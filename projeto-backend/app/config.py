import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent

# Carrega o arquivo de ambiente baseado na variável ENVIRONMENT
# Prioridade: ENVIRONMENT env var -> .env.{environment} -> .env
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development')

# Tenta carregar o arquivo específico do ambiente
env_file = ROOT_DIR / f'.env.{ENVIRONMENT}'
if env_file.exists():
    load_dotenv(env_file)
else:
    # Fallback para .env genérico
    load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gestao_organizacional')

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7

# File Upload
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "documents").mkdir(exist_ok=True)
(UPLOAD_DIR / "videos").mkdir(exist_ok=True)
(UPLOAD_DIR / "photos").mkdir(exist_ok=True)

ALLOWED_DOC_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

# CORS
CORS_ORIGINS = [origin.strip() for origin in os.environ.get('CORS_ORIGINS', '*').split(',') if origin.strip()]

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
