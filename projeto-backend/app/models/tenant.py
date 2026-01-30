from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
from enum import Enum


class TenantPlan(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class TenantStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class TenantBase(BaseModel):
    name: str
    slug: str  # URL-friendly identifier (e.g., "empresa-abc")
    plan: TenantPlan = TenantPlan.FREE
    max_users: int = 10
    max_storage_gb: int = 5
    status: TenantStatus = TenantStatus.ACTIVE
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[dict] = None


class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: TenantPlan = TenantPlan.FREE
    max_users: int = 10
    max_storage_gb: int = 5
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    # Owner info (first admin of the tenant)
    owner_name: str
    owner_email: EmailStr
    owner_password: str


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[TenantPlan] = None
    max_users: Optional[int] = None
    max_storage_gb: Optional[int] = None
    status: Optional[TenantStatus] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[dict] = None


class TenantResponse(TenantBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str
    user_count: Optional[int] = 0
    storage_used_gb: Optional[float] = 0


class TenantStatsResponse(BaseModel):
    tenant_id: str
    tenant_name: str
    user_count: int
    document_count: int
    video_count: int
    storage_used_gb: float
    plan: TenantPlan
    max_users: int
    max_storage_gb: int
