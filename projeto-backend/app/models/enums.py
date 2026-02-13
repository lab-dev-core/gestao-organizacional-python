from enum import Enum


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"  # Can manage all tenants
    ADMIN = "admin"            # Admin of a specific tenant
    FORMADOR = "formador"      # Formador within a tenant
    USER = "user"              # Regular user within a tenant


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class EducationLevel(str, Enum):
    FUNDAMENTAL_INCOMPLETO = "fundamental_incompleto"
    FUNDAMENTAL_COMPLETO = "fundamental_completo"
    MEDIO_INCOMPLETO = "medio_incompleto"
    MEDIO_COMPLETO = "medio_completo"
    SUPERIOR_INCOMPLETO = "superior_incompleto"
    SUPERIOR_COMPLETO = "superior_completo"
    POS_GRADUACAO = "pos_graduacao"
    MESTRADO = "mestrado"
    DOUTORADO = "doutorado"


class AcompanhamentoFrequency(str, Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
