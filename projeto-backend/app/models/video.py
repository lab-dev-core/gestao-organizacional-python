from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict
from app.models.document import PermissionModel
from app.models.video_interaction import GradualReleaseConfig


class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    video_type: str = "upload"
    external_url: Optional[str] = None
    is_public: bool = False
    formative_stage_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    order: int = 0  # Ordem dentro da subcategoria
    allow_comments: bool = True  # Permitir comentários
    allow_evaluation: bool = False  # Permitir avaliação/nota
    gradual_release: Optional[GradualReleaseConfig] = None  # Liberação gradativa


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
    subcategory_id: Optional[str] = None
    order: Optional[int] = None
    allow_comments: Optional[bool] = None
    allow_evaluation: Optional[bool] = None
    gradual_release: Optional[GradualReleaseConfig] = None


class VideoResponse(VideoBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    storage: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    uploaded_by: str
    views: int = 0
    formative_stage_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    comment_count: int = 0
    average_rating: Optional[float] = None
    is_unlocked: Optional[bool] = None  # Para liberação gradativa
    created_at: str
    updated_at: str


class VideoProgressUpdate(BaseModel):
    progress_seconds: int
    completed: bool = False


class VideoProgressResponse(BaseModel):
    video_id: str
    user_id: str
    progress_seconds: int
    completed: bool
    last_watched: str
