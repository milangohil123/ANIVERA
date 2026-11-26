"""Vaccination and Animal Events Management Service.

Coordinates:
- Routine vaccination recording by separately authorised vaccinators ('event.create' + approved clinical auth)
- Treatment consultations and observation events ('event.treatment.create')
- Optional batch number support (DEC-018)
- Zero mandatory VO approval requirement for routine vaccinations (DEC-016)
- Event auditing and review ('event.review')
- Event correction and voids with immutable preservation ('event.correct')
- Immutable security audit trails
"""
import logging
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reference import Programme
from app.modules.animals.models import Animal
from app.modules.authentication.models import User
from app.modules.authorization.models import VaccinatorAuthorization
from app.modules.authorization.service import AuthorizationService
from app.modules.vaccinations.models import AnimalEvent, EventCorrection
from app.modules.vaccinations.repository import VaccinationRepository
from app.modules.vaccinations.schemas import (
    EventCorrectionRequest,
    EventCorrectionResponse,
    EventReviewRequest,
    ObservationRecordCreate,
    ObservationResponse,
    TreatmentRecordCreate,
    TreatmentResponse,
    VaccinationRecordCreate,
    VaccinationResponse,
)

logger = logging.getLogger("pashurakshak.vaccinations.service")


class VaccinationService:
    """Service managing animal health events, vaccinations, treatments, and corrections."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = VaccinationRepository(db)
        self.authz_service = AuthorizationService(db)

    async def record_vaccination(
        self,
        payload: VaccinationRecordCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VaccinationResponse:
        """Record an animal vaccination event.
        
        Enforces:
        - Permission 'event.create'
        - Separate vaccinator authorization (DEC-015: being FW/VO alone does NOT confer vaccination authority)
        - Village geographic scope
        - Valid animal, date guards (no future dates; not before birth date)
        - Routine vaccination requires no VO approval (DEC-016)
        - Batch number is optional (DEC-018)
        """
        await self.authz_service.assert_any_permission(
            current_user,
            ["event.create", "vaccination.record"],
            ip=client_ip
        )

        # Enforce village boundary
        await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)

        # Determine administered vaccinator identity
        admin_user_id = payload.administered_by_user_id or current_user.id
        admin_user = await self.db.get(User, admin_user_id)
        if not admin_user or admin_user.status != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Active administering vaccinator user required")

        # Clinical vaccinator authorization verification (DEC-015: approved vaccinator or VO)
        is_authorised = (admin_user.role in ("VET_OFFICER", "VO")) or await self.authz_service.repo.has_approved_vaccinator_authorization(admin_user.id)
        if not is_authorised:
            logger.warning("Vaccination rejected: user %s lacks approved vaccinator authorization", admin_user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: vaccinator does not possess an approved clinical vaccinator authorization"
            )

        # Validate animal
        animal = await self.db.get(Animal, payload.animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        # Validate date guards (matching DB triggers)
        today = date.today()
        if payload.event_date > today:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event_date cannot be in the future")

        if animal.birth_date and payload.event_date < animal.birth_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"event_date cannot be earlier than animal birth date ({animal.birth_date})"
            )

        # Validate programme
        programme = await self.db.get(Programme, payload.programme_code.strip())
        if not programme:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid vaccination programme code")

        # Idempotency check: if client provided event_id, check for replay
        event_id = payload.event_id or uuid.uuid4()
        existing = await self.repo.get_event_by_id(event_id)
        if existing and existing.vaccination_detail:
            # Replay idempotent response
            d = existing.vaccination_detail
            return VaccinationResponse(
                event_id=existing.event_id,
                animal_id=existing.animal_id,
                village_id=existing.village_id,
                programme_code=d.programme_code,
                event_date=existing.event_date,
                batch_number=d.batch_number,
                dose_note=d.dose_note,
                campaign_id=d.campaign_id,
                camp_id=d.camp_id,
                administered_by_user_id=d.administered_by_user_id,
                administered_by_name=d.administered_by_name,
                authorization_check=d.authorization_check,
                performed_by=existing.performed_by,
                received_at=existing.received_at,
                review_status=existing.review_status,
                remarks=existing.remarks
            )

        # Resolve any explicit approved vaccinator authorization id for linkage
        vauth_stmt = select(VaccinatorAuthorization.id).where(
            VaccinatorAuthorization.user_id == admin_user.id,
            VaccinatorAuthorization.status == "APPROVED"
        ).limit(1)
        vauth_res = await self.db.execute(vauth_stmt)
        vauth_id = vauth_res.scalars().first()

        event = await self.repo.create_vaccination_event(
            event_id=event_id,
            animal_id=animal.id,
            village_id=payload.village_id,
            programme_code=payload.programme_code,
            event_date=payload.event_date,
            batch_number=payload.batch_number,
            dose_note=payload.dose_note,
            campaign_id=payload.campaign_id,
            camp_id=payload.camp_id,
            administered_by_user_id=admin_user.id,
            administered_by_name=payload.administered_by_name or admin_user.full_name,
            vaccinator_authorization_id=vauth_id,
            authorization_check="AUTHORIZED",
            performed_by=current_user.id,
            remarks=payload.remarks
        )

        await self.repo.record_audit_event(
            action="VACCINATION_RECORDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="vaccination",
            object_id=str(event.event_id),
            village_id=payload.village_id,
            reason=f"Recorded {payload.programme_code} vaccination for animal {animal.animal_code or str(animal.id)}",
            ip=client_ip
        )

        # Check and advance active cooperative recurring vaccination cycle
        try:
            from app.modules.health_cases.models import AnimalVaccinationCycle, CooperativeVaccinationSchedule
            from datetime import timedelta
            cyc_res = await self.db.execute(
                select(AnimalVaccinationCycle).where(
                    AnimalVaccinationCycle.animal_id == payload.animal_id,
                    AnimalVaccinationCycle.status.in_(["SCHEDULED", "DUE", "REMINDER_SENT"])
                ).order_by(AnimalVaccinationCycle.due_date).limit(1)
            )
            active_cycle = cyc_res.scalar_one_or_none()
            if active_cycle:
                active_cycle.status = "COMPLETED"
                active_cycle.completed_date = payload.event_date
                active_cycle.completed_event_id = event.event_id

                sched = await self.db.get(CooperativeVaccinationSchedule, active_cycle.schedule_id)
                if sched and sched.status == "ACTIVE":
                    interval_val = sched.recurrence_interval_value or 6
                    if sched.recurrence_interval_unit == "WEEKS":
                        next_delta = timedelta(weeks=interval_val)
                    elif sched.recurrence_interval_unit == "DAYS":
                        next_delta = timedelta(days=interval_val)
                    else:
                        next_delta = timedelta(days=interval_val * 30)

                    next_due = payload.event_date + next_delta
                    next_reminder = next_due - timedelta(days=sched.reminder_days_before or 15)

                    next_cycle = AnimalVaccinationCycle(
                        id=uuid.uuid4(),
                        animal_id=payload.animal_id,
                        schedule_id=sched.id,
                        programme_code=sched.programme_code,
                        cycle_number=active_cycle.cycle_number + 1,
                        previous_vaccination_date=payload.event_date,
                        last_verified_vaccination_date=payload.event_date,
                        due_date=next_due,
                        reminder_date=next_reminder,
                        reminder_status="PENDING",
                        status="SCHEDULED"
                    )
                    self.db.add(next_cycle)
        except Exception as ex:
            logger.warning("Could not auto-advance vaccination cycle: %s", ex)

        # Compute and persist next_due_date if linked to campaign or schedule
        calculated_next_due = None
        if payload.campaign_id:
            try:
                from app.modules.campaigns.models import Campaign
                from datetime import timedelta
                camp = await self.db.get(Campaign, payload.campaign_id)
                if camp and camp.interval_months:
                    calculated_next_due = payload.event_date + timedelta(days=camp.interval_months * 30)
                    if event.vaccination_detail:
                        event.vaccination_detail.next_due_date = calculated_next_due
            except Exception as v_err:
                logger.warning("Next due date calculation note: %s", v_err)

        await self.db.commit()

        d = event.vaccination_detail
        return VaccinationResponse(
            event_id=event.event_id,
            animal_id=event.animal_id,
            village_id=event.village_id,
            programme_code=d.programme_code,
            event_date=event.event_date,
            batch_number=d.batch_number,
            dose_note=d.dose_note,
            campaign_id=d.campaign_id,
            camp_id=d.camp_id,
            administered_by_user_id=d.administered_by_user_id,
            administered_by_name=d.administered_by_name,
            authorization_check=d.authorization_check,
            performed_by=event.performed_by,
            next_due_date=d.next_due_date if (d and d.next_due_date) else calculated_next_due,
            received_at=event.received_at,
            review_status=event.review_status,
            remarks=event.remarks
        )

    async def list_vaccinations(
        self,
        animal_id: Optional[uuid.UUID] = None,
        village_id: Optional[uuid.UUID] = None,
        programme_code: Optional[str] = None,
        campaign_id: Optional[uuid.UUID] = None,
        camp_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50,
        current_user: User = None,
        client_ip: Optional[str] = None
    ) -> List[VaccinationResponse]:
        """List vaccination records within caller scope."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["animal.read", "event.create", "own.read", "aggregate.view"],
            ip=client_ip
        )

        allowed_villages: Optional[Set[uuid.UUID]] = None
        if current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            allowed_villages = scope.assigned_village_ids
        elif current_user.role == "DAIRY_STAFF":
            allowed_villages = scope.cooperative_village_ids

        events = await self.repo.list_vaccinations(
            allowed_village_ids=allowed_villages,
            animal_id=animal_id,
            programme_code=programme_code,
            campaign_id=campaign_id,
            camp_id=camp_id,
            offset=offset,
            limit=limit
        )

        res = []
        for e in events:
            d = e.vaccination_detail
            if d:
                res.append(
                    VaccinationResponse(
                        event_id=e.event_id,
                        animal_id=e.animal_id,
                        village_id=e.village_id,
                        programme_code=d.programme_code,
                        event_date=e.event_date,
                        batch_number=d.batch_number,
                        dose_note=d.dose_note,
                        campaign_id=d.campaign_id,
                        camp_id=d.camp_id,
                        administered_by_user_id=d.administered_by_user_id,
                        administered_by_name=d.administered_by_name,
                        authorization_check=d.authorization_check,
                        performed_by=e.performed_by,
                        received_at=e.received_at,
                        review_status=e.review_status,
                        remarks=e.remarks
                    )
                )
        return res

    async def record_treatment(
        self,
        payload: TreatmentRecordCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> TreatmentResponse:
        """Record veterinary treatment consultation."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["event.treatment.create", "event.create"],
            ip=client_ip
        )

        await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)

        animal = await self.db.get(Animal, payload.animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        today = date.today()
        if payload.event_date > today:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event_date cannot be in the future")

        event_id = payload.event_id or uuid.uuid4()
        event = await self.repo.create_treatment_event(
            event_id=event_id,
            animal_id=animal.id,
            village_id=payload.village_id,
            event_date=payload.event_date,
            treatment_text=payload.treatment_text,
            diagnosis_text=payload.diagnosis_text,
            medicine_text=payload.medicine_text,
            follow_up_date=payload.follow_up_date,
            performed_by=current_user.id,
            remarks=payload.remarks
        )

        await self.repo.record_audit_event(
            action="TREATMENT_RECORDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="treatment",
            object_id=str(event.event_id),
            village_id=payload.village_id,
            reason=f"Recorded treatment for animal {animal.animal_code or str(animal.id)}",
            ip=client_ip
        )
        await self.db.commit()

        td = event.treatment_detail
        return TreatmentResponse(
            event_id=event.event_id,
            animal_id=event.animal_id,
            village_id=event.village_id,
            event_date=event.event_date,
            treatment_text=td.treatment_text,
            diagnosis_text=td.diagnosis_text,
            medicine_text=td.medicine_text,
            follow_up_date=td.follow_up_date,
            performed_by=event.performed_by,
            received_at=event.received_at,
            review_status=event.review_status,
            remarks=event.remarks
        )

    async def list_treatments(
        self,
        animal_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50,
        current_user: User = None,
        client_ip: Optional[str] = None
    ) -> List[TreatmentResponse]:
        """List treatment records."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["animal.read", "event.treatment.create", "own.read"],
            ip=client_ip
        )

        allowed_villages: Optional[Set[uuid.UUID]] = None
        if current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            allowed_villages = scope.assigned_village_ids

        events = await self.repo.list_treatments(
            allowed_village_ids=allowed_villages,
            animal_id=animal_id,
            offset=offset,
            limit=limit
        )

        res = []
        for e in events:
            td = e.treatment_detail
            if td:
                res.append(
                    TreatmentResponse(
                        event_id=e.event_id,
                        animal_id=e.animal_id,
                        village_id=e.village_id,
                        event_date=e.event_date,
                        treatment_text=td.treatment_text,
                        diagnosis_text=td.diagnosis_text,
                        medicine_text=td.medicine_text,
                        follow_up_date=td.follow_up_date,
                        performed_by=e.performed_by,
                        received_at=e.received_at,
                        review_status=e.review_status,
                        remarks=e.remarks
                    )
                )
        return res

    async def review_event(
        self,
        event_id: uuid.UUID,
        payload: EventReviewRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> None:
        """Mark event reviewed or flagged (VO authority: 'event.review')."""
        await self.authz_service.assert_permission(
            current_user,
            "event.review",
            ip=client_ip
        )

        event = await self.repo.get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        await self.authz_service.assert_village_scope(current_user, event.village_id, ip=client_ip)

        await self.repo.review_event(
            event=event,
            reviewed_by=current_user.id,
            review_status=payload.review_status,
            review_note=payload.review_note
        )

        await self.repo.record_audit_event(
            action="EVENT_REVIEWED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="animal_event",
            object_id=str(event.event_id),
            village_id=event.village_id,
            reason=f"Event {event.event_id} marked {payload.review_status}: {payload.review_note or 'Reviewed'}",
            ip=client_ip
        )
        await self.db.commit()

    async def correct_event(
        self,
        event_id: uuid.UUID,
        payload: EventCorrectionRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> EventCorrectionResponse:
        """Amend or void an event with mandatory reason (VO authority: 'event.correct')."""
        await self.authz_service.assert_permission(
            current_user,
            "event.correct",
            ip=client_ip
        )

        event = await self.repo.get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        await self.authz_service.assert_village_scope(current_user, event.village_id, ip=client_ip)

        if payload.action == "AMEND" and not payload.replacement_event_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="replacement_event_id is required when action is AMEND"
            )
        if payload.action == "VOID" and payload.replacement_event_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="replacement_event_id must be NULL when action is VOID"
            )

        correction = await self.repo.correct_event(
            original_event_id=event.event_id,
            action=payload.action,
            reason=payload.reason,
            replacement_event_id=payload.replacement_event_id,
            corrected_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="EVENT_CORRECTED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="event_correction",
            object_id=str(correction.id),
            village_id=event.village_id,
            reason=f"{payload.action} event {event.event_id}: {payload.reason}",
            ip=client_ip
        )
        await self.db.commit()
        return EventCorrectionResponse.model_validate(correction)

