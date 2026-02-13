from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class PermissionModel(BaseModel):
    location_ids: List[str] = []
    user_ids: List[str] = []
    function_ids: List[str] = []
    formative_stage_ids: List[str] = []


class DocumentBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    version: int = 1
    is_public: bool = False
    formative_stage_id: Optional[str] = None
    subcategory_id: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    permissions: Optional[PermissionModel] = None
    is_public: Optional[bool] = None
    formative_stage_id: Optional[str] = None
    subcategory_id: Optional[str] = None


class DocumentResponse(DocumentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    file_url: str
    file_name: str
    file_size: int
    file_type: str
    storage: Optional[str] = "local"
    uploaded_by: str
    views: int = 0
    downloads: int = 0
    formative_stage_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    created_at: str
    updated_at: str
