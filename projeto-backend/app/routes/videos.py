from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import uuid
import json
import logging

from app.database import db
from app.config import UPLOAD_DIR, ALLOWED_VIDEO_EXTENSIONS, ALLOWED_DOC_EXTENSIONS, MAX_FILE_SIZE, ONEDRIVE_ENABLED
from app.models import VideoUpdate, VideoResponse, VideoProgressUpdate, VideoProgressResponse
from app.models.video_interaction import (
    VideoCommentCreate, VideoCommentUpdate, VideoCommentResponse,
    VideoEvaluationCreate, VideoEvaluationResponse,
    VideoAttachmentResponse, VideoAccessStatus
)
from app.utils.security import get_current_user, require_admin_or_formador
from app.utils.permissions import check_permission
from app.utils.audit import log_action
from app.services import onedrive

logger = logging.getLogger(__name__)

router = APIRouter()


async def check_video_access(video: dict, user_id: str) -> VideoAccessStatus:
    """Verifica se o usuário tem acesso ao vídeo com base na liberação gradativa"""
    release_config = video.get("gradual_release")
    if not release_config:
        return VideoAccessStatus(video_id=video["id"], is_unlocked=True)

    release_type = release_config.get("release_type", "free")

    if release_type == "free":
        return VideoAccessStatus(video_id=video["id"], is_unlocked=True)

    prereq_id = release_config.get("prerequisite_video_id")
    if not prereq_id:
        return VideoAccessStatus(video_id=video["id"], is_unlocked=True)

    prereq_video = await db.videos.find_one({"id": prereq_id})
    prereq_title = prereq_video.get("title") if prereq_video else None

    if release_type in ("sequential", "completion"):
        progress = await db.video_progress.find_one(
            {"video_id": prereq_id, "user_id": user_id}
        )
        completed = progress.get("completed", False) if progress else False

        if completed:
            return VideoAccessStatus(
                video_id=video["id"], is_unlocked=True,
                prerequisite_video_title=prereq_title,
                prerequisite_completed=True
            )
        return VideoAccessStatus(
            video_id=video["id"], is_unlocked=False,
            reason="Você precisa completar o vídeo anterior antes de acessar este conteúdo.",
            prerequisite_video_title=prereq_title,
            prerequisite_completed=False
        )

    if release_type == "evaluation":
        min_score = release_config.get("min_evaluation_score", 1)
        evaluation = await db.video_evaluations.find_one(
            {"video_id": prereq_id, "user_id": user_id}
        )
        user_score = evaluation.get("score") if evaluation else None

        if user_score is not None and user_score >= min_score:
            return VideoAccessStatus(
                video_id=video["id"], is_unlocked=True,
                prerequisite_video_title=prereq_title,
                prerequisite_completed=True,
                prerequisite_score=user_score,
                required_score=min_score
            )
        return VideoAccessStatus(
            video_id=video["id"], is_unlocked=False,
            reason=f"Nota mínima de {min_score} na avaliação do vídeo anterior é necessária.",
            prerequisite_video_title=prereq_title,
            prerequisite_completed=False,
            prerequisite_score=user_score,
            required_score=min_score
        )

    return VideoAccessStatus(video_id=video["id"], is_unlocked=True)


