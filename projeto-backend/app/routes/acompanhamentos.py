from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import os
import shutil

from app.database import db
from app.models import AcompanhamentoCreate, AcompanhamentoUpdate, AcompanhamentoResponse
from app.models.enums import UserRole, UserStatus, AcompanhamentoStatus
from app.utils.security import get_current_user, require_formador, get_tenant_filter
from app.utils.audit import log_action
from app.services.pdf import generate_acompanhamento_pdf
from app.config import UPLOAD_DIR, ALLOWED_ATTACHMENT_EXTENSIONS

router = APIRouter()


@router.get("/my-formandos")
async def get_my_formandos(current_user: dict = Depends(require_formador)):
    """Get list of users that have this formador as their responsible"""
    tenant_filter = get_tenant_filter(current_user)
    formandos = await db.users.find(
        {**tenant_filter, "formador_id": current_user["id"], "status": UserStatus.ACTIVE},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    return formandos


@router.get("/formador-overview")
async def get_formador_overview(
    days_threshold: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(require_formador)
):
    """
    Dashboard do formador: formandos com último acompanhamento, agendados
    e atenção necessária (sem acompanhamento nos últimos X dias).
    """
    tenant_filter = get_tenant_filter(current_user)
    roles = current_user.get("roles", [])
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    # Formandos sob responsabilidade
    formandos_query = {**tenant_filter, "status": UserStatus.ACTIVE}
    if not is_admin:
        formandos_query["formador_id"] = current_user["id"]

    formandos = await db.users.find(
        formandos_query,
        {"_id": 0, "id": 1, "full_name": 1, "formative_stage_id": 1, "formador_id": 1}
    ).to_list(1000)

    if not formandos:
        return {"formandos": [], "upcoming": [], "attention": [], "scheduled_today": []}

    formando_ids = [f["id"] for f in formandos]

    # Buscar todos acompanhamentos dos formandos em batch
    acomp_query = {**tenant_filter, "user_id": {"$in": formando_ids}}
    if not is_admin:
        acomp_query["formador_id"] = current_user["id"]

    all_acomps = await db.acompanhamentos.find(
        acomp_query,
        {"_id": 0, "id": 1, "user_id": 1, "user_name": 1, "date": 1, "time": 1,
         "location": 1, "status": 1, "next_acompanhamento_date": 1, "formative_stage_id": 1}
    ).sort("date", -1).to_list(10000)

    # Buscar nomes das etapas em batch
    stage_ids = list({f.get("formative_stage_id") for f in formandos if f.get("formative_stage_id")})
    stages_map = {}
    if stage_ids:
        stages = await db.formative_stages.find(
            {"id": {"$in": stage_ids}}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(len(stage_ids))
        stages_map = {s["id"]: s["name"] for s in stages}

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    threshold_date = (now - timedelta(days=days_threshold)).strftime("%Y-%m-%d")
    week_end = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    # Indexar último acompanhamento realizado por formando
    last_by_user: dict = {}
    for ac in all_acomps:
        uid = ac["user_id"]
        status = ac.get("status", AcompanhamentoStatus.REALIZADO)
        if status == AcompanhamentoStatus.REALIZADO or status == "realizado":
            if uid not in last_by_user or ac["date"] > last_by_user[uid]["date"]:
                last_by_user[uid] = ac

    # Acompanhamentos agendados: hoje e próximos 7 dias
    upcoming = []
    scheduled_today = []
    for ac in all_acomps:
        status = ac.get("status", "")
        if status in (AcompanhamentoStatus.AGENDADO, "agendado"):
            if ac["date"] == today_str:
                scheduled_today.append(ac)
            elif today_str < ac["date"] <= week_end:
                upcoming.append(ac)

    # Montar lista de formandos com info de último acompanhamento
    formandos_info = []
    attention = []
    for f in formandos:
        fid = f["id"]
        last = last_by_user.get(fid)
        last_date = last["date"] if last else None
        days_since = None
        if last_date:
            try:
                ld = datetime.strptime(last_date, "%Y-%m-%d")
                days_since = (now.replace(tzinfo=None) - ld).days
            except ValueError:
                pass

        entry = {
            "id": fid,
            "full_name": f["full_name"],
            "formative_stage_id": f.get("formative_stage_id"),
            "stage_name": stages_map.get(f.get("formative_stage_id", ""), ""),
            "last_acompanhamento_date": last_date,
            "days_since_last": days_since,
            "needs_attention": last_date is None or last_date < threshold_date,
        }
        formandos_info.append(entry)
        if entry["needs_attention"]:
            attention.append(entry)

    # Ordenar: atenção primeiro, depois por dias sem acompanhamento (desc)
    formandos_info.sort(key=lambda x: (not x["needs_attention"], -(x["days_since_last"] or 9999)))

    return {
        "formandos": formandos_info,
        "upcoming": sorted(upcoming, key=lambda x: (x["date"], x.get("time", ""))),
        "scheduled_today": sorted(scheduled_today, key=lambda x: x.get("time", "")),
        "attention": attention,
        "days_threshold": days_threshold,
    }


@router.get("", response_model=List[AcompanhamentoResponse])
async def list_acompanhamentos(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    user_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Get tenant filter - superadmin sees all, others see only their tenant
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter}

    roles = current_user.get("roles", [])
    if UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles:
        pass  # Admin/Superadmin sees all within tenant (filter already applied)
    elif UserRole.FORMADOR in roles:
        query["formador_id"] = current_user["id"]
    else:
        query["user_id"] = current_user["id"]

    if user_id and any(r in roles for r in [UserRole.ADMIN, UserRole.FORMADOR, UserRole.SUPERADMIN]):
        query["user_id"] = user_id

    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id

    skip = (page - 1) * limit
    acompanhamentos = await db.acompanhamentos.find(query, {"_id": 0}).skip(skip).limit(limit).sort("date", -1).to_list(limit)
    return acompanhamentos


@router.get("/count-by-stage")
async def get_acompanhamentos_count_by_stage(current_user: dict = Depends(get_current_user)):
    """Get count of acompanhamentos per formative stage"""
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter}

    roles = current_user.get("roles", [])
    if UserRole.FORMADOR in roles:
        query["formador_id"] = current_user["id"]
    elif UserRole.USER in roles and UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        query["user_id"] = current_user["id"]

    acompanhamentos = await db.acompanhamentos.find(query, {"formative_stage_id": 1}).to_list(10000)

    counts = {}
    for acomp in acompanhamentos:
        stage_id = acomp.get("formative_stage_id")
        if stage_id:
            counts[stage_id] = counts.get(stage_id, 0) + 1

    return counts


@router.get("/export/pdf")
async def export_acompanhamentos_pdf(
    user_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export multiple acompanhamentos as PDF"""
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter}

    roles = current_user.get("roles", [])
    if UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles:
        if user_id:
            query["user_id"] = user_id
    elif UserRole.FORMADOR in roles:
        query["formador_id"] = current_user["id"]
        if user_id:
            query["user_id"] = user_id
    else:
        query["user_id"] = current_user["id"]

    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id

    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        if date_query:
            query["date"] = date_query

    acompanhamentos = await db.acompanhamentos.find(query, {"_id": 0}).sort("date", -1).to_list(1000)

    if not acompanhamentos:
        raise HTTPException(status_code=404, detail="Nenhum acompanhamento encontrado")

    title = "Relatório de Acompanhamentos"
    if user_id and acompanhamentos:
        title = f"Acompanhamentos - {acompanhamentos[0]['user_name']}"

    pdf_buffer = generate_acompanhamento_pdf(acompanhamentos, title)

    filename = f"acompanhamentos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{acomp_id}", response_model=AcompanhamentoResponse)
async def get_acompanhamento(acomp_id: str, current_user: dict = Depends(get_current_user)):
    tenant_filter = get_tenant_filter(current_user)
    acomp = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id}, {"_id": 0})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    roles = current_user.get("roles", [])
    if UserRole.FORMADOR in roles and UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif UserRole.USER in roles and UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles and UserRole.FORMADOR not in roles:
        if acomp["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    await log_action(
        current_user["id"], current_user["full_name"],
        "view", "acompanhamento", acomp_id,
        {"user": acomp.get("user_name")},
        current_user.get("tenant_id")
    )

    return acomp


@router.post("", response_model=AcompanhamentoResponse)
async def create_acompanhamento(
    acomp_data: AcompanhamentoCreate,
    current_user: dict = Depends(require_formador)
):
    tenant_filter = get_tenant_filter(current_user)
    target_user = await db.users.find_one({**tenant_filter, "id": acomp_data.user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    roles = current_user.get("roles", [])
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if target_user.get("formador_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only create follow-ups for your assigned users")

    now = datetime.now(timezone.utc).isoformat()
    acomp_dict = acomp_data.model_dump()
    acomp_dict["id"] = str(uuid.uuid4())
    acomp_dict["tenant_id"] = current_user.get("tenant_id")
    acomp_dict["formador_id"] = current_user["id"]
    acomp_dict["formador_name"] = current_user["full_name"]
    acomp_dict["user_name"] = target_user["full_name"]
    acomp_dict["created_at"] = now
    acomp_dict["updated_at"] = now

    if not acomp_dict.get("formative_stage_id"):
        acomp_dict["formative_stage_id"] = target_user.get("formative_stage_id")

    await db.acompanhamentos.insert_one(acomp_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "acompanhamento", acomp_dict["id"], {"user": target_user["full_name"]}, current_user.get("tenant_id"))

    return acomp_dict


@router.put("/{acomp_id}", response_model=AcompanhamentoResponse)
async def update_acompanhamento(
    acomp_id: str,
    acomp_data: AcompanhamentoUpdate,
    current_user: dict = Depends(require_formador)
):
    tenant_filter = get_tenant_filter(current_user)
    existing = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    roles = current_user.get("roles", [])
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if existing["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only edit your own follow-ups")

    update_dict = {k: v for k, v in acomp_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.acompanhamentos.update_one({**tenant_filter, "id": acomp_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "acompanhamento", acomp_id, None, current_user.get("tenant_id"))

    updated = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id}, {"_id": 0})
    return updated


@router.delete("/{acomp_id}")
async def delete_acompanhamento(acomp_id: str, current_user: dict = Depends(require_formador)):
    tenant_filter = get_tenant_filter(current_user)
    existing = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    roles = current_user.get("roles", [])
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if existing["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own follow-ups")

    await db.acompanhamentos.delete_one({**tenant_filter, "id": acomp_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "acompanhamento", acomp_id, None, current_user.get("tenant_id"))

    return {"message": "Acompanhamento deleted successfully"}


@router.get("/{acomp_id}/pdf")
async def export_acompanhamento_pdf(acomp_id: str, current_user: dict = Depends(get_current_user)):
    """Export a single acompanhamento as PDF"""
    tenant_filter = get_tenant_filter(current_user)
    acomp = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id}, {"_id": 0})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    roles = current_user.get("roles", [])
    if UserRole.FORMADOR in roles and UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif UserRole.USER in roles and UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles and UserRole.FORMADOR not in roles:
        if acomp["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    pdf_buffer = generate_acompanhamento_pdf([acomp], f"Acompanhamento - {acomp['user_name']}")

    filename = f"acompanhamento_{acomp['user_name'].replace(' ', '_')}_{acomp['date']}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{acomp_id}/attachments")
async def upload_acompanhamento_attachment(
    acomp_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_formador)
):
    """Upload an attachment to an acompanhamento"""
    tenant_filter = get_tenant_filter(current_user)
    acomp = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    roles = current_user.get("roles", [])
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_ATTACHMENT_EXTENSIONS)}"
        )

    file_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / "acompanhamentos" / f"{file_id}{ext}"
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = save_path.stat().st_size
    now = datetime.now(timezone.utc).isoformat()

    attachment = {
        "file_name": file.filename,
        "file_url": f"/uploads/acompanhamentos/{file_id}{ext}",
        "file_size": file_size,
        "file_type": ext.lstrip("."),
        "uploaded_at": now
    }

    await db.acompanhamentos.update_one(
        {"id": acomp_id},
        {"$push": {"attachments": attachment}, "$set": {"updated_at": now}}
    )

    return attachment


@router.delete("/{acomp_id}/attachments/{file_name}")
async def delete_acompanhamento_attachment(
    acomp_id: str,
    file_name: str,
    current_user: dict = Depends(require_formador)
):
    """Remove an attachment from an acompanhamento"""
    tenant_filter = get_tenant_filter(current_user)
    acomp = await db.acompanhamentos.find_one({**tenant_filter, "id": acomp_id})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    roles = current_user.get("roles", [])
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc).isoformat()
    await db.acompanhamentos.update_one(
        {"id": acomp_id},
        {"$pull": {"attachments": {"file_name": file_name}}, "$set": {"updated_at": now}}
    )

    return {"message": "Attachment removed"}


@router.get("/attachments/{file_id}")
async def serve_acompanhamento_attachment(file_id: str, current_user: dict = Depends(get_current_user)):
    """Serve an acompanhamento attachment file"""
    import mimetypes
    from fastapi.responses import FileResponse
    # file_id includes extension
    file_path = UPLOAD_DIR / "acompanhamentos" / file_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(str(file_path), media_type=mime_type or "application/octet-stream")
