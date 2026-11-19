"""Database access repository for In-App Notifications domain."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification


class NotificationRepository:
    """Repository handling notification queries and state transitions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_recipient(
        self,
        recipient_user_id: uuid.UUID,
        status_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 50
    ) -> Tuple[List[Notification], int]:
        """Fetch paginated notifications for the specified recipient."""
        base_stmt = select(Notification).where(Notification.recipient_user_id == recipient_user_id)
        if status_filter:
            base_stmt = base_stmt.where(Notification.status == status_filter.upper())

        # Total count query
        count_stmt = select(func.count(Notification.id)).where(Notification.recipient_user_id == recipient_user_id)
        if status_filter:
            count_stmt = count_stmt.where(Notification.status == status_filter.upper())
        total = (await self.db.scalar(count_stmt)) or 0

        # Items query ordered descending by created_at
        stmt = base_stmt.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all()), total

    async def count_unread(self, recipient_user_id: uuid.UUID) -> int:
        """Count unread notifications for a user."""
        stmt = (
            select(func.count(Notification.id))
            .where(
                Notification.recipient_user_id == recipient_user_id,
                Notification.status == "UNREAD"
            )
        )
        return (await self.db.scalar(stmt)) or 0

    async def get_by_id(
        self,
        notification_id: uuid.UUID,
        recipient_user_id: uuid.UUID
    ) -> Optional[Notification]:
        """Fetch notification ensuring it belongs to the caller."""
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_user_id == recipient_user_id
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def mark_as_read(self, notification: Notification) -> None:
        """Mark single notification as READ with timestamp."""
        notification.status = "READ"
        notification.read_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def mark_all_as_read(self, recipient_user_id: uuid.UUID) -> int:
        """Mark all unread notifications as READ for recipient."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(Notification)
            .where(
                Notification.recipient_user_id == recipient_user_id,
                Notification.status == "UNREAD"
            )
            .values(status="READ", read_at=now)
        )
        res = await self.db.execute(stmt)
        await self.db.flush()
        return res.rowcount or 0

    async def create(
        self,
        recipient_user_id: uuid.UUID,
        kind: str,
        message_key: str,
        params: Optional[Dict[str, Any]] = None,
        related_type: Optional[str] = None,
        related_id: Optional[Any] = None
    ) -> Notification:
        """Insert new in-app notification row."""
        notification = Notification(
            id=uuid.uuid4(),
            recipient_user_id=recipient_user_id,
            kind=kind,
            message_key=message_key,
            params=params or {},
            related_type=related_type,
            related_id=str(related_id) if related_id is not None else None,
            status="UNREAD",
            created_at=datetime.now(timezone.utc),
            read_at=None
        )
        self.db.add(notification)
        await self.db.flush()
        return notification

