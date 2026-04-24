from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query

from app.database import db
from app.models.enums import UserRole, UserStatus, AcompanhamentoStatus
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


@router.get("/alerts")
async def get_alerts(
    days_threshold: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna alertas contextuais para o usuário:
    - Formandos sem acompanhamento há X dias (formadores/admins)
    - Acompanhamentos agendados para hoje e próximos 7 dias
    - Aniversários de entrada na comunidade nos próximos 7 dias
    - Aniversários de nascimento nos próximos 7 dias
    """
    tenant_filter = get_tenant_filter(current_user)
    roles = current_user.get("roles", [])
    is_admin = UserRole.ADMIN in roles or UserRole.SUPERADMIN in roles
    is_formador = UserRole.FORMADOR in roles

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    threshold_date = (now - timedelta(days=days_threshold)).strftime("%Y-%m-%d")
    week_end_str = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    alerts = {
        "overdue_acompanhamentos": [],
        "scheduled_today": [],
        "scheduled_this_week": [],
        "upcoming_birthdays": [],
        "upcoming_community_anniversaries": [],
        "total_count": 0,
    }

    # ── Acompanhamentos agendados ──────────────────────────────────────────
    if is_admin or is_formador:
        acomp_query = {**tenant_filter, "status": AcompanhamentoStatus.AGENDADO}
        if not is_admin:
            acomp_query["formador_id"] = current_user["id"]

        scheduled = await db.acompanhamentos.find(
            {**acomp_query, "date": {"$gte": today_str, "$lte": week_end_str}},
            {"_id": 0, "id": 1, "user_name": 1, "date": 1, "time": 1, "location": 1,
             "formative_stage_id": 1, "user_id": 1}
        ).sort("date", 1).to_list(200)

        for ac in scheduled:
            if ac["date"] == today_str:
                alerts["scheduled_today"].append(ac)
            else:
                alerts["scheduled_this_week"].append(ac)

    # ── Formandos sem acompanhamento há X dias ──────────────────────────────
    if is_admin or is_formador:
        formandos_query = {**tenant_filter, "status": UserStatus.ACTIVE}
        if not is_admin:
            formandos_query["formador_id"] = current_user["id"]

        formandos = await db.users.find(
            formandos_query,
            {"_id": 0, "id": 1, "full_name": 1, "formative_stage_id": 1}
        ).to_list(1000)

        if formandos:
            formando_ids = [f["id"] for f in formandos]
            acomp_base = {**tenant_filter, "user_id": {"$in": formando_ids}}
            if not is_admin:
                acomp_base["formador_id"] = current_user["id"]

            # Acompanhamentos realizados após o threshold
            recent_acomps = await db.acompanhamentos.find(
                {**acomp_base, "status": {"$in": [AcompanhamentoStatus.REALIZADO, "realizado"]},
                 "date": {"$gte": threshold_date}},
                {"_id": 0, "user_id": 1}
            ).to_list(10000)

            recent_user_ids = {ac["user_id"] for ac in recent_acomps}

            for f in formandos:
                if f["id"] not in recent_user_ids:
                    alerts["overdue_acompanhamentos"].append({
                        "id": f["id"],
                        "full_name": f["full_name"],
                        "formative_stage_id": f.get("formative_stage_id"),
                    })

    # ── Aniversários próximos (nascimento e consagração) ────────────────────
    base_user_query = {**tenant_filter, "deleted_at": None, "status": UserStatus.ACTIVE}

    # Monta padrões MM-DD para os próximos 7 dias
    upcoming_patterns = []
    for i in range(1, 8):
        d = now + timedelta(days=i)
        upcoming_patterns.append(d.strftime("-%m-%d"))

    if upcoming_patterns:
        birth_regex = "|".join(f"({p}$)" for p in upcoming_patterns)
        upcoming_birthdays = await db.users.find(
            {**base_user_query, "birth_date": {"$regex": birth_regex}},
            {"_id": 0, "id": 1, "full_name": 1, "birth_date": 1}
        ).to_list(100)

        for u in upcoming_birthdays:
            date_str = u.get("birth_date", "")
            days_until = None
            for i in range(1, 8):
                d = now + timedelta(days=i)
                if date_str.endswith(d.strftime("-%m-%d")):
                    days_until = i
                    break
            alerts["upcoming_birthdays"].append({**u, "days_until": days_until})

        consag_regex = birth_regex
        upcoming_consag = await db.users.find(
            {**base_user_query, "community_entry_date": {"$regex": consag_regex}},
            {"_id": 0, "id": 1, "full_name": 1, "community_entry_date": 1}
        ).to_list(100)

        for u in upcoming_consag:
            date_str = u.get("community_entry_date", "")
            days_until = None
            year_str = date_str[:4] if date_str else None
            years = None
            for i in range(1, 8):
                d = now + timedelta(days=i)
                if date_str.endswith(d.strftime("-%m-%d")):
                    days_until = i
                    if year_str:
                        try:
                            years = d.year - int(year_str)
                        except ValueError:
                            pass
                    break
            alerts["upcoming_community_anniversaries"].append(
                {**u, "days_until": days_until, "years": years}
            )

    alerts["total_count"] = (
        len(alerts["overdue_acompanhamentos"])
        + len(alerts["scheduled_today"])
        + len(alerts["upcoming_birthdays"])
        + len(alerts["upcoming_community_anniversaries"])
    )

    return alerts
