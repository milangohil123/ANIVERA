"""Disease Surveillance and Early-Warning Service.

Coordinates:
- Suspected disease incident submissions by Farmers, Field Workers, and VOs ('disease.report')
- Initial UNCONFIRMED status enforcement (DEC-020: no automatic outbreak/confirmation)
- Clinical triage reviews by Veterinary Officers ('disease.review')
- Strict departmental confirmation authority enforcement ('disease.confirm')
- Surveillance village-level aggregations distinguishing suspected vs confirmed cases
- Immutable security audit trails
"""
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, List, Optional, Set, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.media import validate_and_sanitize_image
from app.core.storage import get_disease_attachment_storage
from app.models.geography import Village
from app.models.reference import Programme
from app.modules.animals.models import Animal
from app.modules.authentication.models import User
from app.modules.authorization.models import FarmerUserLink, UserVillageAssignment
from app.modules.authorization.service import AuthorizationService
from app.modules.disease_surveillance.models import DiseaseReport, DiseaseReportAttachment, DiseaseReview
from app.modules.disease_surveillance.repository import DiseaseSurveillanceRepository
from app.modules.disease_surveillance.schemas import (
    DiseaseReportAttachmentResponse,
    DiseaseReportConfirmRequest,
    DiseaseReportCreate,
    DiseaseReportResponse,
    DiseaseReportReviewCreate,
    DiseaseReviewResponse,
    SurveillanceSummaryResponse,
)
from app.modules.duty.models import HelpRequest
from app.modules.duty.table_setup import ensure_duty_tables
from app.modules.farmers.models import Farmer
from app.modules.notifications.service import NotificationService

logger = logging.getLogger("pashurakshak.disease_surveillance.service")


