"""Foundational SQLAlchemy models for Geography (Districts, Talukas, Villages).

Matches the PostgreSQL schema in pashurakshak_schema_v0.2.sql and patch v0.3.1.
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class District(Base):
    """District operational boundary model matching 'districts' table."""
    __tablename__ = "districts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    # Relationships
    talukas: Mapped[List["Taluka"]] = relationship("Taluka", back_populates="district")
    villages: Mapped[List["Village"]] = relationship("Village", back_populates="district")


class Taluka(Base):
    """Taluka administrative boundary model matching 'talukas' table."""
    __tablename__ = "talukas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("districts.id"),
        nullable=False
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    district: Mapped["District"] = relationship("District", back_populates="talukas")
    villages: Mapped[List["Village"]] = relationship("Village", back_populates="taluka")


class Village(Base):
    """Village administrative boundary model matching 'villages' table."""
    __tablename__ = "villages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    taluka_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("talukas.id"),
        nullable=False
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("districts.id"),
        nullable=False
    )
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    census_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    coord_status: Mapped[str] = mapped_column(
        Text,
        default="UNAVAILABLE",
        nullable=False
    )
    coord_source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )
    is_pilot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    # Relationships
    district: Mapped["District"] = relationship("District", back_populates="villages")
    taluka: Mapped["Taluka"] = relationship("Taluka", back_populates="villages")


# Backward compatibility re-export for modules referencing Species through geography
from app.models.reference import Species  # noqa: F401, E402
