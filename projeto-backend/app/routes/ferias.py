from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.ferias import FeriasCreate, FeriasUpdate, FeriasResponse, FeriasConfigUpdate, FeriasStatus
from app.models.enums import UserRole
from app.utils.security import get_current_user, require_admin, get_tenant_filter, get_user_roles
from app.utils.audit import log_action

router = APIRouter()


def _calc_days(start: Optional[str], end: Optional[str]) -> Optional[int]:
    if not start or not end:
        return None
    try:
        d1 = datetime.strptime(start, "%Y-%m-%d")
        d2 = datetime.strptime(end, "%Y-%m-%d")
        return max(0, (d2 - d1).days + 1)
    except ValueError:
        return None


@router.get("", response_model=List[FeriasResponse])
async def list_ferias(
    user_id: Optional[str] = None,
    status: Optional[FeriasStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    tenant_filter = get_tenant_filter(current_user)
    roles = get_user_roles(current_user)

    query = {**tenant_filter}

    # Usuário comum só vê as próprias férias
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles and UserRole.FORMADOR not in roles:
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id

    if status:
        query["status"] = status

    skip = (page - 1) * limit
    ferias_list = await db.ferias.find(query, {"_id": 0}).sort("predicted_start_date", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for f in ferias_list:
        f["duration_days"] = _calc_days(f.get("predicted_start_date"), f.get("predicted_end_date"))
        result.append(f)
    return result


@router.post("", response_model=FeriasResponse)
async def create_ferias(
    data: FeriasCreate,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    # Apenas admin pode criar férias para outro usuário
    target_user_id = data.user_id
    if target_user_id != current_user["id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Você só pode registrar suas próprias férias")

    # Busca nome do usuário alvo
    target_user = await db.users.find_one({"id": target_user_id}, {"full_name": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Verificar limite de dias configurado no tenant
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id})
        max_days = (tenant or {}).get("max_vacation_days", 30) if tenant else 30
        requested = _calc_days(data.predicted_start_date, data.predicted_end_date) or 0
        if requested > max_days:
            raise HTTPException(
                status_code=400,
                detail=f"Férias excedem o limite de {max_days} dias configurado pela organização."
            )

    now = datetime.now(timezone.utc).isoformat()
    ferias_dict = data.model_dump()
    ferias_dict["id"] = str(uuid.uuid4())
    ferias_dict["user_name"] = target_user["full_name"]
    ferias_dict["tenant_id"] = tenant_id
    ferias_dict["created_by_id"] = current_user["id"]
    ferias_dict["created_by_name"] = current_user["full_name"]
    ferias_dict["duration_days"] = _calc_days(data.predicted_start_date, data.predicted_end_date)
    ferias_dict["created_at"] = now
    ferias_dict["updated_at"] = now

    await db.ferias.insert_one(ferias_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "ferias", ferias_dict["id"],
                     {"user": target_user["full_name"]}, tenant_id=tenant_id)
    return ferias_dict


@router.get("/config")
async def get_ferias_config(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return {"max_vacation_days": 30}
    tenant = await db.tenants.find_one({"id": tenant_id})
    return {"max_vacation_days": (tenant or {}).get("max_vacation_days", 30)}


@router.put("/config")
async def update_ferias_config(
    data: FeriasConfigUpdate,
    current_user: dict = Depends(require_admin)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Superadmin não pertence a um tenant específico")
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {"max_vacation_days": data.max_vacation_days, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"max_vacation_days": data.max_vacation_days}


@router.get("/resumo")
async def ferias_resumo(
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retorna resumo de férias (dias usados, saldo, etc.) de um usuário."""
    tenant_id = current_user.get("tenant_id")
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    target_id = user_id if (user_id and is_admin) else current_user["id"]

    tenant = await db.tenants.find_one({"id": tenant_id}) if tenant_id else None
    max_days = (tenant or {}).get("max_vacation_days", 30)

    ferias_list = await db.ferias.find(
        {"user_id": target_id, "status": {"$in": [FeriasStatus.APROVADO, FeriasStatus.CONCLUIDO, FeriasStatus.EM_ANDAMENTO]}},
        {"_id": 0, "predicted_start_date": 1, "predicted_end_date": 1, "actual_start_date": 1, "actual_end_date": 1}
    ).to_list(200)

    used_days = sum(
        _calc_days(f.get("actual_start_date") or f.get("predicted_start_date"),
                   f.get("actual_end_date") or f.get("predicted_end_date")) or 0
        for f in ferias_list
    )

    return {
        "user_id": target_id,
        "max_vacation_days": max_days,
        "used_days": used_days,
        "remaining_days": max(0, max_days - used_days),
        "total_ferias": len(ferias_list)
    }


@router.get("/{ferias_id}", response_model=FeriasResponse)
async def get_ferias(ferias_id: str, current_user: dict = Depends(get_current_user)):
    f = await db.ferias.find_one({"id": ferias_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Férias não encontradas")

    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    if not is_admin and f["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    f["duration_days"] = _calc_days(f.get("predicted_start_date"), f.get("predicted_end_date"))
    return f


@router.put("/{ferias_id}", response_model=FeriasResponse)
async def update_ferias(
    ferias_id: str,
    data: FeriasUpdate,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.ferias.find_one({"id": ferias_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Férias não encontradas")

    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    if not is_admin and existing["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Apenas admin pode mudar o status
    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if "status" in update_dict and not is_admin:
        del update_dict["status"]

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "predicted_start_date" in update_dict or "predicted_end_date" in update_dict:
        start = update_dict.get("predicted_start_date", existing.get("predicted_start_date"))
        end = update_dict.get("predicted_end_date", existing.get("predicted_end_date"))
        update_dict["duration_days"] = _calc_days(start, end)

    await db.ferias.update_one({"id": ferias_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "ferias", ferias_id)

    updated = await db.ferias.find_one({"id": ferias_id}, {"_id": 0})
    updated["duration_days"] = _calc_days(updated.get("predicted_start_date"), updated.get("predicted_end_date"))
    return updated


@router.delete("/{ferias_id}")
async def delete_ferias(ferias_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.ferias.find_one({"id": ferias_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Férias não encontradas")

    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    if not is_admin and existing["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if not is_admin and existing.get("status") not in (FeriasStatus.PENDENTE, FeriasStatus.CANCELADO):
        raise HTTPException(status_code=400, detail="Apenas férias pendentes podem ser removidas pelo usuário")

    await db.ferias.delete_one({"id": ferias_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "ferias", ferias_id)
    return {"message": "Férias removidas com sucesso"}
