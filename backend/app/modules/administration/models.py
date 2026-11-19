"""SQLAlchemy ORM models for Administration module.

Maps existing PostgreSQL 16 tables:
- veterinary_officer_profiles
- gram_panchayats
- gram_panchayat_villages
- gram_panchayat_staff_assignments
- cooperatives

Preserves existing tables without modification. Never calls create_all().
"""
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class VeterinaryOfficerProfile(Base):
    """Veterinary officer professional profile matching 'veterinary_officer_profiles' table."""
    __tablename__ = "veterinary_officer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True
    )
    employee_ref: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    office_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_mobile: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )


class GramPanchayat(Base):
    """Gram Panchayat local administrative unit matching 'gram_panchayats' table."""
    __tablename__ = "gram_panchayats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    taluka_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("talukas.id"),
        nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
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


class GramPanchayatVillage(Base):
    """Mapping of villages governed by a Gram Panchayat matching 'gram_panchayat_villages' table."""
    __tablename__ = "gram_panchayat_villages"

    gram_panchayat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gram_panchayats.id"),
        primary_key=True
    )
    village_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("villages.id"),
        primary_key=True
    )
    mapped_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    mapped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        primary_key=True
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )


class GramPanchayatStaffAssignment(Base):
    """Staff assigned to Gram Panchayat matching 'gram_panchayat_staff_assignments' table."""
    __tablename__ = "gram_panchayat_staff_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    gram_panchayat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gram_panchayats.id"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )


class Cooperative(Base):
    """Dairy and livestock cooperatives matching 'cooperatives' table."""
    __tablename__ = "cooperatives"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name_gu: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    org_type: Mapped[str] = mapped_column(
        Text,
        default="DAIRY_COOPERATIVE",
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        Text,
        default="ACTIVE",
        nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

