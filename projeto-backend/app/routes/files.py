from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import UPLOAD_DIR

router = APIRouter()


@router.get("/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    if folder not in ["documents", "videos", "photos"]:
        raise HTTPException(status_code=404, detail="Invalid folder")

    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)
