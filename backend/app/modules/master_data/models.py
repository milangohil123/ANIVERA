"""SQLAlchemy ORM models for Master Data (Species, Disease Masters, Vaccine Masters)."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.reference import Species


class DiseaseMaster(Base):
    """Disease master reference table."""
    __tablename__ = "disease_masters"

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_hi: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    applicable_species: Mapped[List[str]] = mapped_column(JSONB, default=list, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(Text, default="#EF4444", nullable=True)
    severity: Mapped[Optional[str]] = mapped_column(Text, default="HIGH", nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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


class VaccineMaster(Base):
    """Vaccine master reference table."""
    __tablename__ = "vaccine_masters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    disease_code: Mapped[str] = mapped_column(Text, nullable=False)
    applicable_species: Mapped[List[str]] = mapped_column(JSONB, default=list, nullable=False)
    administration_route: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    standard_dosage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schedule_interval: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(Text, default="VERIFIED", nullable=False)
    verified_source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_custom_manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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
