from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models import UserJourneyCreate, UserJourneyResponse
from app.utils.security import get_current_user, require_admin, get_tenant_filter
from app.utils.audit import log_action

router = APIRouter()


async def get_stage_name(stage_id: Optional[str]) -> Optional[str]:
    """Helper para buscar o nome da etapa formativa"""
    if not stage_id:
        return None
    stage = await db.formative_stages.find_one({"id": stage_id})
    return stage.get("name") if stage else None


async def enrich_journey_record(record: dict) -> dict:
    """Enriquece o registro com nomes das etapas e do usuário"""
    record["from_stage_name"] = await get_stage_name(record.get("from_stage_id"))
    record["to_stage_name"] = await get_stage_name(record.get("to_stage_id"))

    user = await db.users.find_one({"id": record.get("user_id")})
    record["user_name"] = user.get("full_name") if user else None

    return record


async def enrich_journey_records_batch(records: list) -> list:
    """Enriquece múltiplos registros de jornada em batch para evitar N+1 queries"""
    if not records:
        return []

    # Collect unique IDs
    stage_ids = set()
    user_ids = set()
    for r in records:
        if r.get("from_stage_id"):
            stage_ids.add(r["from_stage_id"])
        if r.get("to_stage_id"):
            stage_ids.add(r["to_stage_id"])
        if r.get("user_id"):
            user_ids.add(r["user_id"])

    # Batch fetch stages
    stages_map = {}
    if stage_ids:
        stages = await db.formative_stages.find({"id": {"$in": list(stage_ids)}}).to_list(len(stage_ids))
        stages_map = {s["id"]: s.get("name") for s in stages}

    # Batch fetch users
    users_map = {}
    if user_ids:
        users = await db.users.find({"id": {"$in": list(user_ids)}}).to_list(len(user_ids))
        users_map = {u["id"]: u.get("full_name") for u in users}

    # Enrich all records
    for r in records:
        r["from_stage_name"] = stages_map.get(r.get("from_stage_id"))
        r["to_stage_name"] = stages_map.get(r.get("to_stage_id"))
        r["user_name"] = users_map.get(r.get("user_id"))

    return records


@router.get("/user/{user_id}", response_model=List[UserJourneyResponse])
async def get_user_journey(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna toda a jornada formativa de um usuário específico.
    Ordenado por data de transição (mais antiga primeiro).
    """
    query = get_tenant_filter(current_user)
    query["user_id"] = user_id

    user_query = get_tenant_filter(current_user)
    user_query["id"] = user_id
    user = await db.users.find_one(user_query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    records = await db.user_journey.find(query, {"_id": 0}).sort("transition_date", 1).to_list(1000)

    return await enrich_journey_records_batch(records)


@router.get("", response_model=List[UserJourneyResponse])
async def list_journey_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Lista todas as transições de jornada do tenant.
    Permite filtrar por usuário ou etapa.
    """
    query = get_tenant_filter(current_user)

    if user_id:
        query["user_id"] = user_id
    if stage_id:
        query["$or"] = [{"from_stage_id": stage_id}, {"to_stage_id": stage_id}]

    skip = (page - 1) * limit
    records = await db.user_journey.find(query, {"_id": 0}).sort("transition_date", -1).skip(skip).limit(limit).to_list(limit)

    return await enrich_journey_records_batch(records)


@router.post("/user/{user_id}", response_model=UserJourneyResponse)
async def create_journey_record(
    user_id: str,
    journey_data: UserJourneyCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Cria manualmente um registro de transição de jornada.
    Também atualiza o formative_stage_id do usuário.
    """
    tenant_id = current_user.get("tenant_id")

    user_query = {"id": user_id}
    if tenant_id:
        user_query["tenant_id"] = tenant_id

    user = await db.users.find_one(user_query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stage_query = {"id": journey_data.to_stage_id}
    if tenant_id:
        stage_query["tenant_id"] = tenant_id

    stage = await db.formative_stages.find_one(stage_query)
    if not stage:
        raise HTTPException(status_code=404, detail="Formative stage not found")

    now = datetime.now(timezone.utc).isoformat()

    journey_record = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "from_stage_id": user.get("formative_stage_id"),
        "to_stage_id": journey_data.to_stage_id,
        "notes": journey_data.notes,
        "changed_by_id": current_user["id"],
        "changed_by_name": current_user["full_name"],
        "transition_date": now,
        "created_at": now
    }

    await db.user_journey.insert_one(dict(journey_record))

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"formative_stage_id": journey_data.to_stage_id, "updated_at": now}}
    )

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "create",
        "user_journey",
        journey_record["id"],
        {
            "user_id": user_id,
            "user_name": user.get("full_name"),
            "from_stage": await get_stage_name(user.get("formative_stage_id")),
            "to_stage": stage.get("name")
        }
    )

    enriched = await enrich_journey_record(journey_record)
    return enriched


@router.get("/stats/by-stage", response_model=dict)
async def get_journey_stats_by_stage(
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna estatísticas de quantos usuários estão em cada etapa formativa.
    Uses aggregation pipeline to avoid N+1 queries.
    """
    tenant_id = current_user.get("tenant_id")

    stage_query = {"tenant_id": tenant_id} if tenant_id else {}
    stages = await db.formative_stages.find(stage_query, {"_id": 0}).sort("order", 1).to_list(100)

    # Batch count users per stage using aggregation
    stage_ids = [s["id"] for s in stages]
    user_base_query = {"tenant_id": tenant_id} if tenant_id else {}

    pipeline = [
        {"$match": {**user_base_query, "formative_stage_id": {"$in": stage_ids}}},
        {"$group": {"_id": "$formative_stage_id", "count": {"$sum": 1}}}
    ]
    counts_result = await db.users.aggregate(pipeline).to_list(len(stage_ids))
    counts_map = {r["_id"]: r["count"] for r in counts_result}

    stats = []
    for stage in stages:
        stats.append({
            "stage_id": stage["id"],
            "stage_name": stage["name"],
            "stage_order": stage.get("order", 0),
            "user_count": counts_map.get(stage["id"], 0),
            "estimated_duration": stage.get("estimated_duration")
        })

    # Contar usuários sem etapa
    no_stage_query = {"$or": [{"formative_stage_id": None}, {"formative_stage_id": ""}]}
    if tenant_id:
        no_stage_query["tenant_id"] = tenant_id

    no_stage_count = await db.users.count_documents(no_stage_query)

    return {
        "stages": stats,
        "users_without_stage": no_stage_count,
        "total_stages": len(stages)
    }


@router.delete("/{record_id}")
async def delete_journey_record(
    record_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Remove um registro de jornada (apenas admin).
    Não reverte a etapa do usuário.
    """
    query = get_tenant_filter(current_user)
    query["id"] = record_id

    record = await db.user_journey.find_one(query)
    if not record:
        raise HTTPException(status_code=404, detail="Journey record not found")

    await db.user_journey.delete_one({"id": record_id})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "delete",
        "user_journey",
        record_id
    )

    return {"message": "Journey record deleted successfully"}
