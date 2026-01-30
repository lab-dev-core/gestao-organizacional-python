import uuid
from datetime import datetime, timezone
from app.database import db


async def log_action(user_id: str, user_name: str, action: str, resource_type: str, resource_id: str = None, details: dict = None):
    log_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(log_entry)
