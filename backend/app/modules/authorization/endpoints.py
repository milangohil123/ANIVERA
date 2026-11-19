"""FastAPI endpoints for Authorization and RBAC verification."""
import uuid
from typing import Dict
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.dependencies.rbac import (
    get_user_scope,
    require_disease_confirmation_authority,
    require_vaccinator_authorization,
    verify_district_scope,
    verify_farmer_ownership,
    verify_village_scope,
)
from app.modules.authentication.models import User
from app.modules.authorization.schemas import (
    UserScope,
    UserScopeResponse,
    VOFallbackValidationRequest,
)
from app.modules.authorization.service import AuthorizationService

router = APIRouter(prefix="/rbac", tags=["Authorization & RBAC"])


def _extract_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.get(
    "/scope",
    response_model=UserScopeResponse,
    summary="Get current user security and geographic scope",
    description="Resolves effective permissions, assigned districts, assigned villages, and clinical authorizations."
)
async def get_my_scope(
    scope: UserScope = Depends(get_user_scope)
) -> UserScopeResponse:
    return UserScopeResponse(
        user_id=scope.user_id,
        role=scope.role,
        status=scope.status,
        permissions=sorted(list(scope.permissions)),
        assigned_districts=sorted(list(scope.assigned_district_ids)),
        assigned_villages=sorted(list(scope.assigned_village_ids)),
        linked_farmers=sorted(list(scope.linked_farmer_ids)),
        assigned_cooperatives=sorted(list(scope.assigned_cooperative_ids)),
        is_approved_vaccinator=scope.is_approved_vaccinator
    )


@router.get(
    "/test-permission/{permission_code}",
    status_code=status.HTTP_200_OK,
    summary="Verify user holds a specific permission code",
    description="Enforces canonical permission check and returns HTTP 200 on success or HTTP 403 on denial."
)
async def test_permission_endpoint(
    permission_code: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AuthorizationService(db)
    client_ip = _extract_ip(request)
    await service.assert_permission(current_user, permission_code, ip=client_ip)
    return {"status": "authorized", "permission": permission_code}


@router.get(
    "/test-district/{district_id}",
    status_code=status.HTTP_200_OK,
    summary="Verify user is authorized for target district",
    description="Enforces DAHO district scope and returns HTTP 200 on success or HTTP 403 on denial."
)
async def test_district_endpoint(
    district_id: uuid.UUID,
    scope: UserScope = Depends(verify_district_scope)
) -> Dict[str, str]:
    return {"status": "authorized", "district_id": str(district_id)}


@router.get(
    "/test-village/{village_id}",
    status_code=status.HTTP_200_OK,
    summary="Verify user is authorized for target village",
    description="Enforces FW/VO/DAHO village operational scope and returns HTTP 200 on success or HTTP 403 on denial."
)
async def test_village_endpoint(
    village_id: uuid.UUID,
    scope: UserScope = Depends(verify_village_scope)
) -> Dict[str, str]:
    return {"status": "authorized", "village_id": str(village_id)}


@router.get(
    "/test-farmer/{farmer_id}",
    status_code=status.HTTP_200_OK,
    summary="Verify farmer record-level access isolation",
    description="Ensures farmer users may only access their own linked profiles; returns HTTP 403 for other farmers."
)
async def test_farmer_endpoint(
    farmer_id: uuid.UUID,
    scope: UserScope = Depends(verify_farmer_ownership)
) -> Dict[str, str]:
    return {"status": "authorized", "farmer_id": str(farmer_id)}


@router.post(
    "/test-vo-fallback",
    status_code=status.HTTP_200_OK,
    summary="Verify VO fallback registration prerequisites",
    description="Enforces animal.create.fallback, village assignment, FW unavailability declaration, and audit reason."
)
async def test_vo_fallback_endpoint(
    payload: VOFallbackValidationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AuthorizationService(db)
    client_ip = _extract_ip(request)
    await service.assert_vo_fallback_prerequisites(
        user=current_user,
        village_id=payload.village_id,
        field_worker_user_id=payload.field_worker_user_id,
        reason=payload.reason,
        ip=client_ip
    )
    return {"status": "authorized", "fallback": "validated"}


@router.get(
    "/test-vaccinator",
    status_code=status.HTTP_200_OK,
    summary="Verify vaccinator clinical credential authorization",
    description="Enforces that recording vaccinations requires an approved vaccinator authorization."
)
async def test_vaccinator_endpoint(
    scope: UserScope = Depends(require_vaccinator_authorization)
) -> Dict[str, str]:
    return {"status": "authorized", "vaccinator": "approved"}


@router.get(
    "/test-disease-confirm",
    status_code=status.HTTP_200_OK,
    summary="Verify disease confirmation veterinary authorization",
    description="Enforces that confirming disease reports requires explicit 'disease.confirm' permission."
)
async def test_disease_confirm_endpoint(
    scope: UserScope = Depends(require_disease_confirmation_authority)
) -> Dict[str, str]:
    return {"status": "authorized", "disease_confirmation": "authorized"}

