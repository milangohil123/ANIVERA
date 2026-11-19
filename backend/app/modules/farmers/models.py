"""SQLAlchemy ORM models for Farmer domain matching PostgreSQL 16 schema.

Strictly maps existing PostgreSQL 16 tables:
- farmers
- farmer_verifications
- farmer_account_provisioning

Never calls create_all().
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Farmer(Base):
    """Farmer / livestock owner entity matching 'farmers' table."""
    __tablename__ = "farmers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    farmer_code: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    name_norm: Mapped[str] = mapped_column(Text, nullable=False)
    mobile_e164: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mobile_status: Mapped[str] = mapped_column(Text, default="NONE", nullable=False)
    mobile_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_smartphone: Mapped[str] = mapped_column(Text, default="UNKNOWN", nullable=False)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    address_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    registration_status: Mapped[str] = mapped_column(Text, default="DRAFT", nullable=False)
    registration_path: Mapped[str] = mapped_column(Text, nullable=False)
    registered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    data_consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    outreach_consent: Mapped[str] = mapped_column(Text, default="UNKNOWN", nullable=False)
    consent_basis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    consent_recorded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    consent_recorded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inactive_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    verifications: Mapped[list["FarmerVerification"]] = relationship("FarmerVerification", back_populates="farmer")
    account_provisioning: Mapped[Optional["FarmerAccountProvisioning"]] = relationship(
        "FarmerAccountProvisioning",
        back_populates="farmer",
        uselist=False
    )


class FarmerVerification(Base):
    """Farmer verification log matching 'farmer_verifications' table."""
    __tablename__ = "farmer_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="verifications")


class FarmerAccountProvisioning(Base):
    """Separate farmer account provisioning matching 'farmer_account_provisioning' table."""
    __tablename__ = "farmer_account_provisioning"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False)
    provisioned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provisioned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    activation_status: Mapped[str] = mapped_column(Text, default="PENDING", nullable=False)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="account_provisioning")

