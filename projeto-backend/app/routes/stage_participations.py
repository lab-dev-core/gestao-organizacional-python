from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.stage_participation import (
    StageParticipationCreate, StageParticipationUpdate,
    StageParticipationResponse, ParticipationStatus, UserJourneyFullResponse
)
from app.utils.security import get_current_user, require_admin, get_tenant_filter
from app.utils.audit import log_action

router = APIRouter()


async def enrich_participation(participation: dict) -> dict:
    """Enriquece a participação com dados do usuário, ciclo e etapa"""
    user = await db.users.find_one({"id": participation.get("user_id")})
    if user:
        participation["user_name"] = user.get("full_name")
        participation["user_email"] = user.get("email")
        participation["user_photo_url"] = user.get("photo_url")

    cycle = await db.stage_cycles.find_one({"id": participation.get("cycle_id")})
    if cycle:
        participation["cycle_name"] = cycle.get("name")
        participation["stage_id"] = cycle.get("formative_stage_id")

        stage = await db.formative_stages.find_one({"id": cycle.get("formative_stage_id")})
        if stage:
            participation["stage_name"] = stage.get("name")
            participation["stage_order"] = stage.get("order")

    return participation


async def enrich_participations_batch(participations: list) -> list:
    """Enriquece múltiplas participações em batch para evitar N+1 queries"""
    if not participations:
        return []

    # Collect unique IDs
    user_ids = list({p.get("user_id") for p in participations if p.get("user_id")})
    cycle_ids = list({p.get("cycle_id") for p in participations if p.get("cycle_id")})

    # Batch fetch users
    users_map = {}
    if user_ids:
        users = await db.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids))
        users_map = {u["id"]: u for u in users}

    # Batch fetch cycles
    cycles_map = {}
    if cycle_ids:
        cycles = await db.stage_cycles.find({"id": {"$in": cycle_ids}}).to_list(len(cycle_ids))
        cycles_map = {c["id"]: c for c in cycles}

    # Batch fetch stages referenced by cycles
    stage_ids = list({c.get("formative_stage_id") for c in cycles_map.values() if c.get("formative_stage_id")})
    stages_map = {}
    if stage_ids:
        stages = await db.formative_stages.find({"id": {"$in": stage_ids}}).to_list(len(stage_ids))
        stages_map = {s["id"]: s for s in stages}

    # Enrich all participations using maps
    for p in participations:
        user = users_map.get(p.get("user_id"))
        if user:
            p["user_name"] = user.get("full_name")
            p["user_email"] = user.get("email")
            p["user_photo_url"] = user.get("photo_url")

        cycle = cycles_map.get(p.get("cycle_id"))
        if cycle:
            p["cycle_name"] = cycle.get("name")
            p["stage_id"] = cycle.get("formative_stage_id")

            stage = stages_map.get(cycle.get("formative_stage_id"))
            if stage:
                p["stage_name"] = stage.get("name")
                p["stage_order"] = stage.get("order")

    return participations


@router.get("", response_model=List[StageParticipationResponse])
async def list_participations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    cycle_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[ParticipationStatus] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista participações com filtros"""
    query = get_tenant_filter(current_user)

    if cycle_id:
        query["cycle_id"] = cycle_id
    if user_id:
        query["user_id"] = user_id
    if status:
        query["status"] = status

    skip = (page - 1) * limit
    participations = await db.stage_participations.find(query, {"_id": 0}).sort(
        "enrollment_date", -1
    ).skip(skip).limit(limit).to_list(limit)

    return await enrich_participations_batch(participations)


@router.get("/cycle/{cycle_id}", response_model=List[StageParticipationResponse])
async def list_cycle_participants(
    cycle_id: str,
    status: Optional[ParticipationStatus] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista todos os participantes de um ciclo"""
    query = get_tenant_filter(current_user)
    query["cycle_id"] = cycle_id

    if status:
        query["status"] = status

    participations = await db.stage_participations.find(query, {"_id": 0}).sort(
        "enrollment_date", 1
    ).to_list(500)

    return await enrich_participations_batch(participations)


