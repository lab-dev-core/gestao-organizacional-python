from fastapi import APIRouter
from app.routes import (
    auth, users, locations, functions, formative_stages, documents, videos,
    acompanhamentos, audit, stats, files, tenants, user_journey, stage_cycles,
    stage_participations, certificates, psychological_assessments, content_subcategories
)

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(locations.router, prefix="/locations", tags=["Locations"])
api_router.include_router(functions.router, prefix="/functions", tags=["Functions"])
api_router.include_router(formative_stages.router, prefix="/formative-stages", tags=["Formative Stages"])
api_router.include_router(stage_cycles.router, prefix="/stage-cycles", tags=["Stage Cycles"])
api_router.include_router(stage_participations.router, prefix="/stage-participations", tags=["Stage Participations"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(videos.router, prefix="/videos", tags=["Videos"])
api_router.include_router(acompanhamentos.router, prefix="/acompanhamentos", tags=["Acompanhamentos"])
api_router.include_router(psychological_assessments.router, prefix="/psychological-assessments", tags=["Psychological Assessments"])
api_router.include_router(content_subcategories.router, prefix="/content-subcategories", tags=["Content Subcategories"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["Audit Logs"])
api_router.include_router(stats.router, prefix="/stats", tags=["Statistics"])
api_router.include_router(files.router, prefix="/uploads", tags=["Files"])
api_router.include_router(user_journey.router, prefix="/user-journey", tags=["User Journey"])
api_router.include_router(certificates.router, prefix="/certificates", tags=["Certificates"])
