"""SQLAlchemy ORM model for Notifications domain matching existing PostgreSQL 16 schema.

Strictly maps the existing 'notifications' table:
- id (UUID PK)
- recipient_user_id (UUID FK users.id)
- kind (TEXT)
- message_key (TEXT)
- params (JSONB)
- related_type (TEXT, nullable)
- related_id (TEXT, nullable)
- status (TEXT: 'UNREAD','READ','DISMISSED')
- created_at (TIMESTAMPTZ)
- read_at (TIMESTAMPTZ, nullable)

Never calls Base.metadata.create_all(). Zero DDL.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base


class Notification(Base):
    """In-app persistent notification matching 'notifications' table."""
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    message_key: Mapped[str] = mapped_column(Text, nullable=False)
    params: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    related_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    related_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @validates("related_id")
    def _validate_related_id(self, key: str, value: Any) -> Optional[str]:
        if value is not None:
            return str(value)
        return None

    status: Mapped[str] = mapped_column(Text, default="UNREAD", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    recipient: Mapped["app.modules.authentication.models.User"] = relationship(  # type: ignore
        "User",
        foreign_keys=[recipient_user_id],
        lazy="selectin"
    )


class EmailLog(Base):
    """Email delivery log matching 'email_logs' table."""
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    recipient_email: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)  # SENT, FAILED, PENDING
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

