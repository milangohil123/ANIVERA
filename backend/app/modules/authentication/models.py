"""SQLAlchemy ORM models for Authentication, Users, Permissions, and Auditing.

Strictly matches the PostgreSQL 16 schema in pashurakshak_schema_v0.2.sql and patch v0.3.1.
Never calls create_all().
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
    """User account model matching 'users' table."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mobile_e164: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organisation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="ACTIVE", nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivated_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
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
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship("RefreshToken", back_populates="user")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="user")
    village_assignments: Mapped[List["UserVillageAssignment"]] = relationship(
        "UserVillageAssignment",
        foreign_keys="UserVillageAssignment.user_id",
        back_populates="user"
    )
    district_assignments: Mapped[List["DahoDistrictAssignment"]] = relationship(
        "DahoDistrictAssignment",
        foreign_keys="DahoDistrictAssignment.daho_user_id",
        back_populates="daho_user"
    )
    permission_grants: Mapped[List["UserPermissionGrant"]] = relationship(
        "UserPermissionGrant",
        foreign_keys="UserPermissionGrant.user_id",
        back_populates="user"
    )


class Device(Base):
    """Client device registration matching 'devices' table."""
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pending_count_reported: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="ACTIVE", nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="devices")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship("RefreshToken", back_populates="device")


class RefreshToken(Base):
    """Rotating refresh token registry matching 'refresh_tokens' table."""
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True)
    token_hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rotated_from: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("refresh_tokens.id"),
        nullable=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
    device: Mapped[Optional["Device"]] = relationship("Device", back_populates="refresh_tokens")


class OtpChallenge(Base):
    """Farmer login OTP challenges matching 'otp_challenges' table."""
    __tablename__ = "otp_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    mobile_e164: Mapped[str] = mapped_column(Text, nullable=False)
    code_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    request_ip: Mapped[Optional[str]] = mapped_column(INET, nullable=True)


# Canonical model is defined in app.modules.farmers.models; re-exported here for backwards compatibility
from app.modules.farmers.models import FarmerAccountProvisioning


class UserVillageAssignment(Base):
    """User assigned village boundary matching 'user_village_assignments' table."""
    __tablename__ = "user_village_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    village_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    assigned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="village_assignments")


class DahoDistrictAssignment(Base):
    """DAHO operational district assignment matching 'daho_district_assignments' table."""
    __tablename__ = "daho_district_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    daho_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    district_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=False)
    assigned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    daho_user: Mapped["User"] = relationship("User", foreign_keys=[daho_user_id], back_populates="district_assignments")


class Permission(Base):
    """System permissions catalogue matching 'permissions' table."""
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class RolePermission(Base):
    """Role-to-permission mapping matching 'role_permissions' table."""
    __tablename__ = "role_permissions"

    role: Mapped[str] = mapped_column(Text, primary_key=True)
    permission_code: Mapped[str] = mapped_column(Text, ForeignKey("permissions.code"), primary_key=True)


class UserPermissionGrant(Base):
    """Explicit extra permission grants matching 'user_permission_grants' table."""
    __tablename__ = "user_permission_grants"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    permission_code: Mapped[str] = mapped_column(Text, ForeignKey("permissions.code"), primary_key=True)
    granted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        primary_key=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="permission_grants")


class AuditEvent(Base):
    """Immutable audit trail matching 'audit_events' table."""
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_role: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    object_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    object_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    village_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    result: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    before_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

