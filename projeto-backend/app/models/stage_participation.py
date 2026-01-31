from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


class ParticipationStatus(str, Enum):
    ENROLLED = "enrolled"        # Inscrito/Matriculado
    IN_PROGRESS = "in_progress"  # Em andamento
    APPROVED = "approved"        # Aprovado
    REPROVED = "reproved"        # Reprovado
    WITHDRAWN = "withdrawn"      # Desistente
    TRANSFERRED = "transferred"  # Transferido para outro ciclo


class StageParticipationBase(BaseModel):
    """
    Participação de um usuário em um ciclo específico de uma etapa formativa.
    Registra a entrada, progresso e resultado do usuário no ciclo.
    """
    user_id: str
    cycle_id: str
    enrollment_date: str  # Data de entrada no ciclo
    status: ParticipationStatus = ParticipationStatus.ENROLLED
    completion_date: Optional[str] = None  # Data de conclusão/saída
    notes: Optional[str] = None  # Observações gerais
    evaluation_notes: Optional[str] = None  # Observações da avaliação final
    approved_by_id: Optional[str] = None  # Quem aprovou/reprovou
    approved_by_name: Optional[str] = None


class StageParticipationCreate(BaseModel):
    user_id: str
    cycle_id: str
    enrollment_date: Optional[str] = None  # Se não informado, usa data atual
    notes: Optional[str] = None


class StageParticipationUpdate(BaseModel):
    status: Optional[ParticipationStatus] = None
    completion_date: Optional[str] = None
    notes: Optional[str] = None
    evaluation_notes: Optional[str] = None


class StageParticipationResponse(StageParticipationBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    # Dados populados
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_photo_url: Optional[str] = None
    cycle_name: Optional[str] = None
    stage_id: Optional[str] = None
    stage_name: Optional[str] = None
    stage_order: Optional[int] = None
    created_at: str
    updated_at: str


class UserJourneyFullResponse(BaseModel):
    """
    Resposta completa da jornada de um usuário.
    Inclui todas as participações em ciclos, ordenadas por data.
    """
    user_id: str
    user_name: str
    user_email: str
    current_stage: Optional[str] = None
    current_cycle: Optional[str] = None
    participations: list[StageParticipationResponse] = []
    total_stages_completed: int = 0
    journey_progress_percent: int = 0
