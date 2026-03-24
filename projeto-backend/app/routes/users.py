from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import asyncio
import uuid

from app.database import db
from app.config import UPLOAD_DIR, ALLOWED_IMAGE_EXTENSIONS
from app.models import UserCreate, UserUpdate, UserResponse
from app.models.enums import UserRole, UserStatus
from app.utils.security import (
    get_current_user, require_admin,
    get_tenant_filter, normalize_user_roles, get_user_roles
)
from app.services.user_service import user_service

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    status: Optional[UserStatus] = None,
    location_id: Optional[str] = None,
    function_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_tenant_filter(current_user)
    # Excluir usuários com soft-delete
    query["deleted_at"] = None

    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"cpf": {"$regex": search, "$options": "i"}}
        ]
    if role:
        role_filter = {"$or": [{"roles": role}, {"role": role}]}
        if query.get("$or"):
            query = {"$and": [
                {k: v for k, v in query.items() if k != "$or"},
                {"$or": query["$or"]},
                role_filter
            ]}
        else:
            query.update(role_filter)
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
    for u in users:
        normalize_user_roles(u)
    return users


@router.get("/formadores", response_model=List[UserResponse])
async def list_formadores(current_user: dict = Depends(get_current_user)):
    query = get_tenant_filter(current_user)
    query["$or"] = [{"roles": UserRole.FORMADOR}, {"role": UserRole.FORMADOR}]
    query["status"] = UserStatus.ACTIVE
    query["deleted_at"] = None

    formadores = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    for u in formadores:
        normalize_user_roles(u)
    return formadores


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    query = get_tenant_filter(current_user)
    query["id"] = user_id
    query["deleted_at"] = None

    user = await db.users.find_one(query, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    normalize_user_roles(user)
    return user


@router.post("", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    return await user_service.create_user(user_data, actor=current_user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    return await user_service.update_user(user_id, user_data, actor=current_user)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    """
    Soft-delete: marca deleted_at no usuário em vez de remover o documento.
    Os dados pessoais são anonimizados após 30 dias (LGPD Art. 18).
    Para anonimização imediata, use utils/anonymization.py.
    """
    await user_service.soft_delete_user(user_id, actor=current_user)
    return {"message": "User deleted successfully"}


@router.post("/{user_id}/photo")
async def upload_user_photo(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    current_roles = get_user_roles(current_user)
    is_admin_user = any(r in current_roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN])

    if not is_admin_user and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    query = {"id": user_id, "deleted_at": None}
    if UserRole.SUPERADMIN not in current_roles and current_user.get("tenant_id"):
        query["tenant_id"] = current_user["tenant_id"]

    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não permitido. Use: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Lê o conteúdo antes de qualquer operação I/O para não bloquear
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    # Limite de 5 MB para fotos de perfil
    MAX_PHOTO_SIZE = 5 * 1024 * 1024
    if len(contents) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Foto deve ter no máximo 5 MB")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / "photos" / f"{file_id}{ext}"

    # Escrita assíncrona — não bloqueia o event loop
    await asyncio.to_thread(file_path.write_bytes, contents)

    photo_url = f"/api/uploads/photos/{file_id}{ext}"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"photo_url": photo_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"photo_url": photo_url}
