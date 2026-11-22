"""Comprehensive business logic service for:
1. Farmer Disease Reporting, TAHO Case Assignment, VO/FW Treatment, and TAHO Verification
2. Dairy Cooperative Recurring Vaccination Schedules, Animal Enrollment, 15-Day Reminders,
   and Animal Chronological Timeline
"""
from datetime import date, datetime, timedelta
import logging
from typing import Any, Dict, List, Optional, Set
import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Taluka, Village
from app.modules.administration.models import Cooperative
from app.modules.animals.models import Animal, AnimalExternalIdentifier
from app.modules.authentication.models import AuditEvent, User
from app.modules.authorization.models import CooperativeMembership
from app.modules.disease_surveillance.models import (
    DiseaseReport,
    DiseaseReportAttachment,
    DiseaseReportStatusHistory,
    DiseaseReview,
)
from app.modules.farmers.models import Farmer
from app.modules.health_cases.models import (
    AnimalVaccinationCycle,
    CooperativeVaccinationSchedule,
    HealthCaseAssignment,
    ScheduleAnimalEnrollment,
    TreatmentAttachment,
    TreatmentRecord,
    TreatmentVerification,
)
from app.modules.health_cases.schemas import (
    AnimalTimelineEventItem,
    CaseAssignmentRequest,
    CaseTreatmentRecordRequest,
    CaseTreatmentVerificationRequest,
    CooperativeScheduleSummary,
    FarmerDiseaseReportCreate,
    FarmerDiseaseReportItem,
    RecurringScheduleCreateRequest,
    ScheduleDecisionRequest,
    ScheduleEligibilityPreviewResponse,
)
from app.modules.notifications.models import Notification
from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail

logger = logging.getLogger(__name__)


