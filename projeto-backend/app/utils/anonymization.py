"""
Utilitário de anonimização de dados pessoais — conformidade com LGPD (Art. 18).

Aplica anonimização irreversível em dados pessoais de usuários deletados,
substituindo campos identificáveis por tokens sem valor informativo.
"""

import logging
from datetime import datetime, timezone
from app.database import db

logger = logging.getLogger(__name__)

# Campos pessoais que devem ser anonimizados
_PERSONAL_FIELDS = (
    "full_name", "email", "username", "cpf", "phone",
    "birth_date", "photo_url", "address", "family_contact",
)


async def anonymize_user(user_id: str) -> bool:
    """
    Anonimiza dados pessoais de um usuário já marcado como deletado.

    Substitui campos sensíveis por valores que não permitem re-identificação.
    O registro é mantido no banco para preservar integridade referencial
    (audit logs, histórico de jornada, etc.).

    Returns:
        True se anonimizado com sucesso, False se usuário não encontrado.
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        logger.warning(f"anonymize_user: usuário {user_id} não encontrado")
        return False

    now = datetime.now(timezone.utc).isoformat()

    anon_update = {
        "full_name": f"[Removido {user_id[:8]}]",
        "email": f"deleted_{user_id}@removed.invalid",
        "username": None,
        "cpf": None,
        "phone": None,
        "birth_date": None,
        "photo_url": None,
        "address": None,
        "family_contact": None,
        "anonymized_at": now,
        "updated_at": now,
    }

    await db.users.update_one(
        {"id": user_id},
        {"$set": anon_update}
    )

    logger.info(f"Usuário {user_id} anonimizado com sucesso (LGPD)")
    return True


async def find_users_pending_anonymization(days: int = 30) -> list:
    """
    Retorna usuários deletados há mais de `days` dias que ainda não foram anonimizados.
    Útil para rodar como job agendado.
    """
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    users = await db.users.find(
        {
            "deleted_at": {"$ne": None, "$lt": cutoff},
            "anonymized_at": None,
        },
        {"id": 1, "email": 1, "deleted_at": 1}
    ).to_list(None)

    return users
