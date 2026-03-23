from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, Response
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import uuid
import json
import logging

from app.database import db
from app.config import UPLOAD_DIR, ALLOWED_DOC_EXTENSIONS, MAX_FILE_SIZE, ONEDRIVE_ENABLED
from app.models import DocumentUpdate, DocumentResponse
from app.models.document_interaction import (
    DocumentCommentCreate, DocumentCommentUpdate, DocumentCommentResponse,
    DocumentEvaluationCreate, DocumentEvaluationResponse,
    DocumentAttachmentResponse, DocumentAccessStatus, DocumentReleaseType
)
from app.utils.security import get_current_user, require_admin_or_formador
from app.utils.permissions import check_permission
from app.utils.audit import log_action
from app.services import onedrive

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== LIBERAÇÃO GRADATIVA ====================

async def check_document_access(document: dict, user_id: str) -> DocumentAccessStatus:
    """Verifica se o usuário tem acesso ao documento com base na liberação gradativa"""
    release_config = document.get("gradual_release")
    if not release_config:
        return DocumentAccessStatus(document_id=document["id"], is_unlocked=True)

    release_type = release_config.get("release_type", "free")

    if release_type == "free":
        return DocumentAccessStatus(document_id=document["id"], is_unlocked=True)

    prereq_id = release_config.get("prerequisite_document_id")
    if not prereq_id:
        return DocumentAccessStatus(document_id=document["id"], is_unlocked=True)

    prereq_doc = await db.documents.find_one({"id": prereq_id})
    prereq_title = prereq_doc.get("title") if prereq_doc else None

    if release_type in ("sequential", "completion"):
        access_record = await db.document_access.find_one(
            {"document_id": prereq_id, "user_id": user_id}
        )
        completed = (access_record.get("downloads", 0) > 0) if access_record else False

        if completed:
            return DocumentAccessStatus(
                document_id=document["id"], is_unlocked=True,
                prerequisite_document_title=prereq_title,
                prerequisite_completed=True
            )
        return DocumentAccessStatus(
            document_id=document["id"], is_unlocked=False,
            reason="Você precisa baixar o documento anterior antes de acessar este conteúdo.",
            prerequisite_document_title=prereq_title,
            prerequisite_completed=False
        )

    if release_type == "evaluation":
        min_score = release_config.get("min_evaluation_score", 1)
        evaluation = await db.document_evaluations.find_one(
            {"document_id": prereq_id, "user_id": user_id}
        )
        user_score = evaluation.get("score") if evaluation else None

        if user_score is not None and user_score >= min_score:
            return DocumentAccessStatus(
                document_id=document["id"], is_unlocked=True,
                prerequisite_document_title=prereq_title,
                prerequisite_completed=True,
                prerequisite_score=user_score,
                required_score=min_score
            )
        return DocumentAccessStatus(
            document_id=document["id"], is_unlocked=False,
            reason=f"Nota mínima de {min_score} na avaliação do documento anterior é necessária.",
            prerequisite_document_title=prereq_title,
            prerequisite_completed=False,
            prerequisite_score=user_score,
            required_score=min_score
        )

    return DocumentAccessStatus(document_id=document["id"], is_unlocked=True)


