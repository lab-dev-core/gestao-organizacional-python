"""
Service layer para operações de usuário.

Centraliza lógica de negócio que estava espalhada nas rotas,
tornando o código testável unitariamente e reutilizável.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from app.database import db, transaction
from app.models.enums import UserRole, UserStatus
from app.models.user import UserCreate, UserUpdate
from app.utils.audit import log_action
from app.utils.security import hash_password, get_user_roles, normalize_user_roles, check_tenant_limits

logger = logging.getLogger(__name__)


class UserService:

    async def create_user(self, user_data: UserCreate, actor: dict) -> dict:
        """
        Cria um usuário dentro do tenant do actor.
        Usa transação MongoDB para garantir consistência entre
        a inserção do usuário e o registro de auditoria.
        """
        tenant_id = actor.get("tenant_id")

        if tenant_id:
            await check_tenant_limits(tenant_id, "users")

        # Unicidade de email no tenant
        query = {"email": user_data.email}
        if tenant_id:
            query["tenant_id"] = tenant_id
        if await db.users.find_one(query):
            raise HTTPException(status_code=400, detail="Email already registered")

        # Unicidade de CPF no tenant
        if user_data.cpf:
            cpf_query = {"cpf": user_data.cpf}
            if tenant_id:
                cpf_query["tenant_id"] = tenant_id
            if await db.users.find_one(cpf_query):
                raise HTTPException(status_code=400, detail="CPF already registered")

        now = datetime.now(timezone.utc).isoformat()
        user_dict = user_data.model_dump()
        user_dict["id"] = str(uuid.uuid4())
        user_dict["tenant_id"] = tenant_id
        user_dict["password"] = hash_password(user_data.password)
        user_dict["is_tenant_owner"] = False
        user_dict["created_at"] = now
        user_dict["updated_at"] = now
        user_dict["deleted_at"] = None

        if user_dict.get("address") and hasattr(user_dict["address"], "model_dump"):
            user_dict["address"] = user_dict["address"].model_dump()

        if user_dict.get("family_contact") and hasattr(user_dict["family_contact"], "model_dump"):
            user_dict["family_contact"] = user_dict["family_contact"].model_dump()

        async with transaction() as session:
            insert_kwargs = {"session": session} if session else {}
            await db.users.insert_one(dict(user_dict), **insert_kwargs)
            await log_action(
                actor["id"], actor["full_name"],
                "create", "user", user_dict["id"],
                {"created_user": user_dict["full_name"]},
                tenant_id=tenant_id
            )

        del user_dict["password"]
        return user_dict

    async def update_user(self, user_id: str, user_data: UserUpdate, actor: dict) -> dict:
        """
        Atualiza usuário com validações de permissão e registro de jornada.
        """
        actor_roles = get_user_roles(actor)
        is_admin = any(r in actor_roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN])

        if not is_admin and actor["id"] != user_id:
            raise HTTPException(status_code=403, detail="Permission denied")

        if not is_admin and user_data.roles:
            raise HTTPException(status_code=403, detail="Cannot change roles")

        query = {"id": user_id, "deleted_at": None}
        if UserRole.SUPERADMIN not in actor_roles and actor.get("tenant_id"):
            query["tenant_id"] = actor["tenant_id"]

        existing = await db.users.find_one(query)
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        if existing.get("is_tenant_owner") and UserRole.SUPERADMIN not in actor_roles:
            if user_data.roles and UserRole.ADMIN not in user_data.roles:
                raise HTTPException(status_code=403, detail="Cannot change role of tenant owner")

        update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}

        if "password" in update_dict:
            update_dict["password"] = hash_password(update_dict["password"])

        if "email" in update_dict and update_dict["email"] != existing["email"]:
            email_query = {"email": update_dict["email"]}
            if existing.get("tenant_id"):
                email_query["tenant_id"] = existing["tenant_id"]
            if await db.users.find_one(email_query):
                raise HTTPException(status_code=400, detail="Email already registered")

        if update_dict.get("address") and hasattr(update_dict["address"], "model_dump"):
            update_dict["address"] = update_dict["address"].model_dump()

        if update_dict.get("family_contact") and hasattr(update_dict["family_contact"], "model_dump"):
            update_dict["family_contact"] = update_dict["family_contact"].model_dump()

        # Registra transição de jornada formativa se a etapa mudou
        new_stage_id = update_dict.get("formative_stage_id")
        old_stage_id = existing.get("formative_stage_id")
        if new_stage_id and new_stage_id != old_stage_id:
            await self._record_journey_transition(
                user_id=user_id,
                from_stage_id=old_stage_id,
                to_stage_id=new_stage_id,
                tenant_id=existing.get("tenant_id"),
                changed_by=actor,
            )

        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
        await log_action(actor["id"], actor["full_name"], "update", "user", user_id)

        updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        normalize_user_roles(updated)
        return updated

    async def soft_delete_user(self, user_id: str, actor: dict) -> None:
        """
        Soft-delete: marca deleted_at em vez de remover o documento.
        Os dados pessoais permanecem até serem anonimizados pelo job LGPD.
        """
        actor_roles = get_user_roles(actor)

        query = {"id": user_id, "deleted_at": None}
        if UserRole.SUPERADMIN not in actor_roles and actor.get("tenant_id"):
            query["tenant_id"] = actor["tenant_id"]

        existing = await db.users.find_one(query)
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        if user_id == actor["id"]:
            raise HTTPException(status_code=400, detail="Cannot delete yourself")

        if existing.get("is_tenant_owner") and UserRole.SUPERADMIN not in actor_roles:
            raise HTTPException(status_code=403, detail="Cannot delete tenant owner")

        now = datetime.now(timezone.utc).isoformat()
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "status": UserStatus.INACTIVE,
                "deleted_at": now,
                "updated_at": now,
            }}
        )

        await log_action(
            actor["id"], actor["full_name"],
            "delete", "user", user_id,
            {"deleted_user": existing.get("full_name"), "soft_delete": True}
        )

    async def _record_journey_transition(
        self,
        user_id: str,
        from_stage_id: Optional[str],
        to_stage_id: str,
        tenant_id: Optional[str],
        changed_by: dict,
        notes: Optional[str] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await db.user_journey.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "from_stage_id": from_stage_id,
            "to_stage_id": to_stage_id,
            "notes": notes or "Transição automática via atualização de usuário",
            "changed_by_id": changed_by["id"],
            "changed_by_name": changed_by["full_name"],
            "transition_date": now,
            "created_at": now,
        })


# Instância singleton — use via Depends ou importe diretamente
user_service = UserService()
