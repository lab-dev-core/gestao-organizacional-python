from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class FunctionBase(BaseModel):
    name: str
    description: Optional[str] = None
    hierarchy_level: Optional[int] = 0
    permissions: Optional[List[str]] = []


class FunctionCreate(FunctionBase):
    pass


class FunctionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    hierarchy_level: Optional[int] = None
    permissions: Optional[List[str]] = None


class FunctionResponse(FunctionBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str
