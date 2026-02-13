import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS, REFRESH_TOKEN_EXPIRE_DAYS
from app.database import db
from app.models.enums import UserRole

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def get_user_roles(user: dict) -> list:
    """Get roles from user dict, handling backward compat (old 'role' field -> new 'roles' list)."""
    if "roles" in user and isinstance(user["roles"], list):
        return user["roles"]
    if "role" in user:
        return [user["role"]]
    return [UserRole.USER]


def normalize_user_roles(user: dict) -> dict:
    """Ensure user dict has 'roles' list, converting from old 'role' field if needed."""
    roles = get_user_roles(user)
    user["roles"] = roles
    return user


def create_access_token(user_id: str, roles, tenant_id: str = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    roles_list = roles if isinstance(roles, list) else [roles]
    payload = {
        "user_id": user_id,
        "roles": roles_list,
        "tenant_id": tenant_id,
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"user_id": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_reset_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {"user_id": user_id, "exp": expire, "type": "reset"}
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
    normalize_user_roles(user)
    return user


async def require_superadmin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require superadmin role - can manage all tenants"""
    roles = get_user_roles(current_user)
    if UserRole.SUPERADMIN not in roles:
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin role within the tenant (or superadmin)"""
    roles = get_user_roles(current_user)
    if UserRole.ADMIN not in roles and UserRole.SUPERADMIN not in roles:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_admin_or_formador(current_user: dict = Depends(get_current_user)) -> dict:
    roles = get_user_roles(current_user)
    if not any(r in roles for r in [UserRole.ADMIN, UserRole.FORMADOR, UserRole.SUPERADMIN]):
        raise HTTPException(status_code=403, detail="Admin or Formador access required")
    return current_user


async def require_formador(current_user: dict = Depends(get_current_user)) -> dict:
    roles = get_user_roles(current_user)
    if not any(r in roles for r in [UserRole.ADMIN, UserRole.FORMADOR, UserRole.SUPERADMIN]):
        raise HTTPException(status_code=403, detail="Only formadores can manage follow-ups")
    return current_user


def get_tenant_filter(current_user: dict) -> dict:
    """Get tenant filter for queries - superadmin sees all, others see only their tenant"""
    roles = get_user_roles(current_user)
    if UserRole.SUPERADMIN in roles:
        return {}  # No filter for superadmin

    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="User not associated with any tenant")

    return {"tenant_id": tenant_id}


async def check_tenant_limits(tenant_id: str, resource_type: str) -> None:
    """Check if tenant has reached their plan limits"""
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if resource_type == "users":
        current_count = await db.users.count_documents({"tenant_id": tenant_id})
        if current_count >= tenant.get("max_users", 10):
            raise HTTPException(
                status_code=403,
                detail=f"User limit reached ({tenant.get('max_users', 10)} users). Please upgrade your plan."
            )

    elif resource_type == "storage":
        # Check storage limit
        docs = await db.documents.find({"tenant_id": tenant_id}, {"file_size": 1}).to_list(10000)
        videos = await db.videos.find({"tenant_id": tenant_id}, {"file_size": 1}).to_list(10000)

        storage_bytes = sum(d.get("file_size", 0) or 0 for d in docs)
        storage_bytes += sum(v.get("file_size", 0) or 0 for v in videos)
        storage_gb = storage_bytes / (1024 ** 3)

        max_storage = tenant.get("max_storage_gb", 5)
        if storage_gb >= max_storage:
            raise HTTPException(
                status_code=403,
                detail=f"Storage limit reached ({max_storage} GB). Please upgrade your plan."
            )
