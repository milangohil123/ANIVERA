"""SQLAlchemy ORM models for Veterinary Camps domain.

Matches PostgreSQL tables:
- camps
- camp_staff
- camp_status_history
"""
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Camp(Base):
    """Veterinary camps and doorstep rounds matching 'camps' table."""
    __tablename__ = "camps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camp_code: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        server_default=text("('CMP-BOT-' || lpad(nextval('camp_code_seq')::text, 5, '0'))")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    organizer_type: Mapped[str] = mapped_column(Text, nullable=False)
    cooperative_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cooperatives.id"),
        nullable=True
    )
    planned_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    planned_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="PROPOSED", nullable=False)
    vaccine_availability: Mapped[str] = mapped_column(Text, default="UNKNOWN", nullable=False)
    vaccine_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_farmers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    proposed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rescheduled_from: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("camps.id"), nullable=True)
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

    staff: Mapped[List["CampStaff"]] = relationship("CampStaff", back_populates="camp", cascade="all, delete-orphan")
    history: Mapped[List["CampStatusHistory"]] = relationship("CampStatusHistory", back_populates="camp", cascade="all, delete-orphan")


class CampStaff(Base):
    """Camp expected attendees matching 'camp_staff' table."""
    __tablename__ = "camp_staff"

    camp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("camps.id"),
        primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True
    )
    camp_role: Mapped[str] = mapped_column(
        Text,
        primary_key=True
    )
    assigned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    camp: Mapped["Camp"] = relationship("Camp", back_populates="staff")


class CampStatusHistory(Base):
    """Camp lifecycle state transitions matching 'camp_status_history' table."""
    __tablename__ = "camp_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camp_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("camps.id"), nullable=False)
    old_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_status: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    camp: Mapped["Camp"] = relationship("Camp", back_populates="history")

