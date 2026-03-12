"""
Abstração de armazenamento de arquivos.

Permite trocar o backend de storage (local, OneDrive, S3) via variável
STORAGE_BACKEND sem alterar nenhuma rota.

Uso nas rotas:
    from app.services.storage import get_storage

    storage = get_storage()
    file_id, url = await storage.save(content, "documents", ".pdf")
    await storage.delete("documents", file_id, ".pdf")
"""

import logging
import shutil
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple

from app.config import UPLOAD_DIR, STORAGE_BACKEND, ONEDRIVE_ENABLED

logger = logging.getLogger(__name__)


class StorageService(ABC):
    """Interface comum para todos os backends de storage."""

    @abstractmethod
    async def save(self, content: bytes, folder: str, extension: str) -> Tuple[str, str]:
        """
        Persiste o conteúdo e retorna (file_id, url_de_acesso).
        `url_de_acesso` pode ser uma URL pública (CDN/OneDrive) ou
        o path interno da API (/api/uploads/...).
        """

    @abstractmethod
    async def read(self, folder: str, file_id: str, extension: str) -> Optional[bytes]:
        """Retorna o conteúdo do arquivo ou None se não encontrado."""

    @abstractmethod
    async def delete(self, folder: str, file_id: str, extension: str) -> bool:
        """Remove o arquivo. Retorna True se deletado, False se não encontrado."""

    @abstractmethod
    async def get_url(self, folder: str, file_id: str, extension: str) -> Optional[str]:
        """Retorna URL de acesso (pode ser signed URL ou path interno)."""


class LocalStorageService(StorageService):
    """
    Armazena arquivos no filesystem local do container.
    Simples, mas não escala horizontalmente.
    Use apenas para desenvolvimento ou single-instance.
    """

    def __init__(self, upload_dir: Path = UPLOAD_DIR):
        self.upload_dir = upload_dir

    async def save(self, content: bytes, folder: str, extension: str) -> Tuple[str, str]:
        file_id = str(uuid.uuid4())
        dest_dir = self.upload_dir / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        file_path = dest_dir / f"{file_id}{extension}"

        file_path.write_bytes(content)
        url = f"/api/uploads/{folder}/{file_id}{extension}"
        logger.debug(f"LocalStorage: salvo {file_path}")
        return file_id, url

    async def read(self, folder: str, file_id: str, extension: str) -> Optional[bytes]:
        file_path = self.upload_dir / folder / f"{file_id}{extension}"
        if not file_path.exists():
            return None
        return file_path.read_bytes()

    async def delete(self, folder: str, file_id: str, extension: str) -> bool:
        file_path = self.upload_dir / folder / f"{file_id}{extension}"
        if file_path.exists():
            file_path.unlink()
            logger.debug(f"LocalStorage: deletado {file_path}")
            return True
        return False

    async def get_url(self, folder: str, file_id: str, extension: str) -> Optional[str]:
        file_path = self.upload_dir / folder / f"{file_id}{extension}"
        if not file_path.exists():
            return None
        return f"/api/uploads/{folder}/{file_id}{extension}"


class OneDriveStorageService(StorageService):
    """
    Armazena arquivos no OneDrive via Microsoft Graph API.
    Escalável, com suporte a CDN e signed URLs.
    Requer ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_TENANT_ID.
    """

    async def save(self, content: bytes, folder: str, extension: str) -> Tuple[str, str]:
        from app.services import onedrive
        file_id = str(uuid.uuid4())
        await onedrive.upload_file(folder, file_id, content, extension)
        # Retorna URL interna — o frontend faz download via /api/uploads/{folder}/{file_id}{ext}
        url = f"/api/uploads/{folder}/{file_id}{extension}"
        logger.info(f"OneDriveStorage: salvo {folder}/{file_id}{extension}")
        return file_id, url

    async def read(self, folder: str, file_id: str, extension: str) -> Optional[bytes]:
        from app.services import onedrive
        return await onedrive.download_file(folder, file_id, extension)

    async def delete(self, folder: str, file_id: str, extension: str) -> bool:
        from app.services import onedrive
        return await onedrive.delete_file(folder, file_id, extension)

    async def get_url(self, folder: str, file_id: str, extension: str) -> Optional[str]:
        from app.services import onedrive
        # Tenta obter signed URL do OneDrive (acesso direto sem passar pela API)
        signed = await onedrive.get_download_url(folder, file_id, extension)
        if signed:
            return signed
        return f"/api/uploads/{folder}/{file_id}{extension}"


def get_storage() -> StorageService:
    """
    Factory que retorna a implementação de storage configurada via STORAGE_BACKEND.

    - "onedrive": usa Microsoft Graph API (requer configuração OneDrive)
    - "local" (default): usa filesystem local
    """
    if STORAGE_BACKEND == "onedrive":
        if not ONEDRIVE_ENABLED:
            logger.warning(
                "STORAGE_BACKEND=onedrive mas credenciais OneDrive não configuradas. "
                "Usando storage local como fallback."
            )
            return LocalStorageService()
        return OneDriveStorageService()

    return LocalStorageService()
