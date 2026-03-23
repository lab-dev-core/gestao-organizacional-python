from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from app.models.enums import UserRole, UserStatus, EducationLevel, MaritalStatus


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


class SacramentsModel(BaseModel):
    """Registro de sacramentos recebidos pelo usuário."""
    baptism: bool = False
    baptism_date: Optional[str] = None
    first_communion: bool = False
    first_communion_date: Optional[str] = None
    confirmation: bool = False
    confirmation_date: Optional[str] = None
    marriage: bool = False
    marriage_date: Optional[str] = None


class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    username: Optional[str] = None
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

    # Campos de perfil pessoal/comunidade
    marital_status: Optional[MaritalStatus] = None
    has_children: Optional[bool] = None
    children_count: Optional[int] = None
    community_entry_date: Optional[str] = None   # Data de ingresso na comunidade
    community_entry_place: Optional[str] = None  # Recanto/local onde foi acolhido
    sacraments: Optional[SacramentsModel] = None

    children_names: Optional[str] = None              # Nomes dos filhos (campo livre)

    # Saúde (informações sensíveis — acesso restrito ao formador/admin)
    psychiatric_followup: Optional[bool] = None      # Faz acompanhamento psiquiátrico?
    psychiatric_medication: Optional[bool] = None    # Toma medicação psiquiátrica?
    psychological_followup: Optional[bool] = None    # Faz acompanhamento psicológico?


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = None
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

    # Campos de perfil pessoal/comunidade
    marital_status: Optional[MaritalStatus] = None
    has_children: Optional[bool] = None
    children_count: Optional[int] = None
    community_entry_date: Optional[str] = None
    community_entry_place: Optional[str] = None
    sacraments: Optional[SacramentsModel] = None
    children_names: Optional[str] = None

    # Saúde
    psychiatric_followup: Optional[bool] = None
    psychiatric_medication: Optional[bool] = None
    psychological_followup: Optional[bool] = None


class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


class LoginRequest(BaseModel):
    identifier: str  # Can be email, username, or CPF
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
