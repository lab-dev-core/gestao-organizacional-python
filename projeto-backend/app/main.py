import logging
import uuid
import bcrypt
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, ENVIRONMENT
from app.database import db, close_db
from app.routes import api_router
from app.models.enums import UserRole, UserStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
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
            "tenant_id": None,  # Superadmins don't belong to any tenant
            "is_tenant_owner": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(default_superadmin)
        logger.info(f"Superadmin criado: {SUPERADMIN_EMAIL} / {SUPERADMIN_PASSWORD}")

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
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/debug/cors")
async def debug_cors(request: Request):
    """Debug endpoint to check CORS configuration (no auth required)"""
    return {
        "status": "ok",
        "environment": ENVIRONMENT,
        "cors_origins": CORS_ORIGINS,
        "request_origin": request.headers.get("origin", "no origin header"),
        "request_headers": dict(request.headers),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": "If you can see this, the backend is reachable and CORS is working for this origin."
    }
