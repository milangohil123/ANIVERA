"""FastAPI HTTP route handlers for Offline Synchronisation domain."""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.sync.schemas import (
    ConflictResolveRequest,
    OfflineGrantIssueRequest,
    OfflineGrantIssueResponse,
    ReferenceDataResponse,
    SyncConflictItem,
    SyncPushRequest,
    SyncPushResponse,
    SyncStatusSummary,
)
from app.modules.sync.service import SyncService

router = APIRouter()


def _extract_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from proxy headers or connection state."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "/grant",
    response_model=OfflineGrantIssueResponse,
    status_code=status.HTTP_200_OK,
    summary="Issue or renew an offline authorization grant token",
    description="Issues a verifiable 7-day JWT grant binding authenticated staff to a specific device for offline operations."
)
async def issue_offline_grant(
    payload: OfflineGrantIssueRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> OfflineGrantIssueResponse:
    """Issue a signed offline authorization grant."""
    service = SyncService(db)
    client_ip = _extract_client_ip(request)
    return await service.issue_offline_grant(
        current_user=current_user,
        req=payload,
        client_ip=client_ip
    )


@router.post(
    "/push",
    response_model=SyncPushResponse,
    status_code=status.HTTP_200_OK,
    summary="Push queued offline events to the server",
    description="Processes up to 50 offline events with independent savepoint handling and returns per-record acknowledgements."
)
async def push_sync_events(
    payload: SyncPushRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> SyncPushResponse:
    """Execute batch synchronization."""
    service = SyncService(db)
    client_ip = _extract_client_ip(request)
    return await service.process_sync_push(
        request=payload,
        current_user=current_user,
        client_ip=client_ip
    )


@router.get(
    "/status",
    response_model=SyncStatusSummary,
    status_code=status.HTTP_200_OK,
    summary="Get sync telemetry and conflict counts for a device",
    description="Returns device registration status, last synchronization timestamp, and open conflict counts."
)
async def get_device_sync_status(
    device_id: uuid.UUID = Query(..., alias="deviceId"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> SyncStatusSummary:
    """Fetch device sync health and conflict counts."""
    service = SyncService(db)
    return await service.get_sync_status(device_id=device_id, current_user=current_user)


@router.get(
    "/conflicts",
    response_model=List[SyncConflictItem],
    status_code=status.HTTP_200_OK,
    summary="List open synchronization conflicts for review",
    description="Lists data conflicts requiring authorized clinical or administrative review."
)
async def list_sync_conflicts(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[SyncConflictItem]:
    """List open sync conflicts."""
    service = SyncService(db)
    return await service.list_conflicts(current_user=current_user, limit=limit)


@router.post(
    "/conflicts/{conflict_id}/resolve",
    response_model=SyncConflictItem,
    status_code=status.HTTP_200_OK,
    summary="Resolve an open sync conflict",
    description="Authorized Veterinary Officer or DAHO decision on an unverified or conflicting offline event."
)
async def resolve_sync_conflict(
    conflict_id: uuid.UUID,
    payload: ConflictResolveRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> SyncConflictItem:
    """Resolve an open conflict."""
    service = SyncService(db)
    client_ip = _extract_client_ip(request)
    return await service.resolve_conflict(
        conflict_id=conflict_id,
        req=payload,
        current_user=current_user,
        client_ip=client_ip
    )


@router.get(
    "/reference-data",
    response_model=ReferenceDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Pull scoped reference data for authorized offline operations",
    description="Returns assigned villages, registered farmers, active animals, QR tokens, species/programmes, and active permissions derived strictly from server-side assignments."
)
async def get_reference_data(
    since: Optional[datetime] = Query(None, description="Optional ISO 8601 timestamp cursor for incremental updates"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> ReferenceDataResponse:
    """Pull scoped reference data for offline work."""
    service = SyncService(db)
    client_ip = _extract_client_ip(request) if request else None
    return await service.get_reference_data(
        current_user=current_user,
        since=since,
        client_ip=client_ip
    )


@router.get(
    "/pull",
    response_model=ReferenceDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Pull reference data (alias for /reference-data)",
    description="Alias endpoint for backward compatibility with mobile/offline sync clients."
)
async def pull_reference_data(
    since: Optional[datetime] = Query(None, description="Optional ISO 8601 timestamp cursor for incremental updates"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> ReferenceDataResponse:
    """Alias for /reference-data."""
    service = SyncService(db)
    client_ip = _extract_client_ip(request) if request else None
    return await service.get_reference_data(
        current_user=current_user,
        since=since,
        client_ip=client_ip
    )


