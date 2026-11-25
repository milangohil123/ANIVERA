"""SQLAlchemy ORM models for Campaigns domain.

Matches PostgreSQL tables:
- schedule_versions
- campaigns
- campaign_programmes
- campaign_villages
- campaign_assignments
- campaign_animal_targets
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
    PrimaryKeyConstraint,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class ScheduleVersion(Base):
    """Department vaccination schedule versions matching 'schedule_versions' table."""
    __tablename__ = "schedule_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="DRAFT", nullable=False)
    approved_by_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approval_reference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    campaigns: Mapped[List["Campaign"]] = relationship("Campaign", back_populates="schedule_version")


class Campaign(Base):
    """Vaccination campaigns matching 'campaigns' table."""
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="DRAFT", nullable=False)
    schedule_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedule_versions.id"),
        nullable=True
    )
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    disease_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vaccine_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vaccine_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_vaccine_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_custom_vaccine: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    species_codes: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    activated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    schedule_version: Mapped[Optional["ScheduleVersion"]] = relationship("ScheduleVersion", back_populates="campaigns")
    programmes: Mapped[List["CampaignProgramme"]] = relationship("CampaignProgramme", back_populates="campaign", cascade="all, delete-orphan")
    villages: Mapped[List["CampaignVillage"]] = relationship("CampaignVillage", back_populates="campaign", cascade="all, delete-orphan")
    assignments: Mapped[List["CampaignAssignment"]] = relationship("CampaignAssignment", back_populates="campaign")


class CampaignProgramme(Base):
    """Programmes and species covered in a campaign matching 'campaign_programmes' table."""
    __tablename__ = "campaign_programmes"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        primary_key=True
    )
    species_code: Mapped[str] = mapped_column(
        Text,
        ForeignKey("species.code"),
        primary_key=True
    )
    programme_code: Mapped[str] = mapped_column(
        Text,
        ForeignKey("programmes.code"),
        primary_key=True
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="programmes")


class CampaignVillage(Base):
    """Villages participating in a campaign matching 'campaign_villages' table."""
    __tablename__ = "campaign_villages"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        primary_key=True
    )
    village_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("villages.id"),
        primary_key=True
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="villages")


class CampaignAssignment(Base):
    """Field Worker assignments to campaign villages matching 'campaign_assignments' table."""
    __tablename__ = "campaign_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    worker_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="assignments")


class CampaignAnimalTarget(Base):
    """Eligible animal target snapshots matching 'campaign_animal_targets' table."""
    __tablename__ = "campaign_animal_targets"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        primary_key=True
    )
    animal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id"),
        primary_key=True
    )
    programme_code: Mapped[str] = mapped_column(
        Text,
        ForeignKey("programmes.code"),
        primary_key=True
    )
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    excluded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    exclusion_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CampaignVillageVerification(Base):
    """Village-level campaign assignment, completion, evidence, and verification tracking."""
    __tablename__ = "campaign_village_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ASSIGNED", nullable=False)
    assigned_vo_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_fw_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    animals_visited_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vaccinations_completed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pending_animals_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    field_observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_photo_urls: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    submitted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reopened_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reopened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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

    campaign: Mapped["Campaign"] = relationship("Campaign")


