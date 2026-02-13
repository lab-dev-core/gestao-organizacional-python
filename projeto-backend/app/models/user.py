from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from app.models.enums import UserRole, UserStatus, EducationLevel


class AddressModel(BaseModel):
    cep: str = ""
    street: str = ""
    number: str = ""
    complement: str = ""
    neighborhood: str = ""
    city: str = ""
    state: str = ""


class FamilyContactModel(BaseModel):
    name: str = ""
    phone: str = ""
    relationship: str = ""


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
    roles: List[UserRole] = [UserRole.USER]
    status: UserStatus = UserStatus.ACTIVE
    photo_url: Optional[str] = None
    is_tenant_owner: bool = False
    family_contact: Optional[FamilyContactModel] = None
    education_level: Optional[EducationLevel] = None


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
    roles: Optional[List[UserRole]] = None
    status: Optional[UserStatus] = None
    photo_url: Optional[str] = None
    password: Optional[str] = None
    family_contact: Optional[FamilyContactModel] = None
    education_level: Optional[EducationLevel] = None


class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: Optional[str] = None


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
