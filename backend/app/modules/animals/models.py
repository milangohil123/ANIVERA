"""SQLAlchemy ORM models for Animal domain matching PostgreSQL 16 schema.

Strictly maps existing PostgreSQL 16 tables:
- animals
- animal_external_identifiers
- animal_qr_tokens
- animal_ownership_history
- ownership_transfers
- animal_verifications

Never calls create_all().
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
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Animal(Base):
    """Core livestock animal entity matching 'animals' table."""
    __tablename__ = "animals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    animal_code: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    species_code: Mapped[str] = mapped_column(Text, ForeignKey("species.code"), nullable=False)
    breed_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("breeds.id"), nullable=True)
    sex: Mapped[str] = mapped_column(Text, default="UNKNOWN", nullable=False)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    age_months_estimate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    age_estimated_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False, index=True)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False, index=True)
    registration_status: Mapped[str] = mapped_column(Text, default="DRAFT", nullable=False)
    status: Mapped[str] = mapped_column(Text, default="ACTIVE", nullable=False, index=True)
    status_changed_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    merged_into_animal_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("animals.id"), nullable=True)
    submission_source: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    row_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
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
    external_identifiers: Mapped[List["AnimalExternalIdentifier"]] = relationship("AnimalExternalIdentifier", back_populates="animal")
    qr_tokens: Mapped[List["AnimalQRToken"]] = relationship("AnimalQRToken", back_populates="animal")
    ownership_history: Mapped[List["AnimalOwnershipHistory"]] = relationship("AnimalOwnershipHistory", back_populates="animal")
    verifications: Mapped[List["AnimalVerification"]] = relationship("AnimalVerification", back_populates="animal")


class AnimalExternalIdentifier(Base):
    """Government ear tags / Bharat Pashudhan 12-digit tags matching 'animal_external_identifiers' table."""
    __tablename__ = "animal_external_identifiers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("animals.id"), nullable=False)
    id_type: Mapped[str] = mapped_column(Text, nullable=False)
    id_value: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    status: Mapped[str] = mapped_column(Text, default="ACTIVE", nullable=False, index=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    replaced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replace_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    animal: Mapped["Animal"] = relationship("Animal", back_populates="external_identifiers")


# Compatibility alias
AnimalExternalId = AnimalExternalIdentifier


class AnimalQRToken(Base):
    """Cryptographic physical QR tags matching 'animal_qr_tokens' table."""
    __tablename__ = "animal_qr_tokens"

    token: Mapped[str] = mapped_column(Text, primary_key=True)
    animal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("animals.id"), nullable=False)
    status: Mapped[str] = mapped_column(Text, default="ACTIVE", nullable=False)
    issued_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    animal: Mapped["Animal"] = relationship("Animal", back_populates="qr_tokens")


class AnimalOwnershipHistory(Base):
    """Audit history of animal ownership and location changes matching 'animal_ownership_history' table."""
    __tablename__ = "animal_ownership_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("animals.id"), nullable=False)
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    change_reason: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    animal: Mapped["Animal"] = relationship("Animal", back_populates="ownership_history")


class OwnershipTransfer(Base):
    """Workflow transfers for ownership changes matching 'ownership_transfers' table."""
    __tablename__ = "ownership_transfers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("animals.id"), nullable=False)
    from_farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False)
    to_farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False)
    to_village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reason_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="REQUESTED", nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    effective_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class AnimalVerification(Base):
    """Physical or office verification logs matching 'animal_verifications' table."""
    __tablename__ = "animal_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("animals.id"), nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    tag_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    owner_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    animal: Mapped["Animal"] = relationship("Animal", back_populates="verifications")

