import logging
import time
from typing import Optional

import httpx
import msal

from app.config import (
    ONEDRIVE_CLIENT_ID,
    ONEDRIVE_CLIENT_SECRET,
    ONEDRIVE_TENANT_ID,
    ONEDRIVE_DRIVE_ID,
    ONEDRIVE_BASE_FOLDER,
    ONEDRIVE_ENABLED,
)

logger = logging.getLogger(__name__)

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
CHUNK_SIZE = 4 * 1024 * 1024  # 4MB — limite para upload simples na Graph API

# Cache do token em memória
_token_cache: dict = {"access_token": None, "expires_at": 0}


def _get_msal_app() -> msal.ConfidentialClientApplication:
    authority = f"https://login.microsoftonline.com/{ONEDRIVE_TENANT_ID}"
    return msal.ConfidentialClientApplication(
        ONEDRIVE_CLIENT_ID,
        authority=authority,
        client_credential=ONEDRIVE_CLIENT_SECRET,
    )


async def get_access_token() -> str:
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]

    app = _get_msal_app()
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])

    if "access_token" not in result:
        error = result.get("error_description", result.get("error", "Unknown error"))
        logger.error(f"Failed to acquire OneDrive token: {error}")
        raise Exception(f"OneDrive authentication failed: {error}")

    _token_cache["access_token"] = result["access_token"]
    _token_cache["expires_at"] = now + result.get("expires_in", 3600)
    logger.info("OneDrive access token acquired successfully")
    return result["access_token"]


def _build_item_path(folder: str, filename: str) -> str:
    base = ONEDRIVE_BASE_FOLDER.strip("/")
    return f"{base}/{folder}/{filename}"


def _drive_prefix() -> str:
    if ONEDRIVE_DRIVE_ID:
        return f"{GRAPH_BASE_URL}/drives/{ONEDRIVE_DRIVE_ID}"
    return f"{GRAPH_BASE_URL}/me/drive"


async def upload_file(folder: str, file_id: str, content: bytes, extension: str) -> str:
    if not ONEDRIVE_ENABLED:
        raise Exception("OneDrive is not configured")

    token = await get_access_token()
    filename = f"{file_id}{extension}"
    item_path = _build_item_path(folder, filename)
    drive = _drive_prefix()

    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=300) as client:
        if len(content) <= CHUNK_SIZE:
            # Upload simples para arquivos <= 4MB
            url = f"{drive}/root:/{item_path}:/content"
            headers["Content-Type"] = "application/octet-stream"
            resp = await client.put(url, headers=headers, content=content)
            if resp.status_code not in (200, 201):
                logger.error(f"OneDrive upload failed: {resp.status_code} - {resp.text}")
                raise Exception(f"OneDrive upload failed: {resp.status_code}")
            data = resp.json()
            logger.info(f"File uploaded to OneDrive: {item_path}")
            return data.get("id", "")
        else:
            # Upload em sessão para arquivos > 4MB (suporta até ~250GB)
            url = f"{drive}/root:/{item_path}:/createUploadSession"
            session_body = {
                "item": {
                    "@microsoft.graph.conflictBehavior": "replace",
                    "name": filename,
                }
            }
            resp = await client.post(url, headers=headers, json=session_body)
            if resp.status_code not in (200, 201):
                logger.error(f"OneDrive create session failed: {resp.status_code} - {resp.text}")
                raise Exception(f"OneDrive upload session creation failed: {resp.status_code}")

            upload_url = resp.json()["uploadUrl"]
            total_size = len(content)
            offset = 0

            while offset < total_size:
                chunk_end = min(offset + CHUNK_SIZE, total_size)
                chunk = content[offset:chunk_end]
                content_range = f"bytes {offset}-{chunk_end - 1}/{total_size}"

                chunk_resp = await client.put(
                    upload_url,
                    content=chunk,
                    headers={
                        "Content-Range": content_range,
                        "Content-Length": str(len(chunk)),
                    },
                )

                if chunk_resp.status_code not in (200, 201, 202):
                    logger.error(f"OneDrive chunk upload failed: {chunk_resp.status_code} - {chunk_resp.text}")
                    raise Exception(f"OneDrive chunk upload failed at offset {offset}")

                offset = chunk_end

            logger.info(f"Large file uploaded to OneDrive via session: {item_path} ({total_size} bytes)")
            # O último chunk retorna o item completo
            return chunk_resp.json().get("id", "")


async def download_file(folder: str, file_id: str, extension: str) -> bytes:
    if not ONEDRIVE_ENABLED:
        raise Exception("OneDrive is not configured")

    token = await get_access_token()
    filename = f"{file_id}{extension}"
    item_path = _build_item_path(folder, filename)
    drive = _drive_prefix()

    url = f"{drive}/root:/{item_path}:/content"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            logger.error(f"OneDrive download failed: {resp.status_code} - {resp.text}")
            raise Exception(f"OneDrive download failed: {resp.status_code}")
        return resp.content


async def delete_file(folder: str, file_id: str, extension: str) -> bool:
    if not ONEDRIVE_ENABLED:
        raise Exception("OneDrive is not configured")

    token = await get_access_token()
    filename = f"{file_id}{extension}"
    item_path = _build_item_path(folder, filename)
    drive = _drive_prefix()

    url = f"{drive}/root:/{item_path}"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.delete(url, headers=headers)
        if resp.status_code == 204:
            logger.info(f"File deleted from OneDrive: {item_path}")
            return True
        if resp.status_code == 404:
            logger.warning(f"File not found on OneDrive (already deleted?): {item_path}")
            return True
        logger.error(f"OneDrive delete failed: {resp.status_code} - {resp.text}")
        return False


async def get_download_url(folder: str, file_id: str, extension: str) -> Optional[str]:
    if not ONEDRIVE_ENABLED:
        return None

    token = await get_access_token()
    filename = f"{file_id}{extension}"
    item_path = _build_item_path(folder, filename)
    drive = _drive_prefix()

    url = f"{drive}/root:/{item_path}"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return None
        data = resp.json()
        return data.get("@microsoft.graph.downloadUrl")
