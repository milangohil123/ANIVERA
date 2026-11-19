"""FastAPI dependencies package."""
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.dependencies.db import get_db_session
from app.dependencies.rbac import (
    get_user_scope,
    require_any_permission,
    require_disease_confirmation_authority,
    require_permission,
    require_role,
    require_vaccinator_authorization,
    verify_district_scope,
    verify_farmer_ownership,
    verify_village_scope,
)

__all__ = [
    "get_db_session",
    "get_current_user",
    "get_optional_current_user",
    "get_user_scope",
    "require_role",
    "require_permission",
    "require_any_permission",
    "verify_district_scope",
    "verify_village_scope",
    "verify_farmer_ownership",
    "require_vaccinator_authorization",
    "require_disease_confirmation_authority",
]


