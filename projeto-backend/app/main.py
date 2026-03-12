import logging
import time
import uuid
import bcrypt
from contextvars import ContextVar
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from app.config import (
    CORS_ORIGINS, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD,
    ENVIRONMENT, REDIS_URL, validate_secrets
)
from app.database import db, ping_db, close_db
from app.routes import setup_routes
from app.models.enums import UserRole, UserStatus

# ── Logging ──────────────────────────────────────────────────────────────────
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
if ENVIRONMENT == 'production':
    log_format = '{"time":"%(asctime)s","logger":"%(name)s","level":"%(levelname)s","message":"%(message)s"}'

logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

logger.info(f"Environment: {ENVIRONMENT}")
logger.info(f"CORS Origins configured: {CORS_ORIGINS}")

# ── Correlation ID ────────────────────────────────────────────────────────────
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sistema de Gestão Organizacional - Multi-Tenant",
    description="API multi-tenant para gerenciamento de usuários, documentos, vídeos e acompanhamentos",
    version="3.0.0"
)

# ── Routes ────────────────────────────────────────────────────────────────────
setup_routes(app)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*", "X-Request-ID"],
    max_age=3600,
)


# ── Rate Limiting ─────────────────────────────────────────────────────────────
# Usa Redis se REDIS_URL estiver configurado, caso contrário usa memória local
# (in-memory não funciona com múltiplas instâncias — configure Redis em produção)

RATE_LIMIT_MAX_REQUESTS = 100
RATE_LIMIT_WINDOW_SECONDS = 60
AUTH_RATE_LIMIT_MAX_REQUESTS = 10
AUTH_RATE_LIMIT_WINDOW_SECONDS = 60

_redis_client = None
_rate_limit_store: dict = defaultdict(list)


async def _get_redis():
    global _redis_client
    if _redis_client is None and REDIS_URL:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
            await _redis_client.ping()
            logger.info("Rate limiting: usando Redis distribuído")
        except Exception as e:
            logger.warning(f"Redis indisponível ({e}). Rate limiting em memória (não distribuível).")
            _redis_client = None
    return _redis_client


async def _check_rate_limit_redis(redis_client, key: str, max_req: int, window: int) -> bool:
    """Retorna True se o request deve ser bloqueado."""
    import time as _time
    now = _time.time()
    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zadd(key, {str(uuid.uuid4()): now})
    pipe.zcard(key)
    pipe.expire(key, window)
    results = await pipe.execute()
    count = results[2]
    return count > max_req


def _check_rate_limit_memory(key: str, max_req: int, window: int) -> bool:
    """Retorna True se o request deve ser bloqueado."""
    now = time.time()
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < window]
    if len(_rate_limit_store[key]) >= max_req:
        return True
    _rate_limit_store[key].append(now)
    return False


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    if path.startswith("/api/auth/login") or path.startswith("/api/v1/auth/login") \
            or path.startswith("/api/auth/register") or path.startswith("/api/v1/auth/register"):
        max_requests = AUTH_RATE_LIMIT_MAX_REQUESTS
        window = AUTH_RATE_LIMIT_WINDOW_SECONDS
        key = f"rl:auth:{client_ip}"
    else:
        max_requests = RATE_LIMIT_MAX_REQUESTS
        window = RATE_LIMIT_WINDOW_SECONDS
        key = f"rl:general:{client_ip}"

    redis = await _get_redis()
    if redis:
        blocked = await _check_rate_limit_redis(redis, key, max_requests, window)
    else:
        blocked = _check_rate_limit_memory(key, max_requests, window)

    if blocked:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please try again later."},
            headers={"Retry-After": str(window)}
        )

    return await call_next(request)


