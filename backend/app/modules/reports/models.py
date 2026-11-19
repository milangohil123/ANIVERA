"""SQLAlchemy ORM model for Export Logging matching existing PostgreSQL 16 schema.

Strictly maps the existing 'export_log' table:
- id (UUID PK)
- user_id (UUID FK users.id)
- export_type (TEXT)
- filters (JSONB)
- purpose (TEXT)
- row_count (INTEGER)
- file_path (TEXT)
- formula_safe (BOOLEAN)
- created_at (TIMESTAMPTZ)
- expires_at (TIMESTAMPTZ)

Never calls Base.metadata.create_all(). Zero DDL.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ExportLog(Base):
    """Export log entry matching 'export_log' table in PostgreSQL 16."""
    __tablename__ = "export_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    export_type: Mapped[str] = mapped_column(Text, nullable=False)
    filters: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    purpose: Mapped[str] = mapped_column(Text, default="OPERATIONAL_REPORT", nullable=False)
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    formula_safe: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

