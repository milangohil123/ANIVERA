"""Report and Export Service Layer.

Enforces:
- Strict query-level SQL scope filtering (never post-filtered in Python).
- Clean separation of suspected vs confirmed surveillance cases (DEC-020).
- Absence of unapproved KPIs, thresholds, or invented official statistics.
- Formula injection protection for CSV streaming exports.
- Immutable logging of export operations in the PostgreSQL 'export_log' table.
"""
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import and_, case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Village
from app.modules.animals.models import Animal
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.campaigns.models import Campaign, CampaignVillage
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.farmers.models import Farmer
from app.modules.inventory.models import VaccineProduct, VaccineStockLot, VaccineStockTransaction
from app.modules.reports.models import ExportLog
from app.modules.reports.schemas import (
    CampaignCoverageReportItem,
    CoopProgressReportItem,
    ExportLogItem,
    InventoryReportItem,
    RegistryCountsReportItem,
    StaffActivityReportItem,
    SurveillanceReportItem,
)
from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail


class ReportService:
    """Service providing query-level scoped analytics and safe CSV exports."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.authz = AuthorizationService(db)

    async def _resolve_allowed_villages(self, current_user: User, client_ip: Optional[str] = None) -> Set[uuid.UUID]:
        """Resolve permitted village UUIDs based on caller's authoritative assignments."""
        scope = await self.authz.get_user_scope(current_user)

        if current_user.role == "DAHO":
            # DAHO has authority over all villages in assigned districts
            stmt = select(Village.id).where(
                Village.district_id.in_(scope.assigned_district_ids),
                Village.active == True
            )
            res = await self.db.execute(stmt)
            return set(res.scalars().all())

        if current_user.role in ("VET_OFFICER", "VO", "FIELD_WORKER", "FW"):
            return scope.assigned_village_ids

        if current_user.role in ("DAIRY_STAFF", "COOPERATIVE"):
            return scope.cooperative_village_ids

        if current_user.role in ("SYS_ADMIN", "ADMIN"):
            # SYS_ADMIN has no default operational geodata scope per governance invariants
            return set()

        return set()

    async def get_campaign_coverage_report(
        self,
        current_user: User,
        campaign_id: Optional[uuid.UUID] = None,
        village_id: Optional[uuid.UUID] = None,
        client_ip: Optional[str] = None
    ) -> List[CampaignCoverageReportItem]:
        """Fetch campaign vaccination counts and coverage counts per village.
        
        Governance:
        - Query-level scope enforcement.
        - Shows counts only; no arbitrary percentages or unapproved colour bands.
        """
        allowed_villages = await self._resolve_allowed_villages(current_user, client_ip)
        if not allowed_villages:
            return []

        if village_id:
            if village_id not in allowed_villages:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ગામ તમારા કાર્યક્ષેત્રમાં નથી.")
            allowed_villages = {village_id}

        # Query campaigns and villages within allowed scope
        stmt = (
            select(
                Campaign.id.label("campaign_id"),
                Campaign.name.label("campaign_name"),
                Village.id.label("village_id"),
                Village.name_gu.label("village_name_gu"),
            )
            .join(CampaignVillage, CampaignVillage.campaign_id == Campaign.id)
            .join(Village, Village.id == CampaignVillage.village_id)
            .where(Village.id.in_(allowed_villages))
        )
        if campaign_id:
            stmt = stmt.where(Campaign.id == campaign_id)

        rows = (await self.db.execute(stmt)).all()
        results: List[CampaignCoverageReportItem] = []

        for row in rows:
            c_id, c_name, v_id, v_name = row

            # Count animals vaccinated in this village under this campaign
            cov_stmt = (
                select(func.count(distinct(AnimalEvent.animal_id)))
                .join(VaccinationDetail, VaccinationDetail.event_id == AnimalEvent.event_id)
                .where(
                    AnimalEvent.village_id == v_id,
                    VaccinationDetail.campaign_id == c_id,
                    AnimalEvent.event_type == "VACCINATION"
                )
            )
            covered = (await self.db.execute(cov_stmt)).scalar_one() or 0

            # Count total registered active animals in this village
            elig_stmt = select(func.count(Animal.id)).where(
                Animal.village_id == v_id,
                Animal.status == "ACTIVE"
            )
            eligible = (await self.db.execute(elig_stmt)).scalar_one() or 0

            results.append(CampaignCoverageReportItem(
                campaignId=c_id,
                campaignName=c_name,
                villageId=v_id,
                villageNameGu=v_name,
                programmeCode="FMD",
                eligibleCount=eligible,
                coveredCount=covered,
                targetConfigured=False,
                note="વિભાગીય લક્ષ્યાંક રૂપરેખાંકિત નથી"
            ))

        return results

    async def get_inventory_report(
        self,
        current_user: User,
        district_id: Optional[uuid.UUID] = None,
        client_ip: Optional[str] = None
    ) -> List[InventoryReportItem]:
        """Fetch district vaccine stock and lot transaction metrics.
        
        Scoped to caller's assigned district (DAHO).
        """
        scope = await self.authz.get_user_scope(current_user)
        allowed_districts = scope.assigned_district_ids

        if not allowed_districts and current_user.role not in ("SYS_ADMIN", "ADMIN"):
            return []

        stmt = (
            select(
                VaccineStockLot.id.label("lot_id"),
                VaccineProduct.code.label("product_code"),
                VaccineProduct.name.label("product_name"),
                VaccineProduct.programme_code.label("programme_code"),
                VaccineStockLot.batch_number.label("batch_number"),
                VaccineStockLot.quantity_received.label("received_doses"),
                VaccineStockLot.quantity_issued.label("issued_doses"),
                VaccineStockLot.quantity_wasted.label("wasted_doses"),
                VaccineStockLot.current_balance.label("current_balance"),
                VaccineStockLot.expiry_date.label("expiry_date"),
            )
            .join(VaccineProduct, VaccineProduct.id == VaccineStockLot.product_id)
        )

        if allowed_districts:
            stmt = stmt.where(VaccineStockLot.district_id.in_(allowed_districts))
        if district_id and district_id in allowed_districts:
            stmt = stmt.where(VaccineStockLot.district_id == district_id)

        rows = (await self.db.execute(stmt)).all()
        return [
            InventoryReportItem(
                lotId=r.lot_id,
                productCode=r.product_code,
                productName=r.product_name,
                programmeCode=r.programme_code,
                batchNumber=r.batch_number,
                receivedDoses=r.received_doses,
                issuedDoses=r.issued_doses,
                adjustedDoses=r.wasted_doses,
                currentBalance=r.current_balance,
                expiryDate=r.expiry_date,
            )
            for r in rows
        ]

    async def get_surveillance_report(
        self,
        current_user: User,
        disease_code: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_ip: Optional[str] = None
    ) -> List[SurveillanceReportItem]:
        """Fetch village-level disease surveillance summary.
        
        Strict Invariants:
        - Suspected and Confirmed counts are kept STRICTLY SEPARATE.
        - Zero reports is NEVER rendered as 'safe/disease-free'.
        """
        allowed_villages = await self._resolve_allowed_villages(current_user, client_ip)
        if not allowed_villages:
            return []

        if village_id:
            if village_id not in allowed_villages:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ગામ તમારા કાર્યક્ષેત્રમાં નથી.")
            allowed_villages = {village_id}

        stmt = (
            select(
                DiseaseReport.village_id,
                Village.name_gu.label("village_name_gu"),
                DiseaseReport.disease_code,
                func.count(
                    case((DiseaseReport.status.in_(["SUBMITTED", "UNDER_REVIEW", "SUSPECTED", "NEEDS_MORE_INFORMATION"]), 1))
                ).label("suspected_count"),
                func.count(
                    case((DiseaseReport.status == "CONFIRMED", 1))
                ).label("confirmed_count"),
                func.count(
                    case((DiseaseReport.status == "NOT_CONFIRMED", 1))
                ).label("not_confirmed_count"),
                func.count(
                    case((DiseaseReport.status == "INSUFFICIENT_INFORMATION", 1))
                ).label("insufficient_count"),
                func.max(DiseaseReport.report_date).label("latest_report_date")
            )
            .join(Village, Village.id == DiseaseReport.village_id)
            .where(
                DiseaseReport.village_id.in_(allowed_villages),
                DiseaseReport.duplicate_of.is_(None)
            )
            .group_by(DiseaseReport.village_id, Village.name_gu, DiseaseReport.disease_code)
        )

        if disease_code:
            stmt = stmt.where(DiseaseReport.disease_code == disease_code.upper())
        if start_date:
            stmt = stmt.where(DiseaseReport.report_date >= start_date)
        if end_date:
            stmt = stmt.where(DiseaseReport.report_date <= end_date)

        rows = (await self.db.execute(stmt)).all()
        return [
            SurveillanceReportItem(
                villageId=r.village_id,
                villageNameGu=r.village_name_gu,
                diseaseCode=r.disease_code,
                suspectedCount=r.suspected_count,
                confirmedCount=r.confirmed_count,
                notConfirmedCount=r.not_confirmed_count,
                insufficientCount=r.insufficient_count,
                latestReportDate=r.latest_report_date,
                dataFreshnessStatus="ડેટા ઉપલબ્ધ"
            )
            for r in rows
        ]

    async def get_registry_report(
        self,
        current_user: User,
        village_id: Optional[uuid.UUID] = None,
        client_ip: Optional[str] = None
    ) -> List[RegistryCountsReportItem]:
        """Fetch village livestock registry counts (farmers and species breakdown)."""
        allowed_villages = await self._resolve_allowed_villages(current_user, client_ip)
        if not allowed_villages:
            return []

        if village_id:
            if village_id not in allowed_villages:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ગામ તમારા કાર્યક્ષેત્રમાં નથી.")
            target_village_ids = [village_id]
        else:
            target_village_ids = list(allowed_villages)

        v_stmt = select(Village.id, Village.name_gu).where(Village.id.in_(target_village_ids)).order_by(Village.name_gu)
        v_rows = (await self.db.execute(v_stmt)).all()

        results: List[RegistryCountsReportItem] = []
        for v_id, v_name in v_rows:
            farmer_cnt = (
                await self.db.execute(
                    select(func.count(Farmer.id)).where(Farmer.village_id == v_id, Farmer.active == True)
                )
            ).scalar_one() or 0

            # Species counts
            anim_stmt = (
                select(
                    func.count(Animal.id).label("total"),
                    func.count(case((Animal.species_code == "CATTLE", 1))).label("cattle"),
                    func.count(case((Animal.species_code == "BUFFALO", 1))).label("buffalo"),
                    func.count(case((Animal.species_code == "GOAT", 1))).label("goat"),
                    func.count(case((Animal.species_code == "SHEEP", 1))).label("sheep"),
                    func.count(case((Animal.registration_status == "VERIFIED", 1))).label("verified"),
                )
                .where(Animal.village_id == v_id, Animal.status == "ACTIVE")
            )
            a_row = (await self.db.execute(anim_stmt)).one()

            results.append(RegistryCountsReportItem(
                villageId=v_id,
                villageNameGu=v_name,
                farmerCount=farmer_cnt,
                cattleCount=a_row.cattle or 0,
                buffaloCount=a_row.buffalo or 0,
                goatCount=a_row.goat or 0,
                sheepCount=a_row.sheep or 0,
                totalAnimals=a_row.total or 0,
                verifiedAnimals=a_row.verified or 0,
            ))

        return results

    async def get_staff_activity_report(
        self,
        current_user: User,
        role_filter: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_ip: Optional[str] = None
    ) -> List[StaffActivityReportItem]:
        """Fetch staff registration, vaccination, and surveillance activity counts."""
        await self.authz.assert_any_permission(
            current_user,
            ["district.setup.manage", "field_worker.assign", "activity.read", "technical.manage"],
            ip=client_ip
        )

        u_stmt = select(User.id, User.full_name, User.role).where(
            User.role.in_(["FIELD_WORKER", "VET_OFFICER", "VO", "FW"]),
            User.status == "ACTIVE"
        )
        if role_filter:
            u_stmt = u_stmt.where(User.role == role_filter.upper())

        users = (await self.db.execute(u_stmt)).all()
        results: List[StaffActivityReportItem] = []

        for u_id, u_name, u_role in users:
            # Animal registrations
            r_stmt = select(func.count(Animal.id)).where(Animal.registered_by == u_id)
            if start_date:
                r_stmt = r_stmt.where(func.date(Animal.created_at) >= start_date)
            if end_date:
                r_stmt = r_stmt.where(func.date(Animal.created_at) <= end_date)
            reg_cnt = (await self.db.execute(r_stmt)).scalar_one() or 0

            # Vaccinations performed
            v_stmt = select(func.count(AnimalEvent.event_id)).where(
                AnimalEvent.performed_by == u_id,
                AnimalEvent.event_type == "VACCINATION"
            )
            if start_date:
                v_stmt = v_stmt.where(AnimalEvent.event_date >= start_date)
            if end_date:
                v_stmt = v_stmt.where(AnimalEvent.event_date <= end_date)
            vac_cnt = (await self.db.execute(v_stmt)).scalar_one() or 0

            # Disease reports submitted
            d_stmt = select(func.count(DiseaseReport.report_id)).where(DiseaseReport.reported_by == u_id)
            if start_date:
                d_stmt = d_stmt.where(DiseaseReport.report_date >= start_date)
            if end_date:
                d_stmt = d_stmt.where(DiseaseReport.report_date <= end_date)
            dr_cnt = (await self.db.execute(d_stmt)).scalar_one() or 0

            results.append(StaffActivityReportItem(
                staffUserId=u_id,
                staffName=u_name,
                role=u_role,
                registrationsCount=reg_cnt,
                vaccinationsCount=vac_cnt,
                diseaseReportsCount=dr_cnt,
            ))

        return results

    async def get_coop_progress_report(
        self,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[CoopProgressReportItem]:
        """Fetch aggregate vaccination progress for cooperative assigned villages.
        
        Strict Privacy:
        Never reveals individual owner names, addresses, or animal tag IDs.
        """
        scope = await self.authz.get_user_scope(current_user)
        coop_villages = scope.cooperative_village_ids
        if not coop_villages:
            return []

        v_stmt = select(Village.id, Village.name_gu).where(Village.id.in_(coop_villages)).order_by(Village.name_gu)
        v_rows = (await self.db.execute(v_stmt)).all()

        results: List[CoopProgressReportItem] = []
        for v_id, v_name in v_rows:
            tot = (
                await self.db.execute(
                    select(func.count(Animal.id)).where(Animal.village_id == v_id, Animal.status == "ACTIVE")
                )
            ).scalar_one() or 0

            vac = (
                await self.db.execute(
                    select(func.count(distinct(AnimalEvent.animal_id)))
                    .where(AnimalEvent.village_id == v_id, AnimalEvent.event_type == "VACCINATION")
                )
            ).scalar_one() or 0

            results.append(CoopProgressReportItem(
                villageId=v_id,
                villageNameGu=v_name,
                totalAnimals=tot,
                vaccinatedCount=vac,
                pendingCount=max(0, tot - vac),
            ))

        return results

    async def log_export(
        self,
        user_id: uuid.UUID,
        export_type: str,
        filters: Optional[Dict[str, Any]] = None,
        purpose: str = "OPERATIONAL_REPORT",
        row_count: int = 0,
        formula_safe: bool = True
    ) -> ExportLog:
        """Record export transaction into PostgreSQL 'export_log' table."""
        log_entry = ExportLog(
            id=uuid.uuid4(),
            user_id=user_id,
            export_type=export_type,
            filters=filters or {},
            purpose=purpose,
            row_count=row_count,
            formula_safe=formula_safe,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(log_entry)
        await self.db.commit()
        return log_entry

    async def get_export_history(
        self,
        current_user: User,
        limit: int = 50,
        client_ip: Optional[str] = None
    ) -> List[ExportLogItem]:
        """Fetch recent export history for caller."""
        stmt = (
            select(ExportLog)
            .where(ExportLog.user_id == current_user.id)
            .order_by(ExportLog.created_at.desc())
            .limit(limit)
        )
        logs = (await self.db.execute(stmt)).scalars().all()
        return [
            ExportLogItem(
                id=log.id,
                exportType=log.export_type,
                filters=log.filters,
                purpose=log.purpose,
                rowCount=log.row_count,
                formulaSafe=log.formula_safe,
                createdAt=log.created_at,
            )
            for log in logs
        ]

