from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from app.models.enums import UserRole, UserStatus


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
    is_tenant_owner: bool = False  # Owner of the tenant/organization


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
    tenant_id: Optional[str] = None  # None for superadmins
    created_at: str
    updated_at: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: Optional[str] = None  # Optional: login to specific tenant


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
