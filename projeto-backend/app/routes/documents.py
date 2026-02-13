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
from app.utils.security import get_current_user, require_admin_or_formador
from app.utils.permissions import check_permission
from app.utils.audit import log_action
from app.services import onedrive

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
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
    documents = await db.documents.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)

    accessible_docs = []
    for doc in documents:
        if doc.get("is_public") or check_permission(current_user, doc.get("permissions")):
            accessible_docs.append(doc)

    return accessible_docs


@router.get("/categories")
async def get_document_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.documents.distinct("category")
    return [c for c in categories if c]


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("is_public") and not check_permission(current_user, doc.get("permissions")):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.documents.update_one({"id": doc_id}, {"$inc": {"views": 1}})
    await log_action(current_user["id"], current_user["full_name"], "view", "document", doc_id, {"title": doc["title"]})

    doc["views"] = doc.get("views", 0) + 1
    return doc


@router.post("", response_model=DocumentResponse)
async def create_document(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    is_public: bool = Form(False),
    permissions: str = Form(None),
    formative_stage_id: str = Form(None),
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

    doc_dict = {
        "id": file_id,
        "title": title,
        "description": description,
        "category": category,
        "is_public": is_public,
        "permissions": perm_dict,
        "version": 1,
        "formative_stage_id": formative_stage_id if formative_stage_id else None,
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

    await db.documents.update_one({"id": doc_id}, {"$inc": {"downloads": 1}})
    await log_action(current_user["id"], current_user["full_name"], "download", "document", doc_id, {"title": doc["title"]})

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
