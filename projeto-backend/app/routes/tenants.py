from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import re

from app.database import db
from app.models import (
    TenantCreate, TenantUpdate, TenantResponse, TenantStatsResponse,
    TenantStatus, TenantPlan, UserRole, UserStatus
)
from app.utils.security import get_current_user, require_superadmin, hash_password
from app.utils.audit import log_action

router = APIRouter()


def validate_slug(slug: str) -> bool:
    """Validate tenant slug - only lowercase letters, numbers and hyphens"""
    return bool(re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', slug)) and len(slug) >= 3


@router.get("", response_model=List[TenantResponse])
async def list_tenants(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[TenantStatus] = None,
    plan: Optional[TenantPlan] = None,
    current_user: dict = Depends(require_superadmin)
):
    """List all tenants (superadmin only)"""
    query = {}

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"slug": {"$regex": search, "$options": "i"}},
            {"contact_email": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan

    skip = (page - 1) * limit
    tenants = await db.tenants.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)

    # Add user count for each tenant
    for tenant in tenants:
        tenant["user_count"] = await db.users.count_documents({"tenant_id": tenant["id"]})

    return tenants


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str, current_user: dict = Depends(require_superadmin)):
    """Get a specific tenant (superadmin only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant["user_count"] = await db.users.count_documents({"tenant_id": tenant_id})
    return tenant


@router.get("/slug/{slug}", response_model=TenantResponse)
async def get_tenant_by_slug(slug: str):
    """Get tenant by slug (public - used for login page)"""
    tenant = await db.tenants.find_one({"slug": slug, "status": TenantStatus.ACTIVE}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Return limited info for public access
    return {
        "id": tenant["id"],
        "name": tenant["name"],
        "slug": tenant["slug"],
        "logo_url": tenant.get("logo_url"),
        "status": tenant["status"],
        "plan": tenant["plan"],
        "max_users": tenant["max_users"],
        "max_storage_gb": tenant["max_storage_gb"],
        "created_at": tenant["created_at"],
        "updated_at": tenant["updated_at"]
    }


@router.post("", response_model=TenantResponse)
async def create_tenant(tenant_data: TenantCreate, current_user: dict = Depends(require_superadmin)):
    """Create a new tenant with its owner (superadmin only)"""

    # Validate slug
    if not validate_slug(tenant_data.slug):
        raise HTTPException(
            status_code=400,
            detail="Invalid slug. Use only lowercase letters, numbers and hyphens. Minimum 3 characters."
        )

    # Check if slug exists
    existing = await db.tenants.find_one({"slug": tenant_data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already in use")

    # Check if owner email exists
    existing_email = await db.users.find_one({"email": tenant_data.owner_email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Owner email already registered")

    now = datetime.now(timezone.utc).isoformat()
    tenant_id = str(uuid.uuid4())

    # Create tenant
    tenant_dict = {
        "id": tenant_id,
        "name": tenant_data.name,
        "slug": tenant_data.slug,
        "plan": tenant_data.plan,
        "max_users": tenant_data.max_users,
        "max_storage_gb": tenant_data.max_storage_gb,
        "status": TenantStatus.ACTIVE,
        "contact_email": tenant_data.contact_email,
        "contact_phone": tenant_data.contact_phone,
        "logo_url": None,
        "settings": {},
        "created_at": now,
        "updated_at": now
    }

    await db.tenants.insert_one(tenant_dict)

    # Create owner user
    owner_dict = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "full_name": tenant_data.owner_name,
        "email": tenant_data.owner_email,
        "password": hash_password(tenant_data.owner_password),
        "role": UserRole.ADMIN,
        "status": UserStatus.ACTIVE,
        "is_tenant_owner": True,
        "created_at": now,
        "updated_at": now
    }

    await db.users.insert_one(owner_dict)

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "create",
        "tenant",
        tenant_id,
        {"name": tenant_data.name, "owner": tenant_data.owner_email}
    )

    tenant_dict["user_count"] = 1
    return tenant_dict


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    tenant_data: TenantUpdate,
    current_user: dict = Depends(require_superadmin)
):
    """Update a tenant (superadmin only)"""
    existing = await db.tenants.find_one({"id": tenant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_dict = {k: v for k, v in tenant_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.tenants.update_one({"id": tenant_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "tenant", tenant_id)

    updated = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    updated["user_count"] = await db.users.count_documents({"tenant_id": tenant_id})
    return updated


@router.delete("/{tenant_id}")
async def delete_tenant(tenant_id: str, current_user: dict = Depends(require_superadmin)):
    """Delete a tenant and all its data (superadmin only)"""
    existing = await db.tenants.find_one({"id": tenant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Delete all tenant data
    await db.users.delete_many({"tenant_id": tenant_id})
    await db.locations.delete_many({"tenant_id": tenant_id})
    await db.functions.delete_many({"tenant_id": tenant_id})
    await db.formative_stages.delete_many({"tenant_id": tenant_id})
    await db.documents.delete_many({"tenant_id": tenant_id})
    await db.videos.delete_many({"tenant_id": tenant_id})
    await db.video_progress.delete_many({"tenant_id": tenant_id})
    await db.acompanhamentos.delete_many({"tenant_id": tenant_id})
    await db.audit_logs.delete_many({"tenant_id": tenant_id})

    # Delete tenant
    await db.tenants.delete_one({"id": tenant_id})

    await log_action(
        current_user["id"],
        current_user["full_name"],
        "delete",
        "tenant",
        tenant_id,
        {"name": existing["name"]}
    )

    return {"message": "Tenant and all related data deleted successfully"}


@router.get("/{tenant_id}/stats", response_model=TenantStatsResponse)
async def get_tenant_stats(tenant_id: str, current_user: dict = Depends(require_superadmin)):
    """Get detailed statistics for a tenant (superadmin only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    user_count = await db.users.count_documents({"tenant_id": tenant_id})
    document_count = await db.documents.count_documents({"tenant_id": tenant_id})
    video_count = await db.videos.count_documents({"tenant_id": tenant_id})

    # Calculate storage (simplified - sum of file sizes)
    docs = await db.documents.find({"tenant_id": tenant_id}, {"file_size": 1}).to_list(10000)
    videos = await db.videos.find({"tenant_id": tenant_id}, {"file_size": 1}).to_list(10000)

    storage_bytes = sum(d.get("file_size", 0) or 0 for d in docs)
    storage_bytes += sum(v.get("file_size", 0) or 0 for v in videos)
    storage_gb = storage_bytes / (1024 ** 3)

    return TenantStatsResponse(
        tenant_id=tenant_id,
        tenant_name=tenant["name"],
        user_count=user_count,
        document_count=document_count,
        video_count=video_count,
        storage_used_gb=round(storage_gb, 2),
        plan=tenant["plan"],
        max_users=tenant["max_users"],
        max_storage_gb=tenant["max_storage_gb"]
    )
