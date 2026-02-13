from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from enum import Enum


# --- Video Comments ---

class VideoCommentBase(BaseModel):
    """Comentário em um vídeo"""
    video_id: str
    content: str
    parent_id: Optional[str] = None  # Para respostas a comentários


class VideoCommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None


class VideoCommentUpdate(BaseModel):
    content: Optional[str] = None


class VideoCommentResponse(VideoCommentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    user_photo_url: Optional[str] = None
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


# --- Video Evaluations ---

class VideoEvaluationBase(BaseModel):
    """Avaliação/nota de um vídeo pelo usuário"""
    video_id: str
    score: int  # 1-5
    feedback: Optional[str] = None


class VideoEvaluationCreate(BaseModel):
    score: int  # 1-5
    feedback: Optional[str] = None


class VideoEvaluationResponse(VideoEvaluationBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


# --- Video Attachments ---

class VideoAttachmentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    video_id: str
    file_url: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_by: str
    created_at: str


# --- Gradual Release Config ---

class ReleaseType(str, Enum):
    FREE = "free"                    # Liberado sem restrição
    SEQUENTIAL = "sequential"        # Liberado sequencialmente (assistir anterior)
    EVALUATION = "evaluation"        # Liberado após avaliação/nota mínima
    COMPLETION = "completion"        # Liberado após visualização completa do anterior


class GradualReleaseConfig(BaseModel):
    """Configuração de liberação gradativa de vídeo"""
    release_type: ReleaseType = ReleaseType.FREE
    prerequisite_video_id: Optional[str] = None  # Vídeo que deve ser assistido antes
    min_evaluation_score: Optional[int] = None  # Nota mínima na avaliação para liberar
    require_completion: bool = False  # Requer visualização completa?


class VideoAccessStatus(BaseModel):
    """Status de acesso do usuário a um vídeo"""
    video_id: str
    is_unlocked: bool
    reason: Optional[str] = None  # Motivo de bloqueio
    prerequisite_video_title: Optional[str] = None
    prerequisite_completed: Optional[bool] = None
    prerequisite_score: Optional[int] = None
    required_score: Optional[int] = None
