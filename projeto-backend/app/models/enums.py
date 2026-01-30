from enum import Enum


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"  # Can manage all tenants
    ADMIN = "admin"            # Admin of a specific tenant
    FORMADOR = "formador"      # Formador within a tenant
    USER = "user"              # Regular user within a tenant


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AcompanhamentoFrequency(str, Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
