import os
import pytest

# Set test environment before importing app modules
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-for-tests"
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "gestao_test"
os.environ["SUPERADMIN_EMAIL"] = "test@test.com"
os.environ["SUPERADMIN_PASSWORD"] = "test123"