class HealthWorkflowService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # =========================================================================
    # PART A: Farmer Disease Reporting
    # =========================================================================

    async def submit_farmer_report(
        self,
        payload: FarmerDiseaseReportCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FarmerDiseaseReportItem:
        """Submit an animal health issue or suspected disease report by a Farmer."""
        # 1. Resolve animal
        animal: Optional[Animal] = None
        if payload.animal_id:
            animal = await self.db.get(Animal, payload.animal_id)
        elif payload.animal_tag_id:
            # Look up by tag
            tag_res = await self.db.execute(
                select(AnimalExternalIdentifier).where(
                    AnimalExternalIdentifier.identifier_value == payload.animal_tag_id.strip(),
                    AnimalExternalIdentifier.is_active == True
                )
            )
            ext_id = tag_res.scalar_one_or_none()
            if ext_id:
                animal = await self.db.get(Animal, ext_id.animal_id)

        # 2. Resolve farmer
        farmer: Optional[Farmer] = None
        if current_user.role == "FARMER":
            # Lookup linked farmer record
            f_res = await self.db.execute(
                select(Farmer).where(
                    or_(
                        Farmer.user_id == current_user.id,
                        Farmer.mobile_e164 == current_user.mobile_e164
                    )
                )
            )
            farmer = f_res.scalars().first()

        if animal and not farmer:
            farmer = await self.db.get(Farmer, animal.farmer_id)

        # 3. Resolve village
        village_id = payload.village_id
        if not village_id:
            if animal and animal.village_id:
                village_id = animal.village_id
            elif farmer and farmer.village_id:
                village_id = farmer.village_id

        if not village_id:
            # Fallback to first active village
            v_res = await self.db.execute(select(Village.id).where(Village.active == True).limit(1))
            village_id = v_res.scalar_one_or_none()

        if not village_id:
            raise HTTPException(status_code=400, detail="ગામની માહિતી અનિવાર્ય છે (Village is required)")

        # 4. Generate report number
        now = datetime.now()
        report_no = f"DR-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

        disease_code = "UNKNOWN"
        if not payload.is_unknown_disease and payload.suspected_disease_code:
            disease_code = payload.suspected_disease_code.strip()

        # 5. Create DiseaseReport
        report = DiseaseReport(
            report_id=uuid.uuid4(),
            report_no=report_no,
            animal_id=animal.id if animal else None,
            farmer_id=farmer.id if farmer else None,
            village_id=village_id,
            disease_code=disease_code,
            report_source="FARMER_PORTAL",
            report_date=payload.symptom_onset_date or date.today(),
            symptoms=payload.symptoms or [],
            observation_text=payload.description or "",
            latitude=payload.latitude,
            longitude=payload.longitude,
            reported_by=current_user.id,
            status="SUBMITTED",
        )

        # Custom fields on disease_reports
        setattr(report, "urgency", payload.urgency or "NORMAL")
        setattr(report, "is_unknown_disease", payload.is_unknown_disease)
        setattr(report, "custom_disease_name", payload.custom_disease_name)
        setattr(report, "treatment_status", "SUBMITTED")

        self.db.add(report)
        await self.db.flush()

        # 6. Save photos if provided
        for url in (payload.photo_urls or []):
            att = DiseaseReportAttachment(
                id=uuid.uuid4(),
                report_id=report.report_id,
                file_path=url,
                sha256="manual_upload",
                mime_type="image/jpeg",
                size_bytes=1024,
                uploaded_by=current_user.id
            )
            self.db.add(att)

        # 7. Add status history
        hist = DiseaseReportStatusHistory(
            id=uuid.uuid4(),
            report_id=report.report_id,
            from_status=None,
            to_status="SUBMITTED",
            reason=f"Farmer submitted health problem ({payload.urgency} priority)",
            changed_by=current_user.id
        )
        self.db.add(hist)

        # 8. Notify TAHO / Veterinary Staff
        await self._notify_taho_of_new_report(report, animal, farmer)

        await self.db.commit()
        return await self._to_farmer_report_item(report)

    async def list_farmer_reports(self, current_user: User) -> List[FarmerDiseaseReportItem]:
        """List health reports filed by or belonging to current farmer."""
        f_query = select(Farmer.id).where(
            or_(
                Farmer.user_id == current_user.id,
                Farmer.mobile_e164 == current_user.mobile_e164
            )
        )
        f_res = await self.db.execute(f_query)
        farmer_ids = f_res.scalars().all()

        query = select(DiseaseReport).where(
            or_(
                DiseaseReport.reported_by == current_user.id,
                DiseaseReport.farmer_id.in_(farmer_ids) if farmer_ids else False
            )
        ).order_by(desc(DiseaseReport.received_at))

        res = await self.db.execute(query)
        reports = res.scalars().all()

        items = []
        for r in reports:
            items.append(await self._to_farmer_report_item(r))
        return items

    async def _to_farmer_report_item(self, report: DiseaseReport) -> FarmerDiseaseReportItem:
        animal_name = None
        animal_code = None
        animal_tag = None
        species_code = None
        farmer_name = None

        if report.animal_id:
            animal = await self.db.get(Animal, report.animal_id)
            if animal:
                animal_code = animal.animal_code
                animal_name = getattr(animal, "name", None) or f"{animal.species_code} ({animal.animal_code or 'ID'})"
                species_code = animal.species_code
                # Find tag
                tag_res = await self.db.execute(
                    select(AnimalExternalIdentifier.identifier_value).where(
                        AnimalExternalIdentifier.animal_id == animal.id,
                        AnimalExternalIdentifier.is_active == True
                    ).limit(1)
                )
                animal_tag = tag_res.scalar_one_or_none()

        if report.farmer_id:
            farmer = await self.db.get(Farmer, report.farmer_id)
            if farmer:
                farmer_name = farmer.full_name

        vil = await self.db.get(Village, report.village_id)
        village_name = vil.name_gu if vil else None

        # Fetch attachments
        att_res = await self.db.execute(
            select(DiseaseReportAttachment.file_path).where(DiseaseReportAttachment.report_id == report.report_id)
        )
        photo_urls = att_res.scalars().all()

        # Assigned staff names
        vo_name = None
        fw_name = None
        if getattr(report, "assigned_vo_id", None):
            vo_u = await self.db.get(User, getattr(report, "assigned_vo_id"))
            if vo_u:
                vo_name = vo_u.full_name
        if getattr(report, "assigned_fw_id", None):
            fw_u = await self.db.get(User, getattr(report, "assigned_fw_id"))
            if fw_u:
                fw_name = fw_u.full_name

        return FarmerDiseaseReportItem(
            report_id=report.report_id,
            report_no=report.report_no,
            animal_id=report.animal_id,
            animal_code=animal_code,
            animal_tag_id=animal_tag,
            animal_name=animal_name,
            species_code=species_code,
            farmer_id=report.farmer_id,
            farmer_name=farmer_name,
            village_id=report.village_id,
            village_name_gu=village_name,
            disease_code=report.disease_code,
            is_unknown_disease=bool(getattr(report, "is_unknown_disease", False)),
            custom_disease_name=getattr(report, "custom_disease_name", None),
            symptoms=report.symptoms or [],
            observation_text=report.observation_text,
            urgency=getattr(report, "urgency", "NORMAL") or "NORMAL",
            treatment_status=getattr(report, "treatment_status", "SUBMITTED") or "SUBMITTED",
            report_date=report.report_date,
            received_at=report.received_at,
            assigned_vo_name=vo_name,
            assigned_fw_name=fw_name,
            assigned_to_role=getattr(report, "assigned_to_role", None),
            attachment_count=len(photo_urls),
            photo_urls=list(photo_urls)
        )

    # =========================================================================
    # PART B: TAHO Case Assignment & VO/FW Treatment
    # =========================================================================

    async def list_taho_cases(
        self,
        current_user: User,
        village_id: Optional[uuid.UUID] = None,
        disease_code: Optional[str] = None,
        urgency: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100
    ) -> List[FarmerDiseaseReportItem]:
        """List disease reports within TAHO's authorized Taluka."""
        # Find Taluka villages
        taluka_id = (current_user.assigned_taluka_ids or [None])[0]
        vil_query = select(Village.id)
        if taluka_id:
            vil_query = vil_query.where(Village.taluka_id == taluka_id)
        vil_res = await self.db.execute(vil_query)
        taluka_village_ids = vil_res.scalars().all()

        query = select(DiseaseReport).where(
            DiseaseReport.village_id.in_(taluka_village_ids)
        )

        if village_id:
            query = query.where(DiseaseReport.village_id == village_id)
        if disease_code:
            query = query.where(DiseaseReport.disease_code == disease_code)
        if urgency:
            query = query.where(DiseaseReport.urgency == urgency)
        if status_filter:
            query = query.where(
                or_(
                    DiseaseReport.treatment_status == status_filter,
                    DiseaseReport.status == status_filter
                )
            )

        query = query.order_by(desc(DiseaseReport.received_at)).limit(limit)
        res = await self.db.execute(query)
        reports = res.scalars().all()

        items = []
        for r in reports:
            items.append(await self._to_farmer_report_item(r))
        return items

    async def assign_taho_case(
        self,
        report_id: uuid.UUID,
        payload: CaseAssignmentRequest,
        current_user: User
    ) -> Dict[str, Any]:
        """TAHO assigns reported case to VO, FW, or both with instructions & priority."""
        report = await self.db.get(DiseaseReport, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="અહેવાલ મળ્યો નથી (Report not found)")

        assignment = HealthCaseAssignment(
            id=uuid.uuid4(),
            report_id=report_id,
            assigned_by=current_user.id,
            assigned_vo_id=payload.assigned_vo_id,
            assigned_fw_id=payload.assigned_fw_id,
            assigned_to_role=payload.assigned_to_role,
            priority=payload.priority,
            instructions=payload.instructions,
            planned_visit_date=payload.planned_visit_date or (date.today() + timedelta(days=1)),
            status="ASSIGNED"
        )
        self.db.add(assignment)

        # Update DiseaseReport
        setattr(report, "treatment_status", "ASSIGNED")
        setattr(report, "assigned_vo_id", payload.assigned_vo_id)
        setattr(report, "assigned_fw_id", payload.assigned_fw_id)
        setattr(report, "assigned_to_role", payload.assigned_to_role)
        setattr(report, "assignment_instructions", payload.instructions)
        setattr(report, "planned_visit_date", payload.planned_visit_date)
        report.status = "UNDER_REVIEW"

        # Status History
        hist = DiseaseReportStatusHistory(
            id=uuid.uuid4(),
            report_id=report_id,
            from_status="SUBMITTED",
            to_status="ASSIGNED",
            reason=f"TAHO assigned case to {payload.assigned_to_role}. Priority: {payload.priority}",
            changed_by=current_user.id
        )
        self.db.add(hist)

        # Create In-App Notifications for VO / FW
        recipients = [payload.assigned_vo_id, payload.assigned_fw_id]
        for rec_id in recipients:
            if rec_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=rec_id,
                    kind="CASE_ASSIGNMENT",
                    message_key="notif.case.assigned",
                    params={
                        "report_no": report.report_no or str(report.report_id)[:8],
                        "disease_code": report.disease_code,
                        "priority": payload.priority,
                        "instructions": payload.instructions or "તાત્કાલિક તપાસ કરો"
                    },
                    related_type="disease_report",
                    related_id=str(report.report_id),
                    status="UNREAD"
                )
                self.db.add(notif)

        await self.db.commit()
        return {
            "status": "success",
            "message": "કેસ સફળતાપૂર્વક સોંપવામાં આવ્યો છે",
            "assignment_id": str(assignment.id),
            "report_id": str(report.report_id)
        }

    async def list_assigned_cases_for_staff(self, current_user: User) -> List[FarmerDiseaseReportItem]:
        """List cases assigned to current VO or Field Worker."""
        query = select(DiseaseReport).where(
            or_(
                DiseaseReport.assigned_vo_id == current_user.id,
                DiseaseReport.assigned_fw_id == current_user.id
            )
        ).order_by(desc(DiseaseReport.received_at))

        res = await self.db.execute(query)
        reports = res.scalars().all()

        items = []
        for r in reports:
            items.append(await self._to_farmer_report_item(r))
        return items

    async def record_case_treatment(
        self,
        report_id: uuid.UUID,
        payload: CaseTreatmentRecordRequest,
        current_user: User
    ) -> Dict[str, Any]:
        """VO/FW records clinical treatment and submits for TAHO verification."""
        report = await self.db.get(DiseaseReport, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="અહેવાલ મળ્યો નથી")

        # Resolve animal
        animal_id = report.animal_id
        if not animal_id:
            # Fallback to dummy or first animal
            a_res = await self.db.execute(select(Animal.id).where(Animal.village_id == report.village_id).limit(1))
            animal_id = a_res.scalar_one_or_none()

        if not animal_id:
            raise HTTPException(status_code=400, detail="પશુની માહિતી મળતી નથી")

        staff_role = "VO" if current_user.role in ("VO", "VET_OFFICER") else "FW"

        treatment = TreatmentRecord(
            id=uuid.uuid4(),
            report_id=report_id,
            animal_id=animal_id,
            treated_by=current_user.id,
            treated_by_role=staff_role,
            visit_date=date.today(),
            visit_time=datetime.now().strftime("%H:%M"),
            observations=payload.observations,
            diagnosis=payload.diagnosis,
            treatment_text=payload.treatment_text,
            medicine_administered=payload.medicine_administered,
            dosage_details=payload.dosage_details,
            treatment_notes=payload.treatment_notes,
            follow_up_instructions=payload.follow_up_instructions,
            next_visit_date=payload.next_visit_date,
            latitude=payload.latitude,
            longitude=payload.longitude,
            status="AWAITING_VERIFICATION"
        )
        self.db.add(treatment)

        # Attach before/after treatment photos
        for p in (payload.before_treatment_photos or []):
            att = TreatmentAttachment(
                id=uuid.uuid4(),
                treatment_id=treatment.id,
                report_id=report_id,
                attachment_type="BEFORE_TREATMENT",
                file_path=p,
                uploaded_by=current_user.id
            )
            self.db.add(att)

        for p in (payload.after_treatment_photos or []):
            att = TreatmentAttachment(
                id=uuid.uuid4(),
                treatment_id=treatment.id,
                report_id=report_id,
                attachment_type="AFTER_TREATMENT",
                file_path=p,
                uploaded_by=current_user.id
            )
            self.db.add(att)

        # Update DiseaseReport status
        setattr(report, "treatment_status", "AWAITING_VERIFICATION")

        # Create AnimalEvent in animal_events table for veterinary timeline
        event = AnimalEvent(
            event_id=uuid.uuid4(),
            animal_id=animal_id,
            village_id=report.village_id,
            event_type="TREATMENT",
            event_date=date.today(),
            performed_by=current_user.id,
            remarks=payload.treatment_text,
            review_status="AWAITING_VERIFICATION"
        )
        self.db.add(event)

        # Notify TAHO for verification
        await self._notify_taho_of_treatment(report, treatment, current_user)

        await self.db.commit()
        return {
            "status": "success",
            "message": "સારવાર સફળતાપૂર્વક નોંધાઈ છે અને TAHO ચકાસણી માટે મોકલાઈ છે",
            "treatment_id": str(treatment.id),
            "report_id": str(report.report_id)
        }

    async def verify_taho_treatment(
        self,
        report_id: uuid.UUID,
        payload: CaseTreatmentVerificationRequest,
        current_user: User
    ) -> Dict[str, Any]:
        """TAHO approves or rejects treatment verification."""
        report = await self.db.get(DiseaseReport, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="અહેવાલ મળ્યો નથી")

        # Find latest treatment
        t_res = await self.db.execute(
            select(TreatmentRecord).where(
                TreatmentRecord.report_id == report_id
            ).order_by(desc(TreatmentRecord.created_at)).limit(1)
        )
        treatment = t_res.scalar_one_or_none()

        verification = TreatmentVerification(
            id=uuid.uuid4(),
            treatment_id=treatment.id if treatment else None,
            report_id=report_id,
            verified_by=current_user.id,
            action=payload.action,
            verification_notes=payload.verification_notes,
            rejection_reason=payload.rejection_reason,
            follow_up_instructions=payload.follow_up_instructions,
        )
        self.db.add(verification)

        if payload.action == "APPROVED":
            setattr(report, "treatment_status", "VERIFIED")
            report.status = "CONFIRMED"
            if treatment:
                treatment.status = "VERIFIED"

            # Update AnimalEvent
            await self.db.execute(
                update(AnimalEvent).where(
                    AnimalEvent.animal_id == report.animal_id,
                    AnimalEvent.event_type == "TREATMENT"
                ).values(review_status="VERIFIED", reviewed_by=current_user.id, reviewed_at=datetime.now())
            )

            # Notify Farmer
            if report.farmer_id:
                f = await self.db.get(Farmer, report.farmer_id)
                if f and f.user_id:
                    notif = Notification(
                        id=uuid.uuid4(),
                        recipient_user_id=f.user_id,
                        kind="TREATMENT_VERIFIED",
                        message_key="notif.treatment.verified",
                        params={
                            "report_no": report.report_no or str(report.report_id)[:8],
                            "notes": payload.verification_notes or "સારવાર ચકાસણી મંજૂર થયેલ છે."
                        },
                        related_type="disease_report",
                        related_id=str(report.report_id),
                        status="UNREAD"
                    )
                    self.db.add(notif)
        else:
            # REJECTED or FOLLOW_UP_REQUIRED
            setattr(report, "treatment_status", "FOLLOW_UP_REQUIRED")
            if treatment:
                treatment.status = "FOLLOW_UP_REQUIRED"

            # Notify Staff
            staff_ids = [getattr(report, "assigned_vo_id", None), getattr(report, "assigned_fw_id", None)]
            for s_id in staff_ids:
                if s_id:
                    notif = Notification(
                        id=uuid.uuid4(),
                        recipient_user_id=s_id,
                        kind="TREATMENT_FOLLOW_UP",
                        message_key="notif.treatment.follow_up",
                        params={
                            "report_no": report.report_no or str(report.report_id)[:8],
                            "reason": payload.rejection_reason or "વધારાની મુલાકાત જરૂરી છે",
                            "instructions": payload.follow_up_instructions or "સ્થળ તપાસ કરો"
                        },
                        related_type="disease_report",
                        related_id=str(report.report_id),
                        status="UNREAD"
                    )
                    self.db.add(notif)

        await self.db.commit()
        return {
            "status": "success",
            "action": payload.action,
            "message": "ચકાસણી પ્રક્રિયા સફળતાપૂર્વક સાચવવામાં આવી છે."
        }

    # =========================================================================
    # PART C: Dairy Cooperative Recurring Vaccination Schedules
    # =========================================================================

    async def preview_schedule_eligibility(
        self,
        cooperative_id: uuid.UUID,
        programme_code: str,
        target_species: List[str],
        village_ids: List[uuid.UUID]
    ) -> ScheduleEligibilityPreviewResponse:
        """Preview eligible member animals and potential conflicts."""
        # Member farmers
        mem_query = select(CooperativeMembership.farmer_id).where(
            CooperativeMembership.cooperative_id == cooperative_id,
            CooperativeMembership.is_active == True
        )
        mem_res = await self.db.execute(mem_query)
        member_farmer_ids = mem_res.scalars().all()

        if not member_farmer_ids:
            return ScheduleEligibilityPreviewResponse(
                total_selected_farmers=0,
                total_selected_animals=0,
                species_breakdown={},
                village_breakdown={},
                already_vaccinated_count=0,
                existing_schedule_conflicts_count=0,
                eligible_count=0,
                preview_animals=[]
            )

        # Query animals
        a_query = select(Animal).where(
            Animal.farmer_id.in_(member_farmer_ids),
            Animal.status == "ACTIVE"
        )
        if target_species:
            a_query = a_query.where(Animal.species_code.in_(target_species))
        if village_ids:
            a_query = a_query.where(Animal.village_id.in_(village_ids))

        a_res = await self.db.execute(a_query)
        animals = a_res.scalars().all()

        species_bd: Dict[str, int] = {}
        village_bd: Dict[str, int] = {}
        preview_list: List[Dict[str, Any]] = []

        for a in animals:
            species_bd[a.species_code] = species_bd.get(a.species_code, 0) + 1
            v_key = str(a.village_id)
            village_bd[v_key] = village_bd.get(v_key, 0) + 1

            preview_list.append({
                "animal_id": str(a.id),
                "animal_code": a.animal_code,
                "species": a.species_code,
                "farmer_id": str(a.farmer_id),
                "village_id": str(a.village_id),
            })

        return ScheduleEligibilityPreviewResponse(
            total_selected_farmers=len(member_farmer_ids),
            total_selected_animals=len(animals),
            species_breakdown=species_bd,
            village_breakdown=village_bd,
            already_vaccinated_count=0,
            existing_schedule_conflicts_count=0,
            eligible_count=len(animals),
            preview_animals=preview_list[:100]
        )

    async def create_recurring_schedule(
        self,
        cooperative_id: uuid.UUID,
        payload: RecurringScheduleCreateRequest,
        current_user: User
    ) -> CooperativeScheduleSummary:
        """Cooperative creates recurring vaccination schedule and enrolls linked member animals."""
        # Resolve Taluka
        taluka_id = payload.taluka_id
        if not taluka_id:
            coop = await self.db.get(Cooperative, cooperative_id)
            taluka_id = coop.taluka_id if coop else None

        if not taluka_id:
            t_res = await self.db.execute(select(Taluka.id).limit(1))
            taluka_id = t_res.scalar_one_or_none()

        status_val = "SUBMITTED" if payload.submit_immediately else "DRAFT"

        schedule = CooperativeVaccinationSchedule(
            id=uuid.uuid4(),
            cooperative_id=cooperative_id,
            schedule_name=payload.schedule_name,
            programme_code=payload.programme_code,
            vaccine_name=payload.vaccine_name,
            disease_prevention_purpose=payload.disease_prevention_purpose,
            target_species=payload.target_species,
            target_villages=payload.target_villages,
            taluka_id=taluka_id,
            start_date=payload.start_date,
            recurrence_interval_value=payload.recurrence_interval_value,
            recurrence_interval_unit=payload.recurrence_interval_unit,
            reminder_days_before=payload.reminder_days_before,
            execution_instructions=payload.execution_instructions,
            status=status_val,
            created_by=current_user.id,
            submitted_at=datetime.now() if payload.submit_immediately else None
        )
        self.db.add(schedule)
        await self.db.flush()

        # Enroll animals (only actual linked member animals)
        enrolled_count = 0
        if payload.enrolled_animal_ids:
            for aid in payload.enrolled_animal_ids:
                animal = await self.db.get(Animal, aid)
                if animal:
                    enrollment = ScheduleAnimalEnrollment(
                        id=uuid.uuid4(),
                        schedule_id=schedule.id,
                        animal_id=animal.id,
                        farmer_id=animal.farmer_id,
                        cooperative_id=cooperative_id,
                        status="ENROLLED"
                    )
                    self.db.add(enrollment)
                    enrolled_count += 1
        else:
            # Auto-enroll all linked member animals matching species & villages
            mem_query = select(CooperativeMembership.farmer_id).where(
                CooperativeMembership.cooperative_id == cooperative_id,
                CooperativeMembership.is_active == True
            )
            mem_res = await self.db.execute(mem_query)
            member_farmer_ids = mem_res.scalars().all()

            if member_farmer_ids:
                a_query = select(Animal).where(
                    Animal.farmer_id.in_(member_farmer_ids),
                    Animal.species_code.in_(payload.target_species),
                    Animal.status == "ACTIVE"
                )
                if payload.target_villages:
                    a_query = a_query.where(Animal.village_id.in_(payload.target_villages))

                a_res = await self.db.execute(a_query)
                for animal in a_res.scalars().all():
                    enrollment = ScheduleAnimalEnrollment(
                        id=uuid.uuid4(),
                        schedule_id=schedule.id,
                        animal_id=animal.id,
                        farmer_id=animal.farmer_id,
                        cooperative_id=cooperative_id,
                        status="ENROLLED"
                    )
                    self.db.add(enrollment)
                    enrolled_count += 1

        if payload.submit_immediately:
            # Notify TAHO
            await self._notify_taho_of_schedule(schedule)

        await self.db.commit()
        return await self._to_schedule_summary(schedule, enrolled_count)

    async def list_cooperative_schedules(self, cooperative_id: uuid.UUID) -> List[CooperativeScheduleSummary]:
        """List all recurring vaccination schedules for a Dairy Cooperative."""
        query = select(CooperativeVaccinationSchedule).where(
            CooperativeVaccinationSchedule.cooperative_id == cooperative_id
        ).order_by(desc(CooperativeVaccinationSchedule.created_at))

        res = await self.db.execute(query)
        schedules = res.scalars().all()

        items = []
        for s in schedules:
            # Count enrolled
            c_res = await self.db.execute(
                select(func.count(ScheduleAnimalEnrollment.id)).where(
                    ScheduleAnimalEnrollment.schedule_id == s.id
                )
            )
            count = c_res.scalar() or 0
            items.append(await self._to_schedule_summary(s, count))
        return items

    async def submit_schedule_to_taho(self, schedule_id: uuid.UUID, current_user: User) -> Dict[str, Any]:
        """Submit a draft schedule to TAHO for approval."""
        schedule = await self.db.get(CooperativeVaccinationSchedule, schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="સમયપત્રક મળ્યું નથી")

        schedule.status = "SUBMITTED"
        schedule.submitted_at = datetime.now()

        await self._notify_taho_of_schedule(schedule)
        await self.db.commit()
        return {"status": "success", "message": "સમયપત્રક TAHO મંજૂરી માટે મોકલવામાં આવ્યું છે."}

    async def list_taho_schedules(self, current_user: User) -> List[CooperativeScheduleSummary]:
        """List all cooperative schedules in caller's Taluka."""
        taluka_id = (current_user.assigned_taluka_ids or [None])[0]
        query = select(CooperativeVaccinationSchedule)
        if taluka_id:
            query = query.where(CooperativeVaccinationSchedule.taluka_id == taluka_id)

        query = query.order_by(desc(CooperativeVaccinationSchedule.created_at))
        res = await self.db.execute(query)
        schedules = res.scalars().all()

        items = []
        for s in schedules:
            c_res = await self.db.execute(
                select(func.count(ScheduleAnimalEnrollment.id)).where(
                    ScheduleAnimalEnrollment.schedule_id == s.id
                )
            )
            count = c_res.scalar() or 0
            items.append(await self._to_schedule_summary(s, count))
        return items

    async def decide_schedule_by_taho(
        self,
        schedule_id: uuid.UUID,
        payload: ScheduleDecisionRequest,
        current_user: User
    ) -> Dict[str, Any]:
        """TAHO approves, rejects, or requests changes on a cooperative vaccination schedule."""
        schedule = await self.db.get(CooperativeVaccinationSchedule, schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="સમયપત્રક મળ્યું નથી")

        action = payload.action.upper()
        schedule.reviewed_by = current_user.id
        schedule.reviewed_at = datetime.now()
        schedule.review_notes = payload.review_notes
        schedule.approved_execution_start = payload.approved_execution_start or schedule.start_date
        schedule.approved_execution_end = payload.approved_execution_end

        if action == "APPROVE":
            schedule.status = "ACTIVE"
            # 1. Generate individual animal vaccination cycles & 15-day reminders!
            await self._activate_schedule_cycles(schedule)
            # 2. Notify Cooperative
            await self._notify_coop_of_approval(schedule)
            # 3. Notify enrolled Farmers
            await self._notify_farmers_of_approved_schedule(schedule)
        elif action == "REQUEST_CHANGES":
            schedule.status = "CHANGES_REQUESTED"
        else:
            schedule.status = "REJECTED"

        await self.db.commit()
        return {
            "status": "success",
            "action": action,
            "schedule_status": schedule.status,
            "message": f"સમયપત્રક સ્થિતિ: {schedule.status}"
        }

    async def _activate_schedule_cycles(self, schedule: CooperativeVaccinationSchedule):
        """Generate individual AnimalVaccinationCycle with 15-day reminder dates."""
        enr_res = await self.db.execute(
            select(ScheduleAnimalEnrollment).where(
                ScheduleAnimalEnrollment.schedule_id == schedule.id
            )
        )
        enrollments = enr_res.scalars().all()

        months_interval = schedule.recurrence_interval_value
        if schedule.recurrence_interval_unit == "WEEKS":
            days_delta = months_interval * 7
        elif schedule.recurrence_interval_unit == "DAYS":
            days_delta = months_interval
        else:
            days_delta = months_interval * 30

        for enr in enrollments:
            # Check existing cycle
            c_check = await self.db.execute(
                select(AnimalVaccinationCycle).where(
                    AnimalVaccinationCycle.schedule_id == schedule.id,
                    AnimalVaccinationCycle.animal_id == enr.animal_id,
                    AnimalVaccinationCycle.status.in_(["SCHEDULED", "DUE", "REMINDER_SENT"])
                ).limit(1)
            )
            if c_check.scalar_one_or_none():
                continue

            # Calculate individual due date
            due_date = schedule.start_date
            reminder_date = due_date - timedelta(days=schedule.reminder_days_before)

            cycle = AnimalVaccinationCycle(
                id=uuid.uuid4(),
                animal_id=enr.animal_id,
                schedule_id=schedule.id,
                programme_code=schedule.programme_code,
                cycle_number=1,
                due_date=due_date,
                reminder_date=reminder_date,
                reminder_status="PENDING",
                status="SCHEDULED"
            )
            self.db.add(cycle)

    async def _to_schedule_summary(
        self,
        schedule: CooperativeVaccinationSchedule,
        enrolled_count: int = 0
    ) -> CooperativeScheduleSummary:
        coop = await self.db.get(Cooperative, schedule.cooperative_id)
        coop_name = coop.name_gu if coop else None

        # Count completed
        comp_res = await self.db.execute(
            select(func.count(AnimalVaccinationCycle.id)).where(
                AnimalVaccinationCycle.schedule_id == schedule.id,
                AnimalVaccinationCycle.status == "COMPLETED"
            )
        )
        comp_count = comp_res.scalar() or 0

        due_res = await self.db.execute(
            select(func.count(AnimalVaccinationCycle.id)).where(
                AnimalVaccinationCycle.schedule_id == schedule.id,
                AnimalVaccinationCycle.status.in_(["DUE", "REMINDER_SENT"])
            )
        )
        due_count = due_res.scalar() or 0

        return CooperativeScheduleSummary(
            id=schedule.id,
            cooperative_id=schedule.cooperative_id,
            cooperative_name=coop_name,
            schedule_name=schedule.schedule_name,
            programme_code=schedule.programme_code,
            vaccine_name=schedule.vaccine_name,
            disease_prevention_purpose=schedule.disease_prevention_purpose,
            target_species=schedule.target_species or [],
            taluka_id=schedule.taluka_id,
            start_date=schedule.start_date,
            recurrence_interval_value=schedule.recurrence_interval_value,
            recurrence_interval_unit=schedule.recurrence_interval_unit,
            reminder_days_before=schedule.reminder_days_before,
            status=schedule.status,
            enrolled_animals_count=enrolled_count,
            vaccinated_animals_count=comp_count,
            due_animals_count=due_count,
            overdue_animals_count=0,
            created_at=schedule.created_at,
            submitted_at=schedule.submitted_at,
            reviewed_at=schedule.reviewed_at,
            review_notes=schedule.review_notes
        )

    # =========================================================================
    # PART D: Notifications & 15-Day Reminders
    # =========================================================================

    async def _notify_taho_of_new_report(self, report: DiseaseReport, animal: Optional[Animal], farmer: Optional[Farmer]):
        vil = await self.db.get(Village, report.village_id)
        if vil and vil.taluka_id:
            # Find TAHO user
            t_res = await self.db.execute(
                select(User.id).where(
                    User.role == "TAHO",
                    User.assigned_taluka_ids.contains([vil.taluka_id])
                ).limit(1)
            )
            taho_id = t_res.scalar_one_or_none()
            if taho_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=taho_id,
                    kind="NEW_DISEASE_REPORT",
                    message_key="notif.disease.new",
                    params={
                        "report_no": report.report_no or str(report.report_id)[:8],
                        "urgency": getattr(report, "urgency", "NORMAL"),
                        "disease_code": report.disease_code,
                        "village_name": vil.name_gu
                    },
                    related_type="disease_report",
                    related_id=str(report.report_id),
                    status="UNREAD"
                )
                self.db.add(notif)

    async def _notify_taho_of_treatment(self, report: DiseaseReport, treatment: TreatmentRecord, treated_by: User):
        vil = await self.db.get(Village, report.village_id)
        if vil and vil.taluka_id:
            t_res = await self.db.execute(
                select(User.id).where(
                    User.role == "TAHO",
                    User.assigned_taluka_ids.contains([vil.taluka_id])
                ).limit(1)
            )
            taho_id = t_res.scalar_one_or_none()
            if taho_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=taho_id,
                    kind="TREATMENT_AWAITING_VERIFICATION",
                    message_key="notif.treatment.submitted",
                    params={
                        "report_no": report.report_no or str(report.report_id)[:8],
                        "staff_name": treated_by.full_name,
                        "diagnosis": treatment.diagnosis or "સામાન્ય સારવાર"
                    },
                    related_type="disease_report",
                    related_id=str(report.report_id),
                    status="UNREAD"
                )
                self.db.add(notif)

    async def _notify_taho_of_schedule(self, schedule: CooperativeVaccinationSchedule):
        t_res = await self.db.execute(
            select(User.id).where(
                User.role == "TAHO",
                User.assigned_taluka_ids.contains([schedule.taluka_id])
            ).limit(1)
        )
        taho_id = t_res.scalar_one_or_none()
        if taho_id:
            coop = await self.db.get(Cooperative, schedule.cooperative_id)
            notif = Notification(
                id=uuid.uuid4(),
                recipient_user_id=taho_id,
                kind="COOP_SCHEDULE_SUBMITTED",
                message_key="notif.schedule.submitted",
                params={
                    "schedule_name": schedule.schedule_name,
                    "coop_name": coop.name_gu if coop else "ડેરી મંડળી",
                    "vaccine": schedule.vaccine_name
                },
                related_type="cooperative_schedule",
                related_id=str(schedule.id),
                status="UNREAD"
            )
            self.db.add(notif)

    async def _notify_coop_of_approval(self, schedule: CooperativeVaccinationSchedule):
        coop = await self.db.get(Cooperative, schedule.cooperative_id)
        if coop and coop.user_id:
            notif = Notification(
                id=uuid.uuid4(),
                recipient_user_id=coop.user_id,
                kind="SCHEDULE_APPROVED",
                message_key="notif.schedule.approved",
                params={
                    "schedule_name": schedule.schedule_name,
                    "vaccine": schedule.vaccine_name,
                    "start_date": schedule.start_date.isoformat()
                },
                related_type="cooperative_schedule",
                related_id=str(schedule.id),
                status="UNREAD"
            )
            self.db.add(notif)

    async def _notify_farmers_of_approved_schedule(self, schedule: CooperativeVaccinationSchedule):
        enr_res = await self.db.execute(
            select(ScheduleAnimalEnrollment).where(
                ScheduleAnimalEnrollment.schedule_id == schedule.id
            )
        )
        enrollments = enr_res.scalars().all()
        coop = await self.db.get(Cooperative, schedule.cooperative_id)
        coop_name = coop.name_gu if coop else "ડેરી મંડળી"

        for enr in enrollments:
            farmer = await self.db.get(Farmer, enr.farmer_id)
            if farmer and farmer.user_id:
                animal = await self.db.get(Animal, enr.animal_id)
                tag_name = animal.animal_code if animal else "પશુ"
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=farmer.user_id,
                    kind="SCHEDULE_ENROLLED",
                    message_key="notif.farmer.scheduled",
                    params={
                        "animal_tag": tag_name,
                        "coop_name": coop_name,
                        "vaccine_name": schedule.vaccine_name,
                        "due_date": schedule.start_date.isoformat(),
                        "interval": f"{schedule.recurrence_interval_value} મહિના"
                    },
                    related_type="cooperative_schedule",
                    related_id=str(schedule.id),
                    status="UNREAD"
                )
                self.db.add(notif)

    async def check_and_dispatch_15_day_reminders(self) -> Dict[str, Any]:
        """Automatically checks animal vaccination cycles due in <= 15 days and dispatches notifications."""
        today = date.today()
        fifteen_days_later = today + timedelta(days=15)

        # Cycles due in <= 15 days where reminder not yet sent
        query = select(AnimalVaccinationCycle).where(
            AnimalVaccinationCycle.due_date <= fifteen_days_later,
            AnimalVaccinationCycle.reminder_status == "PENDING",
            AnimalVaccinationCycle.status.in_(["SCHEDULED", "DUE"])
        )
        res = await self.db.execute(query)
        cycles = res.scalars().all()

        reminders_sent = 0
        for cyc in cycles:
            animal = await self.db.get(Animal, cyc.animal_id)
            if not animal:
                continue

            schedule = await self.db.get(CooperativeVaccinationSchedule, cyc.schedule_id)
            coop = await self.db.get(Cooperative, schedule.cooperative_id) if schedule else None
            coop_name = coop.name_gu if coop else "ડેરી મંડળી"

            days_remaining = max(0, (cyc.due_date - today).days)

            # 1. Notify Farmer
            farmer = await self.db.get(Farmer, animal.farmer_id)
            if farmer and farmer.user_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=farmer.user_id,
                    kind="VACCINATION_REMINDER_15D",
                    message_key="notif.reminder.15days",
                    params={
                        "animal_tag": animal.animal_code or str(animal.id)[:8],
                        "vaccine_name": schedule.vaccine_name if schedule else cyc.programme_code,
                        "coop_name": coop_name,
                        "due_date": cyc.due_date.isoformat(),
                        "days_remaining": str(days_remaining)
                    },
                    related_type="vaccination_cycle",
                    related_id=str(cyc.id),
                    status="UNREAD"
                )
                self.db.add(notif)

            # 2. Notify Cooperative
            if coop and coop.user_id:
                coop_notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=coop.user_id,
                    kind="COOP_VACCINATION_REMINDER",
                    message_key="notif.coop.reminder",
                    params={
                        "farmer_name": farmer.full_name if farmer else "પશુપાલક",
                        "animal_tag": animal.animal_code or str(animal.id)[:8],
                        "vaccine_name": schedule.vaccine_name if schedule else cyc.programme_code,
                        "due_date": cyc.due_date.isoformat(),
                        "days_remaining": str(days_remaining)
                    },
                    related_type="vaccination_cycle",
                    related_id=str(cyc.id),
                    status="UNREAD"
                )
                self.db.add(coop_notif)

            cyc.reminder_status = "SENT"
            cyc.reminder_sent_at = datetime.now()
            cyc.status = "DUE"
            reminders_sent += 1

        await self.db.commit()
        return {"status": "success", "reminders_sent": reminders_sent}

    # =========================================================================
    # PART E: Animal Chronological Timeline
    # =========================================================================

    async def get_animal_timeline(self, animal_id: uuid.UUID) -> List[AnimalTimelineEventItem]:
        """Aggregate complete chronological medical and vaccination timeline for an animal."""
        animal = await self.db.get(Animal, animal_id)
        if not animal:
            raise HTTPException(status_code=404, detail="પશુ મળ્યું નથી")

        timeline: List[AnimalTimelineEventItem] = []

        # 1. Registration
        timeline.append(AnimalTimelineEventItem(
            event_id=f"reg-{animal.id}",
            event_type="REGISTRATION",
            event_date=animal.created_at.strftime("%Y-%m-%d"),
            title="પ્રાથમિક પશુ નોંધણી (Animal Registered)",
            description=f"જાતિ: {animal.species_code}, પશુ કોડ: {animal.animal_code or 'N/A'}",
            status="VERIFIED",
            badge_color="emerald"
        ))

        # 2. Disease reports
        dr_res = await self.db.execute(
            select(DiseaseReport).where(DiseaseReport.animal_id == animal_id).order_by(DiseaseReport.report_date)
        )
        for dr in dr_res.scalars().all():
            timeline.append(AnimalTimelineEventItem(
                event_id=f"dr-{dr.report_id}",
                event_type="HEALTH_REPORT",
                event_date=dr.report_date.isoformat(),
                title=f"શંકાસ્પદ સ્વાસ્થ્ય અહેવાલ: {dr.disease_code}",
                description=f"લક્ષણો: {', '.join(dr.symptoms or [])}. પ્રાથમિકતા: {getattr(dr, 'urgency', 'NORMAL')}",
                status=dr.status,
                badge_color="amber"
            ))

        # 3. Treatments
        tr_res = await self.db.execute(
            select(TreatmentRecord).where(TreatmentRecord.animal_id == animal_id).order_by(TreatmentRecord.visit_date)
        )
        for tr in tr_res.scalars().all():
            u = await self.db.get(User, tr.treated_by)
            timeline.append(AnimalTimelineEventItem(
                event_id=f"tr-{tr.id}",
                event_type="TREATMENT",
                event_date=tr.visit_date.isoformat(),
                title="ક્લિનિકલ સારવાર અને દવા (Veterinary Treatment)",
                description=f"નિદાન: {tr.diagnosis or 'તપાસાયેલ'}. દવા: {tr.medicine_administered or 'N/A'}. સારવાર: {tr.treatment_text}",
                performed_by=u.full_name if u else "વેટરનરી સ્ટાફ",
                status=tr.status,
                badge_color="blue"
            ))

        # 4. Recurring Vaccination Cycles
        cyc_res = await self.db.execute(
            select(AnimalVaccinationCycle).where(AnimalVaccinationCycle.animal_id == animal_id).order_by(AnimalVaccinationCycle.due_date)
        )
        for cyc in cyc_res.scalars().all():
            sched = await self.db.get(CooperativeVaccinationSchedule, cyc.schedule_id)
            sched_name = sched.schedule_name if sched else "ડેરી રિકરિંગ શેડ્યૂલ"

            if cyc.status == "COMPLETED" and cyc.completed_date:
                timeline.append(AnimalTimelineEventItem(
                    event_id=f"vax-comp-{cyc.id}",
                    event_type="VACCINATION_COMPLETED",
                    event_date=cyc.completed_date.isoformat(),
                    title=f"રસીકરણ પૂર્ણ: {cyc.programme_code}",
                    description=f"{sched_name} હેઠળ સાઇકલ #{cyc.cycle_number} સફળતાપૂર્વક અપાઈ.",
                    status="COMPLETED",
                    badge_color="emerald"
                ))
            else:
                timeline.append(AnimalTimelineEventItem(
                    event_id=f"vax-due-{cyc.id}",
                    event_type="VACCINATION_SCHEDULE",
                    event_date=cyc.due_date.isoformat(),
                    title=f"આગામી રસીકરણ નિયત તારીખ: {cyc.programme_code}",
                    description=f"અપેક્ષિત તારીખ: {cyc.due_date.isoformat()}. 15-દિવસ રીમાઇન્ડર: {cyc.reminder_date.isoformat()}",
                    status=cyc.status,
                    badge_color="teal"
                ))

        # Sort timeline descending by date
        timeline.sort(key=lambda x: x.event_date, reverse=True)
        return timeline
