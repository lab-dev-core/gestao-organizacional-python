from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def ping_db() -> bool:
    """Ping MongoDB to verify connectivity"""
    try:
        result = await client.admin.command("ping")
        return result.get("ok") == 1.0
    except Exception:
        return False


async def close_db():
    client.close()


@asynccontextmanager
async def transaction():
    """
    Async context manager para operações multi-step com rollback automático.

    Requer que o MongoDB esteja rodando como replica set (mesmo single-node).
    Se transações não forem suportadas (standalone), o bloco executa sem transação
    e loga um aviso.

    Uso:
        async with transaction() as session:
            await db.users.insert_one(doc, session=session)
            await db.audit_logs.insert_one(log, session=session)
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                yield session
    except Exception as e:
        # Standalone MongoDB não suporta transações — fallback sem sessão
        if "Transaction numbers are only allowed" in str(e) or "not a primary" in str(e).lower():
            logger.warning(
                "MongoDB não suporta transações (standalone). "
                "Configure replica set para consistência ACID. "
                "Executando sem transação."
            )
            yield None
        else:
            raise
