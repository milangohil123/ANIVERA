"""FastAPI route handlers for In-App Notifications domain."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.modules.notifications.service import NotificationService

router = APIRouter()


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List authenticated user's notifications",
    description="Returns paginated notifications with localized Gujarati title and body, ordered by creation date descending."
)
async def list_notifications(
    status: Optional[str] = Query(None, description="Optional status filter: UNREAD, READ, DISMISSED"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> NotificationListResponse:
    """Fetch paginated notifications."""
    service = NotificationService(db)
    return await service.list_notifications(
        current_user=current_user,
        status_filter=status,
        offset=offset,
        limit=limit
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get unread notifications count",
    description="Returns the total number of unread notifications for the authenticated user for the header bell badge."
)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UnreadCountResponse:
    """Fetch unread notifications count."""
    service = NotificationService(db)
    return await service.get_unread_count(current_user=current_user)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark single notification as read",
    description="Updates the notification status to READ and records the timestamp."
)
async def mark_notification_as_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> NotificationResponse:
    """Mark a notification as read."""
    service = NotificationService(db)
    return await service.mark_as_read(notification_id=notification_id, current_user=current_user)


@router.post(
    "/read-all",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Mark all user notifications as read",
    description="Marks all unread notifications for the caller as READ in a single transaction."
)
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Mark all notifications as read."""
    service = NotificationService(db)
    count = await service.mark_all_as_read(current_user=current_user)
    return {"marked_count": count, "message": "All notifications marked as read"}

