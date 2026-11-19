"""Database repository for Offline Synchronisation domain."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import AuditEvent, Device, User
from app.modules.sync.models import SyncBatch, SyncConflict, SyncReceipt


class SyncRepository:
    """Encapsulates asynchronous database interactions for synchronization tables."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_device(self, device_id: uuid.UUID) -> Optional[Device]:
        """Fetch client device record by ID."""
        stmt = select(Device).where(Device.id == device_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def upsert_device(
        self,
        device_id: uuid.UUID,
        user_id: uuid.UUID,
        label: Optional[str] = None
    ) -> Device:
        """Fetch or register an active device for the user."""
        device = await self.get_device(device_id)
        now = datetime.now(timezone.utc)
        if not device:
            device = Device(
                id=device_id,
                user_id=user_id,
                label=label or "Field Worker Mobile PWA",
                first_seen_at=now,
                last_seen_at=now,
                last_sync_at=now,
                status="ACTIVE"
            )
            self.db.add(device)
            await self.db.flush()
        else:
            if device.user_id != user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Device is registered to a different user."
                )
            device.last_seen_at = now
            if device.status != "REVOKED":
                device.last_sync_at = now
            await self.db.flush()
        return device

    async def update_device_sync_telemetry(
        self,
        device: Device,
        pending_count: Optional[int] = None
    ) -> None:
        """Update last sync timestamp and pending count on device."""
        device.last_sync_at = datetime.now(timezone.utc)
        if pending_count is not None:
            device.pending_count_reported = pending_count
        await self.db.flush()

    async def create_sync_batch(
        self,
        device_id: uuid.UUID,
        user_id: uuid.UUID,
        event_count: int,
        client_time: Optional[datetime] = None
    ) -> SyncBatch:
        """Create a new sync batch record."""
        batch = SyncBatch(
            id=uuid.uuid4(),
            device_id=device_id,
            user_id=user_id,
            client_time=client_time,
            event_count=event_count,
            accepted=0,
            already_accepted=0,
            rejected=0,
            needs_review=0
        )
        self.db.add(batch)
        await self.db.flush()
        return batch

    async def update_batch_outcomes(
        self,
        batch: SyncBatch,
        accepted: int,
        already_accepted: int,
        rejected: int,
        needs_review: int
    ) -> None:
        """Update aggregate counts on the sync batch."""
        batch.accepted = accepted
        batch.already_accepted = already_accepted
        batch.rejected = rejected
        batch.needs_review = needs_review
        await self.db.flush()

    async def get_sync_receipt(self, event_id: uuid.UUID) -> Optional[SyncReceipt]:
        """Fetch existing receipt for idempotency detection."""
        stmt = select(SyncReceipt).where(SyncReceipt.event_id == event_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def create_sync_receipt(
        self,
        event_id: uuid.UUID,
        device_id: uuid.UUID,
        user_id: uuid.UUID,
        batch_id: uuid.UUID,
        event_type: str,
        status: str,
        code: Optional[str] = None,
        errors: Optional[List[Dict[str, Any]]] = None,
        payload: Optional[Dict[str, Any]] = None
    ) -> SyncReceipt:
        """Create or update a per-event synchronization receipt (safe against retries)."""
        existing = await self.get_sync_receipt(event_id)
        now = datetime.now(timezone.utc)
        if existing:
            existing.device_id = device_id
            existing.user_id = user_id
            existing.last_batch_id = batch_id
            existing.event_type = event_type
            existing.status = status
            existing.code = code
            existing.errors = errors
            existing.payload = payload
            existing.attempt_count += 1
            existing.last_received_at = now
            existing.processed_at = now
            await self.db.flush()
            return existing

        receipt = SyncReceipt(
            event_id=event_id,
            device_id=device_id,
            user_id=user_id,
            last_batch_id=batch_id,
            event_type=event_type,
            status=status,
            code=code,
            errors=errors,
            payload=payload,
            attempt_count=1,
            first_received_at=now,
            last_received_at=now,
            processed_at=now
        )
        self.db.add(receipt)
        await self.db.flush()
        return receipt

    async def record_existing_receipt_revisit(
        self,
        receipt: SyncReceipt,
        batch_id: uuid.UUID
    ) -> None:
        """Update an existing receipt on duplicate replay."""
        receipt.last_batch_id = batch_id
        receipt.attempt_count += 1
        receipt.last_received_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def create_sync_conflict(
        self,
        event_id: Optional[uuid.UUID],
        entity_type: str,
        entity_id: Optional[uuid.UUID],
        conflict_type: str,
        details: Dict[str, Any]
    ) -> SyncConflict:
        """Log a data conflict in sync_conflicts table."""
        conflict = SyncConflict(
            id=uuid.uuid4(),
            event_id=event_id,
            entity_type=entity_type,
            entity_id=entity_id,
            conflict_type=conflict_type,
            details=details,
            status="OPEN"
        )
        self.db.add(conflict)
        await self.db.flush()
        return conflict

    async def get_sync_conflict(self, conflict_id: uuid.UUID) -> Optional[SyncConflict]:
        """Fetch a specific conflict record."""
        stmt = select(SyncConflict).where(SyncConflict.id == conflict_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_open_conflicts(self, limit: int = 50) -> List[SyncConflict]:
        """List open conflicts awaiting review."""
        stmt = (
            select(SyncConflict)
            .where(SyncConflict.status == "OPEN")
            .order_by(SyncConflict.created_at.desc())
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def resolve_conflict(
        self,
        conflict: SyncConflict,
        resolution: str,
        resolved_by: uuid.UUID
    ) -> None:
        """Mark a conflict as resolved with decision notes."""
        conflict.status = "RESOLVED"
        conflict.resolution = resolution
        conflict.resolved_by = resolved_by
        conflict.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def count_open_conflicts_for_device(self, device_id: uuid.UUID) -> int:
        """Count open conflicts linked to receipts from a specific device."""
        stmt = (
            select(func.count(SyncConflict.id))
            .join(SyncReceipt, SyncConflict.event_id == SyncReceipt.event_id)
            .where(
                SyncReceipt.device_id == device_id,
                SyncConflict.status == "OPEN"
            )
        )
        return (await self.db.scalar(stmt)) or 0

    async def count_batches_for_device(self, device_id: uuid.UUID) -> int:
        """Count total historical sync batches for a device."""
        stmt = select(func.count(SyncBatch.id)).where(SyncBatch.device_id == device_id)
        return (await self.db.scalar(stmt)) or 0

    async def record_audit_event(
        self,
        action: str,
        result: str,
        actor_user_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
        ip: Optional[str] = None,
        device_id: Optional[uuid.UUID] = None
    ) -> AuditEvent:
        """Append an audit trail event ensuring result IN ('SUCCESS', 'DENIED', 'FAILED')."""
        valid_results = {"SUCCESS", "DENIED", "FAILED"}
        if result not in valid_results:
            result = "FAILED"

        event = AuditEvent(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            object_type=object_type,
            object_id=object_id,
            village_id=village_id,
            result=result,
            reason=reason,
            ip=ip,
            device_id=device_id
        )
        self.db.add(event)
        await self.db.flush()
        return event

