from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    FORMADOR = "formador"
    USER = "user"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AcompanhamentoFrequency(str, Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
