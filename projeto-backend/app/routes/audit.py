from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import List, Optional
import io
import csv

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
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
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
    if search:
        query["$or"] = [
            {"user_name": {"$regex": search, "$options": "i"}},
            {"resource_type": {"$regex": search, "$options": "i"}},
            {"action": {"$regex": search, "$options": "i"}}
        ]
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        if date_query:
            query["created_at"] = date_query

    skip = (page - 1) * limit
    logs = await db.audit_logs.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return logs


@router.get("/count")
async def get_audit_log_count(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Retorna a contagem total de logs com os filtros aplicados"""
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter}

    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        if date_query:
            query["created_at"] = date_query

    total = await db.audit_logs.count_documents(query)
    return {"total": total}


@router.get("/actions")
async def get_distinct_actions(current_user: dict = Depends(require_admin)):
    """Lista todas as ações distintas registradas"""
    actions = await db.audit_logs.distinct("action")
    return sorted([a for a in actions if a])


@router.get("/resource-types")
async def get_distinct_resource_types(current_user: dict = Depends(require_admin)):
    """Lista todos os tipos de recurso distintos"""
    types = await db.audit_logs.distinct("resource_type")
    return sorted([t for t in types if t])


@router.get("/summary")
async def get_audit_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Resumo da auditoria: contagem por ação, por recurso, por usuário.
    Útil para dashboard de auditoria.
    """
    tenant_filter = get_tenant_filter(current_user)
    match_query = {**tenant_filter}

    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        if date_query:
            match_query["created_at"] = date_query

    # Contagem por ação
    by_action = await db.audit_logs.aggregate([
        {"$match": match_query},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)

    # Contagem por tipo de recurso
    by_resource = await db.audit_logs.aggregate([
        {"$match": match_query},
        {"$group": {"_id": "$resource_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)

    # Top usuários mais ativos
    by_user = await db.audit_logs.aggregate([
        {"$match": match_query},
        {"$group": {"_id": {"user_id": "$user_id", "user_name": "$user_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]).to_list(20)

    # Downloads de documentos
    download_query = {**match_query, "action": "download"}
    total_downloads = await db.audit_logs.count_documents(download_query)

    # Visualizações
    view_query = {**match_query, "action": "view"}
    total_views = await db.audit_logs.count_documents(view_query)

    # Total geral
    total = await db.audit_logs.count_documents(match_query)

    return {
        "total_logs": total,
        "total_downloads": total_downloads,
        "total_views": total_views,
        "by_action": [{"action": item["_id"], "count": item["count"]} for item in by_action],
        "by_resource_type": [{"resource_type": item["_id"], "count": item["count"]} for item in by_resource],
        "top_users": [
            {
                "user_id": item["_id"]["user_id"],
                "user_name": item["_id"]["user_name"],
                "count": item["count"]
            }
            for item in by_user
        ]
    }


@router.get("/export/csv")
async def export_audit_logs_csv(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Exporta logs de auditoria como CSV"""
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter}

    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        if date_query:
            query["created_at"] = date_query

    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Data", "Usuário", "Ação", "Tipo de Recurso", "ID do Recurso", "Detalhes"])

    for log in logs:
        details_str = ""
        if log.get("details"):
            details_str = str(log["details"])
        writer.writerow([
            log.get("created_at", ""),
            log.get("user_name", ""),
            log.get("action", ""),
            log.get("resource_type", ""),
            log.get("resource_id", ""),
            details_str
        ])

    output.seek(0)
    buffer = io.BytesIO(output.getvalue().encode("utf-8-sig"))

    filename = f"audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/user/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin)
):
    """Lista atividade de um usuário específico"""
    tenant_filter = get_tenant_filter(current_user)
    query = {**tenant_filter, "user_id": user_id}

    skip = (page - 1) * limit
    logs = await db.audit_logs.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)

    total = await db.audit_logs.count_documents(query)

    # Resumo de atividade
    activity_summary = await db.audit_logs.aggregate([
        {"$match": query},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(50)

    return {
        "user_id": user_id,
        "total_actions": total,
        "activity_summary": [{"action": item["_id"], "count": item["count"]} for item in activity_summary],
        "recent_logs": logs
    }
