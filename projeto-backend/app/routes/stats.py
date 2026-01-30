from fastapi import APIRouter, Depends

from app.database import db
from app.models.enums import UserRole, UserStatus
from app.utils.security import get_current_user

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": UserStatus.ACTIVE})
    total_documents = await db.documents.count_documents({})
    total_videos = await db.videos.count_documents({})
    total_locations = await db.locations.count_documents({})
    total_functions = await db.functions.count_documents({})
    total_stages = await db.formative_stages.count_documents({})

    admins = await db.users.count_documents({"role": UserRole.ADMIN})
    formadores = await db.users.count_documents({"role": UserRole.FORMADOR})
    common_users = await db.users.count_documents({"role": UserRole.USER})

    recent_logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admins,
            "formadores": formadores,
            "common_users": common_users
        },
        "content": {
            "documents": total_documents,
            "videos": total_videos
        },
        "organization": {
            "locations": total_locations,
            "functions": total_functions,
            "formative_stages": total_stages
        },
        "recent_activity": recent_logs
    }
