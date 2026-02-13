from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.database import db
from app.models.content_subcategory import (
    ContentSubcategoryCreate, ContentSubcategoryUpdate,
    ContentSubcategoryResponse, ContentType
)
from app.utils.security import get_current_user, require_admin_or_formador, get_tenant_filter
from app.utils.audit import log_action

router = APIRouter()


async def enrich_subcategory(subcategory: dict) -> dict:
    """Enriquece subcategoria com nome da etapa e contagens"""
    if subcategory.get("formative_stage_id"):
        stage = await db.formative_stages.find_one({"id": subcategory["formative_stage_id"]})
        if stage:
            subcategory["stage_name"] = stage.get("name")

    sub_id = subcategory.get("id")
    subcategory["video_count"] = await db.videos.count_documents({"subcategory_id": sub_id})
    subcategory["document_count"] = await db.documents.count_documents({"subcategory_id": sub_id})

    return subcategory


@router.get("", response_model=List[ContentSubcategoryResponse])
async def list_subcategories(
    formative_stage_id: Optional[str] = None,
    content_type: Optional[ContentType] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista subcategorias de conteúdo, opcionalmente filtradas por etapa formativa"""
    query = get_tenant_filter(current_user)

    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id
    if content_type:
        query["content_type"] = content_type
    if is_active is not None:
        query["is_active"] = is_active

    subcategories = await db.content_subcategories.find(
        query, {"_id": 0}
    ).sort("order", 1).to_list(500)

    enriched = []
    for sub in subcategories:
        enriched.append(await enrich_subcategory(sub))

    return enriched


@router.get("/{subcategory_id}", response_model=ContentSubcategoryResponse)
async def get_subcategory(
    subcategory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Busca uma subcategoria específica"""
    query = get_tenant_filter(current_user)
    query["id"] = subcategory_id

    subcategory = await db.content_subcategories.find_one(query, {"_id": 0})
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    return await enrich_subcategory(subcategory)


@router.post("", response_model=ContentSubcategoryResponse)
async def create_subcategory(
    data: ContentSubcategoryCreate,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Cria uma nova subcategoria dentro de uma etapa formativa"""
    tenant_id = current_user.get("tenant_id")

    # Verificar se a etapa formativa existe
    stage_query = {"id": data.formative_stage_id}
    if tenant_id:
        stage_query["tenant_id"] = tenant_id
    stage = await db.formative_stages.find_one(stage_query)
    if not stage:
        raise HTTPException(status_code=404, detail="Formative stage not found")

    now = datetime.now(timezone.utc).isoformat()
    subcategory = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }

    await db.content_subcategories.insert_one(subcategory)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "content_subcategory", subcategory["id"],
        {"name": data.name, "stage": stage.get("name")},
        tenant_id
    )

    return await enrich_subcategory(subcategory)


@router.put("/{subcategory_id}", response_model=ContentSubcategoryResponse)
async def update_subcategory(
    subcategory_id: str,
    data: ContentSubcategoryUpdate,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Atualiza uma subcategoria"""
    query = get_tenant_filter(current_user)
    query["id"] = subcategory_id

    existing = await db.content_subcategories.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.content_subcategories.update_one({"id": subcategory_id}, {"$set": update_dict})
    await log_action(
        current_user["id"], current_user["full_name"],
        "update", "content_subcategory", subcategory_id,
        tenant_id=current_user.get("tenant_id")
    )

    updated = await db.content_subcategories.find_one({"id": subcategory_id}, {"_id": 0})
    return await enrich_subcategory(updated)


@router.delete("/{subcategory_id}")
async def delete_subcategory(
    subcategory_id: str,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Remove uma subcategoria"""
    query = get_tenant_filter(current_user)
    query["id"] = subcategory_id

    existing = await db.content_subcategories.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    # Verificar se há conteúdo vinculado
    video_count = await db.videos.count_documents({"subcategory_id": subcategory_id})
    doc_count = await db.documents.count_documents({"subcategory_id": subcategory_id})

    if video_count > 0 or doc_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete subcategory with linked content ({video_count} videos, {doc_count} documents). Remove or reassign content first."
        )

    await db.content_subcategories.delete_one({"id": subcategory_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "content_subcategory", subcategory_id,
        tenant_id=current_user.get("tenant_id")
    )

    return {"message": "Subcategory deleted successfully"}


@router.get("/{subcategory_id}/videos")
async def list_subcategory_videos(
    subcategory_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Lista vídeos de uma subcategoria"""
    query = get_tenant_filter(current_user)
    query["id"] = subcategory_id

    subcategory = await db.content_subcategories.find_one(query)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    skip = (page - 1) * limit
    videos = await db.videos.find(
        {"subcategory_id": subcategory_id}, {"_id": 0}
    ).sort("order", 1).skip(skip).limit(limit).to_list(limit)

    return videos


@router.get("/{subcategory_id}/documents")
async def list_subcategory_documents(
    subcategory_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Lista documentos de uma subcategoria"""
    query = get_tenant_filter(current_user)
    query["id"] = subcategory_id

    subcategory = await db.content_subcategories.find_one(query)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    skip = (page - 1) * limit
    documents = await db.documents.find(
        {"subcategory_id": subcategory_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return documents
