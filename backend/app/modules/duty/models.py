"""SQLAlchemy ORM models for Field Worker Duty Sessions, Live Location Tracking & Smart Assignments.

Matches PostgreSQL 16 schema:
- fw_duty_sessions
- fw_locations
- help_requests
- complaint_assignment_groups
- complaint_group_items
- fw_assignment_history
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class FwDutySession(Base):
    """Field Worker active or completed duty session."""
    __tablename__ = "fw_duty_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    fw_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        Text,
        default="ACTIVE",
        nullable=False
    )  # 'ACTIVE', 'INACTIVE', 'EXPIRED'
    last_known_latitude: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(9, 6),
        nullable=True
    )
    last_known_longitude: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(9, 6),
        nullable=True
    )
    last_location_update: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    location_accuracy: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 2),
        nullable=True
    )
    device_status: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
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

    # Relationships
    locations: Mapped[List["FwLocation"]] = relationship(
        "FwLocation",
        back_populates="duty_session",
        cascade="all, delete-orphan",
        order_by="desc(FwLocation.recorded_at)"
    )


class FwLocation(Base):
    """Periodic GPS location breadcrumb recorded during an active duty session."""
    __tablename__ = "fw_locations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    duty_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fw_duty_sessions.id", ondelete="CASCADE"),
        nullable=False
    )
    fw_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    latitude: Mapped[Decimal] = mapped_column(
        Numeric(9, 6),
        nullable=False
    )
    longitude: Mapped[Decimal] = mapped_column(
        Numeric(9, 6),
        nullable=False
    )
    accuracy: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 2),
        nullable=True
    )
    source: Mapped[str] = mapped_column(
        Text,
        default="GPS",
        nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    duty_session: Mapped["FwDutySession"] = relationship("FwDutySession", back_populates="locations")


class HelpRequest(Base):
    """Farmer help request / animal medical complaint matching 'help_requests' table."""
    __tablename__ = "help_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    reference_no: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False
    )
    requester_name: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    contact_number: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    contact_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    village_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("villages.id"),
        nullable=False
    )
    farmer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.id"),
        nullable=True
    )
    animal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id"),
        nullable=True
    )
    animal_description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    problem_text: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    source: Mapped[str] = mapped_column(
        Text,
        default="STAFF_ASSISTED",
        nullable=False
    )
    registered_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        Text,
        default="SUBMITTED",
        nullable=False
    )  # 'SUBMITTED','ASSIGNED','CONTACT_ATTEMPTED','VISIT_PLANNED','RESOLVED','CANCELLED'
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    visit_planned_for: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )
    outcome_text: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
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
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )


class ComplaintAssignmentGroup(Base):
    """Geographically clustered group of pending complaints for intelligent assignment."""
    __tablename__ = "complaint_assignment_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    group_code: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("districts.id"),
        nullable=False
    )
    taluka_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("talukas.id"),
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        Text,
        default="PENDING",
        nullable=False
    )  # 'PENDING','RECOMMENDATION_READY','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'
    priority: Mapped[str] = mapped_column(
        Text,
        default="NORMAL",
        nullable=False
    )  # 'URGENT','HIGH','NORMAL'
    assigned_fw_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    assigned_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    assigned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    assignment_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
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

    # Relationships
    items: Mapped[List["ComplaintGroupItem"]] = relationship(
        "ComplaintGroupItem",
        back_populates="group",
        cascade="all, delete-orphan"
    )
    history: Mapped[List["FwAssignmentHistory"]] = relationship(
        "FwAssignmentHistory",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="desc(FwAssignmentHistory.created_at)"
    )


class ComplaintGroupItem(Base):
    """Specific complaint linked within an assignment group."""
    __tablename__ = "complaint_group_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("complaint_assignment_groups.id", ondelete="CASCADE"),
        nullable=False
    )
    complaint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False
    )
    complaint_type: Mapped[str] = mapped_column(
        Text,
        default="HELP_REQUEST",
        nullable=False
    )  # 'HELP_REQUEST', 'DISEASE_REPORT'
    village_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("villages.id"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        Text,
        default="PENDING",
        nullable=False
    )  # 'PENDING', 'VISITING', 'RESOLVED', 'CANCELLED'
    outcome_note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    visited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    group: Mapped["ComplaintAssignmentGroup"] = relationship("ComplaintAssignmentGroup", back_populates="items")


class FwAssignmentHistory(Base):
    """Audit log of assignment actions, decisions, reasons, and reassignments."""
    __tablename__ = "fw_assignment_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("complaint_assignment_groups.id", ondelete="CASCADE"),
        nullable=False
    )
    previous_fw_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    new_fw_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    action: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # 'ASSIGNED','REASSIGNED','ACCEPTED','REJECTED','STATUS_CHANGE','CANCELLED'
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    group: Mapped["ComplaintAssignmentGroup"] = relationship("ComplaintAssignmentGroup", back_populates="history")

