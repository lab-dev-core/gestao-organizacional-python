from typing import Optional
from app.models.enums import UserRole


def check_permission(user: dict, permissions: Optional[dict]) -> bool:
    """Check if user has permission to access a resource"""
    if not permissions:
        return True

    if user.get("role") == UserRole.ADMIN:
        return True

    user_id = user.get("id")
    location_id = user.get("location_id")
    function_id = user.get("function_id")
    formative_stage_id = user.get("formative_stage_id")

    # Check user-specific permission
    if user_id in permissions.get("user_ids", []):
        return True

    # Check location permission
    if location_id and location_id in permissions.get("location_ids", []):
        return True

    # Check function permission
    if function_id and function_id in permissions.get("function_ids", []):
        return True

    # Check formative stage permission
    if formative_stage_id and formative_stage_id in permissions.get("formative_stage_ids", []):
        return True

    # If no specific permissions are set, allow access
    if not any([permissions.get("user_ids"), permissions.get("location_ids"),
                permissions.get("function_ids"), permissions.get("formative_stage_ids")]):
        return True

    return False
