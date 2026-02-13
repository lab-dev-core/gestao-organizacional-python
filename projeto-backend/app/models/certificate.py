from pydantic import BaseModel, ConfigDict
from typing import Optional


class CertificateBase(BaseModel):
    title: str
    description: Optional[str] = None
    user_id: str
    file_url: Optional[str] = None
    issue_date: Optional[str] = None
    issuing_institution: Optional[str] = None


class CertificateCreate(BaseModel):
    title: str
    description: Optional[str] = None
    user_id: str
    issue_date: Optional[str] = None
    issuing_institution: Optional[str] = None


class CertificateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    issue_date: Optional[str] = None
    issuing_institution: Optional[str] = None


class CertificateResponse(CertificateBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: Optional[str] = None
    uploaded_by_id: str
    uploaded_by_name: Optional[str] = None
    created_at: str
    updated_at: str
