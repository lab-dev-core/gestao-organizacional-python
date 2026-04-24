from pydantic import BaseModel, ConfigDict
from typing import Optional


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target: str = "all"  # "all" | "stage" | "role"
    formative_stage_id: Optional[str] = None
    target_role: Optional[str] = None
    pinned: bool = False
    expires_at: Optional[str] = None  # ISO date string YYYY-MM-DD or datetime


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    target: Optional[str] = None
    formative_stage_id: Optional[str] = None
    target_role: Optional[str] = None
    pinned: Optional[bool] = None
    expires_at: Optional[str] = None


class AnnouncementResponse(AnnouncementCreate):
    model_config = ConfigDict(extra="ignore")

    id: str
    created_by_id: str
    created_by_name: str
    created_at: str
    updated_at: str
    tenant_id: Optional[str] = None
