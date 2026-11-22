"""SQLAlchemy ORM models for:
1. Disease Reporting, TAHO Case Assignment, Veterinary Treatment, Verification & Audit
2. Dairy Cooperative Recurring Vaccination Schedules, Animal Enrollment & 15-Day Reminders
"""
import uuid
from datetime import date, datetime
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


class HealthCaseAssignment(Base):
    """Assignment of reported animal disease case to VO and/or FW by TAHO."""
    __tablename__ = "health_case_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id", ondelete="CASCADE"),
        nullable=False
    )
    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    assigned_vo_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    assigned_fw_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    assigned_to_role: Mapped[str] = mapped_column(Text, default="BOTH", nullable=False)
    priority: Mapped[str] = mapped_column(Text, default="NORMAL", nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    planned_visit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="ASSIGNED", nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    visited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class TreatmentRecord(Base):
    """Clinical veterinary examination and treatment record executed by VO or FW."""
    __tablename__ = "treatment_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id", ondelete="CASCADE"),
        nullable=False
    )
    assignment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("health_case_assignments.id", ondelete="SET NULL"),
        nullable=True
    )
    animal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        nullable=False
    )
    treated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    treated_by_role: Mapped[str] = mapped_column(Text, default="VO", nullable=False)
    visit_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    visit_time: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    observations: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    treatment_text: Mapped[str] = mapped_column(Text, nullable=False)
    medicine_administered: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dosage_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    treatment_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_visit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    status: Mapped[str] = mapped_column(Text, default="AWAITING_VERIFICATION", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TreatmentVerification(Base):
    """Verification decision by TAHO for a recorded veterinary treatment."""
    __tablename__ = "treatment_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    treatment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_records.id", ondelete="CASCADE"),
        nullable=True
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id", ondelete="CASCADE"),
        nullable=False
    )
    verified_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)  # 'APPROVED', 'REJECTED', 'FOLLOW_UP_REQUIRED'
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TreatmentAttachment(Base):
    """Photographic evidence (before/after/symptom/prescription) attached to a treatment or case."""
    __tablename__ = "treatment_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    treatment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_records.id", ondelete="CASCADE"),
        nullable=True
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disease_reports.report_id", ondelete="CASCADE"),
        nullable=False
    )
    attachment_type: Mapped[str] = mapped_column(Text, default="SYMPTOM_EVIDENCE", nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, default="image/jpeg", nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CooperativeVaccinationSchedule(Base):
    """Recurring vaccination schedule organized by a Dairy Cooperative, pending TAHO approval."""
    __tablename__ = "cooperative_vaccination_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cooperative_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cooperatives.id", ondelete="CASCADE"),
        nullable=False
    )
    schedule_name: Mapped[str] = mapped_column(Text, nullable=False)
    programme_code: Mapped[str] = mapped_column(Text, nullable=False)
    vaccine_name: Mapped[str] = mapped_column(Text, nullable=False)
    disease_prevention_purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_species: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    target_villages: Mapped[List[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list, nullable=False)
    taluka_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("talukas.id"),
        nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    recurrence_interval_value: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    recurrence_interval_unit: Mapped[str] = mapped_column(Text, default="MONTHS", nullable=False)
    reminder_days_before: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    execution_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="DRAFT", nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_execution_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    approved_execution_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class ScheduleAnimalEnrollment(Base):
    """Linking of an individual member animal to an approved cooperative schedule."""
    __tablename__ = "schedule_animal_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cooperative_vaccination_schedules.id", ondelete="CASCADE"),
        nullable=False
    )
    animal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        nullable=False
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.id", ondelete="CASCADE"),
        nullable=False
    )
    cooperative_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cooperatives.id", ondelete="CASCADE"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(Text, default="ENROLLED", nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AnimalVaccinationCycle(Base):
    """Individual recurring cycle for an enrolled animal with due date and 15-day reminder."""
    __tablename__ = "animal_vaccination_cycles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        nullable=False
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cooperative_vaccination_schedules.id", ondelete="CASCADE"),
        nullable=False
    )
    programme_code: Mapped[str] = mapped_column(Text, nullable=False)
    cycle_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    previous_vaccination_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_verified_vaccination_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    reminder_date: Mapped[date] = mapped_column(Date, nullable=False)
    reminder_status: Mapped[str] = mapped_column(Text, default="PENDING", nullable=False)
    reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(Text, default="SCHEDULED", nullable=False)
    assigned_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    completed_event_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    completed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
