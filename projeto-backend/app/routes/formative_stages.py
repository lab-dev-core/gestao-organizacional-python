from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models import FormativeStageCreate, FormativeStageUpdate, FormativeStageResponse
from app.utils.security import get_current_user, require_admin
from app.utils.audit import log_action

router = APIRouter()


@router.get("", response_model=List[FormativeStageResponse])
async def list_formative_stages(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    skip = (page - 1) * limit
    stages = await db.formative_stages.find(query, {"_id": 0}).skip(skip).limit(limit).sort("order", 1).to_list(limit)
    return stages


@router.get("/{stage_id}", response_model=FormativeStageResponse)
async def get_formative_stage(stage_id: str, current_user: dict = Depends(get_current_user)):
    stage = await db.formative_stages.find_one({"id": stage_id}, {"_id": 0})
    if not stage:
        raise HTTPException(status_code=404, detail="Formative stage not found")
    return stage


@router.post("", response_model=FormativeStageResponse)
async def create_formative_stage(stage_data: FormativeStageCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    stage_dict = stage_data.model_dump()
    stage_dict["id"] = str(uuid.uuid4())
    stage_dict["created_at"] = now
    stage_dict["updated_at"] = now

    await db.formative_stages.insert_one(stage_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "formative_stage", stage_dict["id"], {"name": stage_dict["name"]})

    return stage_dict


@router.put("/{stage_id}", response_model=FormativeStageResponse)
async def update_formative_stage(stage_id: str, stage_data: FormativeStageUpdate, current_user: dict = Depends(require_admin)):
    existing = await db.formative_stages.find_one({"id": stage_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Formative stage not found")

    update_dict = {k: v for k, v in stage_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.formative_stages.update_one({"id": stage_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "formative_stage", stage_id)

    updated = await db.formative_stages.find_one({"id": stage_id}, {"_id": 0})
    return updated


@router.delete("/{stage_id}")
async def delete_formative_stage(stage_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.formative_stages.find_one({"id": stage_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Formative stage not found")

    await db.formative_stages.delete_one({"id": stage_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "formative_stage", stage_id, {"name": existing["name"]})

    return {"message": "Formative stage deleted successfully"}
