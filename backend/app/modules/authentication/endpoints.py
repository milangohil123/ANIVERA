"""FastAPI endpoints for Authentication module."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.authentication.schemas import (
    FarmerOtpRequest,
    FarmerOtpRequestResponse,
    FarmerOtpVerifyRequest,
    LogoutRequest,
    RefreshTokenRequest,
    StaffLoginRequest,
    TokenResponse,
    UserProfileResponse,
)
from app.modules.authentication.service import AuthService

router = APIRouter(prefix="", tags=["Authentication"])


def _extract_client_ip(request: Request) -> str:
    """Safely extract remote client IP address."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post(
    "/staff/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Staff username and password login",
    description="Authenticates staff members (DAHO, VO, Field Worker, etc.) using Argon2id password verification."
)
async def staff_login(
    payload: StaffLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> TokenResponse:
    service = AuthService(db)
    client_ip = _extract_client_ip(request)
    return await service.login_staff(payload, client_ip=client_ip)


@router.post(
    "/farmer/request-otp",
    response_model=FarmerOtpRequestResponse,
    status_code=status.HTTP_200_OK,
    summary="Request OTP for farmer mobile login",
    description="Dispatches a 6-digit OTP to a pre-provisioned farmer account. Returns a neutral response to prevent enumeration."
)
async def farmer_request_otp(
    payload: FarmerOtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> FarmerOtpRequestResponse:
    service = AuthService(db)
    client_ip = _extract_client_ip(request)
    return await service.request_farmer_otp(payload, client_ip=client_ip)


@router.post(
    "/farmer/verify-otp",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify farmer login OTP",
    description="Verifies the OTP challenge code and issues access and refresh tokens upon success."
)
async def farmer_verify_otp(
    payload: FarmerOtpVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> TokenResponse:
    service = AuthService(db)
    client_ip = _extract_client_ip(request)
    return await service.verify_farmer_otp(payload, client_ip=client_ip)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and issue new access token",
    description="Validates the active refresh token, revokes it, and issues a new access token and rotated refresh token."
)
async def refresh_tokens(
    payload: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> TokenResponse:
    service = AuthService(db)
    client_ip = _extract_client_ip(request)
    return await service.refresh_tokens(payload, client_ip=client_ip)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke active refresh token on logout",
    description="Revokes the provided refresh token and invalidates active session persistence."
)
async def logout(
    payload: LogoutRequest,
    request: Request,
    current_user: User = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AuthService(db)
    client_ip = _extract_client_ip(request)
    return await service.logout(payload, current_user=current_user, client_ip=client_ip)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user profile and permissions",
    description="Returns current user identity, role, assigned villages, assigned districts, and active permission codes."
)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserProfileResponse:
    service = AuthService(db)
    return await service.get_user_profile(current_user)

