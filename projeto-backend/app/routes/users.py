from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import uuid
import shutil

from app.database import db
from app.config import UPLOAD_DIR, ALLOWED_IMAGE_EXTENSIONS
from app.models import UserCreate, UserUpdate, UserResponse
from app.models.enums import UserRole, UserStatus
from app.utils.security import (
    get_current_user, require_admin, hash_password,
    get_tenant_filter, check_tenant_limits
)
from app.utils.audit import log_action


async def record_journey_transition(
    user_id: str,
    from_stage_id: Optional[str],
    to_stage_id: str,
    tenant_id: Optional[str],
    changed_by: dict,
    notes: Optional[str] = None
):
    """Registra uma transição de jornada formativa"""
    now = datetime.now(timezone.utc).isoformat()
    journey_record = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "from_stage_id": from_stage_id,
        "to_stage_id": to_stage_id,
        "notes": notes or "Transição automática via atualização de usuário",
        "changed_by_id": changed_by["id"],
        "changed_by_name": changed_by["full_name"],
        "transition_date": now,
        "created_at": now
    }
    await db.user_journey.insert_one(dict(journey_record))

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    status: Optional[UserStatus] = None,
    location_id: Optional[str] = None,
    function_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Apply tenant filter
    query = get_tenant_filter(current_user)

    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"cpf": {"$regex": search, "$options": "i"}}
        ]
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    if location_id:
        query["location_id"] = location_id
    if function_id:
        query["function_id"] = function_id
    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id

    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password": 0}).skip(skip).limit(limit).to_list(limit)
    return users


@router.get("/formadores", response_model=List[UserResponse])
async def list_formadores(current_user: dict = Depends(get_current_user)):
    """List all users with formador role within the tenant"""
    query = get_tenant_filter(current_user)
    query["role"] = UserRole.FORMADOR
    query["status"] = UserStatus.ACTIVE

    formadores = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    return formadores


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    query = get_tenant_filter(current_user)
    query["id"] = user_id

    user = await db.users.find_one(query, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    tenant_id = current_user.get("tenant_id")

    # Check tenant limits
    if tenant_id:
        await check_tenant_limits(tenant_id, "users")

    # Check email uniqueness within tenant
    query = {"email": user_data.email}
    if tenant_id:
        query["tenant_id"] = tenant_id
    existing = await db.users.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check CPF uniqueness within tenant
    if user_data.cpf:
        cpf_query = {"cpf": user_data.cpf}
        if tenant_id:
            cpf_query["tenant_id"] = tenant_id
        existing_cpf = await db.users.find_one(cpf_query)
        if existing_cpf:
            raise HTTPException(status_code=400, detail="CPF already registered")

    now = datetime.now(timezone.utc).isoformat()
    user_dict = user_data.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["tenant_id"] = tenant_id  # Associate with current user's tenant
    user_dict["password"] = hash_password(user_data.password)
    user_dict["is_tenant_owner"] = False
    user_dict["created_at"] = now
    user_dict["updated_at"] = now

    if user_dict.get("address"):
        user_dict["address"] = user_dict["address"] if isinstance(user_dict["address"], dict) else user_dict["address"].model_dump() if hasattr(user_dict["address"], 'model_dump') else dict(user_dict["address"])

    mongo_doc = dict(user_dict)
    await db.users.insert_one(mongo_doc)

    await log_action(current_user["id"], current_user["full_name"], "create", "user", user_dict["id"], {"created_user": user_dict["full_name"]})

    del user_dict["password"]
    return user_dict


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Superadmin can update anyone, admin can update users in their tenant, users can update themselves
    if current_user["role"] not in [UserRole.ADMIN, UserRole.SUPERADMIN] and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Non-admins cannot change role
    if current_user["role"] not in [UserRole.ADMIN, UserRole.SUPERADMIN] and user_data.role:
        raise HTTPException(status_code=403, detail="Cannot change role")

    # Build query with tenant filter
    query = {"id": user_id}
    if current_user["role"] != UserRole.SUPERADMIN and current_user.get("tenant_id"):
        query["tenant_id"] = current_user["tenant_id"]

    existing = await db.users.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent tenant owners from being demoted by non-superadmins
    if existing.get("is_tenant_owner") and current_user["role"] != UserRole.SUPERADMIN:
        if user_data.role and user_data.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Cannot change role of tenant owner")

    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}

    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])

    if "email" in update_dict and update_dict["email"] != existing["email"]:
        email_query = {"email": update_dict["email"]}
        if existing.get("tenant_id"):
            email_query["tenant_id"] = existing["tenant_id"]
        existing_email = await db.users.find_one(email_query)
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    if update_dict.get("address"):
        update_dict["address"] = update_dict["address"] if isinstance(update_dict["address"], dict) else update_dict["address"].model_dump() if hasattr(update_dict["address"], 'model_dump') else dict(update_dict["address"])

    # Verificar se houve mudança de etapa formativa e registrar na jornada
    new_stage_id = update_dict.get("formative_stage_id")
    old_stage_id = existing.get("formative_stage_id")
    if new_stage_id and new_stage_id != old_stage_id:
        await record_journey_transition(
            user_id=user_id,
            from_stage_id=old_stage_id,
            to_stage_id=new_stage_id,
            tenant_id=existing.get("tenant_id"),
            changed_by=current_user
        )

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.users.update_one({"id": user_id}, {"$set": update_dict})

    await log_action(current_user["id"], current_user["full_name"], "update", "user", user_id)

    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    # Build query with tenant filter
    query = {"id": user_id}
    if current_user["role"] != UserRole.SUPERADMIN and current_user.get("tenant_id"):
        query["tenant_id"] = current_user["tenant_id"]

    existing = await db.users.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Prevent tenant owner deletion by non-superadmins
    if existing.get("is_tenant_owner") and current_user["role"] != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete tenant owner")

    await db.users.delete_one({"id": user_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "user", user_id, {"deleted_user": existing["full_name"]})

    return {"message": "User deleted successfully"}


@router.post("/{user_id}/photo")
async def upload_user_photo(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.SUPERADMIN] and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Verify user exists and belongs to same tenant
    query = {"id": user_id}
    if current_user["role"] != UserRole.SUPERADMIN and current_user.get("tenant_id"):
        query["tenant_id"] = current_user["tenant_id"]

    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / "photos" / f"{file_id}{ext}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    photo_url = f"/api/uploads/photos/{file_id}{ext}"
    await db.users.update_one({"id": user_id}, {"$set": {"photo_url": photo_url, "updated_at": datetime.now(timezone.utc).isoformat()}})

    return {"photo_url": photo_url}
