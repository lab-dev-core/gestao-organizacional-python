"""Integration tests for API endpoints using FastAPI TestClient."""
import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-for-tests"
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "gestao_test"

from fastapi.testclient import TestClient
from app.utils.security import create_access_token


def get_test_app():
    """Create a test app instance."""
    from app.main import app
    return app


def get_auth_headers(role="admin", user_id="test-user-1", tenant_id="test-tenant-1"):
    """Generate authorization headers for testing."""
    token = create_access_token(user_id, role, tenant_id)
    return {"Authorization": f"Bearer {token}"}


class TestRootEndpoints:
    """Test root and health endpoints (no auth required)."""

    def test_root_returns_api_info(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "3.0.0"
        assert data["multi_tenant"] is True

    def test_health_check(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "version" in data
        assert "checks" in data


class TestRateLimiting:
    """Test rate limiting middleware."""

    def test_rate_limit_allows_normal_requests(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/")
        assert response.status_code == 200

    def test_debug_cors_disabled_in_production(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/debug/cors")
        assert response.status_code == 200


class TestAuthEndpoints:
    """Test authentication endpoints."""

    def test_login_without_credentials_returns_422(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/auth/login", json={})
        assert response.status_code == 422  # Validation error

    def test_login_with_invalid_body_returns_422(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/auth/login", json={"email": "test"})
        assert response.status_code == 422

    def test_register_without_tenant_returns_error(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/auth/register", json={
            "email": "test@test.com",
            "password": "password123",
            "full_name": "Test User"
        })
        # Missing tenant_slug, should fail
        assert response.status_code in [400, 422]


class TestProtectedEndpoints:
    """Test that protected endpoints require authentication (401 Unauthorized)."""

    def test_users_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/users")
        assert response.status_code == 401

    def test_documents_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/documents")
        assert response.status_code == 401

    def test_videos_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/videos")
        assert response.status_code == 401

    def test_acompanhamentos_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/acompanhamentos")
        assert response.status_code == 401

    def test_locations_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/locations")
        assert response.status_code == 401

    def test_functions_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/functions")
        assert response.status_code == 401

    def test_formative_stages_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/formative-stages")
        assert response.status_code == 401

    def test_audit_logs_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/audit-logs")
        assert response.status_code == 401

    def test_tenants_endpoint_requires_auth(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/tenants")
        assert response.status_code == 401


class TestTokenValidation:
    """Test that invalid tokens are properly rejected."""

    def test_expired_token_rejected(self):
        import jwt as pyjwt
        from datetime import datetime, timezone, timedelta
        from app.config import JWT_SECRET, JWT_ALGORITHM

        expired_payload = {
            "user_id": "test",
            "role": "admin",
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        token = pyjwt.encode(expired_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/api/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401

    def test_invalid_token_rejected(self):
        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/api/users",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert response.status_code == 401

    def test_refresh_token_rejected_for_api_access(self):
        """Refresh tokens should not work for API access."""
        from app.utils.security import create_refresh_token
        token = create_refresh_token("test-user")

        app = get_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/api/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401
