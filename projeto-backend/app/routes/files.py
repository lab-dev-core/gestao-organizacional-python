import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from app.config import UPLOAD_DIR, ONEDRIVE_ENABLED
from app.services import onedrive

logger = logging.getLogger(__name__)

router = APIRouter()

ONEDRIVE_FOLDERS = {"documents", "videos"}


@router.get("/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    if folder not in ["documents", "videos", "photos"]:
        raise HTTPException(status_code=404, detail="Invalid folder")

    # Tenta servir do filesystem local primeiro
    file_path = UPLOAD_DIR / folder / filename
    if file_path.exists():
        return FileResponse(file_path)

    # Se não existe localmente e o OneDrive está habilitado, busca de lá
    if ONEDRIVE_ENABLED and folder in ONEDRIVE_FOLDERS:
        file_stem = Path(filename).stem
        file_ext = Path(filename).suffix

        try:
            file_bytes = await onedrive.download_file(folder, file_stem, file_ext)
            if file_bytes is not None:
                return Response(
                    content=file_bytes,
                    media_type="application/octet-stream",
                    headers={"Content-Disposition": f'inline; filename="{filename}"'}
                )
        except Exception as e:
            logger.error(f"OneDrive serve failed for {folder}/{filename}: {e}")

    raise HTTPException(status_code=404, detail="File not found")
