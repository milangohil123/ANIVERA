"""SQLAlchemy ORM models for Disease Surveillance and Reporting domain.

Matches PostgreSQL tables:
- disease_reports
- disease_reviews
- disease_report_status_history
- disease_report_attachments
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
    Integer,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class DiseaseReport(Base):
    """Suspected disease incident report matching 'disease_reports' table."""
    __tablename__ = "disease_reports"

    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_no: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    animal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id"),
        nullable=True
    )
    flock_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    farmer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.id"),
        nullable=True
    )
    village_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("villages.id"),
        nullable=False,
        index=True
    )
    disease_code: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    report_source: Mapped[str] = mapped_column(Text, nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    symptoms: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    observation_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    location_accuracy_m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reported_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    status: Mapped[str] = mapped_column(Text, default="SUBMITTED", nullable=False, index=True)
    duplicate_of: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id"),
        nullable=True
    )
    conflict_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmation_basis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    not_confirmed_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    row_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Health Case Assignment & Treatment Workflow columns
    urgency: Mapped[Optional[str]] = mapped_column(Text, default="NORMAL", nullable=True)
    is_unknown_disease: Mapped[Optional[bool]] = mapped_column(Boolean, default=False, nullable=True)
    custom_disease_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    treatment_status: Mapped[Optional[str]] = mapped_column(Text, default="SUBMITTED", nullable=True)
    assigned_vo_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_fw_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_to_role: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assignment_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    planned_visit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    reviews: Mapped[List["DiseaseReview"]] = relationship("DiseaseReview", back_populates="report", cascade="all, delete-orphan")
    status_history: Mapped[List["DiseaseReportStatusHistory"]] = relationship("DiseaseReportStatusHistory", back_populates="report", cascade="all, delete-orphan")
    attachments: Mapped[List["DiseaseReportAttachment"]] = relationship("DiseaseReportAttachment", back_populates="report", cascade="all, delete-orphan")


class DiseaseReview(Base):
    """Veterinary examination / triage steps matching 'disease_reviews' table."""
    __tablename__ = "disease_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id"),
        nullable=False
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    reviewer_role: Mapped[str] = mapped_column(Text, nullable=False)
    review_type: Mapped[str] = mapped_column(Text, nullable=False)
    assessment: Mapped[str] = mapped_column(Text, nullable=False)
    basis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    authorised_to_confirm: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    report: Mapped["DiseaseReport"] = relationship("DiseaseReport", back_populates="reviews")


class DiseaseReportStatusHistory(Base):
    """Status state transitions matching 'disease_report_status_history' table."""
    __tablename__ = "disease_report_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id"),
        nullable=False
    )
    from_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    to_status: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    report: Mapped["DiseaseReport"] = relationship("DiseaseReport", back_populates="status_history")


class DiseaseReportAttachment(Base):
    """Photo evidence attachments matching 'disease_report_attachments' table."""
    __tablename__ = "disease_report_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id"),
        nullable=False
    )
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    report: Mapped["DiseaseReport"] = relationship("DiseaseReport", back_populates="attachments")

