# Migração de Banco de Dados MongoDB

Crie ou execute scripts de migração de dados no MongoDB.

## Contexto do Projeto

- **Database**: MongoDB 7 (async via Motor)
- **Scripts existentes**: `projeto-backend/scripts/`
- **Conexão**: `projeto-backend/app/database.py`
- **Collections**: users, tenants, documents, videos, acompanhamentos, locations, functions, formative_stages, stage_cycles, stage_participations, certificates, psychological_assessments, user_journey, content_subcategories, audit_logs

## Estrutura de um Script de Migração

```python
#!/usr/bin/env python3
"""
Migração: <descrição>
Data: <data>
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "gestao_organizacional")

async def migrate():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    # Sua migração aqui
    # Ex: await db.users.update_many({}, {"$set": {"new_field": "default_value"}})

    print("Migração concluída!")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
```

## Boas Práticas

1. Sempre faça backup antes de migrações destrutivas
2. Use `update_many` com `$set` para adicionar campos, nunca reescreva documentos
3. Teste em um tenant específico antes de aplicar a todos
4. Adicione logs de progresso para migrações grandes
5. Considere idempotência — a migração deve ser segura para rodar duas vezes
6. Registre a migração no audit log

## Índices MongoDB

Para criar novos índices, adicione em `database.py` na função `create_indexes()`:
```python
await db.collection.create_index([("campo", 1), ("tenant_id", 1)])
```

## Tarefa

$ARGUMENTS

Crie o script de migração necessário e documente as mudanças no schema.
