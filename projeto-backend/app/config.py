import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent.parent

# Carrega o arquivo de ambiente baseado na variável ENVIRONMENT
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development')

env_file = ROOT_DIR / f'.env.{ENVIRONMENT}'
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gestao_organizacional')

# Redis (opcional — usado para rate limiting distribuído)
REDIS_URL = os.environ.get('REDIS_URL', '')

# JWT — sem default inseguro; falha ruidosamente se não configurado
_JWT_SECRET_RAW = os.environ.get('JWT_SECRET', '')

_KNOWN_INSECURE_SECRETS = {
    '',
    'your-super-secret-key-change-in-production',
    'secret',
    'changeme',
    'change_me',
    'mysecret',
}

JWT_SECRET: str = _JWT_SECRET_RAW
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7


def validate_secrets() -> None:
    """
    Valida segredos críticos na inicialização.
    Chame esta função no startup_event do FastAPI.
    Em produção, qualquer configuração insegura encerra o processo.
    Em desenvolvimento, apenas emite avisos.
    """
    errors = []

    if JWT_SECRET in _KNOWN_INSECURE_SECRETS:
        errors.append(
            "JWT_SECRET não configurado ou usa valor padrão inseguro. "
            "Defina JWT_SECRET com um valor aleatório de pelo menos 32 caracteres."
        )
    elif len(JWT_SECRET) < 32:
        errors.append(
            f"JWT_SECRET é muito curto ({len(JWT_SECRET)} chars). "
            "Use pelo menos 32 caracteres."
        )

    superadmin_pass = os.environ.get('SUPERADMIN_PASSWORD', '')
    if superadmin_pass in ('', 'superadmin123', 'admin123', 'Admin@123456', 'changeme'):
        errors.append(
            "SUPERADMIN_PASSWORD não configurado ou usa valor padrão inseguro."
        )

    if not errors:
        return

    for msg in errors:
        logger.error(f"[CONFIG] SECURITY VIOLATION: {msg}")

    if ENVIRONMENT == 'production':
        logger.critical("Configurações inseguras detectadas em produção. Encerrando.")
        sys.exit(1)
    else:
        logger.warning(
            "[CONFIG] Configurações inseguras detectadas. "
            "Isso seria fatal em produção (ENVIRONMENT=production)."
        )


# File Upload
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "documents").mkdir(exist_ok=True)
(UPLOAD_DIR / "videos").mkdir(exist_ok=True)
(UPLOAD_DIR / "photos").mkdir(exist_ok=True)
(UPLOAD_DIR / "certificates").mkdir(exist_ok=True)
(UPLOAD_DIR / "acompanhamentos").mkdir(exist_ok=True)

ALLOWED_DOC_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'}
ALLOWED_ATTACHMENT_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

# Storage backend: "local" | "onedrive"
STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 'local')

# SSO (Google OAuth)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')

# SSO (Microsoft OAuth)
MICROSOFT_CLIENT_ID = os.environ.get('MICROSOFT_CLIENT_ID', '')
MICROSOFT_TENANT_ID_SSO = os.environ.get('MICROSOFT_TENANT_ID_SSO', 'common')

# OneDrive (Microsoft Graph API)
ONEDRIVE_CLIENT_ID = os.environ.get('ONEDRIVE_CLIENT_ID', '')
ONEDRIVE_CLIENT_SECRET = os.environ.get('ONEDRIVE_CLIENT_SECRET', '')
ONEDRIVE_TENANT_ID = os.environ.get('ONEDRIVE_TENANT_ID', '')
ONEDRIVE_DRIVE_ID = os.environ.get('ONEDRIVE_DRIVE_ID', '')
ONEDRIVE_BASE_FOLDER = os.environ.get('ONEDRIVE_BASE_FOLDER', 'gestao-organizacional')
ONEDRIVE_ENABLED = bool(ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET and ONEDRIVE_TENANT_ID)

# CORS — default restrito; '*' deve ser configurado explicitamente
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:80').split(',')
    if origin.strip()
]

# Email (para recuperação de senha)
SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM = os.environ.get('SMTP_FROM', 'noreply@example.com')

# Frontend URL (para links de recuperação de senha)
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Superadmin (criado automaticamente no startup)
SUPERADMIN_EMAIL = os.environ.get('SUPERADMIN_EMAIL', 'superadmin@sistema.com')
SUPERADMIN_PASSWORD = os.environ.get('SUPERADMIN_PASSWORD', 'superadmin123')
