from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum




class CycleStatus(str, Enum):
    PLANNED = "planned"        # Planejado, ainda não iniciou
    IN_PROGRESS = "in_progress"  # Em andamento
    FINISHED = "finished"      # Encerrado


class StageCycleBase(BaseModel):
    """
    Ciclo/Turma de uma etapa formativa.
    Representa uma edição específica de uma etapa com datas definidas.
    Ex: "Aspirantado 2024", "Aspirantado 2025"
    """
    formative_stage_id: str
    name: str  # Ex: "Turma 2024", "2024/2025"
    description: Optional[str] = None
    start_date: str  # Data de início (ISO format)
    end_date: str  # Data de término (ISO format)
    status: CycleStatus = CycleStatus.PLANNED
    max_participants: Optional[int] = None  # Limite de vagas (opcional)


class StageCycleCreate(StageCycleBase):
    pass


class StageCycleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[CycleStatus] = None
    max_participants: Optional[int] = None


class StageCycleResponse(StageCycleBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: Optional[str] = None
    stage_name: Optional[str] = None  # Nome da etapa (populated)
    participants_count: Optional[int] = 0  # Quantidade de participantes
    created_at: str
    updated_at: str
