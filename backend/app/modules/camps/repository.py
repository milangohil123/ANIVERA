"""Asynchronous database repository for Veterinary Camps domain."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Set
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import AuditEvent
from app.modules.camps.models import Camp, CampStaff, CampStatusHistory


class CampRepository:
    """Repository managing veterinary camps, staff assignments, and status transitions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _safe_record_history(self, hist: CampStatusHistory) -> None:
        """Safely record status history if table exists, without breaking the transaction if table doesn't exist in frozen schema."""
        try:
            async with self.db.begin_nested():
                self.db.add(hist)
                await self.db.flush()
        except Exception:
            # Table camp_status_history does not exist in frozen schema v0.2
            pass

    async def _generate_camp_code(self) -> str:
        """Generate next camp_code conforming to 'CMP-BOT-' || lpad(nextval('camp_code_seq')::text, 5, '0')."""
        try:
            async with self.db.begin_nested():
                res = await self.db.execute(
                    text("SELECT 'CMP-BOT-' || lpad(nextval('camp_code_seq')::text, 5, '0')")
                )
                code = res.scalar_one()
                if code:
                    return str(code)
        except Exception:
            pass
        now_utc = datetime.now(timezone.utc)
        return f"CMP-BOT-{int(now_utc.timestamp()) % 100000:05d}"

    async def get_camp_by_id(self, camp_id: uuid.UUID) -> Optional[Camp]:
        """Fetch camp by ID."""
        stmt = select(Camp).where(Camp.id == camp_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_camps(
        self,
        allowed_village_ids: Optional[Set[uuid.UUID]] = None,
        status_filter: Optional[str] = None,
        campaign_id: Optional[uuid.UUID] = None,
        cooperative_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[Camp]:
        """List camps scoped to caller's permitted villages/filters."""
        stmt = select(Camp)

        if allowed_village_ids is not None:
            if len(allowed_village_ids) == 0:
                return []
            stmt = stmt.where(Camp.village_id.in_(allowed_village_ids))

        if status_filter:
            stmt = stmt.where(Camp.status == status_filter)

        if campaign_id:
            stmt = stmt.where(Camp.campaign_id == campaign_id)

        if cooperative_id:
            stmt = stmt.where(Camp.cooperative_id == cooperative_id)

        stmt = stmt.order_by(Camp.planned_start.asc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def has_overlapping_confirmed_camp(
        self,
        village_id: uuid.UUID,
        planned_start: datetime,
        planned_end: datetime,
        exclude_camp_id: Optional[uuid.UUID] = None
    ) -> bool:
        """Check for temporal overlap with existing CONFIRMED camps in the same village (excl_camp_overlap constraint)."""
        stmt = select(func.count()).select_from(Camp).where(
            Camp.village_id == village_id,
            Camp.status == "CONFIRMED",
            Camp.planned_start < planned_end,
            Camp.planned_end > planned_start
        )
        if exclude_camp_id:
            stmt = stmt.where(Camp.id != exclude_camp_id)

        res = await self.db.execute(stmt)
        return (res.scalar() or 0) > 0

    async def create_camp(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        organizer_type: str,
        cooperative_id: Optional[uuid.UUID],
        planned_start: datetime,
        planned_end: datetime,
        location_text: Optional[str],
        proposed_by: uuid.UUID,
        expected_farmers: Optional[int] = None,
        vaccine_availability: str = "UNKNOWN",
        vaccine_note: Optional[str] = None,
        camp_code: Optional[str] = None
    ) -> Camp:
        """Create a new camp proposal."""
        now_utc = datetime.now(timezone.utc)
        if not camp_code:
            camp_code = await self._generate_camp_code()

        camp = Camp(
            id=uuid.uuid4(),
            camp_code=camp_code,
            campaign_id=campaign_id,
            village_id=village_id,
            organizer_type=organizer_type,
            cooperative_id=cooperative_id,
            planned_start=planned_start,
            planned_end=planned_end,
            location_text=location_text.strip() if location_text else None,
            status="PROPOSED",
            vaccine_availability=vaccine_availability,
            vaccine_note=vaccine_note.strip() if vaccine_note else None,
            expected_farmers=expected_farmers,
            proposed_by=proposed_by,
            created_at=now_utc,
            updated_at=now_utc
        )
        self.db.add(camp)
        await self.db.flush()

        # Record history safely (in case camp_status_history table is absent)
        hist = CampStatusHistory(
            id=uuid.uuid4(),
            camp_id=camp.id,
            old_status=None,
            new_status="PROPOSED",
            changed_by=proposed_by,
            reason="Initial proposal",
            changed_at=now_utc
        )
        await self._safe_record_history(hist)
        return camp

    async def confirm_camp(
        self,
        camp: Camp,
        confirmed_by: uuid.UUID,
        vaccine_availability: Optional[str] = None,
        vaccine_note: Optional[str] = None
    ) -> Camp:
        """Confirm a proposed camp by Veterinary Officer."""
        now_utc = datetime.now(timezone.utc)
        old_status = camp.status
        camp.status = "CONFIRMED"
        camp.confirmed_by = confirmed_by
        camp.confirmed_at = now_utc
        if vaccine_availability:
            camp.vaccine_availability = vaccine_availability
        if vaccine_note:
            camp.vaccine_note = vaccine_note.strip()
        camp.updated_at = now_utc
        await self.db.flush()

        hist = CampStatusHistory(
            id=uuid.uuid4(),
            camp_id=camp.id,
            old_status=old_status,
            new_status="CONFIRMED",
            changed_by=confirmed_by,
            reason="Confirmed by Veterinary Officer",
            changed_at=now_utc
        )
        await self._safe_record_history(hist)
        return camp

    async def cancel_camp(
        self,
        camp: Camp,
        cancelled_by: uuid.UUID,
        reason: str
    ) -> Camp:
        """Cancel a camp with mandatory documented reason."""
        now_utc = datetime.now(timezone.utc)
        old_status = camp.status
        camp.status = "CANCELLED"
        camp.cancelled_reason = reason.strip()
        camp.updated_at = now_utc
        await self.db.flush()

        hist = CampStatusHistory(
            id=uuid.uuid4(),
            camp_id=camp.id,
            old_status=old_status,
            new_status="CANCELLED",
            changed_by=cancelled_by,
            reason=reason.strip(),
            changed_at=now_utc
        )
        await self._safe_record_history(hist)
        return camp

    async def reschedule_camp(
        self,
        camp: Camp,
        rescheduled_by: uuid.UUID,
        new_start: datetime,
        new_end: datetime,
        reason: str
    ) -> Camp:
        """Reschedule camp by creating a new linked camp record and marking previous as RESCHEDULED."""
        now_utc = datetime.now(timezone.utc)
        old_status = camp.status
        camp.status = "RESCHEDULED"
        camp.updated_at = now_utc

        hist_prev = CampStatusHistory(
            id=uuid.uuid4(),
            camp_id=camp.id,
            old_status=old_status,
            new_status="RESCHEDULED",
            changed_by=rescheduled_by,
            reason=f"Rescheduled: {reason.strip()}",
            changed_at=now_utc
        )
        await self._safe_record_history(hist_prev)

        # Create new camp linked to original
        new_camp_code = await self._generate_camp_code()
        new_camp = Camp(
            id=uuid.uuid4(),
            camp_code=new_camp_code,
            campaign_id=camp.campaign_id,
            village_id=camp.village_id,
            organizer_type=camp.organizer_type,
            cooperative_id=camp.cooperative_id,
            planned_start=new_start,
            planned_end=new_end,
            location_text=camp.location_text,
            status="PROPOSED",
            vaccine_availability=camp.vaccine_availability,
            vaccine_note=camp.vaccine_note,
            expected_farmers=camp.expected_farmers,
            proposed_by=rescheduled_by,
            rescheduled_from=camp.id,
            created_at=now_utc,
            updated_at=now_utc
        )
        self.db.add(new_camp)
        await self.db.flush()

        hist_new = CampStatusHistory(
            id=uuid.uuid4(),
            camp_id=new_camp.id,
            old_status=None,
            new_status="PROPOSED",
            changed_by=rescheduled_by,
            reason=f"Rescheduled from camp {camp.camp_code or str(camp.id)}: {reason.strip()}",
            changed_at=now_utc
        )
        await self._safe_record_history(hist_new)
        return new_camp

    async def complete_camp(
        self,
        camp: Camp,
        completed_by: uuid.UUID,
        notes: Optional[str] = None
    ) -> Camp:
        """Mark camp COMPLETED."""
        now_utc = datetime.now(timezone.utc)
        old_status = camp.status
        camp.status = "COMPLETED"
        camp.updated_at = now_utc
        await self.db.flush()

        hist = CampStatusHistory(
            id=uuid.uuid4(),
            camp_id=camp.id,
            old_status=old_status,
            new_status="COMPLETED",
            changed_by=completed_by,
            reason=notes.strip() if notes else "Camp operations concluded",
            changed_at=now_utc
        )
        await self._safe_record_history(hist)
        return camp

    async def add_camp_staff(
        self,
        camp_id: uuid.UUID,
        user_id: uuid.UUID,
        camp_role: str,
        assigned_by: uuid.UUID
    ) -> CampStaff:
        """Assign staff attendee to camp."""
        staff = CampStaff(
            camp_id=camp_id,
            user_id=user_id,
            camp_role=camp_role,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc)
        )
        self.db.add(staff)
        await self.db.flush()
        return staff

    async def list_camp_staff(self, camp_id: uuid.UUID) -> List[CampStaff]:
        """List staff assigned to a camp."""
        stmt = select(CampStaff).where(CampStaff.camp_id == camp_id, CampStaff.ended_at.is_(None))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def record_audit_event(
        self,
        action: str,
        result: str,
        actor_user_id: Optional[uuid.UUID],
        actor_role: Optional[str],
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
        ip: Optional[str] = None
    ) -> None:
        """Record an immutable audit event for camp actions."""
        evt = AuditEvent(
            action=action,
            result=result,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            object_type=object_type,
            object_id=object_id,
            village_id=village_id,
            reason=reason,
            ip=ip
        )
        self.db.add(evt)
        await self.db.flush()

