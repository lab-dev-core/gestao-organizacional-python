from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.psychological_assessment import (
    PsychologicalAssessmentCreate, PsychologicalAssessmentUpdate,
    PsychologicalAssessmentResponse, AssessmentStatus, AssessmentType,
    StageIndicatorCreate, StageIndicatorUpdate, StageIndicatorResponse
)
from app.utils.security import get_current_user, require_admin_or_formador, get_tenant_filter
from app.utils.audit import log_action
from app.services.pdf import generate_psychological_assessment_pdf

router = APIRouter()


async def enrich_assessment(assessment: dict) -> dict:
    """Enriquece a avaliação com dados do usuário, etapa e ciclo"""
    user = await db.users.find_one({"id": assessment.get("user_id")})
    if user:
        assessment["user_name"] = user.get("full_name")
        assessment["user_email"] = user.get("email")

    if assessment.get("formative_stage_id"):
        stage = await db.formative_stages.find_one({"id": assessment["formative_stage_id"]})
        if stage:
            assessment["stage_name"] = stage.get("name")

    if assessment.get("cycle_id"):
        cycle = await db.stage_cycles.find_one({"id": assessment["cycle_id"]})
        if cycle:
            assessment["cycle_name"] = cycle.get("name")

    # Calcular score geral
    scores = assessment.get("indicator_scores", [])
    if scores:
        weighted_sum = 0
        total_weight = 0
        for s in scores:
            weight = 1.0
            score_val = s.get("score")
            max_score = s.get("max_score", 5)
            if score_val is not None and max_score > 0:
                normalized = (score_val / max_score) * 100
                weighted_sum += normalized * weight
                total_weight += weight
        if total_weight > 0:
            assessment["overall_score"] = round(weighted_sum / total_weight, 1)

    return assessment


# ==================== INDICADORES DE ETAPA ====================

@router.get("/indicators", response_model=List[StageIndicatorResponse])
async def list_stage_indicators(
    formative_stage_id: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista indicadores de avaliação por etapa formativa"""
    query = get_tenant_filter(current_user)

    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id
    if category:
        query["category"] = category

    indicators = await db.stage_indicators.find(query, {"_id": 0}).sort("category", 1).to_list(500)
    return indicators


@router.post("/indicators", response_model=StageIndicatorResponse)
async def create_stage_indicator(
    data: StageIndicatorCreate,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Cria um indicador de avaliação para uma etapa formativa"""
    tenant_id = current_user.get("tenant_id")

    stage = await db.formative_stages.find_one({"id": data.formative_stage_id})
    if not stage:
        raise HTTPException(status_code=404, detail="Formative stage not found")

    now = datetime.now(timezone.utc).isoformat()
    indicator = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }

    await db.stage_indicators.insert_one(indicator)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "stage_indicator", indicator["id"],
        {"name": data.name, "stage": data.formative_stage_id},
        tenant_id
    )

    return indicator


