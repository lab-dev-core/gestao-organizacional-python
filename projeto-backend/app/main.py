import logging
import time
import uuid
import bcrypt
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, ENVIRONMENT
from app.database import db, ping_db, close_db
from app.routes import api_router
from app.models.enums import UserRole, UserStatus

# Configure structured logging
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
if ENVIRONMENT == 'production':
    log_format = '{"time":"%(asctime)s","logger":"%(name)s","level":"%(levelname)s","message":"%(message)s"}'

logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

logger.info(f"Environment: {ENVIRONMENT}")
logger.info(f"CORS Origins configured: {CORS_ORIGINS}")

# Create FastAPI app
app = FastAPI(
    title="Sistema de Gestão Organizacional - Multi-Tenant",
    description="API multi-tenant para gerenciamento de usuários, documentos, vídeos e acompanhamentos",
    version="3.0.0"
)

# Include API router
app.include_router(api_router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# --- Rate Limiting Middleware ---
rate_limit_store: dict = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 100
RATE_LIMIT_WINDOW_SECONDS = 60
AUTH_RATE_LIMIT_MAX_REQUESTS = 10
AUTH_RATE_LIMIT_WINDOW_SECONDS = 60


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    path = request.url.path

    if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
        max_requests = AUTH_RATE_LIMIT_MAX_REQUESTS
        window = AUTH_RATE_LIMIT_WINDOW_SECONDS
        key = f"auth:{client_ip}"
    else:
        max_requests = RATE_LIMIT_MAX_REQUESTS
        window = RATE_LIMIT_WINDOW_SECONDS
        key = f"general:{client_ip}"

    rate_limit_store[key] = [t for t in rate_limit_store[key] if now - t < window]

    if len(rate_limit_store[key]) >= max_requests:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please try again later."},
            headers={"Retry-After": str(window)}
        )

    rate_limit_store[key].append(now)
    response = await call_next(request)
    return response


# --- Request Logging Middleware ---
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000

    if request.url.path not in ("/health", "/"):
        logger.info(
            f"{request.method} {request.url.path} "
            f"status={response.status_code} "
            f"duration={duration_ms:.1f}ms "
            f"client={request.client.host if request.client else 'unknown'}"
        )

    return response


@app.on_event("startup")
async def startup_event():
    """Create default superadmin if none exists"""
    superadmin_count = await db.users.count_documents({"role": UserRole.SUPERADMIN})
    if superadmin_count == 0:
        default_superadmin = {
            "id": str(uuid.uuid4()),
            "full_name": "Super Administrador",
            "email": SUPERADMIN_EMAIL,
            "password": bcrypt.hashpw(SUPERADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            "role": UserRole.SUPERADMIN,
            "status": UserStatus.ACTIVE,
            "tenant_id": None,
            "is_tenant_owner": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(default_superadmin)
        # Security: do NOT log credentials
        logger.info("Default superadmin account created successfully")

    # Create indexes for better performance
    await db.users.create_index("email")
    await db.users.create_index("tenant_id")
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

    logger.info("Database indexes created")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection"""
    await close_db()


@app.get("/")
async def root():
    return {
        "message": "Sistema de Gestão Organizacional API",
        "version": "3.0.0",
        "multi_tenant": True
    }


@app.get("/health")
async def health_check():
    """Enhanced health check with dependency verification"""
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

    status_code = 200 if health["status"] == "healthy" else 503
    return JSONResponse(content=health, status_code=status_code)


@app.get("/debug/cors")
async def debug_cors(request: Request):
    """Debug endpoint to check CORS configuration (disabled in production)"""
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
