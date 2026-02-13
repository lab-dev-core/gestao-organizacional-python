from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from enum import Enum


class AssessmentStatus(str, Enum):
    DRAFT = "draft"              # Rascunho
    IN_PROGRESS = "in_progress"  # Em andamento
    COMPLETED = "completed"      # Concluído
    REVIEWED = "reviewed"        # Revisado


class AssessmentType(str, Enum):
    ANNUAL = "annual"                  # Relatório anual (final de ano)
    STAGE_EVALUATION = "stage_evaluation"  # Avaliação para próxima etapa
    FOLLOW_UP = "follow_up"            # Acompanhamento psicológico


class IndicatorScore(BaseModel):
    """Pontuação de um indicador individual"""
    indicator_id: str
    indicator_name: str
    category: Optional[str] = None  # Ex: "emocional", "social", "espiritual", "intelectual"
    score: Optional[int] = None  # 1-5 ou 1-10 conforme configuração
    max_score: int = 5
    observations: Optional[str] = None


class StageIndicatorModel(BaseModel):
    """Modelo de indicador para avaliação de etapa formativa"""
    name: str
    description: Optional[str] = None
    category: str  # emocional, social, espiritual, intelectual, comunitario
    weight: float = 1.0  # Peso do indicador na avaliação


class StageIndicatorCreate(StageIndicatorModel):
    formative_stage_id: str


class StageIndicatorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    weight: Optional[float] = None


class StageIndicatorResponse(StageIndicatorModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    formative_stage_id: str
    tenant_id: Optional[str] = None
    created_at: str
    updated_at: str


class PsychologicalAssessmentBase(BaseModel):
    """
    Avaliação psicológica de um membro.
    Pode ser relatório anual ou avaliação para próxima etapa.
    """
    user_id: str
    assessment_type: AssessmentType
    formative_stage_id: Optional[str] = None
    cycle_id: Optional[str] = None
    reference_year: Optional[int] = None  # Ano de referência (para relatório anual)
    status: AssessmentStatus = AssessmentStatus.DRAFT

    # Campos do relatório
    summary: Optional[str] = None  # Resumo geral
    strengths: Optional[str] = None  # Pontos fortes
    areas_for_improvement: Optional[str] = None  # Áreas de melhoria
    recommendations: Optional[str] = None  # Recomendações
    observations: Optional[str] = None  # Observações adicionais

    # Indicadores com pontuação
    indicator_scores: List[IndicatorScore] = []

    # Parecer final
    final_opinion: Optional[str] = None  # Parecer final do avaliador
    recommended_for_next_stage: Optional[bool] = None  # Recomendado para próxima etapa?
    next_stage_id: Optional[str] = None  # Próxima etapa recomendada


class PsychologicalAssessmentCreate(BaseModel):
    user_id: str
    assessment_type: AssessmentType
    formative_stage_id: Optional[str] = None
    cycle_id: Optional[str] = None
    reference_year: Optional[int] = None
    summary: Optional[str] = None
    strengths: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    recommendations: Optional[str] = None
    observations: Optional[str] = None
    indicator_scores: List[IndicatorScore] = []
    final_opinion: Optional[str] = None
    recommended_for_next_stage: Optional[bool] = None
    next_stage_id: Optional[str] = None


class PsychologicalAssessmentUpdate(BaseModel):
    status: Optional[AssessmentStatus] = None
    summary: Optional[str] = None
    strengths: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    recommendations: Optional[str] = None
    observations: Optional[str] = None
    indicator_scores: Optional[List[IndicatorScore]] = None
    final_opinion: Optional[str] = None
    recommended_for_next_stage: Optional[bool] = None
    next_stage_id: Optional[str] = None


class PsychologicalAssessmentResponse(PsychologicalAssessmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: Optional[str] = None
    assessor_id: str  # Quem realizou a avaliação
    assessor_name: str
    # Dados populados
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    stage_name: Optional[str] = None
    cycle_name: Optional[str] = None
    # Métricas calculadas
    overall_score: Optional[float] = None  # Média ponderada dos indicadores
    created_at: str
    updated_at: str
