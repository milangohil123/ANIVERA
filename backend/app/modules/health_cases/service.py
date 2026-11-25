"""Comprehensive business logic service for:
1. Farmer Disease Reporting, TAHO Case Assignment, VO/FW Treatment, and TAHO Verification
2. Dairy Cooperative Recurring Vaccination Schedules, Animal Enrollment, 15-Day Reminders,
   and Animal Chronological Timeline
"""
import base64
from datetime import date, datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Set
import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_disease_attachment_storage

from app.models.geography import Taluka, Village
from app.modules.administration.models import Cooperative
from app.modules.animals.models import Animal, AnimalExternalIdentifier
from app.modules.authentication.models import AuditEvent, User, TahoTalukaAssignment, UserVillageAssignment
from app.modules.authorization.models import CooperativeMembership, FarmerUserLink
from app.modules.disease_surveillance.models import (
    DiseaseReport,
    DiseaseReportAttachment,
    DiseaseReportStatusHistory,
    DiseaseReview,
)
from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
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
    DiseaseClusterAlert,
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
                    AnimalExternalIdentifier.id_value == payload.animal_tag_id.strip(),
                    AnimalExternalIdentifier.status == "ACTIVE"
                )
            )
            ext_id = tag_res.scalar_one_or_none()
            if ext_id:
                animal = await self.db.get(Animal, ext_id.animal_id)

        # 2. Resolve farmer
        farmer: Optional[Farmer] = None
        if current_user.role == "FARMER":
            # Lookup linked farmer record via FarmerUserLink, FarmerAccountProvisioning, or mobile
            link_stmt = select(FarmerUserLink.farmer_id).where(FarmerUserLink.user_id == current_user.id)
            linked_fid = (await self.db.execute(link_stmt)).scalar_one_or_none()
            if not linked_fid:
                prov_stmt = select(FarmerAccountProvisioning.farmer_id).where(FarmerAccountProvisioning.user_id == current_user.id)
                linked_fid = (await self.db.execute(prov_stmt)).scalar_one_or_none()
            if linked_fid:
                farmer = await self.db.get(Farmer, linked_fid)
            elif current_user.mobile_e164:
                m_stmt = select(Farmer).where(Farmer.mobile_e164 == current_user.mobile_e164)
                farmer = (await self.db.execute(m_stmt)).scalars().first()

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

        lat = payload.latitude if (payload.latitude is not None and payload.longitude is not None) else None
        lng = payload.longitude if (payload.latitude is not None and payload.longitude is not None) else None

        # 5. Create DiseaseReport
        report = DiseaseReport(
            report_id=uuid.uuid4(),
            report_no=report_no,
            animal_id=animal.id if animal else None,
            farmer_id=farmer.id if farmer else None,
            village_id=village_id,
            disease_code=disease_code,
            report_source="FARMER_APP",
            report_date=payload.symptom_onset_date or date.today(),
            symptoms=payload.symptoms or [],
            observation_text=payload.description or "",
            latitude=lat,
            longitude=lng,
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
        storage = get_disease_attachment_storage()
        for url in (payload.photo_urls or []):
            if not url or not url.strip():
                continue
            clean_url = url.strip()
            mime = "image/jpeg"
            file_path = clean_url
            size_bytes = 0
            if clean_url.startswith("data:") and "," in clean_url:
                try:
                    header, b64content = clean_url.split(",", 1)
                    if "image/png" in header:
                        mime = "image/png"
                    elif "image/webp" in header:
                        mime = "image/webp"
                    raw_data = base64.b64decode(b64content)
                    size_bytes = len(raw_data)
                    file_path = await storage.save(raw_data, mime_type=mime, subfolder="reports")
                except Exception as img_err:
                    logger.warning("Error saving base64 report photo to storage: %s", img_err)
                    file_path = clean_url
                    size_bytes = len(clean_url)
            else:
                size_bytes = len(clean_url)

            att = DiseaseReportAttachment(
                id=uuid.uuid4(),
                report_id=report.report_id,
                file_path=file_path,
                sha256="manual_upload",
                mime_type=mime,
                size_bytes=size_bytes,
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
        fids = []
        link_stmt = select(FarmerUserLink.farmer_id).where(FarmerUserLink.user_id == current_user.id)
        fids.extend((await self.db.execute(link_stmt)).scalars().all())
        prov_stmt = select(FarmerAccountProvisioning.farmer_id).where(FarmerAccountProvisioning.user_id == current_user.id)
        fids.extend((await self.db.execute(prov_stmt)).scalars().all())
        if current_user.mobile_e164:
            m_stmt = select(Farmer.id).where(Farmer.mobile_e164 == current_user.mobile_e164)
            fids.extend((await self.db.execute(m_stmt)).scalars().all())
        farmer_ids = list(set([fid for fid in fids if fid is not None]))

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

    async def _get_user_id_for_farmer(self, farmer_id: Optional[uuid.UUID]) -> Optional[uuid.UUID]:
        """Resolves the user account ID associated with a farmer profile."""
        if not farmer_id:
            return None
        # 1. Check FarmerUserLink
        link_stmt = select(FarmerUserLink.user_id).where(FarmerUserLink.farmer_id == farmer_id)
        uid = (await self.db.execute(link_stmt)).scalar_one_or_none()
        if uid:
            return uid
        # 2. Check FarmerAccountProvisioning
        prov_stmt = select(FarmerAccountProvisioning.user_id).where(FarmerAccountProvisioning.farmer_id == farmer_id)
        uid = (await self.db.execute(prov_stmt)).scalar_one_or_none()
        if uid:
            return uid
        # 3. Match user by mobile_e164
        farmer = await self.db.get(Farmer, farmer_id)
        if farmer and farmer.mobile_e164:
            user_stmt = select(User.id).where(User.mobile_e164 == farmer.mobile_e164)
            uid = (await self.db.execute(user_stmt)).scalars().first()
            if uid:
                return uid
        return None

    async def _to_farmer_report_item(self, report: DiseaseReport) -> FarmerDiseaseReportItem:
        animal_name = None
        animal_code = None
        animal_tag = None
        species_code = None
        farmer_name = None
        farmer_mobile = None
        farmer_address = None

        if report.animal_id:
            animal = await self.db.get(Animal, report.animal_id)
            if animal:
                animal_code = animal.animal_code
                animal_name = getattr(animal, "name", None) or f"{animal.species_code} ({animal.animal_code or 'ID'})"
                species_code = animal.species_code
                tag_res = await self.db.execute(
                    select(AnimalExternalIdentifier.id_value).where(
                        AnimalExternalIdentifier.animal_id == animal.id,
                        AnimalExternalIdentifier.status == "ACTIVE"
                    ).limit(1)
                )
                animal_tag = tag_res.scalar_one_or_none() or animal.animal_code

        if report.farmer_id:
            farmer = await self.db.get(Farmer, report.farmer_id)
            if farmer:
                farmer_name = farmer.full_name
                farmer_mobile = farmer.mobile_e164
                farmer_address = farmer.address_text

        vil = await self.db.get(Village, report.village_id)
        village_name_gu = vil.name_gu if vil else None
        village_name_en = vil.name_en if vil else None

        # Fetch attachments
        att_res = await self.db.execute(
            select(DiseaseReportAttachment.file_path).where(DiseaseReportAttachment.report_id == report.report_id)
        )
        raw_photos = list(att_res.scalars().all())
        photo_urls = []
        for p in raw_photos:
            if not p:
                continue
            if p.startswith("http") or p.startswith("data:"):
                photo_urls.append(p)
            else:
                photo_urls.append(f"/storage/attachments/{p.lstrip('/')}")

        # Assigned VO resolution
        vo_id = report.assigned_vo_id
        if not vo_id:
            assign_stmt = select(HealthCaseAssignment.assigned_vo_id).where(
                HealthCaseAssignment.report_id == report.report_id
            ).order_by(desc(HealthCaseAssignment.assigned_at)).limit(1)
            vo_id = (await self.db.execute(assign_stmt)).scalar_one_or_none()

        vo_name = None
        if vo_id:
            vo_u = await self.db.get(User, vo_id)
            if vo_u:
                vo_name = vo_u.full_name

        # 24-hour Assignment Deadline and Overdue calculation
        now = datetime.now(timezone.utc)
        rec_at = report.received_at
        if rec_at and rec_at.tzinfo is None:
            rec_at = rec_at.replace(tzinfo=timezone.utc)

        deadline = (rec_at + timedelta(hours=24)) if rec_at else None
        is_overdue = False
        hours_remaining = None

        t_status = report.treatment_status or "SUBMITTED"
        if not vo_id and t_status in ("SUBMITTED", "PENDING_VO_ASSIGNMENT"):
            display_status = "PENDING_VO_ASSIGNMENT"
            if deadline:
                sec_left = (deadline - now).total_seconds()
                hours_remaining = max(0.0, round(sec_left / 3600.0, 1))
                if sec_left <= 0:
                    is_overdue = True
        else:
            display_status = t_status

        # Check escalation history
        esc_stmt = select(DiseaseReportStatusHistory.id).where(
            DiseaseReportStatusHistory.report_id == report.report_id,
            DiseaseReportStatusHistory.to_status == "ESCALATED_TO_DAHO"
        ).limit(1)
        is_escalated = bool((await self.db.execute(esc_stmt)).scalar_one_or_none())

        # Check treatment record
        treatment_record_data = None
        t_stmt = select(TreatmentRecord).where(TreatmentRecord.report_id == report.report_id).order_by(desc(TreatmentRecord.created_at)).limit(1)
        t_row = (await self.db.execute(t_stmt)).scalar_one_or_none()
        if t_row:
            t_att_stmt = select(TreatmentAttachment.file_path).where(TreatmentAttachment.treatment_id == t_row.id)
            raw_t_atts = list((await self.db.execute(t_att_stmt)).scalars().all())
            t_atts = []
            for p in raw_t_atts:
                if not p:
                    continue
                if p.startswith("http") or p.startswith("data:"):
                    t_atts.append(p)
                else:
                    t_atts.append(f"/storage/attachments/{p.lstrip('/')}")
            treated_by_user = await self.db.get(User, t_row.treated_by)
            treatment_record_data = {
                "id": str(t_row.id),
                "visit_date": str(t_row.visit_date),
                "visit_time": t_row.visit_time,
                "observations": t_row.observations,
                "diagnosis": t_row.diagnosis,
                "treatment_text": t_row.treatment_text,
                "medicine_administered": t_row.medicine_administered,
                "dosage_details": t_row.dosage_details,
                "treatment_notes": t_row.treatment_notes,
                "follow_up_instructions": t_row.follow_up_instructions,
                "next_visit_date": str(t_row.next_visit_date) if t_row.next_visit_date else None,
                "treated_by_name": treated_by_user.full_name if treated_by_user else (vo_name or "વેટરનરી અધિકારી"),
                "evidence_photos": t_atts,
                "status": t_row.status
            }

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
            farmer_mobile=farmer_mobile,
            farmer_address=farmer_address,
            village_id=report.village_id,
            village_name_gu=village_name_gu,
            village_name_en=village_name_en,
            disease_code=report.disease_code,
            is_unknown_disease=bool(getattr(report, "is_unknown_disease", False)),
            custom_disease_name=getattr(report, "custom_disease_name", None),
            symptoms=report.symptoms or [],
            observation_text=report.observation_text,
            urgency=getattr(report, "urgency", "NORMAL") or "NORMAL",
            treatment_status=display_status,
            report_date=report.report_date,
            received_at=report.received_at,
            assigned_vo_id=vo_id,
            assigned_vo_name=vo_name,
            assigned_fw_name=None,
            assigned_to_role="VO",
            assignment_deadline=deadline,
            hours_remaining_for_assignment=hours_remaining,
            is_assignment_overdue=is_overdue,
            is_escalated_to_daho=is_escalated,
            latitude=report.latitude,
            longitude=report.longitude,
            attachment_count=len(photo_urls),
            photo_urls=photo_urls,
            treatment_record=treatment_record_data
        )

    # =========================================================================
    # PART B: TAHO / DAHO Case Assignment, VO Treatment & Outbreak Clusters
    # =========================================================================

    async def check_and_escalate_overdue_cases(self, taluka_id: Optional[uuid.UUID] = None) -> int:
        """Finds cases unassigned after 24 hours of submission and escalates them to DAHO."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        stmt = (
            select(DiseaseReport)
            .where(
                DiseaseReport.assigned_vo_id.is_(None),
                DiseaseReport.received_at <= cutoff,
                or_(
                    DiseaseReport.treatment_status.in_(["SUBMITTED", "PENDING_VO_ASSIGNMENT"]),
                    DiseaseReport.treatment_status.is_(None)
                )
            )
        )
        if taluka_id:
            stmt = stmt.join(Village, DiseaseReport.village_id == Village.id).where(Village.taluka_id == taluka_id)

        overdue_reports = (await self.db.execute(stmt)).scalars().all()
        escalated_count = 0

        # Find DAHO user(s)
        daho_stmt = select(User.id).where(User.role.in_(["DAHO", "SYS_ADMIN"]), User.status == "ACTIVE")
        daho_ids = (await self.db.execute(daho_stmt)).scalars().all()

        for report in overdue_reports:
            # Check if already escalated
            chk_stmt = select(DiseaseReportStatusHistory.id).where(
                DiseaseReportStatusHistory.report_id == report.report_id,
                DiseaseReportStatusHistory.to_status == "ESCALATED_TO_DAHO"
            ).limit(1)
            if (await self.db.execute(chk_stmt)).scalar_one_or_none():
                continue

            # Record escalation history
            hist = DiseaseReportStatusHistory(
                id=uuid.uuid4(),
                report_id=report.report_id,
                from_status="PENDING_VO_ASSIGNMENT",
                to_status="ESCALATED_TO_DAHO",
                reason="24 કલાકમાં VO સોંપણી ન થતાં કેસ DAHO ને ઓટો-એસ્કેલેટ કરવામાં આવ્યો છે.",
                changed_by=daho_ids[0] if daho_ids else report.reported_by
            )
            self.db.add(hist)

            vil = await self.db.get(Village, report.village_id)
            v_name = (vil.name_gu or vil.name_en) if vil else "ગામ"

            for d_id in daho_ids:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=d_id,
                    kind="CASE_ASSIGNMENT_ESCALATION",
                    message_key="notif.case.escalated_to_daho",
                    params={
                        "title": "૨૪-કલાક VO સોંપણી મુદત ઓળંગી (Overdue Case Escalation)",
                        "report_no": report.report_no or str(report.report_id)[:8],
                        "disease_code": report.disease_code,
                        "village_name": v_name,
                        "report_date": str(report.report_date),
                        "urgency": getattr(report, "urgency", "NORMAL"),
                        "message": f"ગામ {v_name} નો રોગ કેસ #{report.report_no or str(report.report_id)[:8]} ૨૪ કલાકથી VO સોંપણી વગર બાકી છે. કૃપા કરીને તાત્કાલિક VO સોંપણી કરો."
                    },
                    related_type="disease_report",
                    related_id=str(report.report_id),
                    status="UNREAD"
                )
                self.db.add(notif)

            escalated_count += 1

        if escalated_count > 0:
            await self.db.commit()

        return escalated_count

    async def list_taho_cases(
        self,
        current_user: User,
        village_id: Optional[uuid.UUID] = None,
        disease_code: Optional[str] = None,
        urgency: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100
    ) -> List[FarmerDiseaseReportItem]:
        """List disease reports within TAHO's authorized Taluka, checking 24h assignment deadlines."""
        # Check and escalate any overdue cases
        taluka_res = await self.db.execute(
            select(TahoTalukaAssignment.taluka_id).where(TahoTalukaAssignment.taho_user_id == current_user.id)
        )
        assigned_taluka_ids = list(taluka_res.scalars().all())
        target_taluka_id = assigned_taluka_ids[0] if assigned_taluka_ids else None
        await self.check_and_escalate_overdue_cases(taluka_id=target_taluka_id)

        vil_query = select(Village.id)
        if assigned_taluka_ids:
            vil_query = vil_query.where(Village.taluka_id.in_(assigned_taluka_ids))
        vil_res = await self.db.execute(vil_query)
        taluka_village_ids = vil_res.scalars().all()

        query = select(DiseaseReport)
        if taluka_village_ids:
            query = query.where(DiseaseReport.village_id.in_(taluka_village_ids))

        if village_id:
            query = query.where(DiseaseReport.village_id == village_id)
        if disease_code:
            query = query.where(DiseaseReport.disease_code == disease_code)
        if urgency:
            query = query.where(DiseaseReport.urgency == urgency)
        if status_filter:
            if status_filter == "PENDING_VO_ASSIGNMENT":
                query = query.where(
                    DiseaseReport.assigned_vo_id.is_(None),
                    or_(
                        DiseaseReport.treatment_status == "SUBMITTED",
                        DiseaseReport.treatment_status == "PENDING_VO_ASSIGNMENT",
                        DiseaseReport.treatment_status.is_(None)
                    )
                )
            else:
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

    async def list_daho_cases(
        self,
        current_user: User,
        taluka_id: Optional[uuid.UUID] = None,
        disease_code: Optional[str] = None,
        is_overdue_only: bool = False,
        limit: int = 100
    ) -> List[FarmerDiseaseReportItem]:
        """List disease cases in DAHO district with overdue and escalation indicators."""
        await self.check_and_escalate_overdue_cases(taluka_id=taluka_id)

        query = select(DiseaseReport).join(Village, DiseaseReport.village_id == Village.id)
        if taluka_id:
            query = query.where(Village.taluka_id == taluka_id)
        if disease_code:
            query = query.where(DiseaseReport.disease_code == disease_code)

        if is_overdue_only:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            query = query.where(
                DiseaseReport.assigned_vo_id.is_(None),
                DiseaseReport.received_at <= cutoff
            )

        query = query.order_by(desc(DiseaseReport.received_at)).limit(limit)
        res = await self.db.execute(query)
        reports = res.scalars().all()
        return [await self._to_farmer_report_item(r) for r in reports]

    async def assign_taho_case(
        self,
        report_id: uuid.UUID,
        payload: CaseAssignmentRequest,
        current_user: User
    ) -> Dict[str, Any]:
        """Assign reported case exclusively to an authorized Veterinary Officer (VO)."""
        if current_user.role not in ("TAHO", "DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
            raise HTTPException(status_code=403, detail="માત્ર TAHO અથવા DAHO અધિકારી કેસ સોંપણી કરી શકે છે.")

        report = await self.db.get(DiseaseReport, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="અહેવાલ મળ્યો નથી (Report not found)")

        # Validate VO user
        vo_user = await self.db.get(User, payload.assigned_vo_id)
        if not vo_user or vo_user.role not in ("VET_OFFICER", "VO") or (vo_user.status and vo_user.status.upper() != "ACTIVE"):
            raise HTTPException(
                status_code=400,
                detail="પસંદ કરેલ અધિકારી સક્રિય વેટરનરી ઓફિસર (VO) હોવા જોઈએ. ક્ષેત્રીય કાર્યકર (FW) ને કેસ સોંપણી માન્ય નથી."
            )

        assignment = HealthCaseAssignment(
            id=uuid.uuid4(),
            report_id=report_id,
            assigned_by=current_user.id,
            assigned_vo_id=payload.assigned_vo_id,
            assigned_fw_id=None,
            assigned_to_role="VO",
            priority=payload.priority,
            instructions=payload.instructions,
            planned_visit_date=payload.planned_visit_date or (date.today() + timedelta(days=1)),
            status="ASSIGNED"
        )
        self.db.add(assignment)

        # Update DiseaseReport
        report.treatment_status = "ASSIGNED"
        report.assigned_vo_id = payload.assigned_vo_id
        report.assigned_fw_id = None
        report.assigned_to_role = "VO"
        report.assignment_instructions = payload.instructions
        report.planned_visit_date = payload.planned_visit_date
        report.status = "UNDER_REVIEW"
        self.db.add(report)

        # Status History
        actor_name = current_user.full_name or current_user.username
        hist = DiseaseReportStatusHistory(
            id=uuid.uuid4(),
            report_id=report_id,
            from_status=report.treatment_status or "SUBMITTED",
            to_status="ASSIGNED",
            reason=f"{current_user.role} {actor_name} assigned case exclusively to VO {vo_user.full_name}. Priority: {payload.priority}",
            changed_by=current_user.id
        )
        self.db.add(hist)

        # Resolve detailed data for VO notification
        vil = await self.db.get(Village, report.village_id)
        v_name = (vil.name_gu or vil.name_en) if vil else "ગામ"
        farmer = await self.db.get(Farmer, report.farmer_id) if report.farmer_id else None
        animal = await self.db.get(Animal, report.animal_id) if report.animal_id else None
        tag_val = None
        if animal:
            tag_res = await self.db.execute(
                select(AnimalExternalIdentifier.id_value).where(
                    AnimalExternalIdentifier.animal_id == animal.id,
                    AnimalExternalIdentifier.status == "ACTIVE"
                ).limit(1)
            )
            tag_val = tag_res.scalar_one_or_none() or animal.animal_code

        # In-App Notification to assigned VO with full case and visit details
        notif = Notification(
            id=uuid.uuid4(),
            recipient_user_id=payload.assigned_vo_id,
            kind="NEW_DISEASE_INVESTIGATION_ASSIGNED",
            message_key="notif.case.assigned",
            params={
                "task_title": "નવી રોગ તપાસ સોંપાઈ (New Disease Investigation Assigned)",
                "report_no": report.report_no or str(report.report_id)[:8],
                "case_id": str(report.report_id),
                "disease_code": report.disease_code,
                "custom_disease_name": getattr(report, "custom_disease_name", None) or report.disease_code,
                "symptoms": report.symptoms or [],
                "report_date": str(report.report_date),
                "urgency": getattr(report, "urgency", "NORMAL"),
                "village_name": v_name,
                "farmer_name": farmer.full_name if farmer else "ખેડૂત",
                "farmer_mobile": farmer.mobile_e164 if farmer else None,
                "animal_code": animal.animal_code if animal else None,
                "animal_tag": tag_val,
                "species_code": animal.species_code if animal else None,
                "latitude": float(report.latitude) if report.latitude else None,
                "longitude": float(report.longitude) if report.longitude else None,
                "priority": payload.priority,
                "instructions": payload.instructions or "સ્થળ તપાસ, ક્લિનિકલ સારવાર અને ફોટો પુરાવા સાથે અહેવાલ સબમિટ કરો."
            },
            related_type="disease_report",
            related_id=str(report.report_id),
            status="UNREAD"
        )
        self.db.add(notif)

        await self.db.commit()
        return {
            "status": "success",
            "message": f"કેસ સફળતાપૂર્વક વેટરનરી અધિકારી {vo_user.full_name} ને સોંપવામાં આવ્યો છે.",
            "assignment_id": str(assignment.id),
            "report_id": str(report.report_id),
            "assigned_vo_name": vo_user.full_name
        }

    async def list_assigned_cases_for_staff(self, current_user: User) -> List[FarmerDiseaseReportItem]:
        """List cases assigned to current Veterinary Officer."""
        query = select(DiseaseReport).where(
            or_(
                DiseaseReport.assigned_vo_id == current_user.id,
                # Fallback for legacy FW cases
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
        """VO records clinical examination, medicines, mandatory photo evidence, and submits to TAHO."""
        report = await self.db.get(DiseaseReport, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="અહેવાલ મળ્યો નથી")

        # MANDATORY PHOTOGRAPHIC EVIDENCE CHECK (Requirement 4)
        evidence_photos = (
            (payload.evidence_photos or []) +
            (payload.before_treatment_photos or []) +
            (payload.after_treatment_photos or [])
        )
        if not evidence_photos:
            raise HTTPException(
                status_code=400,
                detail="સારવાર પૂર્ણ કરવા માટે વાસ્તવિક ફોટો પુરાવો (Photographic Evidence) અપલોડ કરવો ફરજિયાત છે."
            )

        animal_id = report.animal_id
        if not animal_id:
            a_res = await self.db.execute(select(Animal.id).where(Animal.village_id == report.village_id).limit(1))
            animal_id = a_res.scalar_one_or_none()

        if not animal_id:
            raise HTTPException(status_code=400, detail="પશુની માહિતી ઉપલબ્ધ નથી")

        try:
            # 1. Create Treatment record
            treatment = TreatmentRecord(
                id=uuid.uuid4(),
                report_id=report.report_id,
                animal_id=animal_id,
                treated_by=current_user.id,
                treated_by_role="VO",
                visit_date=date.today(),
                visit_time=datetime.now().strftime("%H:%M"),
                observations=payload.observations,
                diagnosis=payload.diagnosis or report.disease_code,
                treatment_text=payload.treatment_text,
                medicine_administered=payload.medicine_administered,
                dosage_details=payload.dosage_details,
                treatment_notes=payload.treatment_notes,
                follow_up_instructions=payload.follow_up_instructions,
                next_visit_date=payload.next_visit_date,
                latitude=payload.latitude or (float(report.latitude) if report.latitude else None),
                longitude=payload.longitude or (float(report.longitude) if report.longitude else None),
                status="AWAITING_VERIFICATION"
            )
            self.db.add(treatment)
            # CRITICAL: Flush TreatmentRecord FIRST so its primary key exists in PostgreSQL before child attachments
            await self.db.flush()

            # 2. Persist photographic evidence via storage driver and insert TreatmentAttachment records
            storage = get_disease_attachment_storage()
            seen_photos: Set[str] = set()

            for p in evidence_photos:
                if not p or not p.strip():
                    continue
                p_clean = p.strip()
                if p_clean in seen_photos:
                    continue
                seen_photos.add(p_clean)

                mime_type = "image/jpeg"
                file_path = p_clean
                size_bytes = 0

                # Check if payload is a base64 Data URL and persist to disk/storage
                if p_clean.startswith("data:") and "," in p_clean:
                    try:
                        header, b64content = p_clean.split(",", 1)
                        if "image/png" in header:
                            mime_type = "image/png"
                        elif "image/webp" in header:
                            mime_type = "image/webp"
                        raw_data = base64.b64decode(b64content)
                        size_bytes = len(raw_data)
                        rel_path = await storage.save(raw_data, mime_type=mime_type, subfolder="treatments")
                        file_path = rel_path
                    except Exception as img_err:
                        logger.warning("Error saving base64 treatment image to storage: %s", img_err)
                        file_path = p_clean
                        size_bytes = len(p_clean)
                else:
                    size_bytes = len(p_clean)

                att = TreatmentAttachment(
                    id=uuid.uuid4(),
                    treatment_id=treatment.id,
                    report_id=report.report_id,
                    attachment_type="TREATMENT_EVIDENCE",
                    file_path=file_path,
                    mime_type=mime_type,
                    size_bytes=size_bytes,
                    uploaded_by=current_user.id
                )
                self.db.add(att)

            # Flush attachments to ensure foreign key constraint satisfaction
            await self.db.flush()

            # 3. Update DiseaseReport status
            report.treatment_status = "TREATED_PENDING_VERIFICATION"
            self.db.add(report)

            # 4. Record timeline event in AnimalEvent with valid review_status='NONE'
            event = AnimalEvent(
                event_id=uuid.uuid4(),
                animal_id=animal_id,
                village_id=report.village_id,
                event_type="TREATMENT",
                event_date=date.today(),
                performed_by=current_user.id,
                remarks=f"નિદાન: {payload.diagnosis or report.disease_code} - સારવાર: {payload.treatment_text}",
                review_status="NONE"
            )
            self.db.add(event)

            # 5. Notify TAHO for verification
            await self._notify_taho_of_treatment(report, treatment, current_user)

            # 6. Audit History
            hist = DiseaseReportStatusHistory(
                id=uuid.uuid4(),
                report_id=report.report_id,
                from_status="ASSIGNED",
                to_status="TREATED_PENDING_VERIFICATION",
                reason=f"VO {current_user.full_name} completed clinical treatment with photo evidence. Submitted for TAHO verification.",
                changed_by=current_user.id
            )
            self.db.add(hist)

            await self.db.commit()
            return {
                "status": "success",
                "message": "સારવાર સફળતાપૂર્વક નોંધાઈ છે અને TAHO ચકાસણી માટે મોકલાઈ છે (VO Treatment Submitted – Pending TAHO Verification).",
                "treatment_id": str(treatment.id),
                "report_id": str(report.report_id)
            }
        except Exception as ex:
            await self.db.rollback()
            logger.error("Failed to record treatment for report %s: %s", report_id, ex, exc_info=True)
            if isinstance(ex, HTTPException):
                raise ex
            raise HTTPException(
                status_code=500,
                detail=f"સારવાર વિગત સાચવવામાં નિષ્ફળતા (Database Error): {str(ex)}"
            )

    async def verify_taho_treatment(
        self,
        report_id: uuid.UUID,
        payload: CaseTreatmentVerificationRequest,
        current_user: User
    ) -> Dict[str, Any]:
        """TAHO approves or rejects treatment verification."""
        if current_user.role not in ("TAHO", "DAHO", "SYS_ADMIN", "SUPER_ADMIN"):
            raise HTTPException(status_code=403, detail="માત્ર TAHO અથવા DAHO અધિકારી ચકાસણી કરી શકે છે.")

        report = await self.db.get(DiseaseReport, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="અહેવાલ મળ્યો નથી")

        t_res = await self.db.execute(
            select(TreatmentRecord).where(
                TreatmentRecord.report_id == report_id
            ).order_by(desc(TreatmentRecord.created_at)).limit(1)
        )
        treatment = t_res.scalar_one_or_none()

        if payload.action in ("REJECTED", "FOLLOW_UP_REQUIRED"):
            if not payload.rejection_reason or not payload.rejection_reason.strip():
                raise HTTPException(
                    status_code=400,
                    detail="પુનઃતપાસ અથવા અસ્વીકાર માટે સ્પષ્ટ કારણ દાખલ કરવું ફરજિયાત છે."
                )

        try:
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
                report.treatment_status = "VERIFIED_COMPLETED"
                report.status = "RESOLVED"
                if treatment:
                    treatment.status = "VERIFIED"
                self.db.add(report)

                # Update AnimalEvent
                await self.db.execute(
                    update(AnimalEvent).where(
                        AnimalEvent.animal_id == report.animal_id,
                        AnimalEvent.event_type == "TREATMENT"
                    ).values(review_status="REVIEWED", reviewed_by=current_user.id, reviewed_at=datetime.now(timezone.utc))
                )

                # Audit History
                hist = DiseaseReportStatusHistory(
                    id=uuid.uuid4(),
                    report_id=report.report_id,
                    from_status="TREATED_PENDING_VERIFICATION",
                    to_status="VERIFIED_COMPLETED",
                    reason=f"TAHO {current_user.full_name} verified and approved treatment: {payload.verification_notes or 'સંપૂર્ણ મંજૂર'}",
                    changed_by=current_user.id
                )
                self.db.add(hist)

                # Notify Farmer with actual diagnosis, treatment details, and verification status
                if report.farmer_id:
                    farmer_user_id = await self._get_user_id_for_farmer(report.farmer_id)
                    if farmer_user_id:
                        notif = Notification(
                            id=uuid.uuid4(),
                            recipient_user_id=farmer_user_id,
                            kind="TREATMENT_VERIFIED",
                            message_key="notif.treatment.verified",
                            params={
                                "title": "પશુ સારવાર સફળતાપૂર્વક પૂર્ણ અને ચકાસાયેલ છે",
                                "report_no": report.report_no or str(report.report_id)[:8],
                                "disease_code": report.disease_code,
                                "diagnosis": treatment.diagnosis if treatment else report.disease_code,
                                "treatment_provided": treatment.treatment_text if treatment else "સારવાર પૂર્ણ",
                                "medicines": treatment.medicine_administered if treatment else None,
                                "verified_by": current_user.full_name or "તાલુકા પશુપાલન અધિકારી",
                                "notes": payload.verification_notes or "સારવાર ચકાસણી મંજૂર થયેલ છે."
                            },
                            related_type="disease_report",
                            related_id=str(report.report_id),
                            status="UNREAD"
                        )
                        self.db.add(notif)
            else:
                # REJECTED: Return to assigned VO
                report.treatment_status = "REJECTED_RETURNED_TO_VO"
                if treatment:
                    treatment.status = "REJECTED"
                self.db.add(report)

                hist = DiseaseReportStatusHistory(
                    id=uuid.uuid4(),
                    report_id=report.report_id,
                    from_status="TREATED_PENDING_VERIFICATION",
                    to_status="REJECTED_RETURNED_TO_VO",
                    reason=f"TAHO rejected/requested re-investigation: {payload.rejection_reason}",
                    changed_by=current_user.id
                )
                self.db.add(hist)

                # Notify assigned VO
                if report.assigned_vo_id:
                    notif = Notification(
                        id=uuid.uuid4(),
                        recipient_user_id=report.assigned_vo_id,
                        kind="TREATMENT_FOLLOW_UP",
                        message_key="notif.treatment.follow_up",
                        params={
                            "title": "સારવાર અહેવાલ પુનઃતપાસ માટે પાછો મોકલાયો છે",
                            "report_no": report.report_no or str(report.report_id)[:8],
                            "reason": payload.rejection_reason,
                            "instructions": payload.follow_up_instructions or "કૃપા કરીને સ્થળ પર ફરી તપાસ કરી વિગતો સુધારો."
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
                "message": "ચકાસણી નિર્ણય સફળતાપૂર્વક સાચવવામાં આવ્યો છે."
            }
        except Exception as ex:
            await self.db.rollback()
            logger.error("Failed to verify treatment for report %s: %s", report_id, ex, exc_info=True)
            if isinstance(ex, HTTPException):
                raise ex
            raise HTTPException(
                status_code=500,
                detail=f"ચકાસણી સાચવવામાં નિષ્ફળતા (Database Error): {str(ex)}"
            )

    async def get_disease_clusters(self, current_user: User) -> List[DiseaseClusterAlert]:
        """Detects data-driven potential disease clusters / outbreak alerts within user's scope."""
        cutoff = date.today() - timedelta(days=14)
        stmt = (
            select(DiseaseReport)
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(
                DiseaseReport.report_date >= cutoff,
                or_(
                    DiseaseReport.treatment_status.notin_(["VERIFIED_COMPLETED", "RESOLVED"]),
                    DiseaseReport.treatment_status.is_(None)
                )
            )
        )

        if current_user.role == "TAHO":
            taluka_res = await self.db.execute(
                select(TahoTalukaAssignment.taluka_id).where(
                    TahoTalukaAssignment.taho_user_id == current_user.id,
                    TahoTalukaAssignment.ended_at.is_(None)
                )
            )
            t_ids = list(taluka_res.scalars().all())
            if t_ids:
                stmt = stmt.where(Village.taluka_id.in_(t_ids))
        elif current_user.role in ("VO", "VET_OFFICER"):
            uva_res = await self.db.execute(
                select(UserVillageAssignment.village_id).where(
                    UserVillageAssignment.user_id == current_user.id,
                    UserVillageAssignment.ended_at.is_(None)
                )
            )
            v_ids = list(uva_res.scalars().all())
            if v_ids:
                stmt = stmt.where(Village.id.in_(v_ids))

        res = await self.db.execute(stmt)
        reports = res.scalars().all()

        groups: Dict[str, List[DiseaseReport]] = {}
        for r in reports:
            k = r.disease_code or "UNKNOWN"
            groups.setdefault(k, []).append(r)

        cluster_alerts: List[DiseaseClusterAlert] = []
        for d_code, rep_list in groups.items():
            if len(rep_list) >= 2:
                v_ids = list(set([r.village_id for r in rep_list]))
                v_names = []
                coords = []
                for vid in v_ids:
                    v_obj = await self.db.get(Village, vid)
                    if v_obj:
                        v_names.append(v_obj.name_gu or v_obj.name_en or str(vid))
                        if v_obj.latitude and v_obj.longitude:
                            coords.append((float(v_obj.latitude), float(v_obj.longitude)))

                c_lat = sum(c[0] for c in coords) / len(coords) if coords else None
                c_lng = sum(c[1] for c in coords) / len(coords) if coords else None

                first_dt = min(r.report_date for r in rep_list)
                last_dt = max(r.report_date for r in rep_list)

                cnt = len(rep_list)
                if cnt >= 5:
                    sev = "SUSPECTED_OUTBREAK"
                    title = f"શંકાસ્પદ રોગચાળો ચેતવણી (Suspected Outbreak Alert - {d_code})"
                elif cnt >= 3:
                    sev = "HIGH_RISK"
                    title = f"ઉચ્ચ જોખમ રોગ ક્લસ્ટર (High Risk Cluster - {d_code})"
                else:
                    sev = "ALERT"
                    title = f"સંભવિત રોગ ક્લસ્ટર (Potential Disease Cluster - {d_code})"

                case_items = [await self._to_farmer_report_item(r) for r in rep_list]

                cluster_alerts.append(
                    DiseaseClusterAlert(
                        cluster_id=f"cluster-{d_code}-{str(v_ids[0])[:8]}",
                        disease_code=d_code,
                        disease_name=rep_list[0].custom_disease_name or d_code,
                        title=title,
                        severity=sev,
                        case_count=cnt,
                        village_ids=v_ids,
                        village_names=v_names,
                        first_report_date=first_dt,
                        latest_report_date=last_dt,
                        center_latitude=c_lat,
                        center_longitude=c_lng,
                        radius_km=round(len(v_ids) * 2.5 + 2.0, 1),
                        underlying_case_ids=[r.report_id for r in rep_list],
                        cases=case_items
                    )
                )

        return cluster_alerts

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
        taluka_res = await self.db.execute(
            select(TahoTalukaAssignment.taluka_id).where(TahoTalukaAssignment.taho_user_id == current_user.id)
        )
        assigned_taluka_ids = list(taluka_res.scalars().all())
        query = select(CooperativeVaccinationSchedule)
        if assigned_taluka_ids:
            query = query.where(CooperativeVaccinationSchedule.taluka_id.in_(assigned_taluka_ids))

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
            # Find TAHO user via TahoTalukaAssignment
            t_res = await self.db.execute(
                select(TahoTalukaAssignment.taho_user_id).where(
                    TahoTalukaAssignment.taluka_id == vil.taluka_id
                ).limit(1)
            )
            taho_id = t_res.scalar_one_or_none()
            if not taho_id:
                t_res = await self.db.execute(
                    select(User.id).where(User.role == "TAHO", User.status == "ACTIVE").limit(1)
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
                select(TahoTalukaAssignment.taho_user_id).where(
                    TahoTalukaAssignment.taluka_id == vil.taluka_id
                ).limit(1)
            )
            taho_id = t_res.scalar_one_or_none()
            if not taho_id:
                t_res = await self.db.execute(
                    select(User.id).where(User.role == "TAHO", User.status == "ACTIVE").limit(1)
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
        taho_id = None
        if schedule.taluka_id:
            t_res = await self.db.execute(
                select(TahoTalukaAssignment.taho_user_id).where(
                    TahoTalukaAssignment.taluka_id == schedule.taluka_id
                ).limit(1)
            )
            taho_id = t_res.scalar_one_or_none()
        if not taho_id:
            t_res = await self.db.execute(
                select(User.id).where(User.role == "TAHO", User.status == "ACTIVE").limit(1)
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
            farmer_user_id = await self._get_user_id_for_farmer(enr.farmer_id)
            if farmer_user_id:
                animal = await self.db.get(Animal, enr.animal_id)
                tag_name = animal.animal_code if animal else "પશુ"
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=farmer_user_id,
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
            farmer = await self.db.get(Farmer, animal.farmer_id) if animal.farmer_id else None
            farmer_user_id = await self._get_user_id_for_farmer(animal.farmer_id)
            if farmer_user_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_user_id=farmer_user_id,
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