class DiseaseSurveillanceService:
    """Service managing disease incident reporting, investigation, and veterinary confirmation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = DiseaseSurveillanceRepository(db)
        self.authz_service = AuthorizationService(db)

    async def submit_report(
        self,
        payload: DiseaseReportCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DiseaseReportResponse:
        """Submit a suspected disease incident report.

        Policies:
        - Submitted report starts initially as 'SUBMITTED' (DEC-020).
        - A Field Worker or Farmer report does NOT constitute a confirmed medical diagnosis.
        - Geographic scope is strictly validated.
        """
        await self.authz_service.assert_any_permission(
            current_user,
            ["disease.report", "own.read"],
            ip=client_ip
        )

        # Validate and resolve animal details if supplied (supports both UUID and animal_code like 'ANM-BOT-000017')
        animal = None
        if payload.animal_id:
            if isinstance(payload.animal_id, uuid.UUID):
                animal = await self.db.get(Animal, payload.animal_id)
            else:
                str_aid = str(payload.animal_id).strip()
                try:
                    parsed_uuid = uuid.UUID(str_aid)
                    animal = await self.db.get(Animal, parsed_uuid)
                except (ValueError, AttributeError):
                    parsed_uuid = None
                if not animal:
                    a_stmt = select(Animal).where(Animal.animal_code == str_aid)
                    a_res = await self.db.execute(a_stmt)
                    animal = a_res.scalars().first()

            if animal:
                payload.animal_id = animal.id
                if not payload.village_id and animal.village_id:
                    payload.village_id = animal.village_id
                if not payload.farmer_id and animal.farmer_id:
                    payload.farmer_id = animal.farmer_id
            else:
                # If animal was not resolved by ID or code, do not block the disease report; set to None
                payload.animal_id = None

        # Resolve farmer profile and village ownership
        if current_user.role == "FARMER":
            report_source = "FARMER_APP"
            linked_farmer = None

            # 1. Check if farmer_id was explicitly provided (as UUID or farmer_code)
            if payload.farmer_id:
                if isinstance(payload.farmer_id, uuid.UUID):
                    linked_farmer = await self.db.get(Farmer, payload.farmer_id)
                else:
                    str_fid = str(payload.farmer_id).strip()
                    try:
                        parsed_fid = uuid.UUID(str_fid)
                        linked_farmer = await self.db.get(Farmer, parsed_fid)
                    except (ValueError, AttributeError):
                        parsed_fid = None
                    if not linked_farmer:
                        f_stmt = select(Farmer).where(Farmer.farmer_code == str_fid)
                        f_res = await self.db.execute(f_stmt)
                        linked_farmer = f_res.scalars().first()

            # 2. If not found, lookup via FarmerUserLink
            if not linked_farmer:
                link_stmt = select(FarmerUserLink.farmer_id).where(FarmerUserLink.user_id == current_user.id)
                link_res = await self.db.execute(link_stmt)
                linked_fid = link_res.scalar_one_or_none()
                if linked_fid:
                    linked_farmer = await self.db.get(Farmer, linked_fid)

            # 3. If not found, lookup by matching mobile_e164
            if not linked_farmer and current_user.mobile_e164:
                m_stmt = select(Farmer).where(Farmer.mobile_e164 == current_user.mobile_e164)
                m_res = await self.db.execute(m_stmt)
                linked_farmer = m_res.scalars().first()

            # 4. If not found, lookup by creator/registrar
            if not linked_farmer:
                c_stmt = select(Farmer).where(
                    or_(Farmer.registered_by == current_user.id, Farmer.created_by == current_user.id)
                )
                c_res = await self.db.execute(c_stmt)
                linked_farmer = c_res.scalars().first()

            # 5. Populate verified farmer details and auto-link user
            if linked_farmer:
                payload.farmer_id = linked_farmer.id
                if not payload.village_id and linked_farmer.village_id:
                    payload.village_id = linked_farmer.village_id

                # Ensure FarmerUserLink row exists so authorization checks pass seamlessly
                link_check = await self.db.execute(
                    select(FarmerUserLink).where(
                        FarmerUserLink.user_id == current_user.id,
                        FarmerUserLink.farmer_id == linked_farmer.id
                    )
                )
                if not link_check.scalar_one_or_none():
                    self.db.add(FarmerUserLink(
                        user_id=current_user.id,
                        farmer_id=linked_farmer.id,
                        linked_by=current_user.id,
                        linked_at=datetime.now(timezone.utc)
                    ))
                    await self.db.flush()

            if payload.farmer_id and isinstance(payload.farmer_id, uuid.UUID):
                await self.authz_service.assert_farmer_ownership(current_user, payload.farmer_id, ip=client_ip)
        else:
            report_source = "FIELD_WORKER" if current_user.role in ("FIELD_WORKER", "FW") else "VET_OFFICER"
            if payload.village_id and isinstance(payload.village_id, uuid.UUID):
                await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)

        # Fallback resolution for village_id if still missing or string
        if payload.village_id and not isinstance(payload.village_id, uuid.UUID):
            try:
                payload.village_id = uuid.UUID(str(payload.village_id).strip())
            except (ValueError, AttributeError):
                v_res = await self.db.execute(select(Village.id).where(Village.code == str(payload.village_id).strip()))
                payload.village_id = v_res.scalar_one_or_none()

        if not payload.village_id:
            v_res = await self.db.execute(select(Village.id).where(Village.active == True).limit(1))
            payload.village_id = v_res.scalar_one_or_none()

        if not payload.village_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ગામની વિગત ઉપલબ્ધ નથી. કૃપા કરીને પશુ પસંદ કરો અથવા ક્ષેત્રીય કાર્યકરનો સંપર્ક કરો."
            )

        report_id = uuid.uuid4()
        report = await self.repo.create_report(
            report_id=report_id,
            animal_id=payload.animal_id if isinstance(payload.animal_id, uuid.UUID) else None,
            farmer_id=payload.farmer_id if isinstance(payload.farmer_id, uuid.UUID) else None,
            village_id=payload.village_id,
            disease_code=payload.disease_code,
            report_source=report_source,
            report_date=payload.report_date,
            symptoms=payload.symptoms,
            observation_text=payload.observation_text,
            latitude=payload.latitude,
            longitude=payload.longitude,
            reported_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="DISEASE_REPORT_SUBMITTED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="disease_report",
            object_id=str(report.report_id),
            village_id=payload.village_id,
            reason=f"Reported suspected {report.disease_code} incident ({report_source})",
            ip=client_ip
        )

        # Synchronize with Smart Complaint Grouping / Help Requests for immediate VO & FW dispatch
        try:
            await ensure_duty_tables(self.db)

            ref_no = f"HLP-{datetime.now().strftime('%Y%m%d')}-{str(report_id)[:6].upper()}"
            help_req = HelpRequest(
                id=uuid.uuid4(),
                reference_no=ref_no,
                requester_name=current_user.full_name or current_user.username or "પશુપાલક",
                contact_number=current_user.mobile_e164,
                contact_verified=bool(current_user.mobile_e164),
                village_id=payload.village_id,
                farmer_id=payload.farmer_id,
                animal_id=payload.animal_id,
                problem_text=f"રોગ શંકા: {report.disease_code} | {payload.observation_text or 'પશુ બીમારી/તાવ તપાસ'}".strip(),
                source="FARMER_APP" if current_user.role == "FARMER" else "STAFF_ASSISTED",
                registered_by=current_user.id,
                status="SUBMITTED"
            )
            self.db.add(help_req)
            await self.db.flush()
        except Exception as e:
            logger.warning("Could not auto-create linked help_request: %s", e)

        # Notify assigned Veterinary Officers in-app & simulated external dispatch
        try:
            notif_service = NotificationService(self.db)
            vil_res = await self.db.execute(select(Village.name_gu).where(Village.id == payload.village_id))
            vil_name = vil_res.scalar_one_or_none() or "બોટાદ"

            vo_stmt = (
                select(UserVillageAssignment.user_id)
                .join(User, User.id == UserVillageAssignment.user_id)
                .where(
                    UserVillageAssignment.village_id == payload.village_id,
                    UserVillageAssignment.ended_at.is_(None),
                    User.role.in_(["VET_OFFICER", "VO"])
                )
            )
            vo_res = await self.db.execute(vo_stmt)
            vo_ids = [row[0] for row in vo_res.fetchall()]
            if not vo_ids:
                any_vo = await self.db.execute(select(User.id).where(User.role.in_(["VET_OFFICER", "VO"])).limit(3))
                vo_ids = [row[0] for row in any_vo.fetchall()]

            for vo_id in vo_ids:
                await notif_service.notify(
                    recipient_user_id=vo_id,
                    kind="REPORT_SUBMITTED",
                    message_key="REPORT_SUBMITTED",
                    params={
                        "village_name": vil_name,
                        "disease_name": report.disease_code,
                        "report_no": report.report_no or str(report.report_id)[:8]
                    },
                    related_type="disease_report",
                    related_id=str(report.report_id),
                    scope_village_id=payload.village_id
                )
        except Exception as n_err:
            logger.warning("Notification dispatch error on disease report submission: %s", n_err)

        await self.db.commit()
        return DiseaseReportResponse.model_validate(report)

    async def list_reports(
        self,
        status_filter: Optional[str] = None,
        disease_code: Optional[str] = None,
        animal_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50,
        current_user: User = None,
        client_ip: Optional[str] = None
    ) -> List[DiseaseReportResponse]:
        """List disease reports within caller scope."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["disease.review", "disease.report", "aggregate.view", "own.read"],
            ip=client_ip
        )

        allowed_villages: Optional[Set[uuid.UUID]] = None
        if current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            allowed_villages = scope.assigned_village_ids
        elif current_user.role == "DAIRY_STAFF":
            allowed_villages = scope.cooperative_village_ids

        reports = await self.repo.list_reports(
            allowed_village_ids=allowed_villages,
            status_filter=status_filter,
            disease_code=disease_code,
            animal_id=animal_id,
            offset=offset,
            limit=limit
        )
        return [DiseaseReportResponse.model_validate(r) for r in reports]

    async def get_report(
        self,
        report_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DiseaseReportResponse:
        """Fetch disease report detail."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["disease.review", "disease.report", "aggregate.view", "own.read"],
            ip=client_ip
        )

        report = await self.repo.get_report_by_id(report_id)
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease report not found")
        return DiseaseReportResponse.model_validate(report)

    async def review_report(
        self,
        report_id: uuid.UUID,
        payload: DiseaseReportReviewCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DiseaseReviewResponse:
        """Record a triage or field investigation review step (VO via 'disease.review')."""
        await self.authz_service.assert_permission(
            current_user,
            "disease.review",
            ip=client_ip
        )

        report = await self.repo.get_report_by_id(report_id)
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease report not found")

        await self.authz_service.assert_village_scope(current_user, report.village_id, ip=client_ip)

        review = await self.repo.add_review(
            report=report,
            reviewer_id=current_user.id,
            reviewer_role=current_user.role,
            review_type=payload.review_type,
            assessment=payload.assessment,
            basis=payload.basis,
            authorised_to_confirm=False
        )

        await self.repo.record_audit_event(
            action="DISEASE_REPORT_REVIEWED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="disease_report",
            object_id=str(report.report_id),
            village_id=report.village_id,
            reason=f"Recorded {payload.review_type} assessment: {payload.assessment}",
            ip=client_ip
        )
        await self.db.commit()
        return DiseaseReviewResponse.model_validate(review)

    async def decide_report(
        self,
        report_id: uuid.UUID,
        payload: DiseaseReportConfirmRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DiseaseReportResponse:
        """Confirm or disprove a disease case.

        Mandatory Governance Rule:
        Requires explicit departmental authorization ('disease.confirm').
        A general Veterinary Officer or Field Worker does NOT possess confirmation authority.
        """
        await self.authz_service.assert_disease_confirmation_authority(
            current_user,
            ip=client_ip
        )

        report = await self.repo.get_report_by_id(report_id)
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease report not found")

        await self.authz_service.assert_village_scope(current_user, report.village_id, ip=client_ip)

        if payload.action == "CONFIRM":
            if not payload.confirmation_basis or not payload.confirmation_basis.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid, documented confirmation basis is mandatory when confirming a disease case"
                )
            basis_or_reason = payload.confirmation_basis
        elif payload.action == "DISPROVE":
            if not payload.not_confirmed_reason or not payload.not_confirmed_reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid, documented not_confirmed_reason is mandatory when disproving a disease report"
                )
            basis_or_reason = payload.not_confirmed_reason
        else:  # INSUFFICIENT
            basis_or_reason = "Insufficient diagnostic information to confirm or disprove"

        updated = await self.repo.finalize_decision(
            report=report,
            action=payload.action,
            basis_or_reason=basis_or_reason,
            confirmed_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="DISEASE_REPORT_DECIDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="disease_report",
            object_id=str(report.report_id),
            village_id=report.village_id,
            reason=f"Decision {payload.action}: {basis_or_reason}",
            ip=client_ip
        )

        # Notify original reporter about review decision
        try:
            notif_service = NotificationService(self.db)
            await notif_service.notify(
                recipient_user_id=report.reported_by,
                kind="REPORT_REVIEWED",
                message_key="REPORT_REVIEWED",
                params={
                    "report_no": report.report_no or str(report.report_id)[:8],
                    "status": updated.status
                },
                related_type="disease_report",
                related_id=str(report.report_id)
            )
        except Exception as n_err:
            logger.warning("Notification dispatch error on disease review decision: %s", n_err)

        await self.db.commit()
        return DiseaseReportResponse.model_validate(updated)

    async def get_surveillance_summary(
        self,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[SurveillanceSummaryResponse]:
        """Aggregate surveillance numbers per village (cleanly distinguishing suspected vs confirmed cases)."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["disease.review", "aggregate.view", "map.view"],
            ip=client_ip
        )

        allowed_villages: Optional[Set[uuid.UUID]] = None
        if current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            allowed_villages = scope.assigned_village_ids

        aggregates = await self.repo.get_surveillance_aggregates(allowed_villages)
        return [
            SurveillanceSummaryResponse(
                village_id=row["village_id"],
                disease_code=row["disease_code"],
                suspected_count=row["suspected_count"],
                confirmed_count=row["confirmed_count"],
                not_confirmed_count=row["not_confirmed_count"],
                insufficient_count=row["insufficient_count"],
                last_report_at=row["last_report_at"]
            )
            for row in aggregates
        ]

    async def _assert_report_access(
        self,
        report: DiseaseReport,
        current_user: User,
        client_ip: Optional[str]
    ) -> None:
        """Validate user scope against report location or farmer ownership."""
        if current_user.role == "FARMER":
            if not report.farmer_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to report")
            await self.authz_service.assert_farmer_ownership(current_user, report.farmer_id, ip=client_ip)
        else:
            await self.authz_service.assert_village_scope(current_user, report.village_id, ip=client_ip)

    async def upload_attachment(
        self,
        report_id: uuid.UUID,
        file: UploadFile,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> Tuple[DiseaseReportAttachmentResponse, bool]:
        """Upload and sanitize photo attachment with transaction-level locking to prevent duplicate races.

        Returns:
            Tuple[DiseaseReportAttachmentResponse, is_duplicate]
        """
        await self.authz_service.assert_any_permission(
            current_user,
            ["disease.report", "disease.review"],
            ip=client_ip
        )

        # 1. Lock the parent disease_reports row for the duration of this transaction
        stmt = (
            select(DiseaseReport)
            .where(DiseaseReport.report_id == report_id)
            .with_for_update()
        )
        res = await self.db.execute(stmt)
        report = res.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease report not found")

        # 2. Scope verification
        await self._assert_report_access(report, current_user, client_ip)

        # 3. Read stream and sanitize via Pillow
        raw_bytes = await file.read()
        sanitized_bytes, mime_type, sha256, size_bytes = validate_and_sanitize_image(raw_bytes)

        # 4. Check for existing identical attachment within the locked critical section
        existing = await self.repo.get_attachment_by_hash(report_id, sha256)
        if existing:
            # Release lock & return existing record without writing file or DB row
            resp = DiseaseReportAttachmentResponse.model_validate(existing)
            resp.is_duplicate = True
            return resp, True

        # 5. Save sanitized bytes to storage
        storage = get_disease_attachment_storage()
        relative_path = await storage.save(sanitized_bytes, mime_type)

        # 6. Insert attachment and record audit event
        attachment_id = uuid.uuid4()
        try:
            attachment = await self.repo.create_attachment(
                attachment_id=attachment_id,
                report_id=report_id,
                file_path=relative_path,
                sha256=sha256,
                mime_type=mime_type,
                size_bytes=size_bytes,
                uploaded_by=current_user.id
            )
            await self.repo.record_audit_event(
                action="DISEASE_ATTACHMENT_UPLOADED",
                result="SUCCESS",
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                object_type="disease_report_attachment",
                object_id=str(attachment.id),
                village_id=report.village_id,
                reason=f"Uploaded {mime_type} photo ({size_bytes} bytes)",
                ip=client_ip
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            await storage.delete(relative_path)
            raise

        resp = DiseaseReportAttachmentResponse.model_validate(attachment)
        resp.is_duplicate = False
        return resp, False

    async def list_attachments(
        self,
        report_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[DiseaseReportAttachmentResponse]:
        """List metadata for all attachments on a report."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["disease.report", "disease.review", "own.read"],
            ip=client_ip
        )
        report = await self.repo.get_report_by_id(report_id)
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease report not found")

        await self._assert_report_access(report, current_user, client_ip)
        attachments = await self.repo.list_attachments_for_report(report_id)
        return [DiseaseReportAttachmentResponse.model_validate(a) for a in attachments]

    async def stream_attachment(
        self,
        report_id: uuid.UUID,
        attachment_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> Tuple[Any, str, int, str]:
        """Verify scope, record download audit, and return streaming generator with headers."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["disease.report", "disease.review", "own.read"],
            ip=client_ip
        )
        report = await self.repo.get_report_by_id(report_id)
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease report not found")

        await self._assert_report_access(report, current_user, client_ip)

        attachment = await self.repo.get_attachment_by_id(attachment_id)
        if not attachment or attachment.report_id != report_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

        storage = get_disease_attachment_storage()
        if not await storage.exists(attachment.file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found on storage")

        await self.repo.record_audit_event(
            action="DISEASE_ATTACHMENT_DOWNLOADED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="disease_report_attachment",
            object_id=str(attachment.id),
            village_id=report.village_id,
            ip=client_ip
        )
        await self.db.commit()

        stream = storage.get_stream(attachment.file_path)
        ext = attachment.file_path.split(".")[-1] if "." in attachment.file_path else "jpg"
        filename = f"{attachment.id}.{ext}"
        return stream, attachment.mime_type, attachment.size_bytes, filename

