from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from app.database import db
from app.models import (
    UserCreate, UserResponse, LoginRequest, TokenResponse,
    RefreshTokenRequest, PasswordResetRequest, PasswordResetConfirm
)
from app.models.enums import UserStatus
from app.utils.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, create_reset_token, decode_token, get_current_user
)
from app.utils.audit import log_action
from app.services.email import send_password_reset_email

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
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

    if user_dict.get("address"):
        user_dict["address"] = user_dict["address"] if isinstance(user_dict["address"], dict) else user_dict["address"].model_dump() if hasattr(user_dict["address"], 'model_dump') else dict(user_dict["address"])

    mongo_doc = dict(user_dict)
    await db.users.insert_one(mongo_doc)

    del user_dict["password"]

    access_token = create_access_token(user_dict["id"], user_dict["role"])
    refresh_token = create_refresh_token(user_dict["id"])

    await log_action(user_dict["id"], user_dict["full_name"], "register", "user", user_dict["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_dict
    )


@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("status") == UserStatus.INACTIVE:
        raise HTTPException(status_code=403, detail="Account is inactive")

    access_token = create_access_token(user["id"], user["role"])
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

    access_token = create_access_token(user["id"], user["role"])
    new_refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=user
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/password-reset/request")
async def request_password_reset(reset_data: PasswordResetRequest):
    """Request a password reset email"""
    user = await db.users.find_one({"email": reset_data.email}, {"_id": 0})

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
