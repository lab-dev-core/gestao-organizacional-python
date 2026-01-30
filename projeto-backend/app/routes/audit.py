from fastapi import APIRouter, Depends, Query
from typing import List, Optional

from app.database import db
from app.models import AuditLogResponse
from app.utils.security import require_admin, get_tenant_filter

router = APIRouter()


@router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    # Get tenant filter - superadmin sees all, others see only their tenant
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter}

    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type

    skip = (page - 1) * limit
    logs = await db.audit_logs.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return logs
