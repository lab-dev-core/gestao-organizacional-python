from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


class ContentType(str, Enum):
    VIDEO = "video"
    DOCUMENT = "document"
    MIXED = "mixed"  # Aceita ambos


class ContentSubcategoryBase(BaseModel):
    """
    Subcategoria de conteúdo dentro de uma etapa formativa.
    Permite organizar vídeos e documentos em subcategorias dentro das etapas.
    """
    name: str
    description: Optional[str] = None
    formative_stage_id: str
    content_type: ContentType = ContentType.MIXED
    order: int = 0  # Ordem de exibição
    is_active: bool = True


class ContentSubcategoryCreate(ContentSubcategoryBase):
    pass


class ContentSubcategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[ContentType] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class ContentSubcategoryResponse(ContentSubcategoryBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: Optional[str] = None
    stage_name: Optional[str] = None
    video_count: int = 0
    document_count: int = 0
    created_at: str
    updated_at: str
