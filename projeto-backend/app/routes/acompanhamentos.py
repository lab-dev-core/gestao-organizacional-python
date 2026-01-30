from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models import AcompanhamentoCreate, AcompanhamentoUpdate, AcompanhamentoResponse
from app.models.enums import UserRole, UserStatus
from app.utils.security import get_current_user, require_formador
from app.utils.audit import log_action
from app.services.pdf import generate_acompanhamento_pdf

router = APIRouter()


@router.get("/my-formandos")
async def get_my_formandos(current_user: dict = Depends(require_formador)):
    """Get list of users that have this formador as their responsible"""
    formandos = await db.users.find(
        {"formador_id": current_user["id"], "status": UserStatus.ACTIVE},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    return formandos


@router.get("", response_model=List[AcompanhamentoResponse])
async def list_acompanhamentos(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}

    if current_user.get("role") == UserRole.ADMIN:
        pass
    elif current_user.get("role") == UserRole.FORMADOR:
        query["formador_id"] = current_user["id"]
    else:
        query["user_id"] = current_user["id"]

    if user_id and current_user.get("role") in [UserRole.ADMIN, UserRole.FORMADOR]:
        query["user_id"] = user_id

    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id

    skip = (page - 1) * limit
    acompanhamentos = await db.acompanhamentos.find(query, {"_id": 0}).skip(skip).limit(limit).sort("date", -1).to_list(limit)
    return acompanhamentos


@router.get("/count-by-stage")
async def get_acompanhamentos_count_by_stage(current_user: dict = Depends(get_current_user)):
    """Get count of acompanhamentos per formative stage"""
    query = {}

    if current_user.get("role") == UserRole.FORMADOR:
        query["formador_id"] = current_user["id"]
    elif current_user.get("role") == UserRole.USER:
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
    query = {}

    if current_user.get("role") == UserRole.USER:
        query["user_id"] = current_user["id"]
    elif current_user.get("role") == UserRole.FORMADOR:
        query["formador_id"] = current_user["id"]
        if user_id:
            query["user_id"] = user_id
    else:
        if user_id:
            query["user_id"] = user_id

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
    acomp = await db.acompanhamentos.find_one({"id": acomp_id}, {"_id": 0})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    if current_user.get("role") == UserRole.USER:
        if acomp["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.get("role") == UserRole.FORMADOR:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    return acomp


@router.post("", response_model=AcompanhamentoResponse)
async def create_acompanhamento(
    acomp_data: AcompanhamentoCreate,
    current_user: dict = Depends(require_formador)
):
    target_user = await db.users.find_one({"id": acomp_data.user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.get("role") != UserRole.ADMIN:
        if target_user.get("formador_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only create follow-ups for your assigned users")

    now = datetime.now(timezone.utc).isoformat()
    acomp_dict = acomp_data.model_dump()
    acomp_dict["id"] = str(uuid.uuid4())
    acomp_dict["formador_id"] = current_user["id"]
    acomp_dict["formador_name"] = current_user["full_name"]
    acomp_dict["user_name"] = target_user["full_name"]
    acomp_dict["created_at"] = now
    acomp_dict["updated_at"] = now

    if not acomp_dict.get("formative_stage_id"):
        acomp_dict["formative_stage_id"] = target_user.get("formative_stage_id")

    await db.acompanhamentos.insert_one(acomp_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "acompanhamento", acomp_dict["id"], {"user": target_user["full_name"]})

    return acomp_dict


@router.put("/{acomp_id}", response_model=AcompanhamentoResponse)
async def update_acompanhamento(
    acomp_id: str,
    acomp_data: AcompanhamentoUpdate,
    current_user: dict = Depends(require_formador)
):
    existing = await db.acompanhamentos.find_one({"id": acomp_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    if current_user.get("role") != UserRole.ADMIN:
        if existing["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only edit your own follow-ups")

    update_dict = {k: v for k, v in acomp_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.acompanhamentos.update_one({"id": acomp_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "acompanhamento", acomp_id)

    updated = await db.acompanhamentos.find_one({"id": acomp_id}, {"_id": 0})
    return updated


@router.delete("/{acomp_id}")
async def delete_acompanhamento(acomp_id: str, current_user: dict = Depends(require_formador)):
    existing = await db.acompanhamentos.find_one({"id": acomp_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    if current_user.get("role") != UserRole.ADMIN:
        if existing["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own follow-ups")

    await db.acompanhamentos.delete_one({"id": acomp_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "acompanhamento", acomp_id)

    return {"message": "Acompanhamento deleted successfully"}


@router.get("/{acomp_id}/pdf")
async def export_acompanhamento_pdf(acomp_id: str, current_user: dict = Depends(get_current_user)):
    """Export a single acompanhamento as PDF"""
    acomp = await db.acompanhamentos.find_one({"id": acomp_id}, {"_id": 0})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")

    if current_user.get("role") == UserRole.USER:
        if acomp["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.get("role") == UserRole.FORMADOR:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    pdf_buffer = generate_acompanhamento_pdf([acomp], f"Acompanhamento - {acomp['user_name']}")

    filename = f"acompanhamento_{acomp['user_name'].replace(' ', '_')}_{acomp['date']}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