# ==================== DOCUMENTOS CRUD ====================

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    formative_stage_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    if subcategory_id:
        query["subcategory_id"] = subcategory_id
    if formative_stage_id:
        query["formative_stage_id"] = formative_stage_id

    skip = (page - 1) * limit
    documents = await db.documents.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)

    accessible_docs = []
    for doc in documents:
        if doc.get("is_public") or check_permission(current_user, doc.get("permissions")):
            # Enriquecer com nome da subcategoria
            if doc.get("subcategory_id"):
                sub = await db.content_subcategories.find_one({"id": doc["subcategory_id"]})
                if sub:
                    doc["subcategory_name"] = sub.get("name")

            # Contagem de comentários
            doc["comment_count"] = await db.document_comments.count_documents({"document_id": doc["id"]})

            # Média de avaliação
            pipeline = [
                {"$match": {"document_id": doc["id"]}},
                {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
            ]
            avg_result = await db.document_evaluations.aggregate(pipeline).to_list(1)
            if avg_result:
                doc["average_rating"] = round(avg_result[0]["avg_score"], 1)

            # Verificar liberação gradativa
            access = await check_document_access(doc, current_user["id"])
            doc["is_unlocked"] = access.is_unlocked

            accessible_docs.append(doc)

    return accessible_docs


@router.get("/categories")
async def get_document_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.documents.distinct("category")
    return [c for c in categories if c]


@router.get("/{doc_id}/access-status", response_model=DocumentAccessStatus)
async def get_document_access_status(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Verifica se o documento está liberado para o usuário"""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return await check_document_access(doc, current_user["id"])


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("is_public") and not check_permission(current_user, doc.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verificar liberação gradativa
    access = await check_document_access(doc, current_user["id"])
    if not access.is_unlocked:
        raise HTTPException(status_code=403, detail=access.reason or "Document locked")

    await db.documents.update_one({"id": doc_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "view", "document", doc_id, {"title": doc["title"]})

    # Registrar acesso por usuário
    await db.document_access.update_one(
        {"document_id": doc_id, "user_id": current_user["id"]},
        {"$inc": {"views": 1}, "$set": {
            "document_id": doc_id,
            "user_id": current_user["id"],
            "last_accessed": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    doc["views"] = doc.get("views", 0) + 1

    # Enriquecer com nome da subcategoria
    if doc.get("subcategory_id"):
        sub = await db.content_subcategories.find_one({"id": doc["subcategory_id"]})
        if sub:
            doc["subcategory_name"] = sub.get("name")

    # Contagem de comentários
    doc["comment_count"] = await db.document_comments.count_documents({"document_id": doc_id})

    # Média de avaliação
    pipeline = [
        {"$match": {"document_id": doc_id}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
    ]
    avg_result = await db.document_evaluations.aggregate(pipeline).to_list(1)
    if avg_result:
        doc["average_rating"] = round(avg_result[0]["avg_score"], 1)

    doc["is_unlocked"] = True

    return doc


@router.post("", response_model=DocumentResponse)
async def create_document(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    is_public: bool = Form(False),
    permissions: str = Form(None),
    formative_stage_id: str = Form(None),
    subcategory_id: str = Form(None),
    allow_comments: bool = Form(False),
    allow_evaluation: bool = Form(False),
    gradual_release: str = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin_or_formador)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT")

    file_id = str(uuid.uuid4())

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 500MB")

    if ONEDRIVE_ENABLED:
        try:
            await onedrive.upload_file("documents", file_id, content, ext)
        except Exception as e:
            logger.error(f"OneDrive upload failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload file to cloud storage")
    else:
        file_path = UPLOAD_DIR / "documents" / f"{file_id}{ext}"
        with open(file_path, "wb") as buffer:
            buffer.write(content)

    now = datetime.now(timezone.utc).isoformat()

    perm_dict = None
    if permissions:
        try:
            perm_dict = json.loads(permissions)
        except:
            perm_dict = None

    release_dict = None
    if gradual_release:
        try:
            release_dict = json.loads(gradual_release)
        except:
            release_dict = None

    doc_dict = {
        "id": file_id,
        "title": title,
        "description": description,
        "category": category,
        "is_public": is_public,
        "permissions": perm_dict,
        "version": 1,
        "formative_stage_id": formative_stage_id if formative_stage_id else None,
        "subcategory_id": subcategory_id if subcategory_id else None,
        "allow_comments": allow_comments,
        "allow_evaluation": allow_evaluation,
        "gradual_release": release_dict,
        "file_url": f"/api/uploads/documents/{file_id}{ext}",
        "file_name": file.filename,
        "file_size": len(content),
        "file_type": ext[1:],
        "storage": "onedrive" if ONEDRIVE_ENABLED else "local",
        "uploaded_by": current_user["id"],
        "views": 0,
        "downloads": 0,
        "created_at": now,
        "updated_at": now
    }

    await db.documents.insert_one(doc_dict)
    await log_action(current_user["id"], current_user["full_name"], "upload", "document", file_id, {"title": title})

    return doc_dict


@router.put("/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, doc_data: DocumentUpdate, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    update_dict = {k: v for k, v in doc_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    if update_dict.get("permissions"):
        update_dict["permissions"] = update_dict["permissions"] if isinstance(update_dict["permissions"], dict) else update_dict["permissions"].model_dump() if hasattr(update_dict["permissions"], 'model_dump') else dict(update_dict["permissions"])

    if update_dict.get("gradual_release"):
        update_dict["gradual_release"] = update_dict["gradual_release"] if isinstance(update_dict["gradual_release"], dict) else update_dict["gradual_release"].model_dump() if hasattr(update_dict["gradual_release"], 'model_dump') else dict(update_dict["gradual_release"])

    await db.documents.update_one({"id": doc_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "document", doc_id)

    updated = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    return updated


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    if existing.get("storage") == "onedrive" and ONEDRIVE_ENABLED:
        try:
            await onedrive.delete_file("documents", doc_id, f".{existing['file_type']}")
        except Exception as e:
            logger.error(f"OneDrive delete failed for document {doc_id}: {e}")
    else:
        file_path = UPLOAD_DIR / "documents" / f"{doc_id}.{existing['file_type']}"
        if file_path.exists():
            file_path.unlink()

    # Limpar dados associados
    await db.document_comments.delete_many({"document_id": doc_id})
    await db.document_evaluations.delete_many({"document_id": doc_id})
    await db.document_attachments.delete_many({"document_id": doc_id})
    await db.document_access.delete_many({"document_id": doc_id})

    await db.documents.delete_one({"id": doc_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "document", doc_id, {"title": existing["title"]})

    return {"message": "Document deleted successfully"}


@router.get("/{doc_id}/download")
async def download_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("is_public") and not check_permission(current_user, doc.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verificar liberação gradativa
    access = await check_document_access(doc, current_user["id"])
    if not access.is_unlocked:
        raise HTTPException(status_code=403, detail=access.reason or "Document locked")

    await db.documents.update_one({"id": doc_id}, {"$inc": {"downloads": 1}})
    await log_action(current_user["id"], current_user["full_name"], "download", "document", doc_id, {"title": doc["title"]})

    # Registrar download por usuário (para liberação gradativa)
    await db.document_access.update_one(
        {"document_id": doc_id, "user_id": current_user["id"]},
        {"$inc": {"downloads": 1}, "$set": {
            "document_id": doc_id,
            "user_id": current_user["id"],
            "last_accessed": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    if doc.get("storage") == "onedrive" and ONEDRIVE_ENABLED:
        try:
            file_bytes = await onedrive.download_file("documents", doc_id, f".{doc['file_type']}")
            if file_bytes is None:
                raise HTTPException(status_code=404, detail="File not found on cloud storage")
            return Response(
                content=file_bytes,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{doc["file_name"]}"'}
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"OneDrive download failed for document {doc_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to download from cloud storage")

    file_path = UPLOAD_DIR / "documents" / f"{doc_id}.{doc['file_type']}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, filename=doc["file_name"], media_type="application/octet-stream")


# ==================== VISUALIZAÇÃO INLINE ====================

_INLINE_MIME = {
    "pdf": "application/pdf",
    "txt": "text/plain; charset=utf-8",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


@router.get("/{doc_id}/view")
async def view_document_inline(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Serve o arquivo com Content-Disposition: inline para visualização no navegador."""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("is_public") and not check_permission(current_user, doc.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")

    access = await check_document_access(doc, current_user["id"])
    if not access.is_unlocked:
        raise HTTPException(status_code=403, detail=access.reason or "Document locked")

    file_type = doc.get("file_type", "")
    media_type = _INLINE_MIME.get(file_type, "application/octet-stream")
    disposition = "inline" if file_type in _INLINE_MIME else "attachment"

    await db.documents.update_one({"id": doc_id}, {"$inc": {"views": 1}})

    if doc.get("storage") == "onedrive" and ONEDRIVE_ENABLED:
        try:
            file_bytes = await onedrive.download_file("documents", doc_id, f".{file_type}")
            if file_bytes is None:
                raise HTTPException(status_code=404, detail="File not found on cloud storage")
            return Response(
                content=file_bytes,
                media_type=media_type,
                headers={"Content-Disposition": f'{disposition}; filename="{doc["file_name"]}"'}
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"OneDrive view failed for document {doc_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to load from cloud storage")

    file_path = UPLOAD_DIR / "documents" / f"{doc_id}.{file_type}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{doc["file_name"]}"'}
    )


# ==================== COMENTÁRIOS ====================

@router.get("/{doc_id}/comments", response_model=List[DocumentCommentResponse])
async def list_document_comments(
    doc_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Lista comentários de um documento"""
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("allow_comments", False):
        return []

    skip = (page - 1) * limit
    comments = await db.document_comments.find(
        {"document_id": doc_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return comments


@router.post("/{doc_id}/comments", response_model=DocumentCommentResponse)
async def create_document_comment(
    doc_id: str,
    data: DocumentCommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Adiciona comentário a um documento"""
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("allow_comments", False):
        raise HTTPException(status_code=403, detail="Comments are disabled for this document")

    now = datetime.now(timezone.utc).isoformat()
    comment = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "user_photo_url": current_user.get("photo_url"),
        "content": data.content,
        "parent_id": data.parent_id,
        "tenant_id": current_user.get("tenant_id"),
        "created_at": now,
        "updated_at": now
    }

    await db.document_comments.insert_one(comment)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "document_comment", comment["id"],
        {"document_id": doc_id}
    )

    return comment


@router.put("/{doc_id}/comments/{comment_id}", response_model=DocumentCommentResponse)
async def update_document_comment(
    doc_id: str,
    comment_id: str,
    data: DocumentCommentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Edita um comentário (apenas o autor)"""
    comment = await db.document_comments.find_one({"id": comment_id, "document_id": doc_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.document_comments.update_one({"id": comment_id}, {"$set": update_dict})

    updated = await db.document_comments.find_one({"id": comment_id}, {"_id": 0})
    return updated


@router.delete("/{doc_id}/comments/{comment_id}")
async def delete_document_comment(
    doc_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove um comentário (autor ou admin)"""
    comment = await db.document_comments.find_one({"id": comment_id, "document_id": doc_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    roles = current_user.get("roles", [])
    if comment["user_id"] != current_user["id"] and "admin" not in roles and "superadmin" not in roles:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.document_comments.delete_one({"id": comment_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "document_comment", comment_id,
        {"document_id": doc_id}
    )

    return {"message": "Comment deleted successfully"}


# ==================== AVALIAÇÕES ====================

@router.get("/{doc_id}/evaluations", response_model=List[DocumentEvaluationResponse])
async def list_document_evaluations(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lista avaliações de um documento"""
    evaluations = await db.document_evaluations.find(
        {"document_id": doc_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    return evaluations


@router.post("/{doc_id}/evaluations", response_model=DocumentEvaluationResponse)
async def create_or_update_document_evaluation(
    doc_id: str,
    data: DocumentEvaluationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Avalia um documento (1-5). Atualiza se já avaliou."""
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("allow_evaluation", False):
        raise HTTPException(status_code=403, detail="Evaluation is disabled for this document")

    if data.score < 1 or data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")

    now = datetime.now(timezone.utc).isoformat()

    existing = await db.document_evaluations.find_one(
        {"document_id": doc_id, "user_id": current_user["id"]}
    )

    if existing:
        await db.document_evaluations.update_one(
            {"id": existing["id"]},
            {"$set": {
                "score": data.score,
                "feedback": data.feedback,
                "updated_at": now
            }}
        )
        updated = await db.document_evaluations.find_one({"id": existing["id"]}, {"_id": 0})
        return updated

    evaluation = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "score": data.score,
        "feedback": data.feedback,
        "tenant_id": current_user.get("tenant_id"),
        "created_at": now,
        "updated_at": now
    }

    await db.document_evaluations.insert_one(evaluation)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "document_evaluation", evaluation["id"],
        {"document_id": doc_id, "score": data.score}
    )

    return evaluation


# ==================== ARQUIVOS ANEXOS ====================

@router.get("/{doc_id}/attachments", response_model=List[DocumentAttachmentResponse])
async def list_document_attachments(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lista arquivos anexos de um documento"""
    attachments = await db.document_attachments.find(
        {"document_id": doc_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return attachments


@router.post("/{doc_id}/attachments", response_model=DocumentAttachmentResponse)
async def upload_document_attachment(
    doc_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin_or_formador)
):
    """Faz upload de um arquivo anexo para um documento"""
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type for attachment")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 500MB")

    attachment_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / "documents" / f"{attachment_id}{ext}"
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    now = datetime.now(timezone.utc).isoformat()
    attachment = {
        "id": attachment_id,
        "document_id": doc_id,
        "file_url": f"/api/uploads/documents/{attachment_id}{ext}",
        "file_name": file.filename,
        "file_size": len(content),
        "file_type": ext[1:],
        "uploaded_by": current_user["id"],
        "tenant_id": current_user.get("tenant_id"),
        "created_at": now
    }

    await db.document_attachments.insert_one(attachment)
    await log_action(
        current_user["id"], current_user["full_name"],
        "upload", "document_attachment", attachment_id,
        {"document_id": doc_id, "file_name": file.filename}
    )

    return attachment


@router.delete("/{doc_id}/attachments/{attachment_id}")
async def delete_document_attachment(
    doc_id: str,
    attachment_id: str,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Remove um arquivo anexo"""
    attachment = await db.document_attachments.find_one(
        {"id": attachment_id, "document_id": doc_id}
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_name = attachment["file_url"].split("/")[-1]
    file_path = UPLOAD_DIR / "documents" / file_name
    if file_path.exists():
        file_path.unlink()

    await db.document_attachments.delete_one({"id": attachment_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "document_attachment", attachment_id,
        {"document_id": doc_id}
    )

    return {"message": "Attachment deleted successfully"}


# ==================== PROGRESSO DE LEITURA ====================

@router.post("/{doc_id}/mark-read")
async def mark_document_read(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a document as read/completed by the current user"""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.document_access.update_one(
        {"document_id": doc_id, "user_id": current_user["id"]},
        {"$set": {
            "document_id": doc_id,
            "user_id": current_user["id"],
            "completed": True,
            "completed_at": now,
            "last_accessed": now
        }, "$inc": {"views": 1}},
        upsert=True
    )
    await db.documents.update_one({"id": doc_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "mark_read", "document", doc_id, {"title": doc.get("title")})
    return {"message": "Document marked as read", "completed": True}


@router.get("/{doc_id}/read-status")
async def get_document_read_status(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Get read status of a document for the current user"""
    record = await db.document_access.find_one(
        {"document_id": doc_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    return {
        "document_id": doc_id,
        "completed": record.get("completed", False) if record else False,
        "views": record.get("views", 0) if record else 0,
        "completed_at": record.get("completed_at") if record else None
    }


@router.get("/read-status/batch")
async def get_documents_read_status_batch(
    document_ids: str = Query(..., description="Comma-separated document IDs"),
    current_user: dict = Depends(get_current_user)
):
    """Get read status for multiple documents"""
    ids = [id.strip() for id in document_ids.split(",") if id.strip()]
    records = await db.document_access.find(
        {"document_id": {"$in": ids}, "user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(1000)
    result = {r["document_id"]: {"completed": r.get("completed", False), "views": r.get("views", 0)} for r in records}
    return result
