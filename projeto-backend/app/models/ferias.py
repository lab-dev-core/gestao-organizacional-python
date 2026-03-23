from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


class FeriasStatus(str, Enum):
    PENDENTE = "pendente"        # Aguardando aprovação
    APROVADO = "aprovado"        # Aprovado pelo admin
    EM_ANDAMENTO = "em_andamento"  # Férias em curso
    CONCLUIDO = "concluido"      # Férias encerradas
    CANCELADO = "cancelado"      # Cancelado


class FeriasBase(BaseModel):
    user_id: str
    predicted_start_date: str          # Data prevista de início (YYYY-MM-DD)
    predicted_end_date: str            # Data prevista de término (YYYY-MM-DD)
    actual_start_date: Optional[str] = None   # Data efetiva de início
    actual_end_date: Optional[str] = None     # Data efetiva de término
    status: FeriasStatus = FeriasStatus.PENDENTE
    notes: Optional[str] = None


class FeriasCreate(FeriasBase):
    pass


class FeriasUpdate(BaseModel):
    predicted_start_date: Optional[str] = None
    predicted_end_date: Optional[str] = None
    actual_start_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    status: Optional[FeriasStatus] = None
    notes: Optional[str] = None


class FeriasResponse(FeriasBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_name: str
    tenant_id: Optional[str] = None
    created_by_id: str
    created_by_name: str
    duration_days: Optional[int] = None   # Calculado: diferença entre datas previstas
    created_at: str
    updated_at: str


class FeriasConfigUpdate(BaseModel):
    max_vacation_days: int   # Máximo de dias de férias permitido por ciclo/ano
