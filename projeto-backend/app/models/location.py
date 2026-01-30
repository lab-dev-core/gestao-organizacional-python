from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.models.enums import UserStatus
from app.models.user import AddressModel


class LocationBase(BaseModel):
    name: str
    address: Optional[AddressModel] = None
    responsible: Optional[str] = None
    capacity: Optional[int] = None
    status: UserStatus = UserStatus.ACTIVE


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[AddressModel] = None
    responsible: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[UserStatus] = None


class LocationResponse(LocationBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    updated_at: str
