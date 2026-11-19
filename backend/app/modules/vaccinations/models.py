"""SQLAlchemy ORM models for Animal Events, Vaccinations, Treatments, and Corrections.

Matches PostgreSQL tables:
- animal_events
- vaccination_details
- treatment_details
- observation_details
- event_corrections
"""
import uuid
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.modules.authorization.models import VaccinatorAuthorization



class AnimalEvent(Base):
    """Immutable livestock event record matching 'animal_events' table."""
    __tablename__ = "animal_events"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_seq: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        Identity(always=True)
    )
    animal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id"),
        nullable=True
    )
    flock_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    village_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("villages.id"),
        nullable=False
    )
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    performed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    client_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    source: Mapped[str] = mapped_column(Text, default="ONLINE", nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_status: Mapped[str] = mapped_column(Text, default="NONE", nullable=False)
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    vaccination_detail: Mapped[Optional["VaccinationDetail"]] = relationship("VaccinationDetail", back_populates="event", uselist=False, cascade="all, delete-orphan")
    treatment_detail: Mapped[Optional["TreatmentDetail"]] = relationship("TreatmentDetail", back_populates="event", uselist=False, cascade="all, delete-orphan")
    observation_detail: Mapped[Optional["ObservationDetail"]] = relationship("ObservationDetail", back_populates="event", uselist=False, cascade="all, delete-orphan")


class VaccinationDetail(Base):
    """Vaccination specific facts matching 'vaccination_details' table."""
    __tablename__ = "vaccination_details"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animal_events.event_id"),
        primary_key=True
    )
    programme_code: Mapped[str] = mapped_column(
        Text,
        ForeignKey("programmes.code"),
        nullable=False
    )
    batch_number: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dose_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=True
    )
    camp_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("camps.id"),
        nullable=True
    )
    administered_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    administered_by_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vaccinator_authorization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccinator_authorizations.id"),
        nullable=True
    )
    authorization_check: Mapped[str] = mapped_column(Text, default="NOT_CHECKED", nullable=False)
    head_count_vaccinated: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    event: Mapped["AnimalEvent"] = relationship("AnimalEvent", back_populates="vaccination_detail")


class TreatmentDetail(Base):
    """Clinical treatment consultation details matching 'treatment_details' table."""
    __tablename__ = "treatment_details"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animal_events.event_id"),
        primary_key=True
    )
    diagnosis_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    treatment_text: Mapped[str] = mapped_column(Text, nullable=False)
    medicine_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    event: Mapped["AnimalEvent"] = relationship("AnimalEvent", back_populates="treatment_detail")


class ObservationDetail(Base):
    """General field observations and clinical symptoms matching 'observation_details' table."""
    __tablename__ = "observation_details"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animal_events.event_id"),
        primary_key=True
    )
    symptoms: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    event: Mapped["AnimalEvent"] = relationship("AnimalEvent", back_populates="observation_detail")


class EventCorrection(Base):
    """Immutable event corrections / voids matching 'event_corrections' table."""
    __tablename__ = "event_corrections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animal_events.event_id"),
        unique=True,
        nullable=False
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    replacement_event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animal_events.event_id"),
        unique=True,
        nullable=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    corrected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )



