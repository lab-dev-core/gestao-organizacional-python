from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import shutil
from enum import Enum
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7

# File upload config
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "documents").mkdir(exist_ok=True)
(UPLOAD_DIR / "videos").mkdir(exist_ok=True)
(UPLOAD_DIR / "photos").mkdir(exist_ok=True)

ALLOWED_DOC_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

app = FastAPI(title="Sistema de Gestão Organizacional")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    ADMIN = "admin"
    FORMADOR = "formador"
    USER = "user"

class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

# ==================== MODELS ====================
class AddressModel(BaseModel):
    cep: str = ""
    street: str = ""
    number: str = ""
    complement: str = ""
    neighborhood: str = ""
    city: str = ""
    state: str = ""

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    birth_date: Optional[str] = None
    address: Optional[AddressModel] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    location_id: Optional[str] = None
    function_id: Optional[str] = None
    formative_stage_id: Optional[str] = None
    formador_id: Optional[str] = None
    role: UserRole = UserRole.USER
    status: UserStatus = UserStatus.ACTIVE
    photo_url: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    birth_date: Optional[str] = None
    address: Optional[AddressModel] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    location_id: Optional[str] = None
    function_id: Optional[str] = None
    formative_stage_id: Optional[str] = None
    formador_id: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    photo_url: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# Location Models
class LocationBase(BaseModel):
    name: str
    address: Optional[AddressModel] = None
    responsible: Optional[str] = None
    capacity: Optional[int] = None
    status: UserStatus = UserStatus.ACTIVE

class LocationCreate(LocationBase):
    pass

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[AddressModel] = None
    responsible: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[UserStatus] = None

class LocationResponse(LocationBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str

# Function Models
class FunctionBase(BaseModel):
    name: str
    description: Optional[str] = None
    hierarchy_level: Optional[int] = 0
    permissions: Optional[List[str]] = []

class FunctionCreate(FunctionBase):
    pass

class FunctionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    hierarchy_level: Optional[int] = None
    permissions: Optional[List[str]] = None

class FunctionResponse(FunctionBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str

# Formative Stage Models
class FormativeStageBase(BaseModel):
    name: str
    description: Optional[str] = None
    order: int = 0
    estimated_duration: Optional[str] = None
    prerequisites: Optional[List[str]] = []

class FormativeStageCreate(FormativeStageBase):
    pass

class FormativeStageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    estimated_duration: Optional[str] = None
    prerequisites: Optional[List[str]] = None

class FormativeStageResponse(FormativeStageBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str

# Permission Models for Documents/Videos
class PermissionModel(BaseModel):
    location_ids: List[str] = []
    user_ids: List[str] = []
    function_ids: List[str] = []
    formative_stage_ids: List[str] = []

# Document Models
class DocumentBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    version: int = 1
    is_public: bool = False
    formative_stage_id: Optional[str] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    is_public: Optional[bool] = None
    formative_stage_id: Optional[str] = None

class DocumentResponse(DocumentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    file_url: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_by: str
    views: int = 0
    downloads: int = 0
    formative_stage_id: Optional[str] = None
    created_at: str
    updated_at: str

# Video Models
class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    video_type: str = "upload"  # "upload" or "link"
    external_url: Optional[str] = None
    is_public: bool = False
    formative_stage_id: Optional[str] = None

class VideoCreate(VideoBase):
    pass

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    external_url: Optional[str] = None
    is_public: Optional[bool] = None
    formative_stage_id: Optional[str] = None

class VideoResponse(VideoBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    uploaded_by: str
    views: int = 0
    formative_stage_id: Optional[str] = None
    created_at: str
    updated_at: str

# Video Progress Model
class VideoProgressUpdate(BaseModel):
    progress_seconds: int
    completed: bool = False

class VideoProgressResponse(BaseModel):
    video_id: str
    user_id: str
    progress_seconds: int
    completed: bool
    last_watched: str

# Audit Log Model
class AuditLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: str

# Acompanhamento (Follow-up) Models
class AcompanhamentoFrequency(str, Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"

class AcompanhamentoBase(BaseModel):
    user_id: str  # The user being followed up (formando)
    formative_stage_id: Optional[str] = None
    date: str  # Date of the follow-up meeting
    time: str  # Time of the meeting
    location: str  # Where the meeting took place
    content: str  # The actual follow-up report/notes
    frequency: AcompanhamentoFrequency = AcompanhamentoFrequency.BIWEEKLY

class AcompanhamentoCreate(AcompanhamentoBase):
    pass

class AcompanhamentoUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    content: Optional[str] = None
    frequency: Optional[AcompanhamentoFrequency] = None
    formative_stage_id: Optional[str] = None

class AcompanhamentoResponse(AcompanhamentoBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    formador_id: str  # The formador who created this follow-up
    formador_name: str
    user_name: str
    created_at: str
    updated_at: str

# ==================== HELPER FUNCTIONS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"user_id": user_id, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"user_id": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_admin_or_formador(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in [UserRole.ADMIN, UserRole.FORMADOR]:
        raise HTTPException(status_code=403, detail="Admin or Formador access required")
    return current_user

async def log_action(user_id: str, user_name: str, action: str, resource_type: str, resource_id: str = None, details: dict = None):
    log_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(log_entry)

def check_permission(user: dict, permissions: Optional[dict]) -> bool:
    """Check if user has permission to access a resource"""
    if not permissions:
        return True
    
    if user.get("role") == UserRole.ADMIN:
        return True
    
    user_id = user.get("id")
    location_id = user.get("location_id")
    function_id = user.get("function_id")
    formative_stage_id = user.get("formative_stage_id")
    
    # Check user-specific permission
    if user_id in permissions.get("user_ids", []):
        return True
    
    # Check location permission
    if location_id and location_id in permissions.get("location_ids", []):
        return True
    
    # Check function permission
    if function_id and function_id in permissions.get("function_ids", []):
        return True
    
    # Check formative stage permission
    if formative_stage_id and formative_stage_id in permissions.get("formative_stage_ids", []):
        return True
    
    # If no specific permissions are set, allow access
    if not any([permissions.get("user_ids"), permissions.get("location_ids"), 
                permissions.get("function_ids"), permissions.get("formative_stage_ids")]):
        return True
    
    return False

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if CPF exists
    if user_data.cpf:
        existing_cpf = await db.users.find_one({"cpf": user_data.cpf})
        if existing_cpf:
            raise HTTPException(status_code=400, detail="CPF already registered")
    
    now = datetime.now(timezone.utc).isoformat()
    user_dict = user_data.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = now
    user_dict["updated_at"] = now
    
    # Convert address to dict if exists
    if user_dict.get("address"):
        user_dict["address"] = user_dict["address"] if isinstance(user_dict["address"], dict) else user_dict["address"].model_dump() if hasattr(user_dict["address"], 'model_dump') else dict(user_dict["address"])
    
    # Create a copy for MongoDB insertion (will add _id)
    mongo_doc = dict(user_dict)
    await db.users.insert_one(mongo_doc)
    
    # Remove password from response (user_dict doesn't have _id)
    del user_dict["password"]
    
    access_token = create_access_token(user_dict["id"], user_dict["role"])
    refresh_token = create_refresh_token(user_dict["id"])
    
    await log_action(user_dict["id"], user_dict["full_name"], "register", "user", user_dict["id"])
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_dict
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("status") == UserStatus.INACTIVE:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    access_token = create_access_token(user["id"], user["role"])
    refresh_token = create_refresh_token(user["id"])
    
    # Remove password from response
    user_response = {k: v for k, v in user.items() if k != "password"}
    
    await log_action(user["id"], user["full_name"], "login", "user", user["id"])
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response
    )

@api_router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(refresh_data: RefreshTokenRequest):
    payload = decode_token(refresh_data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    access_token = create_access_token(user["id"], user["role"])
    new_refresh_token = create_refresh_token(user["id"])
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=user
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== USER ROUTES ====================
@api_router.get("/users", response_model=List[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    status: Optional[UserStatus] = None,
    location_id: Optional[str] = None,
    function_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"cpf": {"$regex": search, "$options": "i"}}
        ]
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    if location_id:
        query["location_id"] = location_id
    if function_id:
        query["function_id"] = function_id
    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id
    
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password": 0}).skip(skip).limit(limit).to_list(limit)
    return users

@api_router.get("/users/formadores", response_model=List[UserResponse])
async def list_formadores(current_user: dict = Depends(get_current_user)):
    """List all users with formador role"""
    formadores = await db.users.find(
        {"role": UserRole.FORMADOR, "status": UserStatus.ACTIVE}, 
        {"_id": 0, "password": 0}
    ).to_list(1000)
    return formadores

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if CPF exists
    if user_data.cpf:
        existing_cpf = await db.users.find_one({"cpf": user_data.cpf})
        if existing_cpf:
            raise HTTPException(status_code=400, detail="CPF already registered")
    
    now = datetime.now(timezone.utc).isoformat()
    user_dict = user_data.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = now
    user_dict["updated_at"] = now
    
    if user_dict.get("address"):
        user_dict["address"] = user_dict["address"] if isinstance(user_dict["address"], dict) else user_dict["address"].model_dump() if hasattr(user_dict["address"], 'model_dump') else dict(user_dict["address"])
    
    # Create a copy for MongoDB insertion (will add _id)
    mongo_doc = dict(user_dict)
    await db.users.insert_one(mongo_doc)
    
    await log_action(current_user["id"], current_user["full_name"], "create", "user", user_dict["id"], {"created_user": user_dict["full_name"]})
    
    del user_dict["password"]
    return user_dict

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Check permission - admin can update anyone, users can only update themselves
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Non-admins cannot change role
    if current_user["role"] != UserRole.ADMIN and user_data.role:
        raise HTTPException(status_code=403, detail="Cannot change role")
    
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])
    
    if "email" in update_dict and update_dict["email"] != existing["email"]:
        existing_email = await db.users.find_one({"email": update_dict["email"]})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    if update_dict.get("address"):
        update_dict["address"] = update_dict["address"] if isinstance(update_dict["address"], dict) else update_dict["address"].model_dump() if hasattr(update_dict["address"], 'model_dump') else dict(update_dict["address"])
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    await log_action(current_user["id"], current_user["full_name"], "update", "user", user_id)
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    await db.users.delete_one({"id": user_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "user", user_id, {"deleted_user": existing["full_name"]})
    
    return {"message": "User deleted successfully"}

@api_router.post("/users/{user_id}/photo")
async def upload_user_photo(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / "photos" / f"{file_id}{ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    photo_url = f"/api/uploads/photos/{file_id}{ext}"
    await db.users.update_one({"id": user_id}, {"$set": {"photo_url": photo_url, "updated_at": datetime.now(timezone.utc).isoformat()}})
    
    return {"photo_url": photo_url}

# ==================== LOCATION ROUTES ====================
@api_router.get("/locations", response_model=List[LocationResponse])
async def list_locations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[UserStatus] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    locations = await db.locations.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return locations

@api_router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(location_id: str, current_user: dict = Depends(get_current_user)):
    location = await db.locations.find_one({"id": location_id}, {"_id": 0})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

@api_router.post("/locations", response_model=LocationResponse)
async def create_location(location_data: LocationCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    location_dict = location_data.model_dump()
    location_dict["id"] = str(uuid.uuid4())
    location_dict["created_at"] = now
    location_dict["updated_at"] = now
    
    if location_dict.get("address"):
        location_dict["address"] = location_dict["address"] if isinstance(location_dict["address"], dict) else location_dict["address"].model_dump() if hasattr(location_dict["address"], 'model_dump') else dict(location_dict["address"])
    
    await db.locations.insert_one(location_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "location", location_dict["id"], {"name": location_dict["name"]})
    
    return location_dict

@api_router.put("/locations/{location_id}", response_model=LocationResponse)
async def update_location(location_id: str, location_data: LocationUpdate, current_user: dict = Depends(require_admin)):
    existing = await db.locations.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")
    
    update_dict = {k: v for k, v in location_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_dict.get("address"):
        update_dict["address"] = update_dict["address"] if isinstance(update_dict["address"], dict) else update_dict["address"].model_dump() if hasattr(update_dict["address"], 'model_dump') else dict(update_dict["address"])
    
    await db.locations.update_one({"id": location_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "location", location_id)
    
    updated = await db.locations.find_one({"id": location_id}, {"_id": 0})
    return updated

@api_router.delete("/locations/{location_id}")
async def delete_location(location_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.locations.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")
    
    await db.locations.delete_one({"id": location_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "location", location_id, {"name": existing["name"]})
    
    return {"message": "Location deleted successfully"}

# ==================== FUNCTION ROUTES ====================
@api_router.get("/functions", response_model=List[FunctionResponse])
async def list_functions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    skip = (page - 1) * limit
    functions = await db.functions.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return functions

@api_router.get("/functions/{function_id}", response_model=FunctionResponse)
async def get_function(function_id: str, current_user: dict = Depends(get_current_user)):
    function = await db.functions.find_one({"id": function_id}, {"_id": 0})
    if not function:
        raise HTTPException(status_code=404, detail="Function not found")
    return function

@api_router.post("/functions", response_model=FunctionResponse)
async def create_function(function_data: FunctionCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    function_dict = function_data.model_dump()
    function_dict["id"] = str(uuid.uuid4())
    function_dict["created_at"] = now
    function_dict["updated_at"] = now
    
    await db.functions.insert_one(function_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "function", function_dict["id"], {"name": function_dict["name"]})
    
    return function_dict

@api_router.put("/functions/{function_id}", response_model=FunctionResponse)
async def update_function(function_id: str, function_data: FunctionUpdate, current_user: dict = Depends(require_admin)):
    existing = await db.functions.find_one({"id": function_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Function not found")
    
    update_dict = {k: v for k, v in function_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.functions.update_one({"id": function_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "function", function_id)
    
    updated = await db.functions.find_one({"id": function_id}, {"_id": 0})
    return updated

@api_router.delete("/functions/{function_id}")
async def delete_function(function_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.functions.find_one({"id": function_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Function not found")
    
    await db.functions.delete_one({"id": function_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "function", function_id, {"name": existing["name"]})
    
    return {"message": "Function deleted successfully"}

# ==================== FORMATIVE STAGE ROUTES ====================
@api_router.get("/formative-stages", response_model=List[FormativeStageResponse])
async def list_formative_stages(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    skip = (page - 1) * limit
    stages = await db.formative_stages.find(query, {"_id": 0}).skip(skip).limit(limit).sort("order", 1).to_list(limit)
    return stages

@api_router.get("/formative-stages/{stage_id}", response_model=FormativeStageResponse)
async def get_formative_stage(stage_id: str, current_user: dict = Depends(get_current_user)):
    stage = await db.formative_stages.find_one({"id": stage_id}, {"_id": 0})
    if not stage:
        raise HTTPException(status_code=404, detail="Formative stage not found")
    return stage

@api_router.post("/formative-stages", response_model=FormativeStageResponse)
async def create_formative_stage(stage_data: FormativeStageCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    stage_dict = stage_data.model_dump()
    stage_dict["id"] = str(uuid.uuid4())
    stage_dict["created_at"] = now
    stage_dict["updated_at"] = now
    
    await db.formative_stages.insert_one(stage_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "formative_stage", stage_dict["id"], {"name": stage_dict["name"]})
    
    return stage_dict

@api_router.put("/formative-stages/{stage_id}", response_model=FormativeStageResponse)
async def update_formative_stage(stage_id: str, stage_data: FormativeStageUpdate, current_user: dict = Depends(require_admin)):
    existing = await db.formative_stages.find_one({"id": stage_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Formative stage not found")
    
    update_dict = {k: v for k, v in stage_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.formative_stages.update_one({"id": stage_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "formative_stage", stage_id)
    
    updated = await db.formative_stages.find_one({"id": stage_id}, {"_id": 0})
    return updated

@api_router.delete("/formative-stages/{stage_id}")
async def delete_formative_stage(stage_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.formative_stages.find_one({"id": stage_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Formative stage not found")
    
    await db.formative_stages.delete_one({"id": stage_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "formative_stage", stage_id, {"name": existing["name"]})
    
    return {"message": "Formative stage deleted successfully"}

# ==================== DOCUMENT ROUTES ====================
@api_router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    
    skip = (page - 1) * limit
    documents = await db.documents.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    
    # Filter by permissions
    accessible_docs = []
    for doc in documents:
        if doc.get("is_public") or check_permission(current_user, doc.get("permissions")):
            accessible_docs.append(doc)
    
    return accessible_docs

@api_router.get("/documents/categories")
async def get_document_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.documents.distinct("category")
    return [c for c in categories if c]

@api_router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not doc.get("is_public") and not check_permission(current_user, doc.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment view count
    await db.documents.update_one({"id": doc_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "view", "document", doc_id, {"title": doc["title"]})
    
    doc["views"] = doc.get("views", 0) + 1
    return doc

@api_router.post("/documents", response_model=DocumentResponse)
async def create_document(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    is_public: bool = Form(False),
    permissions: str = Form(None),
    formative_stage_id: str = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin_or_formador)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT")
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / "documents" / f"{file_id}{ext}"
    
    # Save file
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 500MB")
    
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Parse permissions JSON if provided
    perm_dict = None
    if permissions:
        import json
        try:
            perm_dict = json.loads(permissions)
        except:
            perm_dict = None
    
    doc_dict = {
        "id": file_id,
        "title": title,
        "description": description,
        "category": category,
        "is_public": is_public,
        "permissions": perm_dict,
        "version": 1,
        "formative_stage_id": formative_stage_id if formative_stage_id else None,
        "file_url": f"/api/uploads/documents/{file_id}{ext}",
        "file_name": file.filename,
        "file_size": len(content),
        "file_type": ext[1:],
        "uploaded_by": current_user["id"],
        "views": 0,
        "downloads": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.documents.insert_one(doc_dict)
    await log_action(current_user["id"], current_user["full_name"], "upload", "document", file_id, {"title": title})
    
    return doc_dict

@api_router.put("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, doc_data: DocumentUpdate, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_dict = {k: v for k, v in doc_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_dict.get("permissions"):
        update_dict["permissions"] = update_dict["permissions"] if isinstance(update_dict["permissions"], dict) else update_dict["permissions"].model_dump() if hasattr(update_dict["permissions"], 'model_dump') else dict(update_dict["permissions"])
    
    await db.documents.update_one({"id": doc_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "document", doc_id)
    
    updated = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    return updated

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file
    file_path = UPLOAD_DIR / "documents" / f"{doc_id}.{existing['file_type']}"
    if file_path.exists():
        file_path.unlink()
    
    await db.documents.delete_one({"id": doc_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "document", doc_id, {"title": existing["title"]})
    
    return {"message": "Document deleted successfully"}

@api_router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not doc.get("is_public") and not check_permission(current_user, doc.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = UPLOAD_DIR / "documents" / f"{doc_id}.{doc['file_type']}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Increment download count
    await db.documents.update_one({"id": doc_id}, {"$inc": {"downloads": 1}})
    await log_action(current_user["id"], current_user["full_name"], "download", "document", doc_id, {"title": doc["title"]})
    
    return FileResponse(file_path, filename=doc["file_name"], media_type="application/octet-stream")

# ==================== VIDEO ROUTES ====================
@api_router.get("/videos", response_model=List[VideoResponse])
async def list_videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    
    skip = (page - 1) * limit
    videos = await db.videos.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    
    # Filter by permissions
    accessible_videos = []
    for video in videos:
        if video.get("is_public") or check_permission(current_user, video.get("permissions")):
            accessible_videos.append(video)
    
    return accessible_videos

@api_router.get("/videos/categories")
async def get_video_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.videos.distinct("category")
    return [c for c in categories if c]

@api_router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video(video_id: str, current_user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not video.get("is_public") and not check_permission(current_user, video.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment view count
    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "view", "video", video_id, {"title": video["title"]})
    
    video["views"] = video.get("views", 0) + 1
    return video

@api_router.post("/videos", response_model=VideoResponse)
async def create_video(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    is_public: bool = Form(False),
    video_type: str = Form("upload"),
    external_url: str = Form(None),
    permissions: str = Form(None),
    formative_stage_id: str = Form(None),
    file: UploadFile = File(None),
    current_user: dict = Depends(require_admin_or_formador)
):
    now = datetime.now(timezone.utc).isoformat()
    video_id = str(uuid.uuid4())
    
    # Parse permissions JSON if provided
    perm_dict = None
    if permissions:
        import json
        try:
            perm_dict = json.loads(permissions)
        except:
            perm_dict = None
    
    video_dict = {
        "id": video_id,
        "title": title,
        "description": description,
        "category": category,
        "is_public": is_public,
        "permissions": perm_dict,
        "video_type": video_type,
        "external_url": external_url,
        "formative_stage_id": formative_stage_id if formative_stage_id else None,
        "file_url": None,
        "file_name": None,
        "file_size": None,
        "thumbnail_url": None,
        "duration": None,
        "uploaded_by": current_user["id"],
        "views": 0,
        "created_at": now,
        "updated_at": now
    }
    
    if video_type == "upload" and file:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_VIDEO_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid file type. Allowed: MP4, AVI, MOV, MKV, WEBM")
        
        file_path = UPLOAD_DIR / "videos" / f"{video_id}{ext}"
        
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 500MB")
        
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        video_dict["file_url"] = f"/api/uploads/videos/{video_id}{ext}"
        video_dict["file_name"] = file.filename
        video_dict["file_size"] = len(content)
    
    await db.videos.insert_one(video_dict)
    await log_action(current_user["id"], current_user["full_name"], "upload", "video", video_id, {"title": title})
    
    return video_dict

@api_router.put("/videos/{video_id}", response_model=VideoResponse)
async def update_video(video_id: str, video_data: VideoUpdate, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.videos.find_one({"id": video_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Video not found")
    
    update_dict = {k: v for k, v in video_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_dict.get("permissions"):
        update_dict["permissions"] = update_dict["permissions"] if isinstance(update_dict["permissions"], dict) else update_dict["permissions"].model_dump() if hasattr(update_dict["permissions"], 'model_dump') else dict(update_dict["permissions"])
    
    await db.videos.update_one({"id": video_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "video", video_id)
    
    updated = await db.videos.find_one({"id": video_id}, {"_id": 0})
    return updated

@api_router.delete("/videos/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.videos.find_one({"id": video_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Delete file if exists
    if existing.get("file_url"):
        file_name = existing["file_url"].split("/")[-1]
        file_path = UPLOAD_DIR / "videos" / file_name
        if file_path.exists():
            file_path.unlink()
    
    await db.videos.delete_one({"id": video_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "video", video_id, {"title": existing["title"]})
    
    return {"message": "Video deleted successfully"}

# Video Progress
@api_router.get("/videos/{video_id}/progress", response_model=VideoProgressResponse)
async def get_video_progress(video_id: str, current_user: dict = Depends(get_current_user)):
    progress = await db.video_progress.find_one(
        {"video_id": video_id, "user_id": current_user["id"]}, 
        {"_id": 0}
    )
    if not progress:
        return VideoProgressResponse(
            video_id=video_id,
            user_id=current_user["id"],
            progress_seconds=0,
            completed=False,
            last_watched=datetime.now(timezone.utc).isoformat()
        )
    return progress

@api_router.post("/videos/{video_id}/progress", response_model=VideoProgressResponse)
async def update_video_progress(
    video_id: str, 
    progress_data: VideoProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat()
    
    await db.video_progress.update_one(
        {"video_id": video_id, "user_id": current_user["id"]},
        {"$set": {
            "video_id": video_id,
            "user_id": current_user["id"],
            "progress_seconds": progress_data.progress_seconds,
            "completed": progress_data.completed,
            "last_watched": now
        }},
        upsert=True
    )
    
    return VideoProgressResponse(
        video_id=video_id,
        user_id=current_user["id"],
        progress_seconds=progress_data.progress_seconds,
        completed=progress_data.completed,
        last_watched=now
    )

# ==================== ACOMPANHAMENTO ROUTES ====================
async def require_formador(current_user: dict = Depends(get_current_user)) -> dict:
    """Only formadores can create/manage acompanhamentos"""
    if current_user.get("role") not in [UserRole.ADMIN, UserRole.FORMADOR]:
        raise HTTPException(status_code=403, detail="Only formadores can manage follow-ups")
    return current_user

@api_router.get("/acompanhamentos/my-formandos")
async def get_my_formandos(current_user: dict = Depends(require_formador)):
    """Get list of users that have this formador as their responsible"""
    formandos = await db.users.find(
        {"formador_id": current_user["id"], "status": UserStatus.ACTIVE},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    return formandos

@api_router.get("/acompanhamentos", response_model=List[AcompanhamentoResponse])
async def list_acompanhamentos(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Admin sees all, formador sees their own created, user sees only their own
    if current_user.get("role") == UserRole.ADMIN:
        pass  # No filter for admin
    elif current_user.get("role") == UserRole.FORMADOR:
        query["formador_id"] = current_user["id"]
    else:
        # Regular user can only see their own acompanhamentos
        query["user_id"] = current_user["id"]
    
    if user_id and current_user.get("role") in [UserRole.ADMIN, UserRole.FORMADOR]:
        query["user_id"] = user_id
    
    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id
    
    skip = (page - 1) * limit
    acompanhamentos = await db.acompanhamentos.find(query, {"_id": 0}).skip(skip).limit(limit).sort("date", -1).to_list(limit)
    return acompanhamentos

@api_router.get("/acompanhamentos/count-by-stage")
async def get_acompanhamentos_count_by_stage(current_user: dict = Depends(get_current_user)):
    """Get count of acompanhamentos per formative stage"""
    query = {}
    
    if current_user.get("role") == UserRole.FORMADOR:
        query["formador_id"] = current_user["id"]
    elif current_user.get("role") == UserRole.USER:
        query["user_id"] = current_user["id"]
    
    # Get all acompanhamentos matching query
    acompanhamentos = await db.acompanhamentos.find(query, {"formative_stage_id": 1}).to_list(10000)
    
    # Count by stage
    counts = {}
    for acomp in acompanhamentos:
        stage_id = acomp.get("formative_stage_id")
        if stage_id:
            counts[stage_id] = counts.get(stage_id, 0) + 1
    
    return counts

@api_router.get("/acompanhamentos/{acomp_id}", response_model=AcompanhamentoResponse)
async def get_acompanhamento(acomp_id: str, current_user: dict = Depends(get_current_user)):
    acomp = await db.acompanhamentos.find_one({"id": acomp_id}, {"_id": 0})
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")
    
    # Check permissions
    if current_user.get("role") == UserRole.USER:
        if acomp["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.get("role") == UserRole.FORMADOR:
        if acomp["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return acomp

@api_router.post("/acompanhamentos", response_model=AcompanhamentoResponse)
async def create_acompanhamento(
    acomp_data: AcompanhamentoCreate,
    current_user: dict = Depends(require_formador)
):
    # Verify that the user being followed up has this formador as responsible
    target_user = await db.users.find_one({"id": acomp_data.user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only allow if formador is the responsible or if admin
    if current_user.get("role") != UserRole.ADMIN:
        if target_user.get("formador_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only create follow-ups for your assigned users")
    
    now = datetime.now(timezone.utc).isoformat()
    acomp_dict = acomp_data.model_dump()
    acomp_dict["id"] = str(uuid.uuid4())
    acomp_dict["formador_id"] = current_user["id"]
    acomp_dict["formador_name"] = current_user["full_name"]
    acomp_dict["user_name"] = target_user["full_name"]
    acomp_dict["created_at"] = now
    acomp_dict["updated_at"] = now
    
    # Use the formando's formative stage if not specified
    if not acomp_dict.get("formative_stage_id"):
        acomp_dict["formative_stage_id"] = target_user.get("formative_stage_id")
    
    await db.acompanhamentos.insert_one(acomp_dict)
    await log_action(current_user["id"], current_user["full_name"], "create", "acompanhamento", acomp_dict["id"], {"user": target_user["full_name"]})
    
    return acomp_dict

@api_router.put("/acompanhamentos/{acomp_id}", response_model=AcompanhamentoResponse)
async def update_acompanhamento(
    acomp_id: str,
    acomp_data: AcompanhamentoUpdate,
    current_user: dict = Depends(require_formador)
):
    existing = await db.acompanhamentos.find_one({"id": acomp_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")
    
    # Only the formador who created it or admin can update
    if current_user.get("role") != UserRole.ADMIN:
        if existing["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only edit your own follow-ups")
    
    update_dict = {k: v for k, v in acomp_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.acompanhamentos.update_one({"id": acomp_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "acompanhamento", acomp_id)
    
    updated = await db.acompanhamentos.find_one({"id": acomp_id}, {"_id": 0})
    return updated

@api_router.delete("/acompanhamentos/{acomp_id}")
async def delete_acompanhamento(acomp_id: str, current_user: dict = Depends(require_formador)):
    existing = await db.acompanhamentos.find_one({"id": acomp_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Acompanhamento not found")
    
    # Only the formador who created it or admin can delete
    if current_user.get("role") != UserRole.ADMIN:
        if existing["formador_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own follow-ups")
    
    await db.acompanhamentos.delete_one({"id": acomp_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "acompanhamento", acomp_id)
    
    return {"message": "Acompanhamento deleted successfully"}

# ==================== AUDIT LOG ROUTES ====================
@api_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    
    skip = (page - 1) * limit
    logs = await db.audit_logs.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return logs

# ==================== DASHBOARD/STATS ROUTES ====================
@api_router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Count totals
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": UserStatus.ACTIVE})
    total_documents = await db.documents.count_documents({})
    total_videos = await db.videos.count_documents({})
    total_locations = await db.locations.count_documents({})
    total_functions = await db.functions.count_documents({})
    total_stages = await db.formative_stages.count_documents({})
    
    # Users by role
    admins = await db.users.count_documents({"role": UserRole.ADMIN})
    formadores = await db.users.count_documents({"role": UserRole.FORMADOR})
    common_users = await db.users.count_documents({"role": UserRole.USER})
    
    # Recent activity
    recent_logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admins,
            "formadores": formadores,
            "common_users": common_users
        },
        "content": {
            "documents": total_documents,
            "videos": total_videos
        },
        "organization": {
            "locations": total_locations,
            "functions": total_functions,
            "formative_stages": total_stages
        },
        "recent_activity": recent_logs
    }

# ==================== FILE SERVING ====================
@api_router.get("/uploads/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    if folder not in ["documents", "videos", "photos"]:
        raise HTTPException(status_code=404, detail="Invalid folder")
    
    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

# ==================== HEALTH CHECK ====================
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and configure CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
