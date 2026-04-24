from fastapi import FastAPI
from fastapi.routing import APIRouter
from app.routes import (
    auth, users, locations, functions, formative_stages, documents, videos,
    acompanhamentos, audit, stats, files, tenants, user_journey, stage_cycles,
    stage_participations, certificates, psychological_assessments, content_subcategories,
    ferias, announcements, quizzes
)


def _attach_routes(router: APIRouter) -> None:
    """Registra todos os sub-routers em um APIRouter pai."""
    router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
    router.include_router(users.router, prefix="/users", tags=["Users"])
    router.include_router(locations.router, prefix="/locations", tags=["Locations"])
    router.include_router(functions.router, prefix="/functions", tags=["Functions"])
    router.include_router(formative_stages.router, prefix="/formative-stages", tags=["Formative Stages"])
    router.include_router(stage_cycles.router, prefix="/stage-cycles", tags=["Stage Cycles"])
    router.include_router(stage_participations.router, prefix="/stage-participations", tags=["Stage Participations"])
    router.include_router(documents.router, prefix="/documents", tags=["Documents"])
    router.include_router(videos.router, prefix="/videos", tags=["Videos"])
    router.include_router(acompanhamentos.router, prefix="/acompanhamentos", tags=["Acompanhamentos"])
    router.include_router(psychological_assessments.router, prefix="/psychological-assessments", tags=["Psychological Assessments"])
    router.include_router(content_subcategories.router, prefix="/content-subcategories", tags=["Content Subcategories"])
    router.include_router(audit.router, prefix="/audit-logs", tags=["Audit Logs"])
    router.include_router(stats.router, prefix="/stats", tags=["Statistics"])
    router.include_router(files.router, prefix="/uploads", tags=["Files"])
    router.include_router(user_journey.router, prefix="/user-journey", tags=["User Journey"])
    router.include_router(certificates.router, prefix="/certificates", tags=["Certificates"])
    router.include_router(ferias.router, prefix="/ferias", tags=["Férias"])
    router.include_router(announcements.router, prefix="/announcements", tags=["Announcements"])
    router.include_router(quizzes.router, prefix="/quizzes", tags=["Quizzes"])


def setup_routes(app: FastAPI) -> None:
    """
    Registra as rotas da API na aplicação FastAPI.

    - /api/v1/  → versão canônica (use esta em novos clientes)
    - /api/     → alias de backward compatibility (deprecated)
    """
    # Versão canônica
    v1_router = APIRouter(prefix="/api/v1")
    _attach_routes(v1_router)
    app.include_router(v1_router)

    # Alias legado — mantido para não quebrar clientes existentes
    # Será removido em uma versão futura
    legacy_router = APIRouter(prefix="/api")
    _attach_routes(legacy_router)
    app.include_router(legacy_router)


# Mantém compatibilidade com qualquer import externo de `api_router`
api_router = APIRouter(prefix="/api")
_attach_routes(api_router)
