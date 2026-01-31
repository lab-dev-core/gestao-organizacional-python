from pydantic import BaseModel, ConfigDict
from typing import Optional


class UserJourneyBase(BaseModel):
    """
    Registra uma transição na jornada formativa do usuário.
    Cada registro representa uma mudança de etapa formativa.
    """
    user_id: str
    from_stage_id: Optional[str] = None  # None quando é a primeira etapa
    to_stage_id: str
    notes: Optional[str] = None  # Observações sobre a transição
    changed_by_id: str  # ID de quem fez a alteração
    changed_by_name: str  # Nome de quem fez a alteração


class UserJourneyCreate(BaseModel):
    to_stage_id: str
    notes: Optional[str] = None


class UserJourneyResponse(UserJourneyBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    from_stage_name: Optional[str] = None
    to_stage_name: Optional[str] = None
    user_name: Optional[str] = None
    transition_date: str
    created_at: str
