"""Asynchronous database repository for Disease Surveillance and Reporting domain."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Set
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.modules.authentication.models import AuditEvent
from app.modules.disease_surveillance.models import (
    DiseaseReport,
    DiseaseReportAttachment,
    DiseaseReportStatusHistory,
    DiseaseReview,
)


class DiseaseSurveillanceRepository:
    """Repository managing disease incident reporting, investigation reviews, and final outcomes."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_report_by_id(self, report_id: uuid.UUID) -> Optional[DiseaseReport]:
        """Fetch report with reviews and status history."""
        stmt = (
            select(DiseaseReport)
            .options(
                selectinload(DiseaseReport.reviews),
                selectinload(DiseaseReport.status_history)
            )
            .where(DiseaseReport.report_id == report_id)
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def create_report(
        self,
        report_id: uuid.UUID,
        animal_id: Optional[uuid.UUID],
        farmer_id: Optional[uuid.UUID],
        village_id: uuid.UUID,
        disease_code: str,
        report_source: str,
        report_date: date,
        symptoms: List[str],
        observation_text: Optional[str],
        latitude: Optional[Decimal],
        longitude: Optional[Decimal],
        reported_by: uuid.UUID
    ) -> DiseaseReport:
        """Create a disease incident report initially in SUBMITTED (unconfirmed) status."""
        now_utc = datetime.now(timezone.utc)
        report = DiseaseReport(
            report_id=report_id,
            animal_id=animal_id,
            farmer_id=farmer_id,
            village_id=village_id,
            disease_code=disease_code.strip(),
            report_source=report_source,
            report_date=report_date,
            symptoms=symptoms,
            observation_text=observation_text.strip() if observation_text else None,
            latitude=latitude,
            longitude=longitude,
            reported_by=reported_by,
            received_at=now_utc,
            status="SUBMITTED",
            conflict_flag=False,
            row_version=1
        )
        self.db.add(report)

        hist = DiseaseReportStatusHistory(
            id=uuid.uuid4(),
            report_id=report_id,
            from_status=None,
            to_status="SUBMITTED",
            reason="Initial field incident submission",
            changed_by=reported_by,
            changed_at=now_utc
        )
        self.db.add(hist)
        await self.db.flush()
        return report

    async def list_reports(
        self,
        allowed_village_ids: Optional[Set[uuid.UUID]] = None,
        status_filter: Optional[str] = None,
        disease_code: Optional[str] = None,
        animal_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[DiseaseReport]:
        """List reports filtered by status, disease, animal, and allowed villages."""
        stmt = select(DiseaseReport)

        if allowed_village_ids is not None:
            if len(allowed_village_ids) == 0:
                return []
            stmt = stmt.where(DiseaseReport.village_id.in_(allowed_village_ids))

        if status_filter:
            stmt = stmt.where(DiseaseReport.status == status_filter)

        if disease_code:
            stmt = stmt.where(DiseaseReport.disease_code == disease_code)

        if animal_id:
            stmt = stmt.where(DiseaseReport.animal_id == animal_id)

        stmt = stmt.order_by(DiseaseReport.report_date.desc(), DiseaseReport.received_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def add_review(
        self,
        report: DiseaseReport,
        reviewer_id: uuid.UUID,
        reviewer_role: str,
        review_type: str,
        assessment: str,
        basis: Optional[str],
        authorised_to_confirm: bool
    ) -> DiseaseReview:
        """Record an investigation review step and update report status accordingly."""
        now_utc = datetime.now(timezone.utc)
        review = DiseaseReview(
            id=uuid.uuid4(),
            report_id=report.report_id,
            reviewer_id=reviewer_id,
            reviewer_role=reviewer_role,
            review_type=review_type,
            assessment=assessment,
            basis=basis.strip() if basis else None,
            authorised_to_confirm=authorised_to_confirm,
            at=now_utc
        )
        self.db.add(review)

        # Update report status to match non-final review assessment
        old_status = report.status
        report.status = assessment
        report.row_version += 1

        hist = DiseaseReportStatusHistory(
            id=uuid.uuid4(),
            report_id=report.report_id,
            from_status=old_status,
            to_status=assessment,
            reason=f"Review ({review_type}): {basis or assessment}",
            changed_by=reviewer_id,
            changed_at=now_utc
        )
        self.db.add(hist)
        await self.db.flush()
        return review

    async def finalize_decision(
        self,
        report: DiseaseReport,
        action: str,
        basis_or_reason: str,
        confirmed_by: uuid.UUID
    ) -> DiseaseReport:
        """Apply final confirmation, disproval, or insufficient assessment."""
        now_utc = datetime.now(timezone.utc)
        old_status = report.status

        if action == "CONFIRM":
            report.status = "CONFIRMED"
            report.confirmed_by = confirmed_by
            report.confirmed_at = now_utc
            report.confirmation_basis = basis_or_reason.strip()
            new_status = "CONFIRMED"
        elif action == "DISPROVE":
            report.status = "NOT_CONFIRMED"
            report.not_confirmed_reason = basis_or_reason.strip()
            new_status = "NOT_CONFIRMED"
        elif action == "INSUFFICIENT":
            report.status = "INSUFFICIENT_INFORMATION"
            new_status = "INSUFFICIENT_INFORMATION"

        report.row_version += 1

        # Also add a final DiseaseReview record reflecting this action
        final_review = DiseaseReview(
            id=uuid.uuid4(),
            report_id=report.report_id,
            reviewer_id=confirmed_by,
            reviewer_role="AUTHORISED_VETERINARIAN",
            review_type="VETERINARY_EXAMINATION",
            assessment=new_status,
            basis=basis_or_reason.strip(),
            authorised_to_confirm=True,
            at=now_utc
        )
        self.db.add(final_review)

        hist = DiseaseReportStatusHistory(
            id=uuid.uuid4(),
            report_id=report.report_id,
            from_status=old_status,
            to_status=new_status,
            reason=basis_or_reason.strip(),
            changed_by=confirmed_by,
            changed_at=now_utc
        )
        self.db.add(hist)
        await self.db.flush()
        return report

    async def get_surveillance_aggregates(
        self,
        allowed_village_ids: Optional[Set[uuid.UUID]] = None
    ) -> List[dict]:
        """Aggregate surveillance numbers per village and disease (matching v_village_surveillance)."""
        stmt = (
            select(
                DiseaseReport.village_id,
                DiseaseReport.disease_code,
                func.count().filter(
                    DiseaseReport.status.in_(["SUBMITTED", "UNDER_REVIEW", "SUSPECTED", "NEEDS_MORE_INFORMATION"]),
                    DiseaseReport.duplicate_of.is_(None)
                ).label("suspected_count"),
                func.count().filter(
                    DiseaseReport.status == "CONFIRMED",
                    DiseaseReport.duplicate_of.is_(None)
                ).label("confirmed_count"),
                func.count().filter(
                    DiseaseReport.status == "NOT_CONFIRMED"
                ).label("not_confirmed_count"),
                func.count().filter(
                    DiseaseReport.status == "INSUFFICIENT_INFORMATION"
                ).label("insufficient_count"),
                func.max(DiseaseReport.received_at).label("last_report_at")
            )
            .group_by(DiseaseReport.village_id, DiseaseReport.disease_code)
        )

        if allowed_village_ids is not None:
            if len(allowed_village_ids) == 0:
                return []
            stmt = stmt.where(DiseaseReport.village_id.in_(allowed_village_ids))

        res = await self.db.execute(stmt)
        rows = res.fetchall()
        return [
            {
                "village_id": r[0],
                "disease_code": r[1],
                "suspected_count": r[2] or 0,
                "confirmed_count": r[3] or 0,
                "not_confirmed_count": r[4] or 0,
                "insufficient_count": r[5] or 0,
                "last_report_at": r[6]
            }
            for r in rows
        ]

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
        """Record an immutable audit event for disease surveillance."""
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

    async def create_attachment(
        self,
        attachment_id: uuid.UUID,
        report_id: uuid.UUID,
        file_path: str,
        sha256: str,
        mime_type: str,
        size_bytes: int,
        uploaded_by: uuid.UUID
    ) -> DiseaseReportAttachment:
        """Create and persist an attachment record."""
        att = DiseaseReportAttachment(
            id=attachment_id,
            report_id=report_id,
            file_path=file_path,
            sha256=sha256,
            mime_type=mime_type,
            size_bytes=size_bytes,
            uploaded_by=uploaded_by
        )
        self.db.add(att)
        await self.db.flush()
        return att

    async def get_attachment_by_id(self, attachment_id: uuid.UUID) -> Optional[DiseaseReportAttachment]:
        """Fetch attachment by its primary key ID."""
        return await self.db.get(DiseaseReportAttachment, attachment_id)

    async def get_attachment_by_hash(
        self,
        report_id: uuid.UUID,
        sha256: str
    ) -> Optional[DiseaseReportAttachment]:
        """Check for existing duplicate attachment on the report by SHA-256."""
        stmt = select(DiseaseReportAttachment).where(
            DiseaseReportAttachment.report_id == report_id,
            DiseaseReportAttachment.sha256 == sha256
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_attachments_for_report(
        self,
        report_id: uuid.UUID
    ) -> List[DiseaseReportAttachment]:
        """List all attachments associated with a disease report."""
        stmt = (
            select(DiseaseReportAttachment)
            .where(DiseaseReportAttachment.report_id == report_id)
            .order_by(DiseaseReportAttachment.uploaded_at.asc())
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