@router.put("/indicators/{indicator_id}", response_model=StageIndicatorResponse)
async def update_stage_indicator(
    indicator_id: str,
    data: StageIndicatorUpdate,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Atualiza um indicador de avaliação"""
    query = get_tenant_filter(current_user)
    query["id"] = indicator_id

    existing = await db.stage_indicators.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Indicator not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.stage_indicators.update_one({"id": indicator_id}, {"$set": update_dict})
    await log_action(
        current_user["id"], current_user["full_name"],
        "update", "stage_indicator", indicator_id,
        tenant_id=current_user.get("tenant_id")
    )

    updated = await db.stage_indicators.find_one({"id": indicator_id}, {"_id": 0})
    return updated


@router.delete("/indicators/{indicator_id}")
async def delete_stage_indicator(
    indicator_id: str,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Remove um indicador de avaliação"""
    query = get_tenant_filter(current_user)
    query["id"] = indicator_id

    existing = await db.stage_indicators.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Indicator not found")

    await db.stage_indicators.delete_one({"id": indicator_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "stage_indicator", indicator_id,
        tenant_id=current_user.get("tenant_id")
    )

    return {"message": "Indicator deleted successfully"}


# ==================== AVALIAÇÕES PSICOLÓGICAS ====================

@router.get("", response_model=List[PsychologicalAssessmentResponse])
async def list_assessments(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = None,
    assessment_type: Optional[AssessmentType] = None,
    status: Optional[AssessmentStatus] = None,
    formative_stage_id: Optional[str] = None,
    reference_year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista avaliações psicológicas com filtros"""
    query = get_tenant_filter(current_user)

    if user_id:
        query["user_id"] = user_id
    if assessment_type:
        query["assessment_type"] = assessment_type
    if status:
        query["status"] = status
    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id
    if reference_year:
        query["reference_year"] = reference_year

    skip = (page - 1) * limit
    assessments = await db.psychological_assessments.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    enriched = []
    for a in assessments:
        enriched.append(await enrich_assessment(a))

    return enriched


@router.get("/{assessment_id}", response_model=PsychologicalAssessmentResponse)
async def get_assessment(
    assessment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Busca uma avaliação psicológica específica"""
    query = get_tenant_filter(current_user)
    query["id"] = assessment_id

    assessment = await db.psychological_assessments.find_one(query, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    await log_action(
        current_user["id"], current_user["full_name"],
        "view", "psychological_assessment", assessment_id,
        tenant_id=current_user.get("tenant_id")
    )

    return await enrich_assessment(assessment)


@router.post("", response_model=PsychologicalAssessmentResponse)
async def create_assessment(
    data: PsychologicalAssessmentCreate,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Cria uma nova avaliação psicológica"""
    tenant_id = current_user.get("tenant_id")

    # Verificar se usuário existe
    user_query = {"id": data.user_id}
    if tenant_id:
        user_query["tenant_id"] = tenant_id
    user = await db.users.find_one(user_query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc).isoformat()
    assessment = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "assessor_id": current_user["id"],
        "assessor_name": current_user["full_name"],
        "status": AssessmentStatus.DRAFT,
        **data.model_dump(),
        "indicator_scores": [s.model_dump() for s in data.indicator_scores] if data.indicator_scores else [],
        "created_at": now,
        "updated_at": now
    }

    await db.psychological_assessments.insert_one(assessment)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "psychological_assessment", assessment["id"],
        {"user": user.get("full_name"), "type": data.assessment_type},
        tenant_id
    )

    return await enrich_assessment(assessment)


@router.put("/{assessment_id}", response_model=PsychologicalAssessmentResponse)
async def update_assessment(
    assessment_id: str,
    data: PsychologicalAssessmentUpdate,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Atualiza uma avaliação psicológica"""
    query = get_tenant_filter(current_user)
    query["id"] = assessment_id

    existing = await db.psychological_assessments.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if "indicator_scores" in update_dict:
        update_dict["indicator_scores"] = [
            s if isinstance(s, dict) else s.model_dump()
            for s in update_dict["indicator_scores"]
        ]
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.psychological_assessments.update_one({"id": assessment_id}, {"$set": update_dict})
    await log_action(
        current_user["id"], current_user["full_name"],
        "update", "psychological_assessment", assessment_id,
        tenant_id=current_user.get("tenant_id")
    )

    updated = await db.psychological_assessments.find_one({"id": assessment_id}, {"_id": 0})
    return await enrich_assessment(updated)


@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: str,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Remove uma avaliação psicológica"""
    query = get_tenant_filter(current_user)
    query["id"] = assessment_id

    existing = await db.psychological_assessments.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")

    await db.psychological_assessments.delete_one({"id": assessment_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "psychological_assessment", assessment_id,
        tenant_id=current_user.get("tenant_id")
    )

    return {"message": "Assessment deleted successfully"}


# ==================== RELATÓRIO ANUAL (PDF) ====================

@router.get("/user/{user_id}/annual-report")
async def generate_annual_report(
    user_id: str,
    reference_year: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Gera relatório geral de final de ano (relatório do usuário).
    Inclui todas as avaliações do ano, indicadores, acompanhamentos e parecer.
    """
    tenant_filter = get_tenant_filter(current_user)

    # Buscar usuário
    user = await db.users.find_one({**tenant_filter, "id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Buscar avaliações do ano
    assessments = await db.psychological_assessments.find(
        {**tenant_filter, "user_id": user_id, "reference_year": reference_year},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)

    # Buscar acompanhamentos do ano
    acompanhamentos = await db.acompanhamentos.find(
        {
            **tenant_filter,
            "user_id": user_id,
            "date": {"$gte": f"{reference_year}-01-01", "$lte": f"{reference_year}-12-31"}
        },
        {"_id": 0}
    ).sort("date", 1).to_list(500)

    # Buscar participações em ciclos
    participations = await db.stage_participations.find(
        {**tenant_filter, "user_id": user_id},
        {"_id": 0}
    ).to_list(100)

    # Buscar etapa formativa atual
    current_stage = None
    if user.get("formative_stage_id"):
        current_stage = await db.formative_stages.find_one(
            {"id": user["formative_stage_id"]}, {"_id": 0}
        )

    # Enriquecer avaliações
    for a in assessments:
        await enrich_assessment(a)

    report_data = {
        "user": user,
        "reference_year": reference_year,
        "assessments": assessments,
        "acompanhamentos": acompanhamentos,
        "participations": participations,
        "current_stage": current_stage
    }

    pdf_buffer = generate_psychological_assessment_pdf(report_data)

    await log_action(
        current_user["id"], current_user["full_name"],
        "export", "annual_report", user_id,
        {"year": reference_year, "user": user.get("full_name")},
        current_user.get("tenant_id")
    )

    filename = f"relatorio_anual_{user['full_name'].replace(' ', '_')}_{reference_year}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{assessment_id}/pdf")
async def export_assessment_pdf(
    assessment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Exporta uma avaliação individual como PDF"""
    query = get_tenant_filter(current_user)
    query["id"] = assessment_id

    assessment = await db.psychological_assessments.find_one(query, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    enriched = await enrich_assessment(assessment)

    user = await db.users.find_one({"id": assessment["user_id"]})
    report_data = {
        "user": user or {},
        "reference_year": assessment.get("reference_year"),
        "assessments": [enriched],
        "acompanhamentos": [],
        "participations": [],
        "current_stage": None
    }

    pdf_buffer = generate_psychological_assessment_pdf(report_data)

    await log_action(
        current_user["id"], current_user["full_name"],
        "export", "psychological_assessment", assessment_id,
        tenant_id=current_user.get("tenant_id")
    )

    user_name = enriched.get("user_name", "usuario")
    filename = f"avaliacao_{user_name.replace(' ', '_')}_{assessment_id[:8]}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== AVALIAÇÃO PARA PRÓXIMA ETAPA ====================

@router.get("/user/{user_id}/stage-readiness")
async def get_stage_readiness(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Verifica a prontidão de um membro para a próxima etapa.
    Retorna indicadores, pontuações e parecer.
    """
    tenant_filter = get_tenant_filter(current_user)

    user = await db.users.find_one({**tenant_filter, "id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_stage_id = user.get("formative_stage_id")
    if not current_stage_id:
        return {
            "user_id": user_id,
            "user_name": user.get("full_name"),
            "current_stage": None,
            "ready_for_next": False,
            "message": "User not assigned to any formative stage"
        }

    current_stage = await db.formative_stages.find_one({"id": current_stage_id})

    # Buscar próxima etapa
    next_stage = None
    if current_stage:
        next_stage = await db.formative_stages.find_one(
            {**tenant_filter, "order": current_stage.get("order", 0) + 1}
        )

    # Buscar indicadores da etapa atual
    indicators = await db.stage_indicators.find(
        {**tenant_filter, "formative_stage_id": current_stage_id},
        {"_id": 0}
    ).to_list(100)

    # Buscar última avaliação de etapa
    latest_assessment = await db.psychological_assessments.find_one(
        {
            **tenant_filter,
            "user_id": user_id,
            "formative_stage_id": current_stage_id,
            "assessment_type": AssessmentType.STAGE_EVALUATION
        },
        {"_id": 0},
        sort=[("created_at", -1)]
    )

    # Buscar participação atual
    participation = None
    if current_stage_id:
        participation = await db.stage_participations.find_one(
            {**tenant_filter, "user_id": user_id, "status": {"$in": ["enrolled", "in_progress"]}},
            {"_id": 0},
            sort=[("created_at", -1)]
        )

    # Contagem de acompanhamentos
    acomp_count = await db.acompanhamentos.count_documents(
        {**tenant_filter, "user_id": user_id, "formative_stage_id": current_stage_id}
    )

    return {
        "user_id": user_id,
        "user_name": user.get("full_name"),
        "current_stage": {
            "id": current_stage.get("id") if current_stage else None,
            "name": current_stage.get("name") if current_stage else None,
            "order": current_stage.get("order") if current_stage else None
        },
        "next_stage": {
            "id": next_stage.get("id") if next_stage else None,
            "name": next_stage.get("name") if next_stage else None,
            "order": next_stage.get("order") if next_stage else None
        } if next_stage else None,
        "indicators": indicators,
        "latest_assessment": latest_assessment,
        "current_participation": participation,
        "acompanhamento_count": acomp_count,
        "recommended_for_next_stage": latest_assessment.get("recommended_for_next_stage") if latest_assessment else None
    }
