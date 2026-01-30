from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.models.enums import AcompanhamentoFrequency


class AcompanhamentoBase(BaseModel):
    user_id: str
    formative_stage_id: Optional[str] = None
    date: str
    time: str
    location: str
    content: str
    frequency: AcompanhamentoFrequency = AcompanhamentoFrequency.BIWEEKLY


class AcompanhamentoCreate(AcompanhamentoBase):
    pass


class AcompanhamentoUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    content: Optional[str] = None
    frequency: Optional[AcompanhamentoFrequency] = None
    formative_stage_id: Optional[str] = None


class AcompanhamentoResponse(AcompanhamentoBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    formador_id: str
    formador_name: str
    user_name: str
    created_at: str
    updated_at: str
