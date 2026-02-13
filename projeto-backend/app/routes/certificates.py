from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import uuid
import shutil

from app.database import db
from app.config import UPLOAD_DIR, ALLOWED_DOC_EXTENSIONS, ALLOWED_IMAGE_EXTENSIONS
from app.models.certificate import CertificateResponse
from app.models.enums import UserRole
from app.utils.security import (
    get_current_user, get_tenant_filter, get_user_roles
)
from app.utils.audit import log_action

router = APIRouter()

ALLOWED_CERT_EXTENSIONS = ALLOWED_DOC_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS


def can_view_user_certificates(current_user: dict, target_user_id: str, target_user: dict = None) -> bool:
    """Check if current user can view certificates of target user."""
    roles = get_user_roles(current_user)

    # User can always see their own
    if current_user["id"] == target_user_id:
        return True

    # Admin and superadmin can see all in their tenant
    if any(r in roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN]):
        return True

    # Formador can see certificates of users assigned to them
    if UserRole.FORMADOR in roles and target_user:
        if target_user.get("formador_id") == current_user["id"]:
            return True

    return False


@router.get("", response_model=List[CertificateResponse])
async def list_certificates(
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List certificates. Filters by user_id if provided, otherwise shows accessible ones."""
    roles = get_user_roles(current_user)
    query = get_tenant_filter(current_user)

    if user_id:
        # Check permission to view this user's certificates
        target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        if not can_view_user_certificates(current_user, user_id, target_user):
            raise HTTPException(status_code=403, detail="Permission denied")
        query["user_id"] = user_id
    else:
        # Without user_id filter: show based on role
        is_admin = any(r in roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN])
        is_formador = UserRole.FORMADOR in roles

        if is_admin:
            pass  # Admin sees all in tenant (query already filtered by tenant)
        elif is_formador:
            # Formador sees own + their assigned users' certificates
            assigned_users = await db.users.find(
                {"formador_id": current_user["id"]}, {"id": 1}
            ).to_list(1000)
            allowed_ids = [u["id"] for u in assigned_users] + [current_user["id"]]
            query["user_id"] = {"$in": allowed_ids}
        else:
            # Regular user sees only own
            query["user_id"] = current_user["id"]

    certificates = await db.certificates.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return certificates


@router.post("", response_model=CertificateResponse)
async def upload_certificate(
    title: str = Form(...),
    user_id: str = Form(...),
    description: Optional[str] = Form(None),
    issue_date: Optional[str] = Form(None),
    issuing_institution: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a certificate. Users can upload for themselves, admins for anyone."""
    roles = get_user_roles(current_user)
    is_admin = any(r in roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN])

    # Only the user themselves or admin can upload
    if not is_admin and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Verify target user exists
    user_query = {"id": user_id}
    if current_user.get("tenant_id"):
        user_query["tenant_id"] = current_user["tenant_id"]
    target_user = await db.users.find_one(user_query)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_CERT_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_CERT_EXTENSIONS)}")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / "certificates" / f"{file_id}{ext}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    now = datetime.now(timezone.utc).isoformat()
    cert_dict = {
        "id": str(uuid.uuid4()),
        "tenant_id": current_user.get("tenant_id"),
        "title": title,
        "description": description,
        "user_id": user_id,
        "file_url": f"/api/uploads/certificates/{file_id}{ext}",
        "issue_date": issue_date,
        "issuing_institution": issuing_institution,
        "uploaded_by_id": current_user["id"],
        "uploaded_by_name": current_user["full_name"],
        "created_at": now,
        "updated_at": now
    }

    await db.certificates.insert_one(dict(cert_dict))
    await log_action(current_user["id"], current_user["full_name"], "create", "certificate", cert_dict["id"], {"certificate_title": title, "for_user": user_id})

    return cert_dict


@router.put("/{cert_id}", response_model=CertificateResponse)
async def update_certificate(
    cert_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    issue_date: Optional[str] = Form(None),
    issuing_institution: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Update certificate metadata."""
    roles = get_user_roles(current_user)
    is_admin = any(r in roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN])

    query = get_tenant_filter(current_user)
    query["id"] = cert_id

    cert = await db.certificates.find_one(query)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if not is_admin and cert["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Permission denied")

    update_dict = {}
    if title is not None:
        update_dict["title"] = title
    if description is not None:
        update_dict["description"] = description
    if issue_date is not None:
        update_dict["issue_date"] = issue_date
    if issuing_institution is not None:
        update_dict["issuing_institution"] = issuing_institution

    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.certificates.update_one({"id": cert_id}, {"$set": update_dict})

    updated = await db.certificates.find_one({"id": cert_id}, {"_id": 0})
    return updated


@router.delete("/{cert_id}")
async def delete_certificate(cert_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a certificate. User can delete own, admin can delete any."""
    roles = get_user_roles(current_user)
    is_admin = any(r in roles for r in [UserRole.ADMIN, UserRole.SUPERADMIN])

    query = get_tenant_filter(current_user)
    query["id"] = cert_id

    cert = await db.certificates.find_one(query)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if not is_admin and cert["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Delete file from disk
    if cert.get("file_url"):
        filename = cert["file_url"].split("/")[-1]
        file_path = UPLOAD_DIR / "certificates" / filename
        if file_path.exists():
            file_path.unlink()

    await db.certificates.delete_one({"id": cert_id})
    await log_action(current_user["id"], current_user["full_name"], "delete", "certificate", cert_id)

    return {"message": "Certificate deleted successfully"}
