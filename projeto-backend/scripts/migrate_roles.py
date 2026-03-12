#!/usr/bin/env python3
"""
Migration: role (string) → roles (list)

Converte o campo legado `role` para `roles` em todos os documentos da
coleção `users` que ainda não possuem o campo `roles`.

Após executar e verificar que todos os usuários têm `roles`, o campo
`role` e toda a lógica de backward compatibility em `utils/security.py`
podem ser removidos.

Uso:
    cd projeto-backend
    python scripts/migrate_roles.py [--dry-run]
"""

import asyncio
import sys
import argparse
from pathlib import Path

# Permite importar app.* sem instalar o pacote
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URL, DB_NAME


async def migrate(dry_run: bool = False) -> None:
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Usuários com campo legado `role` sem o campo novo `roles`
    query = {
        "role": {"$exists": True},
        "roles": {"$exists": False}
    }

    users_to_migrate = await db.users.find(query, {"_id": 1, "id": 1, "role": 1, "email": 1}).to_list(None)
    total = len(users_to_migrate)

    if total == 0:
        print("Nenhum usuário para migrar. Todos já possuem campo `roles`.")
        client.close()
        return

    print(f"Encontrados {total} usuários para migrar.")

    if dry_run:
        print("[DRY RUN] Os seguintes usuários seriam migrados:")
        for u in users_to_migrate:
            print(f"  - {u.get('email', u.get('id', '?'))} : role={u.get('role')}")
        client.close()
        return

    migrated = 0
    errors = 0

    for user in users_to_migrate:
        old_role = user["role"]
        new_roles = [old_role] if isinstance(old_role, str) else old_role

        result = await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"roles": new_roles},
                "$unset": {"role": ""}
            }
        )

        if result.modified_count == 1:
            migrated += 1
        else:
            print(f"  [ERRO] Falha ao migrar usuário {user.get('id', user['_id'])}")
            errors += 1

    print(f"\nMigração concluída: {migrated} migrados, {errors} erros.")

    if errors == 0:
        print(
            "\nPróximo passo: após verificar os dados, remova o campo `role` dos modelos "
            "e as funções `get_user_roles()` e `normalize_user_roles()` de utils/security.py, "
            "substituindo todas as chamadas por `user.get('roles', [UserRole.USER])`."
        )

    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migra campo role → roles em usuários")
    parser.add_argument("--dry-run", action="store_true", help="Apenas lista, não modifica")
    args = parser.parse_args()

    asyncio.run(migrate(dry_run=args.dry_run))