# ── Correlation ID + Request Logging ─────────────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request_id_var.set(request_id)
    request.state.request_id = request_id

    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000

    # Propaga o ID para o cliente — útil para correlacionar logs com reports de erro
    response.headers["X-Request-ID"] = request_id

    if request.url.path not in ("/health", "/"):
        client_ip = request.client.host if request.client else "unknown"
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"status={response.status_code} "
            f"duration={duration_ms:.1f}ms "
            f"client={client_ip}"
        )

    return response


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    # Valida segredos críticos — falha em produção se inseguros
    validate_secrets()

    if not REDIS_URL:
        logger.warning(
            "REDIS_URL não configurado. Rate limiting em memória não funciona "
            "com múltiplas instâncias. Configure Redis para produção."
        )

    # Cria superadmin padrão se não existir
    superadmin_count = await db.users.count_documents(
        {"$or": [{"roles": UserRole.SUPERADMIN}, {"role": UserRole.SUPERADMIN}]}
    )
    if superadmin_count == 0:
        default_superadmin = {
            "id": str(uuid.uuid4()),
            "full_name": "Super Administrador",
            "email": SUPERADMIN_EMAIL,
            "password": bcrypt.hashpw(SUPERADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            "roles": [UserRole.SUPERADMIN],
            "status": UserStatus.ACTIVE,
            "tenant_id": None,
            "is_tenant_owner": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(default_superadmin)
        logger.info("Default superadmin account created successfully")

    # Índices de performance
    await db.users.create_index("email")
    await db.users.create_index("tenant_id")
    await db.users.create_index([("email", 1), ("tenant_id", 1)])
    await db.users.create_index("deleted_at")  # para filtrar soft-deletes
    await db.tenants.create_index("slug", unique=True)
    await db.documents.create_index("tenant_id")
    await db.videos.create_index("tenant_id")
    await db.acompanhamentos.create_index("tenant_id")
    await db.locations.create_index("tenant_id")
    await db.functions.create_index("tenant_id")
    await db.formative_stages.create_index("tenant_id")
    await db.user_journey.create_index("tenant_id")
    await db.user_journey.create_index("user_id")
    await db.stage_cycles.create_index("tenant_id")
    await db.stage_cycles.create_index("formative_stage_id")
    await db.stage_participations.create_index("tenant_id")
    await db.stage_participations.create_index("cycle_id")
    await db.stage_participations.create_index("user_id")
    await db.certificates.create_index("tenant_id")
    await db.certificates.create_index("user_id")
    await db.psychological_assessments.create_index("tenant_id")
    await db.psychological_assessments.create_index("user_id")
    await db.psychological_assessments.create_index("assessor_id")
    await db.psychological_assessments.create_index("formative_stage_id")
    await db.stage_indicators.create_index("tenant_id")
    await db.stage_indicators.create_index("formative_stage_id")
    await db.content_subcategories.create_index("tenant_id")
    await db.content_subcategories.create_index("formative_stage_id")
    await db.video_comments.create_index("video_id")
    await db.video_comments.create_index("user_id")
    await db.video_evaluations.create_index("video_id")
    await db.video_evaluations.create_index([("video_id", 1), ("user_id", 1)])
    await db.video_attachments.create_index("video_id")
    await db.video_progress.create_index([("video_id", 1), ("user_id", 1)])
    await db.document_comments.create_index("document_id")
    await db.document_comments.create_index("user_id")
    await db.document_evaluations.create_index("document_id")
    await db.document_evaluations.create_index([("document_id", 1), ("user_id", 1)])
    await db.document_attachments.create_index("document_id")
    await db.document_access.create_index([("document_id", 1), ("user_id", 1)])
    await db.audit_logs.create_index("tenant_id")
    await db.audit_logs.create_index("user_id")
    await db.audit_logs.create_index("action")
    await db.audit_logs.create_index("resource_type")
    await db.audit_logs.create_index("created_at")

    logger.info("Database indexes created")


@app.on_event("shutdown")
async def shutdown_event():
    if _redis_client:
        await _redis_client.close()
    await close_db()


# ── Health & Debug ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "message": "Sistema de Gestão Organizacional API",
        "version": "3.0.0",
        "multi_tenant": True
    }


@app.get("/health")
async def health_check():
    health = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "3.0.0",
        "environment": ENVIRONMENT,
        "checks": {}
    }

    try:
        db_ok = await ping_db()
        health["checks"]["database"] = {
            "status": "healthy" if db_ok else "unhealthy",
            "type": "mongodb"
        }
        if not db_ok:
            health["status"] = "degraded"
    except Exception as e:
        health["checks"]["database"] = {
            "status": "unhealthy",
            "type": "mongodb",
            "error": str(e)
        }
        health["status"] = "degraded"

    redis = await _get_redis()
    health["checks"]["rate_limiting"] = {
        "backend": "redis" if redis else "in-memory",
        "distributed": redis is not None
    }

    status_code = 200 if health["status"] == "healthy" else 503
    return JSONResponse(content=health, status_code=status_code)


@app.get("/debug/cors")
async def debug_cors(request: Request):
    if ENVIRONMENT == "production":
        return {"message": "Debug endpoint disabled in production"}

    return {
        "status": "ok",
        "environment": ENVIRONMENT,
        "cors_origins": CORS_ORIGINS,
        "request_origin": request.headers.get("origin", "no origin header"),
        "request_headers": dict(request.headers),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": "If you can see this, the backend is reachable and CORS is working for this origin."
    }
