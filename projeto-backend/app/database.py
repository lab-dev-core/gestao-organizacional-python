import logging
from contextlib import asynccontextmanager
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logger = logging.getLogger(__name__)

# Cache do resultado da sondagem de suporte a transações
_transactions_supported: Optional[bool] = None


async def _probe_transaction_support() -> bool:
    """
    Sonda uma vez se este MongoDB suporta transações multi-documento.
    Replica sets suportam; instâncias standalone não suportam.
    O resultado é cacheado para evitar round-trips repetidos.
    """
    global _transactions_supported
    if _transactions_supported is not None:
        return _transactions_supported

    try:
        async with await client.start_session() as session:
            session.start_transaction()
            # Qualquer operação com sessão falha imediatamente em standalone
            await db["_txn_probe"].find_one({}, session=session)
            await session.abort_transaction()
        _transactions_supported = True
    except Exception:
        _transactions_supported = False

    return _transactions_supported


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
    if not await _probe_transaction_support():
        logger.warning(
            "MongoDB não suporta transações (standalone). "
            "Configure replica set para consistência ACID. "
            "Executando sem transação."
        )
        yield None
        return

    async with await client.start_session() as session:
        async with session.start_transaction():
            yield session
