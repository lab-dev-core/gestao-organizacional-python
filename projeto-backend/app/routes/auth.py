from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from app.database import db
from app.models import (
    UserCreate, UserResponse, LoginRequest, TokenResponse,
    RefreshTokenRequest, PasswordResetRequest, PasswordResetConfirm,
    TenantStatus
)
from app.models.enums import UserStatus, UserRole
from app.utils.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, create_reset_token, decode_token, get_current_user,
    check_tenant_limits
)
from app.utils.audit import log_action
from app.services.email import send_password_reset_email

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate, tenant_slug: str = None):
    """
    Register a new user.
    - If tenant_slug is provided, registers within that tenant
    - Without tenant_slug, registration is not allowed (must be invited or created by admin)
    """
    if not tenant_slug:
        raise HTTPException(
            status_code=400,
            detail="Tenant slug is required. Please access via your organization's URL."
        )

    # Find tenant
    tenant = await db.tenants.find_one({"slug": tenant_slug, "status": TenantStatus.ACTIVE})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found or inactive")

    # Check tenant limits
    await check_tenant_limits(tenant["id"], "users")

    # Check if email exists within tenant
    existing = await db.users.find_one({"email": user_data.email, "tenant_id": tenant["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered in this organization")

    # Check if CPF exists within tenant
    if user_data.cpf:
        existing_cpf = await db.users.find_one({"cpf": user_data.cpf, "tenant_id": tenant["id"]})
        if existing_cpf:
            raise HTTPException(status_code=400, detail="CPF already registered in this organization")

    now = datetime.now(timezone.utc).isoformat()
    user_dict = user_data.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["tenant_id"] = tenant["id"]
    user_dict["password"] = hash_password(user_data.password)
    user_dict["role"] = UserRole.USER  # New registrations are always regular users
    user_dict["is_tenant_owner"] = False
    user_dict["created_at"] = now
    user_dict["updated_at"] = now

    if user_dict.get("address"):
        user_dict["address"] = user_dict["address"] if isinstance(user_dict["address"], dict) else user_dict["address"].model_dump() if hasattr(user_dict["address"], 'model_dump') else dict(user_dict["address"])

    mongo_doc = dict(user_dict)
    await db.users.insert_one(mongo_doc)

    del user_dict["password"]

    access_token = create_access_token(user_dict["id"], user_dict["role"], tenant["id"])
    refresh_token = create_refresh_token(user_dict["id"])

    await log_action(user_dict["id"], user_dict["full_name"], "register", "user", user_dict["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_dict
    )


@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """
    Login user.
    - If tenant_slug is provided, login within that tenant only
    - If not provided, search across all tenants (will fail if user exists in multiple)
    - Superadmins can login without tenant_slug
    """
    query = {"email": login_data.email}

    if login_data.tenant_slug:
        # Find tenant
        tenant = await db.tenants.find_one({"slug": login_data.tenant_slug})
        if not tenant:
            raise HTTPException(status_code=404, detail="Organization not found")

        if tenant.get("status") != TenantStatus.ACTIVE:
            raise HTTPException(status_code=403, detail="Organization is inactive")

        query["tenant_id"] = tenant["id"]

    user = await db.users.find_one(query, {"_id": 0})

    # If no tenant specified, check if it's a superadmin
    if not user and not login_data.tenant_slug:
        # Try to find superadmin (they don't have tenant_id)
        user = await db.users.find_one({
            "email": login_data.email,
            "role": UserRole.SUPERADMIN
        }, {"_id": 0})

    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("status") == UserStatus.INACTIVE:
        raise HTTPException(status_code=403, detail="Account is inactive")

    # Check if tenant is active (for non-superadmins)
    if user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": user["tenant_id"]})
        if tenant and tenant.get("status") != TenantStatus.ACTIVE:
            raise HTTPException(status_code=403, detail="Your organization is inactive. Please contact support.")

    access_token = create_access_token(user["id"], user["role"], user.get("tenant_id"))
    refresh_token = create_refresh_token(user["id"])

    user_response = {k: v for k, v in user.items() if k != "password"}

    await log_action(user["id"], user["full_name"], "login", "user", user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_data: RefreshTokenRequest):
    payload = decode_token(refresh_data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token(user["id"], user["role"], user.get("tenant_id"))
    new_refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=user
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    # Add tenant info if user belongs to a tenant
    if current_user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": current_user["tenant_id"]}, {"_id": 0})
        if tenant:
            current_user["tenant"] = {
                "id": tenant["id"],
                "name": tenant["name"],
                "slug": tenant["slug"],
                "plan": tenant["plan"]
            }
    return current_user


@router.post("/password-reset/request")
async def request_password_reset(reset_data: PasswordResetRequest, tenant_slug: str = None):
    """Request a password reset email"""
    query = {"email": reset_data.email}

    if tenant_slug:
        tenant = await db.tenants.find_one({"slug": tenant_slug})
        if tenant:
            query["tenant_id"] = tenant["id"]

    user = await db.users.find_one(query, {"_id": 0})

    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a reset link will be sent"}

    token = create_reset_token(user["id"])

    # Store the reset token
    await db.password_resets.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False
        }},
        upsert=True
    )

    # Send email
    await send_password_reset_email(user["email"], token, user["full_name"])

    await log_action(user["id"], user["full_name"], "password_reset_request", "user", user["id"])

    return {"message": "If the email exists, a reset link will be sent"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(reset_data: PasswordResetConfirm):
    """Confirm password reset with token"""
    try:
        payload = decode_token(reset_data.token)
    except HTTPException:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid token type")

    # Check if token was already used
    reset_record = await db.password_resets.find_one({
        "user_id": payload["user_id"],
        "token": reset_data.token,
        "used": False
    })

    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or already used token")

    # Update password
    new_password_hash = hash_password(reset_data.new_password)
    await db.users.update_one(
        {"id": payload["user_id"]},
        {"$set": {
            "password": new_password_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Mark token as used
    await db.password_resets.update_one(
        {"user_id": payload["user_id"], "token": reset_data.token},
        {"$set": {"used": True}}
    )

    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    await log_action(user["id"], user["full_name"], "password_reset_confirm", "user", user["id"])

    return {"message": "Password reset successful"}