@router.get("", response_model=List[VideoResponse])
async def list_videos(
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
    videos = await db.videos.find(query, {"_id": 0}).skip(skip).limit(limit).sort("order", 1).to_list(limit)

    accessible_videos = []
    for video in videos:
        if video.get("is_public") or check_permission(current_user, video.get("permissions")):
            # Enriquecer com dados da subcategoria
            if video.get("subcategory_id"):
                sub = await db.content_subcategories.find_one({"id": video["subcategory_id"]})
                if sub:
                    video["subcategory_name"] = sub.get("name")

            # Contagem de comentários
            video["comment_count"] = await db.video_comments.count_documents({"video_id": video["id"]})

            # Média de avaliação
            pipeline = [
                {"$match": {"video_id": video["id"]}},
                {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
            ]
            avg_result = await db.video_evaluations.aggregate(pipeline).to_list(1)
            if avg_result:
                video["average_rating"] = round(avg_result[0]["avg_score"], 1)

            # Verificar liberação gradativa
            access = await check_video_access(video, current_user["id"])
            video["is_unlocked"] = access.is_unlocked

            accessible_videos.append(video)

    return accessible_videos


@router.get("/categories")
async def get_video_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.videos.distinct("category")
    return [c for c in categories if c]


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(video_id: str, current_user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.get("is_public") and not check_permission(current_user, video.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verificar liberação gradativa
    access = await check_video_access(video, current_user["id"])
    if not access.is_unlocked:
        raise HTTPException(status_code=403, detail=access.reason or "Video locked")

    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "view", "video", video_id, {"title": video["title"]})

    video["views"] = video.get("views", 0) + 1

    # Enriquecer
    if video.get("subcategory_id"):
        sub = await db.content_subcategories.find_one({"id": video["subcategory_id"]})
        if sub:
            video["subcategory_name"] = sub.get("name")

    video["comment_count"] = await db.video_comments.count_documents({"video_id": video_id})

    pipeline = [
        {"$match": {"video_id": video_id}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
    ]
    avg_result = await db.video_evaluations.aggregate(pipeline).to_list(1)
    if avg_result:
        video["average_rating"] = round(avg_result[0]["avg_score"], 1)

    video["is_unlocked"] = True

    return video


@router.get("/{video_id}/access-status", response_model=VideoAccessStatus)
async def get_video_access_status(video_id: str, current_user: dict = Depends(get_current_user)):
    """Verifica se o vídeo está liberado para o usuário"""
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    return await check_video_access(video, current_user["id"])


@router.post("", response_model=VideoResponse)
async def create_video(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    is_public: bool = Form(False),
    video_type: str = Form("upload"),
    external_url: str = Form(None),
    permissions: str = Form(None),
    formative_stage_id: str = Form(None),
    subcategory_id: str = Form(None),
    order: int = Form(0),
    allow_comments: bool = Form(True),
    allow_evaluation: bool = Form(False),
    gradual_release: str = Form(None),
    file: UploadFile = File(None),
    current_user: dict = Depends(require_admin_or_formador)
):
    now = datetime.now(timezone.utc).isoformat()
    video_id = str(uuid.uuid4())

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

    video_dict = {
        "id": video_id,
        "title": title,
        "description": description,
        "category": category,
        "is_public": is_public,
        "permissions": perm_dict,
        "video_type": video_type,
        "external_url": external_url,
        "formative_stage_id": formative_stage_id if formative_stage_id else None,
        "subcategory_id": subcategory_id if subcategory_id else None,
        "order": order,
        "allow_comments": allow_comments,
        "allow_evaluation": allow_evaluation,
        "gradual_release": release_dict,
        "file_url": None,
        "file_name": None,
        "file_size": None,
        "file_type": None,
        "storage": None,
        "thumbnail_url": None,
        "duration": None,
        "uploaded_by": current_user["id"],
        "views": 0,
        "created_at": now,
        "updated_at": now
    }

    if video_type == "upload" and file:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_VIDEO_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid file type. Allowed: MP4, AVI, MOV, MKV, WEBM")

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 500MB")

        if ONEDRIVE_ENABLED:
            try:
                await onedrive.upload_file("videos", video_id, content, ext)
                video_dict["storage"] = "onedrive"
            except Exception as e:
                logger.error(f"OneDrive video upload failed: {e}")
                raise HTTPException(status_code=500, detail="Failed to upload video to cloud storage")
        else:
            file_path = UPLOAD_DIR / "videos" / f"{video_id}{ext}"
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            video_dict["storage"] = "local"

        video_dict["file_url"] = f"/api/uploads/videos/{video_id}{ext}"
        video_dict["file_name"] = file.filename
        video_dict["file_size"] = len(content)
        video_dict["file_type"] = ext[1:]

    await db.videos.insert_one(video_dict)
    await log_action(current_user["id"], current_user["full_name"], "upload", "video", video_id, {"title": title})

    return video_dict


@router.put("/{video_id}", response_model=VideoResponse)
async def update_video(video_id: str, video_data: VideoUpdate, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.videos.find_one({"id": video_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Video not found")

    update_dict = {k: v for k, v in video_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    if update_dict.get("permissions"):
        update_dict["permissions"] = update_dict["permissions"] if isinstance(update_dict["permissions"], dict) else update_dict["permissions"].model_dump() if hasattr(update_dict["permissions"], 'model_dump') else dict(update_dict["permissions"])

    if update_dict.get("gradual_release"):
        update_dict["gradual_release"] = update_dict["gradual_release"] if isinstance(update_dict["gradual_release"], dict) else update_dict["gradual_release"].model_dump() if hasattr(update_dict["gradual_release"], 'model_dump') else dict(update_dict["gradual_release"])

    await db.videos.update_one({"id": video_id}, {"$set": update_dict})
    await log_action(current_user["id"], current_user["full_name"], "update", "video", video_id)

    updated = await db.videos.find_one({"id": video_id}, {"_id": 0})
    return updated


@router.delete("/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(require_admin_or_formador)):
    existing = await db.videos.find_one({"id": video_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Video not found")

    if existing.get("file_url"):
        file_name = existing["file_url"].split("/")[-1]
        if existing.get("storage") == "onedrive" and ONEDRIVE_ENABLED:
            try:
                ext = f".{existing['file_type']}" if existing.get("file_type") else Path(file_name).suffix
                await onedrive.delete_file("videos", video_id, ext)
            except Exception as e:
                logger.error(f"OneDrive delete failed for video {video_id}: {e}")
        else:
            file_path = UPLOAD_DIR / "videos" / file_name
            if file_path.exists():
                file_path.unlink()

    # Limpar dados associados
    await db.video_comments.delete_many({"video_id": video_id})
    await db.video_evaluations.delete_many({"video_id": video_id})
    await db.video_attachments.delete_many({"video_id": video_id})
    await db.video_progress.delete_many({"video_id": video_id})

    await db.videos.delete_one({"id": video_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "video", video_id, {"title": existing["title"]})

    return {"message": "Video deleted successfully"}


# ==================== PROGRESSO ====================

@router.get("/{video_id}/progress", response_model=VideoProgressResponse)
async def get_video_progress(video_id: str, current_user: dict = Depends(get_current_user)):
    progress = await db.video_progress.find_one(
        {"video_id": video_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not progress:
        return VideoProgressResponse(
            video_id=video_id,
            user_id=current_user["id"],
            progress_seconds=0,
            completed=False,
            last_watched=datetime.now(timezone.utc).isoformat()
        )
    return progress


@router.post("/{video_id}/progress", response_model=VideoProgressResponse)
async def update_video_progress(
    video_id: str,
    progress_data: VideoProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat()

    await db.video_progress.update_one(
        {"video_id": video_id, "user_id": current_user["id"]},
        {"$set": {
            "video_id": video_id,
            "user_id": current_user["id"],
            "progress_seconds": progress_data.progress_seconds,
            "completed": progress_data.completed,
            "last_watched": now
        }},
        upsert=True
    )

    if progress_data.completed:
        await log_action(
            current_user["id"], current_user["full_name"],
            "complete", "video", video_id
        )

    return VideoProgressResponse(
        video_id=video_id,
        user_id=current_user["id"],
        progress_seconds=progress_data.progress_seconds,
        completed=progress_data.completed,
        last_watched=now
    )


# ==================== COMENTÁRIOS ====================

@router.get("/{video_id}/comments", response_model=List[VideoCommentResponse])
async def list_video_comments(
    video_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Lista comentários de um vídeo"""
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.get("allow_comments", True):
        return []

    skip = (page - 1) * limit
    comments = await db.video_comments.find(
        {"video_id": video_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return comments


@router.post("/{video_id}/comments", response_model=VideoCommentResponse)
async def create_video_comment(
    video_id: str,
    data: VideoCommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Adiciona comentário a um vídeo"""
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.get("allow_comments", True):
        raise HTTPException(status_code=403, detail="Comments are disabled for this video")

    now = datetime.now(timezone.utc).isoformat()
    comment = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "user_photo_url": current_user.get("photo_url"),
        "content": data.content,
        "parent_id": data.parent_id,
        "tenant_id": current_user.get("tenant_id"),
        "created_at": now,
        "updated_at": now
    }

    await db.video_comments.insert_one(comment)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "video_comment", comment["id"],
        {"video_id": video_id}
    )

    return comment


@router.put("/{video_id}/comments/{comment_id}", response_model=VideoCommentResponse)
async def update_video_comment(
    video_id: str,
    comment_id: str,
    data: VideoCommentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Edita um comentário (apenas o autor)"""
    comment = await db.video_comments.find_one({"id": comment_id, "video_id": video_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.video_comments.update_one({"id": comment_id}, {"$set": update_dict})

    updated = await db.video_comments.find_one({"id": comment_id}, {"_id": 0})
    return updated


@router.delete("/{video_id}/comments/{comment_id}")
async def delete_video_comment(
    video_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove um comentário (autor ou admin)"""
    comment = await db.video_comments.find_one({"id": comment_id, "video_id": video_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    roles = current_user.get("roles", [])
    if comment["user_id"] != current_user["id"] and "admin" not in roles and "superadmin" not in roles:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.video_comments.delete_one({"id": comment_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "video_comment", comment_id,
        {"video_id": video_id}
    )

    return {"message": "Comment deleted successfully"}


# ==================== AVALIAÇÕES ====================

@router.get("/{video_id}/evaluations", response_model=List[VideoEvaluationResponse])
async def list_video_evaluations(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lista avaliações de um vídeo"""
    evaluations = await db.video_evaluations.find(
        {"video_id": video_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    return evaluations


@router.post("/{video_id}/evaluations", response_model=VideoEvaluationResponse)
async def create_or_update_video_evaluation(
    video_id: str,
    data: VideoEvaluationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Avalia um vídeo (1-5). Atualiza se já avaliou."""
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.get("allow_evaluation", False):
        raise HTTPException(status_code=403, detail="Evaluation is disabled for this video")

    if data.score < 1 or data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")

    now = datetime.now(timezone.utc).isoformat()

    existing = await db.video_evaluations.find_one(
        {"video_id": video_id, "user_id": current_user["id"]}
    )

    if existing:
        await db.video_evaluations.update_one(
            {"id": existing["id"]},
            {"$set": {
                "score": data.score,
                "feedback": data.feedback,
                "updated_at": now
            }}
        )
        updated = await db.video_evaluations.find_one({"id": existing["id"]}, {"_id": 0})
        return updated

    evaluation = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "score": data.score,
        "feedback": data.feedback,
        "tenant_id": current_user.get("tenant_id"),
        "created_at": now,
        "updated_at": now
    }

    await db.video_evaluations.insert_one(evaluation)
    await log_action(
        current_user["id"], current_user["full_name"],
        "create", "video_evaluation", evaluation["id"],
        {"video_id": video_id, "score": data.score}
    )

    return evaluation


# ==================== ARQUIVOS ANEXOS ====================

@router.get("/{video_id}/attachments", response_model=List[VideoAttachmentResponse])
async def list_video_attachments(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lista arquivos anexos de um vídeo"""
    attachments = await db.video_attachments.find(
        {"video_id": video_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return attachments


@router.post("/{video_id}/attachments", response_model=VideoAttachmentResponse)
async def upload_video_attachment(
    video_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin_or_formador)
):
    """Faz upload de um arquivo anexo para um vídeo"""
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

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
        "video_id": video_id,
        "file_url": f"/api/uploads/documents/{attachment_id}{ext}",
        "file_name": file.filename,
        "file_size": len(content),
        "file_type": ext[1:],
        "uploaded_by": current_user["id"],
        "tenant_id": current_user.get("tenant_id"),
        "created_at": now
    }

    await db.video_attachments.insert_one(attachment)
    await log_action(
        current_user["id"], current_user["full_name"],
        "upload", "video_attachment", attachment_id,
        {"video_id": video_id, "file_name": file.filename}
    )

    return attachment


@router.delete("/{video_id}/attachments/{attachment_id}")
async def delete_video_attachment(
    video_id: str,
    attachment_id: str,
    current_user: dict = Depends(require_admin_or_formador)
):
    """Remove um arquivo anexo"""
    attachment = await db.video_attachments.find_one(
        {"id": attachment_id, "video_id": video_id}
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_name = attachment["file_url"].split("/")[-1]
    file_path = UPLOAD_DIR / "documents" / file_name
    if file_path.exists():
        file_path.unlink()

    await db.video_attachments.delete_one({"id": attachment_id})
    await log_action(
        current_user["id"], current_user["full_name"],
        "delete", "video_attachment", attachment_id,
        {"video_id": video_id}
    )

    return {"message": "Attachment deleted successfully"}
