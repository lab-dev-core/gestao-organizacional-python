"""Tests for security utilities: password hashing, JWT tokens, role checks."""
import pytest
import jwt
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

# Set env before imports
import os
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-for-tests"

from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
)
from app.config import JWT_SECRET, JWT_ALGORITHM


class TestPasswordHashing:
    """Tests for bcrypt password hashing and verification."""

    def test_hash_password_returns_string(self):
        result = hash_password("test_password")
        assert isinstance(result, str)

    def test_hash_password_not_plaintext(self):
        password = "my_secret_password"
        hashed = hash_password(password)
        assert hashed != password

    def test_hash_password_different_hashes_for_same_password(self):
        password = "my_secret_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2  # bcrypt uses random salt

    def test_verify_password_correct(self):
        password = "correct_password"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_verify_password_empty_password(self):
        hashed = hash_password("some_password")
        assert verify_password("", hashed) is False

    def test_hash_password_unicode(self):
        password = "senhaComAçéntos123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_hash_password_long_password(self):
        password = "a" * 72  # bcrypt max length
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


class TestJWTTokens:
    """Tests for JWT token creation and decoding."""

    def test_create_access_token(self):
        token = create_access_token("user-123", "admin", "tenant-456")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_access_token_payload(self):
        token = create_access_token("user-123", "admin", "tenant-456")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload["user_id"] == "user-123"
        assert payload["role"] == "admin"
        assert payload["tenant_id"] == "tenant-456"
        assert payload["type"] == "access"

    def test_access_token_without_tenant(self):
        token = create_access_token("user-123", "superadmin")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload["user_id"] == "user-123"
        assert payload["tenant_id"] is None

    def test_access_token_has_expiration(self):
        token = create_access_token("user-123", "admin")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert "exp" in payload
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp_time > datetime.now(timezone.utc)

    def test_create_refresh_token(self):
        token = create_refresh_token("user-123")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload["user_id"] == "user-123"
        assert payload["type"] == "refresh"

    def test_refresh_token_longer_expiration(self):
        access = create_access_token("user-123", "admin")
        refresh = create_refresh_token("user-123")

        access_payload = jwt.decode(access, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        refresh_payload = jwt.decode(refresh, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        assert refresh_payload["exp"] > access_payload["exp"]

    def test_create_reset_token(self):
        token = create_reset_token("user-123")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload["user_id"] == "user-123"
        assert payload["type"] == "reset"

    def test_decode_valid_token(self):
        token = create_access_token("user-123", "admin", "tenant-456")
        payload = decode_token(token)
        assert payload["user_id"] == "user-123"
        assert payload["role"] == "admin"

    def test_decode_expired_token_raises(self):
        expired_payload = {
            "user_id": "user-123",
            "role": "admin",
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)
        }
        token = jwt.encode(expired_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_decode_invalid_token_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_token("not.a.valid.token")
        assert exc_info.value.status_code == 401

    def test_decode_token_wrong_secret_raises(self):
        token = jwt.encode(
            {"user_id": "x", "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "wrong-secret",
            algorithm=JWT_ALGORITHM,
        )
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401


class TestPermissions:
    """Tests for the permission checking utility."""

    def test_no_permissions_allows_access(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user"}
        assert check_permission(user, None) is True

    def test_admin_always_allowed(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "admin"}
        permissions = {"user_ids": ["other-user"]}
        assert check_permission(user, permissions) is True

    def test_user_in_user_ids_allowed(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user"}
        permissions = {"user_ids": ["u1", "u2"]}
        assert check_permission(user, permissions) is True

    def test_user_not_in_user_ids_denied(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user"}
        permissions = {"user_ids": ["u2", "u3"]}
        assert check_permission(user, permissions) is False

    def test_user_location_allowed(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user", "location_id": "loc1"}
        permissions = {"location_ids": ["loc1"]}
        assert check_permission(user, permissions) is True

    def test_user_location_denied(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user", "location_id": "loc1"}
        permissions = {"location_ids": ["loc2"]}
        assert check_permission(user, permissions) is False

    def test_user_function_allowed(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user", "function_id": "fn1"}
        permissions = {"function_ids": ["fn1"]}
        assert check_permission(user, permissions) is True

    def test_user_formative_stage_allowed(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user", "formative_stage_id": "fs1"}
        permissions = {"formative_stage_ids": ["fs1"]}
        assert check_permission(user, permissions) is True

    def test_empty_permissions_allows_access(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user"}
        permissions = {"user_ids": [], "location_ids": [], "function_ids": [], "formative_stage_ids": []}
        assert check_permission(user, permissions) is True

    def test_mixed_permissions_user_matches_one(self):
        from app.utils.permissions import check_permission
        user = {"id": "u1", "role": "user", "location_id": "loc1"}
        permissions = {"user_ids": ["u2"], "location_ids": ["loc1"]}
        assert check_permission(user, permissions) is True


class TestTenantFilter:
    """Tests for tenant filter generation."""

    def test_superadmin_no_filter(self):
        from app.utils.security import get_tenant_filter
        user = {"role": "superadmin", "tenant_id": None}
        result = get_tenant_filter(user)
        assert result == {}

    def test_admin_gets_tenant_filter(self):
        from app.utils.security import get_tenant_filter
        user = {"role": "admin", "tenant_id": "t1"}
        result = get_tenant_filter(user)
        assert result == {"tenant_id": "t1"}

    def test_user_without_tenant_raises(self):
        from app.utils.security import get_tenant_filter
        from fastapi import HTTPException
        user = {"role": "user", "tenant_id": None}
        with pytest.raises(HTTPException) as exc_info:
            get_tenant_filter(user)
        assert exc_info.value.status_code == 403
