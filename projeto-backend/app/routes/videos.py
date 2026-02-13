from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import uuid
import json
import logging

from app.database import db
from app.config import UPLOAD_DIR, ALLOWED_VIDEO_EXTENSIONS, MAX_FILE_SIZE, ONEDRIVE_ENABLED
from app.models import VideoUpdate, VideoResponse, VideoProgressUpdate, VideoProgressResponse
from app.utils.security import get_current_user, require_admin_or_formador
from app.utils.permissions import check_permission
from app.utils.audit import log_action
from app.services import onedrive

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[VideoResponse])
async def list_videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
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

    skip = (page - 1) * limit
    videos = await db.videos.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)

    accessible_videos = []
    for video in videos:
        if video.get("is_public") or check_permission(current_user, video.get("permissions")):
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

    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "view", "video", video_id, {"title": video["title"]})

    video["views"] = video.get("views", 0) + 1
    return video


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

    await db.videos.delete_one({"id": video_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "video", video_id, {"title": existing["title"]})

    return {"message": "Video deleted successfully"}


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

    return VideoProgressResponse(
        video_id=video_id,
        user_id=current_user["id"],
        progress_seconds=progress_data.progress_seconds,
        completed=progress_data.completed,
        last_watched=now
    )
