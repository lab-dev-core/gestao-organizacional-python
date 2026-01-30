from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models import LocationCreate, LocationUpdate, LocationResponse
from app.models.enums import UserStatus
from app.utils.security import get_current_user, require_admin
from app.utils.audit import log_action

router = APIRouter()


@router.get("", response_model=List[LocationResponse])
async def list_locations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[UserStatus] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if status:
        query["status"] = status

    skip = (page - 1) * limit
    locations = await db.locations.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return locations


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(location_id: str, current_user: dict = Depends(get_current_user)):
    location = await db.locations.find_one({"id": location_id}, {"_id": 0})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("", response_model=LocationResponse)
async def create_location(location_data: LocationCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    location_dict = location_data.model_dump()
    location_dict["id"] = str(uuid.uuid4())
    location_dict["created_at"] = now
    location_dict["updated_at"] = now

    if location_dict.get("address"):
        location_dict["address"] = location_dict["address"] if isinstance(location_dict["address"], dict) else location_dict["address"].model_dump() if hasattr(location_dict["address"], 'model_dump') else dict(location_dict["address"])

    await db.locations.insert_one(location_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "location", location_dict["id"], {"name": location_dict["name"]})

    return location_dict


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(location_id: str, location_data: LocationUpdate, current_user: dict = Depends(require_admin)):
    existing = await db.locations.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")

    update_dict = {k: v for k, v in location_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    if update_dict.get("address"):
        update_dict["address"] = update_dict["address"] if isinstance(update_dict["address"], dict) else update_dict["address"].model_dump() if hasattr(update_dict["address"], 'model_dump') else dict(update_dict["address"])

    await db.locations.update_one({"id": location_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "location", location_id)

    updated = await db.locations.find_one({"id": location_id}, {"_id": 0})
    return updated


@router.delete("/{location_id}")
async def delete_location(location_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.locations.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")

    await db.locations.delete_one({"id": location_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "location", location_id, {"name": existing["name"]})

    return {"message": "Location deleted successfully"}