@router.get("/user/{user_id}/journey", response_model=UserJourneyFullResponse)
async def get_user_full_journey(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retorna a jornada completa de um usuário com todas as participações"""
    user_query = get_tenant_filter(current_user)
    user_query["id"] = user_id

    user = await db.users.find_one(user_query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    part_query = get_tenant_filter(current_user)
    part_query["user_id"] = user_id

    participations = await db.stage_participations.find(part_query, {"_id": 0}).to_list(100)

    enriched_participations = await enrich_participations_batch(participations)

    # Ordenar por ordem da etapa e data
    enriched_participations.sort(key=lambda x: (x.get("stage_order", 0), x.get("enrollment_date", "")))

    # Calcular estatísticas
    completed_stages = set()
    current_stage = None
    current_cycle = None

    for p in enriched_participations:
        if p.get("status") == ParticipationStatus.APPROVED:
            completed_stages.add(p.get("stage_id"))
        if p.get("status") in [ParticipationStatus.ENROLLED, ParticipationStatus.IN_PROGRESS]:
            current_stage = p.get("stage_name")
            current_cycle = p.get("cycle_name")

    tenant_id = current_user.get("tenant_id")
    stage_query = {"tenant_id": tenant_id} if tenant_id else {}
    total_stages = await db.formative_stages.count_documents(stage_query)

    progress = int((len(completed_stages) / total_stages) * 100) if total_stages > 0 else 0

    return UserJourneyFullResponse(
        user_id=user_id,
        user_name=user.get("full_name"),
        user_email=user.get("email"),
        current_stage=current_stage,
        current_cycle=current_cycle,
        participations=enriched_participations,
        total_stages_completed=len(completed_stages),
        journey_progress_percent=progress
    )


@router.get("/{participation_id}", response_model=StageParticipationResponse)
async def get_participation(
    participation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Busca uma participação específica"""
    query = get_tenant_filter(current_user)
    query["id"] = participation_id

    participation = await db.stage_participations.find_one(query, {"_id": 0})
    if not participation:
        raise HTTPException(status_code=404, detail="Participation not found")

    return await enrich_participation(participation)


@router.post("", response_model=StageParticipationResponse)
async def create_participation(
    data: StageParticipationCreate,
    current_user: dict = Depends(require_admin)
):
    """Inscreve um usuário em um ciclo"""
    tenant_id = current_user.get("tenant_id")

    user_query = {"id": data.user_id}
    if tenant_id:
        user_query["tenant_id"] = tenant_id

    user = await db.users.find_one(user_query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cycle_query = {"id": data.cycle_id}
    if tenant_id:
        cycle_query["tenant_id"] = tenant_id

    cycle = await db.stage_cycles.find_one(cycle_query)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    existing = await db.stage_participations.find_one({
        "user_id": data.user_id,
        "cycle_id": data.cycle_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already enrolled in this cycle")

    if cycle.get("max_participants"):
        current_count = await db.stage_participations.count_documents({"cycle_id": data.cycle_id})
        if current_count >= cycle["max_participants"]:
            raise HTTPException(status_code=400, detail="Cycle is full")

    now = datetime.now(timezone.utc).isoformat()

    participation = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "user_id": data.user_id,
        "cycle_id": data.cycle_id,
        "enrollment_date": data.enrollment_date or now,
        "status": ParticipationStatus.ENROLLED,
        "completion_date": None,
        "notes": data.notes,
        "evaluation_notes": None,
        "approved_by_id": None,
        "approved_by_name": None,
        "created_at": now,
        "updated_at": now
    }

    await db.stage_participations.insert_one(dict(participation))

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "create",
        "stage_participation",
        participation["id"],
        {
            "user": user.get("full_name"),
            "cycle": cycle.get("name")
        }
    )

    return await enrich_participation(participation)


@router.put("/{participation_id}", response_model=StageParticipationResponse)
async def update_participation(
    participation_id: str,
    data: StageParticipationUpdate,
    current_user: dict = Depends(require_admin)
):
    """Atualiza uma participação (status, notas, etc)"""
    query = get_tenant_filter(current_user)
    query["id"] = participation_id

    existing = await db.stage_participations.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Participation not found")

    now = datetime.now(timezone.utc).isoformat()
    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict["updated_at"] = now

    if data.status in [ParticipationStatus.APPROVED, ParticipationStatus.REPROVED]:
        update_dict["approved_by_id"] = current_user["id"]
        update_dict["approved_by_name"] = current_user["full_name"]
        if not data.completion_date:
            update_dict["completion_date"] = now

    await db.stage_participations.update_one({"id": participation_id}, {"$set": update_dict})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "update",
        "stage_participation",
        participation_id,
        {"new_status": data.status} if data.status else {}
    )

    updated = await db.stage_participations.find_one({"id": participation_id}, {"_id": 0})
    return await enrich_participation(updated)


@router.post("/{participation_id}/approve", response_model=StageParticipationResponse)
async def approve_participation(
    participation_id: str,
    evaluation_notes: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Aprova um participante no ciclo"""
    query = get_tenant_filter(current_user)
    query["id"] = participation_id

    existing = await db.stage_participations.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Participation not found")

    now = datetime.now(timezone.utc).isoformat()

    update_dict = {
        "status": ParticipationStatus.APPROVED,
        "completion_date": now,
        "approved_by_id": current_user["id"],
        "approved_by_name": current_user["full_name"],
        "updated_at": now
    }

    if evaluation_notes:
        update_dict["evaluation_notes"] = evaluation_notes

    await db.stage_participations.update_one({"id": participation_id}, {"$set": update_dict})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "approve",
        "stage_participation",
        participation_id
    )

    updated = await db.stage_participations.find_one({"id": participation_id}, {"_id": 0})
    return await enrich_participation(updated)


@router.post("/{participation_id}/reprove", response_model=StageParticipationResponse)
async def reprove_participation(
    participation_id: str,
    evaluation_notes: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Reprova um participante no ciclo"""
    query = get_tenant_filter(current_user)
    query["id"] = participation_id

    existing = await db.stage_participations.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Participation not found")

    now = datetime.now(timezone.utc).isoformat()

    update_dict = {
        "status": ParticipationStatus.REPROVED,
        "completion_date": now,
        "approved_by_id": current_user["id"],
        "approved_by_name": current_user["full_name"],
        "updated_at": now
    }

    if evaluation_notes:
        update_dict["evaluation_notes"] = evaluation_notes

    await db.stage_participations.update_one({"id": participation_id}, {"$set": update_dict})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "reprove",
        "stage_participation",
        participation_id
    )

    updated = await db.stage_participations.find_one({"id": participation_id}, {"_id": 0})
    return await enrich_participation(updated)


@router.delete("/{participation_id}")
async def delete_participation(
    participation_id: str,
    current_user: dict = Depends(require_admin)
):
    """Remove uma participação"""
    query = get_tenant_filter(current_user)
    query["id"] = participation_id

    participation = await db.stage_participations.find_one(query)
    if not participation:
        raise HTTPException(status_code=404, detail="Participation not found")

    await db.stage_participations.delete_one({"id": participation_id})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "delete",
        "stage_participation",
        participation_id
    )

    return {"message": "Participation deleted successfully"}


@router.get("/stats/overview", response_model=dict)
async def get_participation_stats(
    current_user: dict = Depends(get_current_user)
):
    """Estatísticas gerais de participação"""
    tenant_id = current_user.get("tenant_id")
    base_query = {"tenant_id": tenant_id} if tenant_id else {}

    stats_by_status = {}
    for status in ParticipationStatus:
        query = {**base_query, "status": status}
        count = await db.stage_participations.count_documents(query)
        stats_by_status[status.value] = count

    pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    result = await db.stage_participations.aggregate(pipeline).to_list(1)
    unique_users = result[0]["total"] if result else 0

    active_cycles = await db.stage_cycles.count_documents({
        **base_query,
        "status": {"$in": ["planned", "in_progress"]}
    })

    return {
        "by_status": stats_by_status,
        "unique_users_in_journey": unique_users,
        "active_cycles": active_cycles,
        "total_participations": sum(stats_by_status.values())
    }
