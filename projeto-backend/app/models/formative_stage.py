from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class FormativeStageBase(BaseModel):
    name: str
    description: Optional[str] = None
    order: int = 0
    estimated_duration: Optional[str] = None
    prerequisites: Optional[List[str]] = []


class FormativeStageCreate(FormativeStageBase):
    pass


class FormativeStageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    estimated_duration: Optional[str] = None
    prerequisites: Optional[List[str]] = None


class FormativeStageResponse(FormativeStageBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str
