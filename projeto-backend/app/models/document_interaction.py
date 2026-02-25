from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


# --- Document Comments ---

class DocumentCommentBase(BaseModel):
    """Comentário em um documento"""
    document_id: str
    content: str
    parent_id: Optional[str] = None  # Para respostas a comentários


class DocumentCommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None


class DocumentCommentUpdate(BaseModel):
    content: Optional[str] = None


class DocumentCommentResponse(DocumentCommentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    user_photo_url: Optional[str] = None
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


# --- Document Evaluations ---

class DocumentEvaluationBase(BaseModel):
    """Avaliação/nota de um documento pelo usuário"""
    document_id: str
    score: int  # 1-5
    feedback: Optional[str] = None


class DocumentEvaluationCreate(BaseModel):
    score: int  # 1-5
    feedback: Optional[str] = None


class DocumentEvaluationResponse(DocumentEvaluationBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


# --- Document Attachments ---

class DocumentAttachmentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    document_id: str
    file_url: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_by: str
    tenant_id: Optional[str] = None
    created_at: str


# --- Gradual Release for Documents ---

class DocumentReleaseType(str, Enum):
    FREE = "free"            # Liberado sem restrição
    SEQUENTIAL = "sequential"  # Liberado após visualizar/baixar o documento anterior
    EVALUATION = "evaluation"  # Liberado após avaliação mínima no documento anterior
    COMPLETION = "completion"  # Liberado após download completo do documento anterior


class DocumentGradualReleaseConfig(BaseModel):
    """Configuração de liberação gradativa de documento"""
    release_type: DocumentReleaseType = DocumentReleaseType.FREE
    prerequisite_document_id: Optional[str] = None  # Documento que deve ser acessado antes
    min_evaluation_score: Optional[int] = None  # Nota mínima para liberar (1-5)
    require_download: bool = False  # Requer download do anterior?


class DocumentAccessStatus(BaseModel):
    """Status de acesso do usuário a um documento"""
    document_id: str
    is_unlocked: bool
    reason: Optional[str] = None  # Motivo de bloqueio
    prerequisite_document_title: Optional[str] = None
    prerequisite_completed: Optional[bool] = None
    prerequisite_score: Optional[int] = None
    required_score: Optional[int] = None


# --- Document Access Tracking (per-user) ---

class DocumentAccessRecord(BaseModel):
    """Rastreamento de acesso por usuário a um documento"""
    document_id: str
    user_id: str
    views: int = 0
    downloads: int = 0
    last_accessed: str
