from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementResponse
from app.models.enums import UserRole
from app.utils.security import get_current_user, get_tenant_filter, get_user_roles
from app.utils.audit import log_action

router = APIRouter()


def _is_expired(expires_at: Optional[str]) -> bool:
    """Return True if expires_at is set and is in the past."""
    if not expires_at:
        return False
    try:
        # Support both date-only and full datetime strings
        today = datetime.now(timezone.utc).date()
        exp_date = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).date() \
            if "T" in expires_at or len(expires_at) > 10 \
            else datetime.strptime(expires_at[:10], "%Y-%m-%d").date()
        return exp_date < today
    except (ValueError, AttributeError):
        return False


@router.get("", response_model=List[AnnouncementResponse])
async def list_announcements(
    include_expired: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    tenant_filter = get_tenant_filter(current_user)
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles
    is_privileged = is_admin or is_formador

    query = {**tenant_filter}

    all_announcements = await db.announcements.find(query, {"_id": 0}).to_list(1000)

    result = []
    for ann in all_announcements:
        # Visibility filter by target
        target = ann.get("target", "all")

        if target == "stage":
            # Only users with matching formative_stage_id OR admins/formadores can see it
            user_stage = current_user.get("formative_stage_id")
            ann_stage = ann.get("formative_stage_id")
            if not is_privileged and user_stage != ann_stage:
                continue

        elif target == "role":
            # Only users with matching role OR admins/formadores can see it
            target_role = ann.get("target_role")
            if target_role and not is_privileged:
                user_role_values = [r.value if hasattr(r, "value") else r for r in roles]
                if target_role not in user_role_values:
                    continue

        # Expiry filter
        expired = _is_expired(ann.get("expires_at"))
        if expired:
            if not is_admin:
                # Non-admins never see expired announcements unless explicitly requested
                continue
            elif not include_expired:
                # Admins also hide expired unless they asked for them
                continue

        result.append(ann)

    # Sort: pinned first, then by created_at descending
    result.sort(key=lambda a: (not a.get("pinned", False), a.get("created_at", "")), reverse=False)
    # The above sorts pinned=True first (False < True so we negate pinned),
    # then within same pinned value sort by created_at desc.
    # Re-implement clearly:
    result.sort(
        key=lambda a: (
            0 if a.get("pinned", False) else 1,  # pinned first
            # negate created_at for descending: use negative string won't work, so we'll sort separately
        )
    )
    # Two-pass: stable sort by created_at desc first, then by pinned
    result.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    result.sort(key=lambda a: 0 if a.get("pinned", False) else 1)

    return result


@router.post("", response_model=AnnouncementResponse)
async def create_announcement(
    data: AnnouncementCreate,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles

    if not is_admin and not is_formador:
        raise HTTPException(status_code=403, detail="Admin or Formador access required")

    # Validate target field
    valid_targets = {"all", "stage", "role"}
    if data.target not in valid_targets:
        raise HTTPException(status_code=400, detail=f"target must be one of: {', '.join(valid_targets)}")

    tenant_id = current_user.get("tenant_id")
    now = datetime.now(timezone.utc).isoformat()

    ann_dict = data.model_dump()
    ann_dict["id"] = str(uuid.uuid4())
    ann_dict["tenant_id"] = tenant_id
    ann_dict["created_by_id"] = current_user["id"]
    ann_dict["created_by_name"] = current_user["full_name"]
    ann_dict["created_at"] = now
    ann_dict["updated_at"] = now

    await db.announcements.insert_one(ann_dict)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "announcement", ann_dict["id"],
        {"title": data.title},
        tenant_id=tenant_id
    )
    return ann_dict


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles

    if not is_admin and not is_formador:
        raise HTTPException(status_code=403, detail="Admin or Formador access required")

    tenant_filter = get_tenant_filter(current_user)
    query = {"id": announcement_id, **tenant_filter}
    existing = await db.announcements.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Only creator or admin can edit
    if not is_admin and existing.get("created_by_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator or an admin can edit this announcement")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}

    # Validate target if provided
    if "target" in update_dict and update_dict["target"] not in {"all", "stage", "role"}:
        raise HTTPException(status_code=400, detail="target must be one of: all, stage, role")

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.announcements.update_one({"id": announcement_id}, {"$set": update_dict})
    await log_action(
        current_user["id"], current_user["full_name"],
        "update", "announcement", announcement_id,
        tenant_id=current_user.get("tenant_id")
    )

    updated = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    return updated


@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user)
):
    roles = get_user_roles(current_user)
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles

    tenant_filter = get_tenant_filter(current_user)
    query = {"id": announcement_id, **tenant_filter}
    existing = await db.announcements.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Admin or creator can delete
    if not is_admin and existing.get("created_by_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator or an admin can delete this announcement")

    await db.announcements.delete_one({"id": announcement_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "announcement", announcement_id,
        tenant_id=current_user.get("tenant_id")
    )
    return {"message": "Announcement deleted successfully"}
