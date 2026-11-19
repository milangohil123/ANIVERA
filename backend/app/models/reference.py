"""Foundational SQLAlchemy models for Reference Data (Species, Breeds, Programmes, SystemSettings).

Matches the PostgreSQL schema in pashurakshak_schema_v0.2.sql.
"""
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


class Species(Base):
    """Species reference model matching 'species' table."""
    __tablename__ = "species"

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    breeds: Mapped[List["Breed"]] = relationship("Breed", back_populates="species")


class Breed(Base):
    """Breed reference model matching 'breeds' table."""
    __tablename__ = "breeds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    species_code: Mapped[str] = mapped_column(
        Text,
        ForeignKey("species.code"),
        nullable=False
    )
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    species: Mapped["Species"] = relationship("Species", back_populates="breeds")


class Programme(Base):
    """Vaccination programme category matching 'programmes' table."""
    __tablename__ = "programmes"

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    name_gu: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SystemSetting(Base):
    """System configuration parameters matching 'system_settings' table."""
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

