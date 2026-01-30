import logging
import uuid
import bcrypt
from datetime import datetime, timezone
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import db, close_db
from app.routes import api_router
from app.models.enums import UserRole, UserStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Sistema de Gestão Organizacional",
    description="API para gerenciamento de usuários, documentos, vídeos e acompanhamentos",
    version="2.0.0"
)

# Include API router
app.include_router(api_router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Create default admin if none exists"""
    admin_count = await db.users.count_documents({"role": UserRole.ADMIN})
    if admin_count == 0:
        default_admin = {
            "id": str(uuid.uuid4()),
            "full_name": "Administrador",
            "email": "admin@admin.com",
            "password": bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode(),
            "role": UserRole.ADMIN,
            "status": UserStatus.ACTIVE,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(default_admin)
        logger.info("Admin padrão criado: admin@admin.com / admin123")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection"""
    await close_db()


@app.get("/")
async def root():
    return {"message": "Sistema de Gestão Organizacional API", "version": "2.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
