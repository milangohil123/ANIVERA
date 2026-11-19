"""FastAPI RESTful endpoints for SYS_ADMIN Technical Monitoring & Audit.

Provides thin read-only endpoints over existing tables:
- users
- devices
- audit_events
Enforces explicit permission checks: 'user.manage' or 'audit.read'.
SYS_ADMIN receives NO operational geographic or clinical data.
"""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import AuditEvent, Device, User
from app.modules.authorization.service import AuthorizationService

router = APIRouter(prefix="", tags=["Technical Administration"])


# ------------------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------------------

class TechnicalOverviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    total_users: int
    active_users: int
    total_devices: int
    active_devices: int
    total_audit_events: int


class TechnicalUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    username: Optional[str] = None
    full_name: str
    mobile_e164: Optional[str] = None
    role: str
    status: str
    designation: Optional[str] = None
    organisation: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None


class TechnicalDeviceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    user_full_name: Optional[str] = None
    label: Optional[str] = None
    first_seen_at: datetime
    last_seen_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    pending_count_reported: Optional[int] = None
    status: str


class TechnicalAuditItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    occurred_at: datetime
    actor_user_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    result: str
    reason: Optional[str] = None
    ip: Optional[str] = None


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------

@router.get("/overview", response_model=TechnicalOverviewResponse, summary="Technical system overview")
async def get_technical_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TechnicalOverviewResponse:
    """Fetch high-level technical overview of users, devices, and audit counters."""
    authz = AuthorizationService(db)
    await authz.assert_any_permission(current_user, ["user.manage", "audit.read", "technical.manage"])

    # Fast scalar counts
    tot_users = (await db.execute(select(func.count(User.id)))).scalar_one() or 0
    act_users = (await db.execute(select(func.count(User.id)).where(User.status == "ACTIVE"))).scalar_one() or 0
    tot_devices = (await db.execute(select(func.count(Device.id)))).scalar_one() or 0
    act_devices = (await db.execute(select(func.count(Device.id)).where(Device.status == "ACTIVE"))).scalar_one() or 0
    tot_audits = (await db.execute(select(func.count(AuditEvent.id)))).scalar_one() or 0

    return TechnicalOverviewResponse(
        status="HEALTHY",
        total_users=tot_users,
        active_users=act_users,
        total_devices=tot_devices,
        active_devices=act_devices,
        total_audit_events=tot_audits,
    )


@router.get("/users", response_model=List[TechnicalUserItem], summary="List all system users and statuses")
async def list_technical_users(
    role: Optional[str] = Query(None, description="Filter by user role"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (ACTIVE/LOCKED)"),
    search: Optional[str] = Query(None, description="Search by name, username or mobile"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[TechnicalUserItem]:
    """Read-only listing of system accounts for identity and technical management."""
    authz = AuthorizationService(db)
    await authz.assert_any_permission(current_user, ["user.manage", "technical.manage"])

    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role.strip().upper())
    if status_filter:
        stmt = stmt.where(User.status == status_filter.strip().upper())
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            (User.full_name.ilike(pattern)) |
            (User.username.ilike(pattern)) |
            (User.mobile_e164.ilike(pattern))
        )

    stmt = stmt.order_by(desc(User.created_at)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    users = res.scalars().all()

    return [TechnicalUserItem.model_validate(u) for u in users]


@router.get("/devices", response_model=List[TechnicalDeviceItem], summary="List registered field devices")
async def list_technical_devices(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[TechnicalDeviceItem]:
    """Read-only listing of physical devices registered with the system."""
    authz = AuthorizationService(db)
    await authz.assert_any_permission(current_user, ["user.manage", "technical.manage"])

    stmt = select(Device, User.full_name).join(User, User.id == Device.user_id, isouter=True)
    if status_filter:
        stmt = stmt.where(Device.status == status_filter.strip().upper())

    stmt = stmt.order_by(desc(Device.first_seen_at)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    rows = res.all()

    items: List[TechnicalDeviceItem] = []
    for dev, user_name in rows:
        items.append(
            TechnicalDeviceItem(
                id=dev.id,
                user_id=dev.user_id,
                user_full_name=user_name,
                label=dev.label,
                first_seen_at=dev.first_seen_at,
                last_seen_at=dev.last_seen_at,
                last_sync_at=dev.last_sync_at,
                pending_count_reported=dev.pending_count_reported,
                status=dev.status,
            )
        )
    return items


@router.get("/audit-logs", response_model=List[TechnicalAuditItem], summary="Read immutable system audit trail")
async def list_technical_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name"),
    result: Optional[str] = Query(None, description="Filter by SUCCESS/DENIED/FAILED"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[TechnicalAuditItem]:
    """Read-only listing of security and operational audit trail."""
    authz = AuthorizationService(db)
    await authz.assert_any_permission(current_user, ["audit.read", "technical.manage"])

    stmt = select(AuditEvent, User.full_name).join(User, User.id == AuditEvent.actor_user_id, isouter=True)
    if action:
        stmt = stmt.where(AuditEvent.action == action.strip().upper())
    if result:
        stmt = stmt.where(AuditEvent.result == result.strip().upper())

    stmt = stmt.order_by(desc(AuditEvent.occurred_at)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    rows = res.all()

    items: List[TechnicalAuditItem] = []
    for ev, actor_name in rows:
        items.append(
            TechnicalAuditItem(
                id=ev.id,
                occurred_at=ev.occurred_at,
                actor_user_id=ev.actor_user_id,
                actor_name=actor_name,
                actor_role=ev.actor_role,
                action=ev.action,
                object_type=ev.object_type,
                object_id=ev.object_id,
                result=ev.result,
                reason=ev.reason,
                ip=str(ev.ip) if ev.ip else None,
            )
        )
    return items

