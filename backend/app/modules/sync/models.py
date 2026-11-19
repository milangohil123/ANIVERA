"""SQLAlchemy ORM models for Offline Synchronisation domain matching PostgreSQL 16 schema.

Strictly maps existing PostgreSQL 16 tables:
- sync_batches
- sync_receipts
- sync_conflicts

Never calls create_all().
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class SyncBatch(Base):
    """Sync batch log matching 'sync_batches' table."""
    __tablename__ = "sync_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    client_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    event_count: Mapped[int] = mapped_column(Integer, nullable=False)
    accepted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    already_accepted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    needs_review: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    receipts: Mapped[List["SyncReceipt"]] = relationship("SyncReceipt", back_populates="batch")


class SyncReceipt(Base):
    """Per-event synchronization receipt matching 'sync_receipts' table."""
    __tablename__ = "sync_receipts"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    last_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sync_batches.id"),
        nullable=True
    )
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # 'ACCEPTED','ALREADY_ACCEPTED','REJECTED','NEEDS_REVIEW','HELD_FOR_REVIEW'
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    errors: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, nullable=True)
    payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    first_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    last_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    batch: Mapped[Optional["SyncBatch"]] = relationship("SyncBatch", back_populates="receipts")
    conflicts: Mapped[List["SyncConflict"]] = relationship("SyncConflict", back_populates="receipt")


class SyncConflict(Base):
    """Sync data conflict matching 'sync_conflicts' table."""
    __tablename__ = "sync_conflicts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sync_receipts.event_id"),
        nullable=True
    )
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)  # 'EVENT','ANIMAL','OWNER'
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    conflict_type: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # 'POSSIBLE_DUPLICATE_EVENT','STALE_ROW_VERSION','IDENTITY_MISMATCH','DUPLICATE_ANIMAL','DEACTIVATED_USER'
    details: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="OPEN", nullable=False)  # 'OPEN','RESOLVED'
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    receipt: Mapped[Optional["SyncReceipt"]] = relationship("SyncReceipt", back_populates="conflicts")

