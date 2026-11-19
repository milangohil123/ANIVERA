"""FastAPI dependencies for Role-Based Access Control and Scope Enforcement."""
import uuid
from typing import Callable, List, Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.authorization.schemas import UserScope
from app.modules.authorization.service import AuthorizationService


def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def get_user_scope(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserScope:
    """FastAPI dependency resolving the current user's security scope."""
    service = AuthorizationService(db)
    return await service.get_user_scope(current_user)


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory checking that user holds one of the allowed roles."""
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: role must be one of {list(allowed_roles)}"
            )
        return current_user
    return dependency


def require_permission(permission_code: str) -> Callable:
    """Dependency factory requiring a specific canonical permission code."""
    async def dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session)
    ) -> UserScope:
        service = AuthorizationService(db)
        return await service.assert_permission(
            user=current_user,
            permission_code=permission_code,
            ip=_client_ip(request)
        )
    return dependency


def require_any_permission(*permission_codes: str) -> Callable:
    """Dependency factory requiring at least one of the specified permission codes."""
    async def dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session)
    ) -> UserScope:
        service = AuthorizationService(db)
        return await service.assert_any_permission(
            user=current_user,
            permission_codes=list(permission_codes),
            ip=_client_ip(request)
        )
    return dependency


async def verify_district_scope(
    district_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserScope:
    """Route parameter dependency enforcing trusted district scope."""
    service = AuthorizationService(db)
    return await service.assert_district_scope(
        user=current_user,
        district_id=district_id,
        ip=_client_ip(request)
    )


async def verify_village_scope(
    village_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserScope:
    """Route parameter dependency enforcing trusted village scope."""
    service = AuthorizationService(db)
    return await service.assert_village_scope(
        user=current_user,
        village_id=village_id,
        ip=_client_ip(request)
    )


async def verify_farmer_ownership(
    farmer_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserScope:
    """Route parameter dependency enforcing farmer record-level ownership isolation."""
    service = AuthorizationService(db)
    return await service.assert_farmer_ownership(
        user=current_user,
        farmer_id=farmer_id,
        ip=_client_ip(request)
    )


async def require_vaccinator_authorization(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserScope:
    """Dependency verifying that user holds an approved vaccinator clinical credential."""
    service = AuthorizationService(db)
    await service.assert_vaccinator_authorization(
        user=current_user,
        ip=_client_ip(request)
    )
    return await service.get_user_scope(current_user)


async def require_disease_confirmation_authority(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserScope:
    """Dependency verifying explicit disease confirmation authority ('disease.confirm')."""
    service = AuthorizationService(db)
    await service.assert_disease_confirmation_authority(
        user=current_user,
        ip=_client_ip(request)
    )
    return await service.get_user_scope(current_user)

