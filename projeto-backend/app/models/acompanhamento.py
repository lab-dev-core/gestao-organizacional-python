from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from app.models.enums import AcompanhamentoFrequency, AcompanhamentoStatus


class AcompanhamentoAttachment(BaseModel):
    file_name: str
    file_url: str
    file_size: int
    file_type: str
    uploaded_at: str


class AcompanhamentoBase(BaseModel):
    user_id: str
    formative_stage_id: Optional[str] = None
    date: str
    time: str
    location: str
    content: str
    frequency: AcompanhamentoFrequency = AcompanhamentoFrequency.BIWEEKLY
    status: AcompanhamentoStatus = AcompanhamentoStatus.REALIZADO
    next_acompanhamento_date: Optional[str] = None
    next_steps: Optional[str] = None
    avaliacao: Optional[str] = None          # verde | amarelo | vermelho
    tags: Optional[List[str]] = []


class AcompanhamentoCreate(AcompanhamentoBase):
    pass


class AcompanhamentoUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    content: Optional[str] = None
    frequency: Optional[AcompanhamentoFrequency] = None
    formative_stage_id: Optional[str] = None
    status: Optional[AcompanhamentoStatus] = None
    next_acompanhamento_date: Optional[str] = None
    next_steps: Optional[str] = None
    avaliacao: Optional[str] = None
    tags: Optional[List[str]] = None


class AcompanhamentoResponse(AcompanhamentoBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    formador_id: str
    formador_name: str
    user_name: str
    attachments: Optional[List[AcompanhamentoAttachment]] = []
    created_at: str
    updated_at: str
