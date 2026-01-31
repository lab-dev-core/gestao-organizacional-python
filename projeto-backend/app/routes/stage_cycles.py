from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.stage_cycle import (
    StageCycleCreate, StageCycleUpdate, StageCycleResponse, CycleStatus
)
from app.utils.security import get_current_user, require_admin, get_tenant_filter
from app.utils.audit import log_action

router = APIRouter()


async def enrich_cycle(cycle: dict) -> dict:
    """Enriquece o ciclo com dados da etapa e contagem de participantes"""
    # Buscar nome da etapa
    stage = await db.formative_stages.find_one({"id": cycle.get("formative_stage_id")})
    cycle["stage_name"] = stage.get("name") if stage else None

    # Contar participantes
    count = await db.stage_participations.count_documents({"cycle_id": cycle["id"]})
    cycle["participants_count"] = count

    return cycle


@router.get("", response_model=List[StageCycleResponse])
async def list_cycles(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    stage_id: Optional[str] = None,
    status: Optional[CycleStatus] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista todos os ciclos do tenant"""
    query = get_tenant_filter(current_user)

    if stage_id:
        query["formative_stage_id"] = stage_id
    if status:
        query["status"] = status
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    skip = (page - 1) * limit
    cycles = await db.stage_cycles.find(query, {"_id": 0}).sort([
        ("formative_stage_id", 1),
        ("start_date", -1)
    ]).skip(skip).limit(limit).to_list(limit)

    enriched = []
    for cycle in cycles:
        enriched.append(await enrich_cycle(cycle))

    return enriched


@router.get("/by-stage/{stage_id}", response_model=List[StageCycleResponse])
async def list_cycles_by_stage(
    stage_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lista todos os ciclos de uma etapa específica"""
    query = get_tenant_filter(current_user)
    query["formative_stage_id"] = stage_id

    cycles = await db.stage_cycles.find(query, {"_id": 0}).sort("start_date", -1).to_list(100)

    enriched = []
    for cycle in cycles:
        enriched.append(await enrich_cycle(cycle))

    return enriched


@router.get("/active", response_model=List[StageCycleResponse])
async def list_active_cycles(
    current_user: dict = Depends(get_current_user)
):
    """Lista ciclos ativos (planejados ou em andamento)"""
    query = get_tenant_filter(current_user)
    query["status"] = {"$in": [CycleStatus.PLANNED, CycleStatus.IN_PROGRESS]}

    cycles = await db.stage_cycles.find(query, {"_id": 0}).sort("start_date", 1).to_list(100)

    enriched = []
    for cycle in cycles:
        enriched.append(await enrich_cycle(cycle))

    return enriched


@router.get("/{cycle_id}", response_model=StageCycleResponse)
async def get_cycle(
    cycle_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Busca um ciclo específico"""
    query = get_tenant_filter(current_user)
    query["id"] = cycle_id

    cycle = await db.stage_cycles.find_one(query, {"_id": 0})
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    return await enrich_cycle(cycle)


@router.post("", response_model=StageCycleResponse)
async def create_cycle(
    cycle_data: StageCycleCreate,
    current_user: dict = Depends(require_admin)
):
    """Cria um novo ciclo"""
    tenant_id = current_user.get("tenant_id")

    # Verificar se a etapa existe
    stage_query = {"id": cycle_data.formative_stage_id}
    if tenant_id:
        stage_query["tenant_id"] = tenant_id

    stage = await db.formative_stages.find_one(stage_query)
    if not stage:
        raise HTTPException(status_code=404, detail="Formative stage not found")

    now = datetime.now(timezone.utc).isoformat()

    cycle = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        **cycle_data.model_dump(),
        "created_at": now,
        "updated_at": now
    }

    await db.stage_cycles.insert_one(dict(cycle))

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "create",
        "stage_cycle",
        cycle["id"],
        {"name": cycle["name"], "stage": stage.get("name")}
    )

    return await enrich_cycle(cycle)


@router.put("/{cycle_id}", response_model=StageCycleResponse)
async def update_cycle(
    cycle_id: str,
    cycle_data: StageCycleUpdate,
    current_user: dict = Depends(require_admin)
):
    """Atualiza um ciclo"""
    query = get_tenant_filter(current_user)
    query["id"] = cycle_id

    existing = await db.stage_cycles.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Cycle not found")

    update_dict = {k: v for k, v in cycle_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.stage_cycles.update_one({"id": cycle_id}, {"$set": update_dict})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "update",
        "stage_cycle",
        cycle_id
    )

    updated = await db.stage_cycles.find_one({"id": cycle_id}, {"_id": 0})
    return await enrich_cycle(updated)


@router.delete("/{cycle_id}")
async def delete_cycle(
    cycle_id: str,
    current_user: dict = Depends(require_admin)
):
    """Remove um ciclo (apenas se não tiver participantes)"""
    query = get_tenant_filter(current_user)
    query["id"] = cycle_id

    cycle = await db.stage_cycles.find_one(query)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Verificar se tem participantes
    participants = await db.stage_participations.count_documents({"cycle_id": cycle_id})
    if participants > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete cycle with {participants} participants. Remove participants first."
        )

    await db.stage_cycles.delete_one({"id": cycle_id})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "delete",
        "stage_cycle",
        cycle_id
    )

    return {"message": "Cycle deleted successfully"}
