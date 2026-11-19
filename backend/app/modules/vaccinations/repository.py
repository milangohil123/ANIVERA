"""Asynchronous database repository for Animal Events, Vaccinations, Treatments, and Corrections."""
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional, Set
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.modules.authentication.models import AuditEvent
from app.modules.authorization.models import VaccinatorAuthorization
from app.modules.vaccinations.models import (
    AnimalEvent,
    EventCorrection,
    ObservationDetail,
    TreatmentDetail,
    VaccinationDetail,
)


class VaccinationRepository:
    """Repository managing animal event transactions, clinical vaccinations, treatments, and corrections."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_event_by_id(self, event_id: uuid.UUID) -> Optional[AnimalEvent]:
        """Fetch an animal event with child details."""
        stmt = (
            select(AnimalEvent)
            .options(
                selectinload(AnimalEvent.vaccination_detail),
                selectinload(AnimalEvent.treatment_detail),
                selectinload(AnimalEvent.observation_detail)
            )
            .where(AnimalEvent.event_id == event_id)
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def create_vaccination_event(
        self,
        event_id: uuid.UUID,
        animal_id: uuid.UUID,
        village_id: uuid.UUID,
        programme_code: str,
        event_date: date,
        batch_number: Optional[str],
        dose_note: Optional[str],
        campaign_id: Optional[uuid.UUID],
        camp_id: Optional[uuid.UUID],
        administered_by_user_id: Optional[uuid.UUID],
        administered_by_name: Optional[str],
        vaccinator_authorization_id: Optional[uuid.UUID],
        authorization_check: str,
        performed_by: uuid.UUID,
        remarks: Optional[str]
    ) -> AnimalEvent:
        """Create an immutable vaccination event and detail record atomically."""
        now_utc = datetime.now(timezone.utc)
        event = AnimalEvent(
            event_id=event_id,
            animal_id=animal_id,
            village_id=village_id,
            event_type="VACCINATION",
            event_date=event_date,
            performed_by=performed_by,
            received_at=now_utc,
            source="ONLINE",
            schema_version=1,
            remarks=remarks.strip() if remarks else None,
            review_status="NONE"
        )
        self.db.add(event)

        detail = VaccinationDetail(
            event_id=event_id,
            programme_code=programme_code.strip(),
            batch_number=batch_number.strip() if batch_number else None,
            dose_note=dose_note.strip() if dose_note else None,
            campaign_id=campaign_id,
            camp_id=camp_id,
            administered_by_user_id=administered_by_user_id,
            administered_by_name=administered_by_name.strip() if administered_by_name else None,
            vaccinator_authorization_id=vaccinator_authorization_id,
            authorization_check=authorization_check
        )
        self.db.add(detail)
        await self.db.flush()
        event.vaccination_detail = detail
        return event

    async def list_vaccinations(
        self,
        allowed_village_ids: Optional[Set[uuid.UUID]] = None,
        animal_id: Optional[uuid.UUID] = None,
        programme_code: Optional[str] = None,
        campaign_id: Optional[uuid.UUID] = None,
        camp_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[AnimalEvent]:
        """List effective vaccination events (excluding voided ones)."""
        stmt = (
            select(AnimalEvent)
            .options(selectinload(AnimalEvent.vaccination_detail))
            .join(VaccinationDetail, AnimalEvent.event_id == VaccinationDetail.event_id)
            .where(AnimalEvent.event_type == "VACCINATION")
        )

        if allowed_village_ids is not None:
            if len(allowed_village_ids) == 0:
                return []
            stmt = stmt.where(AnimalEvent.village_id.in_(allowed_village_ids))

        if animal_id:
            stmt = stmt.where(AnimalEvent.animal_id == animal_id)

        if programme_code:
            stmt = stmt.where(VaccinationDetail.programme_code == programme_code)

        if campaign_id:
            stmt = stmt.where(VaccinationDetail.campaign_id == campaign_id)

        if camp_id:
            stmt = stmt.where(VaccinationDetail.camp_id == camp_id)

        stmt = stmt.order_by(AnimalEvent.event_date.desc(), AnimalEvent.received_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_treatment_event(
        self,
        event_id: uuid.UUID,
        animal_id: uuid.UUID,
        village_id: uuid.UUID,
        event_date: date,
        treatment_text: str,
        diagnosis_text: Optional[str],
        medicine_text: Optional[str],
        follow_up_date: Optional[date],
        performed_by: uuid.UUID,
        remarks: Optional[str]
    ) -> AnimalEvent:
        """Create clinical treatment event and detail record atomically."""
        now_utc = datetime.now(timezone.utc)
        event = AnimalEvent(
            event_id=event_id,
            animal_id=animal_id,
            village_id=village_id,
            event_type="TREATMENT",
            event_date=event_date,
            performed_by=performed_by,
            received_at=now_utc,
            source="ONLINE",
            schema_version=1,
            remarks=remarks.strip() if remarks else None,
            review_status="NONE"
        )
        self.db.add(event)

        detail = TreatmentDetail(
            event_id=event_id,
            diagnosis_text=diagnosis_text.strip() if diagnosis_text else None,
            treatment_text=treatment_text.strip(),
            medicine_text=medicine_text.strip() if medicine_text else None,
            follow_up_date=follow_up_date
        )
        self.db.add(detail)
        await self.db.flush()
        event.treatment_detail = detail
        return event

    async def list_treatments(
        self,
        allowed_village_ids: Optional[Set[uuid.UUID]] = None,
        animal_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[AnimalEvent]:
        """List treatment records."""
        stmt = (
            select(AnimalEvent)
            .options(selectinload(AnimalEvent.treatment_detail))
            .join(TreatmentDetail, AnimalEvent.event_id == TreatmentDetail.event_id)
            .where(AnimalEvent.event_type == "TREATMENT")
        )

        if allowed_village_ids is not None:
            if len(allowed_village_ids) == 0:
                return []
            stmt = stmt.where(AnimalEvent.village_id.in_(allowed_village_ids))

        if animal_id:
            stmt = stmt.where(AnimalEvent.animal_id == animal_id)

        stmt = stmt.order_by(AnimalEvent.event_date.desc(), AnimalEvent.received_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_observation_event(
        self,
        event_id: uuid.UUID,
        animal_id: uuid.UUID,
        village_id: uuid.UUID,
        event_date: date,
        symptoms: List[str],
        notes: Optional[str],
        performed_by: uuid.UUID,
        remarks: Optional[str]
    ) -> AnimalEvent:
        """Create observation event."""
        now_utc = datetime.now(timezone.utc)
        event = AnimalEvent(
            event_id=event_id,
            animal_id=animal_id,
            village_id=village_id,
            event_type="OBSERVATION",
            event_date=event_date,
            performed_by=performed_by,
            received_at=now_utc,
            source="ONLINE",
            schema_version=1,
            remarks=remarks.strip() if remarks else None,
            review_status="NONE"
        )
        self.db.add(event)

        detail = ObservationDetail(
            event_id=event_id,
            symptoms=symptoms,
            notes=notes.strip() if notes else None
        )
        self.db.add(detail)
        await self.db.flush()
        event.observation_detail = detail
        return event

    async def review_event(
        self,
        event: AnimalEvent,
        reviewed_by: uuid.UUID,
        review_status: str,
        review_note: Optional[str]
    ) -> AnimalEvent:
        """Update audit review status on an existing animal event."""
        event.review_status = review_status
        event.reviewed_by = reviewed_by
        event.reviewed_at = datetime.now(timezone.utc)
        event.review_note = review_note.strip() if review_note else None
        await self.db.flush()
        return event

    async def correct_event(
        self,
        original_event_id: uuid.UUID,
        action: str,
        reason: str,
        corrected_by: uuid.UUID,
        replacement_event_id: Optional[uuid.UUID] = None
    ) -> EventCorrection:
        """Record an immutable event correction / void."""
        correction = EventCorrection(
            id=uuid.uuid4(),
            original_event_id=original_event_id,
            action=action,
            replacement_event_id=replacement_event_id,
            reason=reason.strip(),
            corrected_by=corrected_by,
            corrected_at=datetime.now(timezone.utc)
        )
        self.db.add(correction)
        await self.db.flush()
        return correction

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
        """Record an immutable audit event for livestock events."""
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

    async def is_authorized_vaccinator(
        self,
        user_id: uuid.UUID,
        check_date: Optional[date] = None,
        programme_code: Optional[str] = None
    ) -> bool:
        """Check whether user holds an APPROVED vaccinator_authorization covering check_date,
        or has approved role/deployment clinical vaccinator authority."""
        effective_date = check_date or date.today()
        stmt = (
            select(VaccinatorAuthorization)
            .where(
                VaccinatorAuthorization.user_id == user_id,
                VaccinatorAuthorization.status == "APPROVED",
                (VaccinatorAuthorization.valid_from == None) | (VaccinatorAuthorization.valid_from <= effective_date),
                (VaccinatorAuthorization.valid_to == None) | (VaccinatorAuthorization.valid_to >= effective_date),
            )
        )
        res = await self.db.execute(stmt)
        vauth = res.scalars().first()
        if vauth is not None:
            return True

        from app.modules.authentication.models import User, UserVillageAssignment, UserPermissionGrant
        user = await self.db.get(User, user_id)
        if not user or user.status != "ACTIVE":
            return False

        if user.role in ("VET_OFFICER", "VO"):
            return True

        if user.role in ("FIELD_WORKER", "FW"):
            from app.modules.campaigns.models import CampaignAssignment
            camp_stmt = select(CampaignAssignment.id).where(
                CampaignAssignment.worker_user_id == user_id,
                CampaignAssignment.ended_at.is_(None)
            ).limit(1)
            camp_res = await self.db.execute(camp_stmt)
            if camp_res.scalars().first() is not None:
                return True

            up_stmt = select(UserPermissionGrant.user_id).where(
                UserPermissionGrant.user_id == user_id,
                UserPermissionGrant.permission_code.in_(["vaccination.record", "event.create"]),
                UserPermissionGrant.revoked_at.is_(None)
            ).limit(1)
            up_res = await self.db.execute(up_stmt)
            if up_res.scalars().first() is not None:
                return True

            return False

        return False


# Backwards-compatible alias for plural repository name
VaccinationsRepository = VaccinationRepository


