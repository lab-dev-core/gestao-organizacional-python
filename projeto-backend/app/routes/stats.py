from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.database import db
from app.models.enums import UserRole, UserStatus
from app.utils.security import get_current_user, get_tenant_filter

router = APIRouter()


def _roles_filter(role: UserRole) -> dict:
    """Gera filtro compatível com campo antigo 'role' e novo 'roles' lista."""
    return {"$or": [{"role": role}, {"roles": role}]}


@router.get("/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    tenant_filter = get_tenant_filter(current_user)

    user_filter = {**tenant_filter, "deleted_at": None}
    active_filter = {**tenant_filter, "status": UserStatus.ACTIVE, "deleted_at": None}

    total_users = await db.users.count_documents(user_filter)
    active_users = await db.users.count_documents(active_filter)
    total_documents = await db.documents.count_documents(tenant_filter)
    total_videos = await db.videos.count_documents(tenant_filter)
    total_locations = await db.locations.count_documents(tenant_filter)
    total_functions = await db.functions.count_documents(tenant_filter)
    total_stages = await db.formative_stages.count_documents(tenant_filter)

    admins = await db.users.count_documents({**tenant_filter, **_roles_filter(UserRole.ADMIN), "deleted_at": None})
    formadores = await db.users.count_documents({**tenant_filter, **_roles_filter(UserRole.FORMADOR), "deleted_at": None})
    common_users = await db.users.count_documents({**tenant_filter, **_roles_filter(UserRole.USER), "deleted_at": None})

    recent_logs = await db.audit_logs.find(tenant_filter, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)

    # ── Aniversariantes ────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    today_mm_dd = now.strftime("-%m-%d")
    month_mm = now.strftime("-%m-")

    base = {**tenant_filter, "deleted_at": None, "status": UserStatus.ACTIVE}

    # Aniversariantes do dia (nascimento)
    today_birthdays_raw = await db.users.find(
        {**base, "birth_date": {"$regex": f"{today_mm_dd}$"}},
        {"_id": 0, "id": 1, "full_name": 1, "birth_date": 1, "photo_url": 1, "location_id": 1}
    ).to_list(100)

    # Aniversariantes do mês (nascimento)
    month_birthdays_raw = await db.users.find(
        {**base, "birth_date": {"$regex": month_mm}},
        {"_id": 0, "id": 1, "full_name": 1, "birth_date": 1, "photo_url": 1, "location_id": 1}
    ).sort("birth_date", 1).to_list(100)

    # Aniversariantes de consagração do dia (community_entry_date)
    today_consagracao = await db.users.find(
        {**base, "community_entry_date": {"$regex": f"{today_mm_dd}$"}},
        {"_id": 0, "id": 1, "full_name": 1, "community_entry_date": 1, "photo_url": 1}
    ).to_list(100)

    # Aniversariantes de consagração do mês
    month_consagracao = await db.users.find(
        {**base, "community_entry_date": {"$regex": month_mm}},
        {"_id": 0, "id": 1, "full_name": 1, "community_entry_date": 1, "photo_url": 1}
    ).sort("community_entry_date", 1).to_list(100)

    def _enrich_birthday(u: dict, date_field: str) -> dict:
        """Adiciona idade/anos calculados ao registro."""
        date_str = u.get(date_field, "")
        years = None
        if date_str and len(date_str) >= 4:
            try:
                birth_year = int(date_str[:4])
                years = now.year - birth_year
            except ValueError:
                pass
        return {**u, "years": years}

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admins,
            "formadores": formadores,
            "common_users": common_users,
        },
        "content": {
            "documents": total_documents,
            "videos": total_videos,
        },
        "organization": {
            "locations": total_locations,
            "functions": total_functions,
            "formative_stages": total_stages,
        },
        "recent_activity": recent_logs,
        "birthdays": {
            "today": [_enrich_birthday(u, "birth_date") for u in today_birthdays_raw],
            "month": [_enrich_birthday(u, "birth_date") for u in month_birthdays_raw],
        },
        "consagracao": {
            "today": [_enrich_birthday(u, "community_entry_date") for u in today_consagracao],
            "month": [_enrich_birthday(u, "community_entry_date") for u in month_consagracao],
        },
    }
