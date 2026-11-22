"""Taluka Administration (TAHO) Service Layer.

Provides comprehensive Taluka-level operational administration:
- Real database-backed Taluka & Village KPIs
- Taluka GIS & Village Analytics
- Veterinary Officer (VO) Management & Email Activation
- Field Worker (FW) Management & Location-based Village Assignment
- Taluka Vaccination Campaign Management & Progress Tracking
- Taluka-scoped Vaccination Monitoring
- Taluka-scoped Animal & Farmer Records
- Disease Surveillance, Investigation Tracking & Early Warning Clusters
- Reports & Analytics
- Actionable Operational Insights
- Realistic, Safe & Resettable Demonstration Data (Requirement 19)
"""

import json
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, status
from sqlalchemy import distinct, func, select, and_, or_, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.core.security import get_password_hash
from app.models.geography import District, Taluka, Village
from app.modules.animals.models import Animal
from app.modules.authentication.models import (
    AuditEvent,
    TahoTalukaAssignment,
    User,
    UserVillageAssignment,
)
from app.modules.campaigns.models import Campaign, CampaignVillage
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.farmers.models import Farmer
from app.modules.vaccinations.models import AnimalEvent
from app.core.email_service import (
    send_vo_activation_email,
    send_fw_activation_email,
)


class TahoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_taho_taluka(
        self,
        taho_user: User,
        override_taluka_id: Optional[uuid.UUID] = None
    ) -> Tuple[Taluka, District]:
        """Resolve active assigned Taluka for the authenticated TAHO user."""
        if taho_user.role in ("SUPER_ADMIN", "SYS_ADMIN", "DAHO") and override_taluka_id:
            taluka = (await self.db.execute(select(Taluka).where(Taluka.id == override_taluka_id))).scalar_one_or_none()
            if not taluka:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified Taluka not found.")
            district = (await self.db.execute(select(District).where(District.id == taluka.district_id))).scalar_one_or_none()
            return taluka, district

        asgn_stmt = (
            select(TahoTalukaAssignment, Taluka, District)
            .join(Taluka, TahoTalukaAssignment.taluka_id == Taluka.id)
            .join(District, Taluka.district_id == District.id)
            .where(
                TahoTalukaAssignment.taho_user_id == taho_user.id,
                TahoTalukaAssignment.ended_at.is_(None)
            )
        )
        row = (await self.db.execute(asgn_stmt)).first()
        if not row:
            if taho_user.role in ("SUPER_ADMIN", "SYS_ADMIN"):
                # Fallback to first available taluka
                first_taluka = (await self.db.execute(select(Taluka).order_by(Taluka.name_en).limit(1))).scalar_one_or_none()
                if first_taluka:
                    dist = (await self.db.execute(select(District).where(District.id == first_taluka.district_id))).scalar_one_or_none()
                    return first_taluka, dist
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not currently have an active Taluka assigned. Please contact your DAHO."
            )
        _, taluka, district = row
        return taluka, district

    # ==========================================================================
    # 1. TAHO Dashboard KPIs & Multi-Dimensional Analytics
    # ==========================================================================
    async def get_taho_overview(
        self,
        taho_user: User,
        override_taluka_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """Aggregate real database KPIs, 10 analytic datasets, and actionable insights for TAHO."""
        taluka, district = await self.get_taho_taluka(taho_user, override_taluka_id)
        taluka_id = taluka.id

        # 1. Geographic & Staff Counts
        v_count = (await self.db.execute(
            select(func.count(Village.id)).where(Village.taluka_id == taluka_id, Village.active == True)
        )).scalar() or 0

        vo_count = (await self.db.execute(
            select(func.count(distinct(UserVillageAssignment.user_id)))
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .join(User, UserVillageAssignment.user_id == User.id)
            .where(Village.taluka_id == taluka_id, User.role == "VET_OFFICER", UserVillageAssignment.ended_at.is_(None))
        )).scalar() or 0

        fw_count = (await self.db.execute(
            select(func.count(distinct(UserVillageAssignment.user_id)))
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .join(User, UserVillageAssignment.user_id == User.id)
            .where(Village.taluka_id == taluka_id, User.role == "FIELD_WORKER", UserVillageAssignment.ended_at.is_(None))
        )).scalar() or 0

        # 2. Farmers & Animals
        farmers_count = (await self.db.execute(
            select(func.count(distinct(Farmer.id)))
            .join(Village, Farmer.village_id == Village.id)
            .where(Village.taluka_id == taluka_id, Farmer.active == True)
        )).scalar() or 0

        animals_count = (await self.db.execute(
            select(func.count(distinct(Animal.id)))
            .join(Village, Animal.village_id == Village.id)
            .where(Village.taluka_id == taluka_id, Animal.status == "ACTIVE")
        )).scalar() or 0

        # 3. Vaccinations
        total_vaccinations = (await self.db.execute(
            select(func.count(AnimalEvent.event_id))
            .join(Village, AnimalEvent.village_id == Village.id)
            .where(Village.taluka_id == taluka_id, AnimalEvent.event_type == "VACCINATION")
        )).scalar() or 0

        completed_vaccinations = (await self.db.execute(
            select(func.count(AnimalEvent.event_id))
            .join(Village, AnimalEvent.village_id == Village.id)
            .where(
                Village.taluka_id == taluka_id,
                AnimalEvent.event_type == "VACCINATION",
                or_(AnimalEvent.review_status == "VERIFIED", AnimalEvent.review_status == "COMPLETED", AnimalEvent.review_status.is_(None))
            )
        )).scalar() or 0

        pending_vaccinations = max(0, animals_count - completed_vaccinations)
        overdue_vaccinations = 0  # Overdue schedule

        # 4. Disease Reports & Alerts
        total_disease_reports = (await self.db.execute(
            select(func.count(DiseaseReport.report_id))
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(Village.taluka_id == taluka_id)
        )).scalar() or 0

        active_disease_reports = (await self.db.execute(
            select(func.count(DiseaseReport.report_id))
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(
                Village.taluka_id == taluka_id,
                DiseaseReport.status.in_(["REPORTED", "UNDER_INVESTIGATION", "SUBMITTED", "PENDING_REVIEW"])
            )
        )).scalar() or 0

        disease_alerts_count = (await self.db.execute(
            select(func.count(DiseaseReport.report_id))
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(
                Village.taluka_id == taluka_id,
                DiseaseReport.status.in_(["SUBMITTED", "UNDER_INVESTIGATION", "CONFIRMED"])
            )
        )).scalar() or 0

        # 5. Active Campaigns in Taluka
        active_campaigns = (await self.db.execute(
            select(func.count(distinct(CampaignVillage.campaign_id)))
            .join(Village, CampaignVillage.village_id == Village.id)
            .join(Campaign, CampaignVillage.campaign_id == Campaign.id)
            .where(Village.taluka_id == taluka_id, Campaign.status == "ACTIVE")
        )).scalar() or 0

        # 6. Village-wise Vaccination Coverage
        villages = (await self.db.execute(
            select(Village).where(Village.taluka_id == taluka_id, Village.active == True).order_by(Village.name_en)
        )).scalars().all()

        village_coverage = []
        low_coverage_villages = []
        high_pending_villages = []
        unassigned_villages = []

        for v in villages:
            v_animals = (await self.db.execute(
                select(func.count(distinct(Animal.id))).where(Animal.village_id == v.id, Animal.status == "ACTIVE")
            )).scalar() or 0

            v_vax = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.village_id == v.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0

            v_pending = max(0, v_animals - v_vax)
            pct = round((v_vax / v_animals * 100), 1) if v_animals > 0 else 0.0

            # Check assigned staff
            has_staff = (await self.db.execute(
                select(func.count(UserVillageAssignment.id)).where(UserVillageAssignment.village_id == v.id, UserVillageAssignment.ended_at.is_(None))
            )).scalar() or 0

            if has_staff == 0:
                unassigned_villages.append({"village_id": str(v.id), "name_en": v.name_en, "name_gu": v.name_gu})

            if v_animals > 0 and pct < 40.0:
                low_coverage_villages.append({
                    "village_id": str(v.id),
                    "name_en": v.name_en,
                    "name_gu": v.name_gu,
                    "animals": v_animals,
                    "vaccinated": v_vax,
                    "coverage_pct": pct
                })

            if v_pending >= 3:
                high_pending_villages.append({
                    "village_id": str(v.id),
                    "name_en": v.name_en,
                    "name_gu": v.name_gu,
                    "pending_count": v_pending
                })

            village_coverage.append({
                "village_id": str(v.id),
                "name_en": v.name_en,
                "name_gu": v.name_gu,
                "animals": v_animals,
                "vaccinated": v_vax,
                "pending": v_pending,
                "coverage_pct": pct
            })

        # 7. Species-wise Animal Distribution
        species_rows = (await self.db.execute(
            select(Animal.species_code, func.count(Animal.id))
            .join(Village, Animal.village_id == Village.id)
            .where(Village.taluka_id == taluka_id, Animal.status == "ACTIVE")
            .group_by(Animal.species_code)
        )).fetchall()

        species_colors = {
            "CATTLE": "#135D43",
            "BUFFALO": "#0284C7",
            "GOAT": "#D97706",
            "SHEEP": "#7C3AED",
            "POULTRY": "#DC2626"
        }
        species_gu = {
            "CATTLE": "ગાય / બળદ (Cattle)",
            "BUFFALO": "ભેંસ (Buffalo)",
            "GOAT": "બકરી (Goat)",
            "SHEEP": "ઘેટાં (Sheep)",
            "POULTRY": "મરઘાં (Poultry)"
        }
        species_distribution = [
            {
                "species": sp,
                "label": species_gu.get(sp.upper() if sp else "", sp or "અન્ય"),
                "count": cnt,
                "color": species_colors.get(sp.upper() if sp else "", "#64748B")
            }
            for sp, cnt in species_rows
        ]

        # 8. Monthly & Daily Vaccination Trends (Past 30 days)
        today = datetime.now(timezone.utc).date()
        thirty_days_ago = today - timedelta(days=29)

        daily_vax_rows = (await self.db.execute(
            select(AnimalEvent.event_date, func.count(AnimalEvent.event_id))
            .join(Village, AnimalEvent.village_id == Village.id)
            .where(
                Village.taluka_id == taluka_id,
                AnimalEvent.event_type == "VACCINATION",
                AnimalEvent.event_date >= thirty_days_ago
            )
            .group_by(AnimalEvent.event_date)
            .order_by(AnimalEvent.event_date)
        )).fetchall()

        vax_date_map = {row[0]: row[1] for row in daily_vax_rows if row[0]}
        daily_trends = []
        for i in range(30):
            d = thirty_days_ago + timedelta(days=i)
            daily_trends.append({
                "date": d.isoformat(),
                "label": d.strftime("%d/%m"),
                "value": vax_date_map.get(d, 0)
            })

        # 9. Disease-wise Breakdown & Cases
        disease_cases = (await self.db.execute(
            select(DiseaseReport.disease_code, func.count(DiseaseReport.report_id))
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(Village.taluka_id == taluka_id)
            .group_by(DiseaseReport.disease_code)
        )).fetchall()

        disease_info = {
            "FMD": {"name_gu": "FMD (ખરવા-મોવાસા)", "color": "#DC2626"},
            "HS": {"name_gu": "HS (ગળસૂંઠો)", "color": "#0284C7"},
            "BQ": {"name_gu": "BQ (ગાઠીયો તાવ)", "color": "#135D43"},
            "BRUCELLOSIS": {"name_gu": "Brucellosis (બ્રુસેલોસિસ)", "color": "#D97706"},
            "LSD": {"name_gu": "LSD (લમ્પી ત્વચા રોગ)", "color": "#EA580C"},
            "FEVER": {"name_gu": "સામાન્ય તાવ (Fever)", "color": "#EAB308"}
        }

        disease_breakdown = [
            {
                "code": d_code,
                "label": disease_info.get(d_code.upper() if d_code else "", {}).get("name_gu", d_code or "અજ્ઞાત રોગ"),
                "count": cnt,
                "color": disease_info.get(d_code.upper() if d_code else "", {}).get("color", "#64748B")
            }
            for d_code, cnt in disease_cases
        ]

        # 10. Staff Performance Summaries (VO & FW)
        vo_users = (await self.db.execute(
            select(User, func.count(distinct(UserVillageAssignment.village_id)).label("village_count"))
            .join(UserVillageAssignment, User.id == UserVillageAssignment.user_id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(Village.taluka_id == taluka_id, User.role == "VET_OFFICER", UserVillageAssignment.ended_at.is_(None))
            .group_by(User.id)
        )).fetchall()

        vo_performance = []
        for u, v_c in vo_users:
            vax_done = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.performed_by == u.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0
            vo_performance.append({
                "id": str(u.id),
                "name": u.full_name,
                "username": u.username,
                "assigned_villages_count": v_c,
                "vaccinations_performed": vax_done,
                "status": u.status
            })

        fw_users = (await self.db.execute(
            select(User, func.count(distinct(UserVillageAssignment.village_id)).label("village_count"))
            .join(UserVillageAssignment, User.id == UserVillageAssignment.user_id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(Village.taluka_id == taluka_id, User.role == "FIELD_WORKER", UserVillageAssignment.ended_at.is_(None))
            .group_by(User.id)
        )).fetchall()

        fw_performance = []
        for u, v_c in fw_users:
            vax_done = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.performed_by == u.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0
            fw_performance.append({
                "id": str(u.id),
                "name": u.full_name,
                "username": u.username,
                "assigned_villages_count": v_c,
                "vaccinations_performed": vax_done,
                "status": u.status
            })

        # 11. Actionable Operational Insights
        actionable_insights = []
        if len(unassigned_villages) > 0:
            actionable_insights.append({
                "id": "INS-UNASSIGNED",
                "severity": "HIGH",
                "title": f"{len(unassigned_villages)} ગામોમાં ક્ષેત્રીય સ્ટાફની સોંપણી બાકી છે",
                "description": "તાલુકા હેઠળના આ ગામોમાં નિયમિત રસીકરણ અને દેખરેખ માટે વેટરનરી ઓફિસર કે ફીલ્ડ વર્કર નિયુક્ત કરો.",
                "action_label": "સ્ટાફ સોંપણી કરો",
                "target_route": "/taho/staff",
                "count": len(unassigned_villages)
            })

        if len(low_coverage_villages) > 0:
            actionable_insights.append({
                "id": "INS-LOW-COV",
                "severity": "CRITICAL" if len(low_coverage_villages) > 3 else "MEDIUM",
                "title": f"{len(low_coverage_villages)} ગામોમાં રસીકરણ કવરેજ ૪૦% થી ઓછું છે",
                "description": "તાત્કાલિક રસીકરણ ઝુંબેશ અને કેમ્પ આયોજિત કરી કવરેજ વધારવાની જરૂર છે.",
                "action_label": "ઝુંબેશ બનાવો",
                "target_route": "/taho/campaigns",
                "count": len(low_coverage_villages)
            })

        if active_disease_reports > 0:
            actionable_insights.append({
                "id": "INS-DIS-ACTIVE",
                "severity": "CRITICAL",
                "title": f"{active_disease_reports} રોગ સર્વેક્ષણ કેસ તપાસ હેઠળ છે",
                "description": "શંકાસ્પદ કેસોની ક્લિનિકલ તપાસ અને સેમ્પલ કન્ફર્મેશન માટે VO ને કામગીરી સોંપો.",
                "action_label": "સર્વેક્ષણ જુઓ",
                "target_route": "/taho/surveillance",
                "count": active_disease_reports
            })

        overall_coverage_pct = round((completed_vaccinations / animals_count * 100), 1) if animals_count > 0 else 0.0

        return {
            "has_assignment": True,
            "taluka_id": str(taluka.id),
            "taluka_code": taluka.code,
            "taluka_name_en": taluka.name_en,
            "taluka_name_gu": taluka.name_gu,
            "district_id": str(district.id),
            "district_name_en": district.name_en,
            "district_name_gu": district.name_gu,
            "total_villages": v_count,
            "total_animals": animals_count,
            "total_farmers": farmers_count,
            "total_vos": vo_count,
            "total_fws": fw_count,
            "active_campaigns": active_campaigns,
            "total_vaccinations": total_vaccinations,
            "completed_vaccinations": completed_vaccinations,
            "pending_vaccinations": pending_vaccinations,
            "overdue_vaccinations": overdue_vaccinations,
            "overall_coverage_pct": overall_coverage_pct,
            "total_disease_reports": total_disease_reports,
            "active_disease_reports": active_disease_reports,
            "disease_alerts": disease_alerts_count,
            "species_distribution": species_distribution,
            "daily_vaccination_trends": daily_trends,
            "disease_breakdown": disease_breakdown,
            "village_coverage": village_coverage[:50],
            "vo_performance": vo_performance,
            "fw_performance": fw_performance,
            "actionable_insights": actionable_insights,
            "pending_vs_completed": {
                "completed": completed_vaccinations,
                "pending": pending_vaccinations
            }
        }

    # ==========================================================================
    # 2. Taluka GIS & Village Hierarchy Analytics
    # ==========================================================================
    async def get_taho_hierarchy(
        self,
        taho_user: User,
        override_taluka_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """Return Taluka polygon, all villages with boundaries, coordinates, and health stats."""
        taluka, district = await self.get_taho_taluka(taho_user, override_taluka_id)

        villages = list((await self.db.execute(
            select(Village).where(Village.taluka_id == taluka.id, Village.active == True).order_by(Village.name_en)
        )).scalars().all())

        village_items = []
        for v in villages:
            an_cnt = (await self.db.execute(
                select(func.count(distinct(Animal.id))).where(Animal.village_id == v.id, Animal.status == "ACTIVE")
            )).scalar() or 0

            vax_cnt = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.village_id == v.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0

            dis_cnt = (await self.db.execute(
                select(func.count(DiseaseReport.report_id)).where(DiseaseReport.village_id == v.id)
            )).scalar() or 0

            # Staff assignment
            asgn_staff = (await self.db.execute(
                select(User.full_name, User.role)
                .join(UserVillageAssignment, User.id == UserVillageAssignment.user_id)
                .where(UserVillageAssignment.village_id == v.id, UserVillageAssignment.ended_at.is_(None))
            )).fetchall()

            vos_assigned = [name for name, role in asgn_staff if role == "VET_OFFICER"]
            fws_assigned = [name for name, role in asgn_staff if role == "FIELD_WORKER"]

            village_items.append({
                "village_id": str(v.id),
                "code": v.code,
                "name_en": v.name_en,
                "name_gu": v.name_gu,
                "census_code": v.census_code,
                "latitude": float(v.latitude) if v.latitude else None,
                "longitude": float(v.longitude) if v.longitude else None,
                "has_boundary": v.boundary_geojson is not None,
                "animal_count": an_cnt,
                "vaccination_count": vax_cnt,
                "pending_count": max(0, an_cnt - vax_cnt),
                "coverage_pct": round((vax_cnt / an_cnt * 100), 1) if an_cnt > 0 else 0.0,
                "disease_count": dis_cnt,
                "assigned_vos": vos_assigned,
                "assigned_fws": fws_assigned
            })

        return {
            "taluka_id": str(taluka.id),
            "taluka_code": taluka.code,
            "taluka_name_en": taluka.name_en,
            "taluka_name_gu": taluka.name_gu,
            "district_id": str(district.id),
            "district_name_en": district.name_en,
            "district_name_gu": district.name_gu,
            "boundary_geojson": taluka.boundary_geojson,
            "villages": village_items
        }

    # ==========================================================================
    # 2.1 Filter-based GIS Analytics & Color-coded Layer Data
    # ==========================================================================
    async def get_gis_analytics(
        self,
        taho_user: User,
        layer_mode: str = "coverage",
        village_id: Optional[uuid.UUID] = None,
        vaccine_code: Optional[str] = None,
        disease_code: Optional[str] = None,
        campaign_id: Optional[uuid.UUID] = None,
        species_code: Optional[str] = None,
        vaccination_status: Optional[str] = None,
        disease_status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        vo_id: Optional[uuid.UUID] = None,
        fw_id: Optional[uuid.UUID] = None,
        coverage_range: Optional[str] = None
    ) -> Dict[str, Any]:
        """Dynamically compute filter-aware GIS analytics, color assignments, legend, and connected charts."""
        taluka, district = await self.get_taho_taluka(taho_user)

        # Parse date range
        d_start, d_end = None, None
        if start_date:
            try:
                d_start = datetime.strptime(start_date.strip(), "%Y-%m-%d").date()
            except Exception:
                pass
        if end_date:
            try:
                d_end = datetime.strptime(end_date.strip(), "%Y-%m-%d").date()
            except Exception:
                pass

        # 1. Fetch all villages in Taluka
        villages = list((await self.db.execute(
            select(Village).where(Village.taluka_id == taluka.id).order_by(Village.name_en)
        )).scalars().all())

        # 2. Animals per village
        an_stmt = (
            select(Animal.village_id, Animal.species_code, func.count(Animal.id))
            .join(Village, Animal.village_id == Village.id)
            .where(Village.taluka_id == taluka.id, Animal.status == "ACTIVE")
        )
        if species_code:
            an_stmt = an_stmt.where(Animal.species_code.ilike(species_code.strip()))
        an_stmt = an_stmt.group_by(Animal.village_id, Animal.species_code)
        an_rows = (await self.db.execute(an_stmt)).fetchall()

        village_animals: Dict[Any, Dict[str, Any]] = {}
        for v_id, sp, cnt in an_rows:
            if v_id not in village_animals:
                village_animals[v_id] = {"total": 0, "species": {}}
            village_animals[v_id]["total"] += cnt
            village_animals[v_id]["species"][sp] = cnt

        # 3. Farmers per village
        fm_rows = (await self.db.execute(
            select(Farmer.village_id, func.count(Farmer.id))
            .join(Village, Farmer.village_id == Village.id)
            .where(Village.taluka_id == taluka.id, Farmer.active == True)
            .group_by(Farmer.village_id)
        )).fetchall()
        village_farmers = {v_id: cnt for v_id, cnt in fm_rows}

        # 4. Vaccinations per village
        vax_stmt = (
            select(
                AnimalEvent.village_id,
                Animal.species_code,
                AnimalEvent.review_status,
                AnimalEvent.remarks,
                AnimalEvent.event_date,
                func.count(AnimalEvent.event_id)
            )
            .join(Village, AnimalEvent.village_id == Village.id)
            .outerjoin(Animal, AnimalEvent.animal_id == Animal.id)
            .where(Village.taluka_id == taluka.id, AnimalEvent.event_type == "VACCINATION")
        )
        if d_start:
            vax_stmt = vax_stmt.where(AnimalEvent.event_date >= d_start)
        if d_end:
            vax_stmt = vax_stmt.where(AnimalEvent.event_date <= d_end)
        if species_code:
            vax_stmt = vax_stmt.where(Animal.species_code.ilike(species_code.strip()))
        if vaccine_code:
            vax_stmt = vax_stmt.where(AnimalEvent.remarks.ilike(f"%{vaccine_code.strip()}%"))
        if vaccination_status:
            vax_stmt = vax_stmt.where(AnimalEvent.review_status == vaccination_status.strip())
        if vo_id:
            vax_stmt = vax_stmt.where(AnimalEvent.performed_by == vo_id)
        if fw_id:
            vax_stmt = vax_stmt.where(AnimalEvent.performed_by == fw_id)

        vax_stmt = vax_stmt.group_by(
            AnimalEvent.village_id, Animal.species_code, AnimalEvent.review_status, AnimalEvent.remarks, AnimalEvent.event_date
        )
        vax_rows = (await self.db.execute(vax_stmt)).fetchall()

        village_vax: Dict[Any, Dict[str, Any]] = {}
        vaccine_totals: Dict[str, int] = {}
        species_vax_totals: Dict[str, int] = {}
        daily_vax_counts: Dict[str, int] = {}

        for v_id, sp, rev_st, rem, ev_date, cnt in vax_rows:
            if v_id not in village_vax:
                village_vax[v_id] = {"total": 0, "verified": 0, "pending": 0}
            village_vax[v_id]["total"] += cnt
            if rev_st == "VERIFIED":
                village_vax[v_id]["verified"] += cnt
            else:
                village_vax[v_id]["pending"] += cnt

            if sp:
                species_vax_totals[sp] = species_vax_totals.get(sp, 0) + cnt

            v_cand = "FMD"
            if rem:
                for cand in ["FMD", "BRUCELLOSIS", "HS", "BQ", "ANTHRAX", "LSD"]:
                    if cand in rem.upper():
                        v_cand = cand
                        break
            vaccine_totals[v_cand] = vaccine_totals.get(v_cand, 0) + cnt

            if ev_date:
                d_str = ev_date.isoformat()
                daily_vax_counts[d_str] = daily_vax_counts.get(d_str, 0) + cnt

        # 5. Disease reports per village
        dis_stmt = (
            select(
                DiseaseReport.village_id,
                DiseaseReport.disease_code,
                DiseaseReport.status,
                DiseaseReport.report_date,
                func.count(DiseaseReport.report_id)
            )
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(Village.taluka_id == taluka.id)
        )
        if disease_code:
            dis_stmt = dis_stmt.where(DiseaseReport.disease_code.ilike(disease_code.strip()))
        if disease_status:
            dis_stmt = dis_stmt.where(DiseaseReport.status == disease_status.strip())
        if d_start:
            dis_stmt = dis_stmt.where(DiseaseReport.report_date >= d_start)
        if d_end:
            dis_stmt = dis_stmt.where(DiseaseReport.report_date <= d_end)
        dis_stmt = dis_stmt.group_by(
            DiseaseReport.village_id, DiseaseReport.disease_code, DiseaseReport.status, DiseaseReport.report_date
        )
        dis_rows = (await self.db.execute(dis_stmt)).fetchall()

        village_dis: Dict[Any, Dict[str, Any]] = {}
        disease_totals: Dict[str, int] = {}
        disease_status_totals: Dict[str, int] = {}
        daily_dis_counts: Dict[str, int] = {}

        for v_id, d_c, st, rep_date, cnt in dis_rows:
            if v_id not in village_dis:
                village_dis[v_id] = {"total": 0, "active": 0, "breakdown": {}}
            village_dis[v_id]["total"] += cnt
            if st in ("REPORTED", "UNDER_INVESTIGATION"):
                village_dis[v_id]["active"] += cnt
            village_dis[v_id]["breakdown"][d_c] = village_dis[v_id]["breakdown"].get(d_c, 0) + cnt

            disease_totals[d_c] = disease_totals.get(d_c, 0) + cnt
            disease_status_totals[st] = disease_status_totals.get(st, 0) + cnt

            if rep_date:
                d_str = rep_date.isoformat()
                daily_dis_counts[d_str] = daily_dis_counts.get(d_str, 0) + cnt

        # 6. Assigned staff per village
        staff_rows = (await self.db.execute(
            select(UserVillageAssignment.village_id, User.id, User.full_name, User.role)
            .join(User, UserVillageAssignment.user_id == User.id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(Village.taluka_id == taluka.id, UserVillageAssignment.ended_at.is_(None))
        )).fetchall()
        village_staff: Dict[Any, Dict[str, List[str]]] = {}
        all_vos: Dict[str, str] = {}
        all_fws: Dict[str, str] = {}
        for v_id, u_id, name, r in staff_rows:
            if v_id not in village_staff:
                village_staff[v_id] = {"vos": [], "fws": []}
            if r == "VET_OFFICER":
                village_staff[v_id]["vos"].append(name)
                all_vos[str(u_id)] = name
            else:
                village_staff[v_id]["fws"].append(name)
                all_fws[str(u_id)] = name

        # 7. Campaigns linked to villages
        camp_query = (
            select(CampaignVillage.village_id, Campaign.id, Campaign.name, Campaign.code, Campaign.status)
            .join(Campaign, CampaignVillage.campaign_id == Campaign.id)
            .join(Village, CampaignVillage.village_id == Village.id)
            .where(Village.taluka_id == taluka.id)
        )
        if campaign_id:
            camp_query = camp_query.where(Campaign.id == campaign_id)
        camp_rows = (await self.db.execute(camp_query)).fetchall()
        village_campaigns: Dict[Any, List[Dict[str, Any]]] = {}
        all_campaigns: Dict[str, Dict[str, Any]] = {}
        for v_id, c_id, c_name, c_code, c_status in camp_rows:
            if v_id not in village_campaigns:
                village_campaigns[v_id] = []
            village_campaigns[v_id].append({"id": str(c_id), "name": c_name, "code": c_code, "status": c_status})
            all_campaigns[str(c_id)] = {"id": str(c_id), "name": c_name, "code": c_code}

        # 8. Compute village metrics & layer colors
        all_populations = [village_animals.get(v.id, {}).get("total", 0) for v in villages]
        max_pop = max(all_populations) if all_populations and max(all_populations) > 0 else 100

        village_metrics_list = []
        legend_counts: Dict[str, int] = {}

        for v in villages:
            v_id = v.id
            an_data = village_animals.get(v_id, {"total": 0, "species": {}})
            an_cnt = an_data["total"]
            fm_cnt = village_farmers.get(v_id, 0)
            vx_data = village_vax.get(v_id, {"total": 0, "verified": 0, "pending": 0})
            vax_done = vx_data["total"]
            dis_data = village_dis.get(v_id, {"total": 0, "active": 0, "breakdown": {}})
            dis_cnt = dis_data["total"]
            st_data = village_staff.get(v_id, {"vos": [], "fws": []})
            camps = village_campaigns.get(v_id, [])

            target_animals = an_cnt
            pending_count = max(0, target_animals - vax_done)
            coverage_pct = round((vax_done / target_animals * 100), 1) if target_animals > 0 else 0.0

            # Color calculation by layer_mode
            fill_color = "#E2E8F0"
            status_label = "સામાન્ય"

            if layer_mode == "coverage":
                if target_animals == 0:
                    fill_color = "#E2E8F0"
                    status_label = "પશુધન નોંધાયેલ નથી"
                elif coverage_pct <= 25.0:
                    fill_color = "#EF4444"
                    status_label = "અતિ ઓછું કવરેજ (0-25%)"
                elif coverage_pct <= 50.0:
                    fill_color = "#F97316"
                    status_label = "લક્ષ્યાંકથી ઓછું (26-50%)"
                elif coverage_pct <= 75.0:
                    fill_color = "#F59E0B"
                    status_label = "મધ્યમ કવરેજ (51-75%)"
                else:
                    fill_color = "#10B981"
                    status_label = "ઉચ્ચ કવરેજ (76-100%)"

            elif layer_mode == "disease":
                if dis_cnt == 0:
                    fill_color = "#10B981"
                    status_label = "કોઈ કેસ નથી (Case-Free)"
                elif dis_cnt <= 2:
                    fill_color = "#F59E0B"
                    status_label = "ઓછા કેસો (1-2 Cases)"
                elif dis_cnt <= 5:
                    fill_color = "#F97316"
                    status_label = "મધ્યમ એકાગ્રતા (3-5 Cases)"
                else:
                    fill_color = "#EF4444"
                    status_label = "ઉચ્ચ એકાગ્રતા (>5 Cases)"

            elif layer_mode == "pending":
                if pending_count <= 5:
                    fill_color = "#10B981"
                    status_label = "ઓછું બાકી (0-5 Pending)"
                elif pending_count <= 15:
                    fill_color = "#F59E0B"
                    status_label = "મધ્યમ બાકી (6-15 Pending)"
                elif pending_count <= 30:
                    fill_color = "#F97316"
                    status_label = "વધારે બાકી (16-30 Pending)"
                else:
                    fill_color = "#EF4444"
                    status_label = "ગંભીર બાકી (>30 Pending)"

            elif layer_mode == "campaign":
                if not camps:
                    fill_color = "#94A3B8"
                    status_label = "ઝુંબેશમાં નથી"
                elif coverage_pct == 0:
                    fill_color = "#CBD5E1"
                    status_label = "શરૂ નથી થયેલ (0%)"
                elif coverage_pct < 50.0:
                    fill_color = "#F59E0B"
                    status_label = "ચાલુ છે (1-50%)"
                elif coverage_pct < 90.0:
                    fill_color = "#3B82F6"
                    status_label = "લગભગ પૂર્ણ (51-89%)"
                else:
                    fill_color = "#10B981"
                    status_label = "સંપૂર્ણ (90-100%)"

            elif layer_mode == "population":
                if an_cnt == 0:
                    fill_color = "#E2E8F0"
                    status_label = "શૂન્ય પશુધન"
                elif an_cnt <= max_pop * 0.25:
                    fill_color = "#BBF7D0"
                    status_label = "ઓછી વસ્તી"
                elif an_cnt <= max_pop * 0.50:
                    fill_color = "#4ADE80"
                    status_label = "મધ્યમ વસ્તી"
                elif an_cnt <= max_pop * 0.75:
                    fill_color = "#16A34A"
                    status_label = "ઉચ્ચ વસ્તી"
                else:
                    fill_color = "#14532D"
                    status_label = "સૌથી વધુ વસ્તી"

            elif layer_mode == "risk":
                if dis_cnt == 0:
                    fill_color = "#10B981"
                    status_label = "સામાન્ય સ્થિતિ (Normal)"
                elif dis_cnt == 1:
                    fill_color = "#F59E0B"
                    status_label = "તપાસ હેઠળ (Investigation)"
                elif dis_cnt >= 2 and "CONFIRMED" not in dis_data["breakdown"]:
                    fill_color = "#F97316"
                    status_label = "શંકાસ્પદ ક્લસ્ટર (Cluster Signal)"
                else:
                    fill_color = "#EF4444"
                    status_label = "પુષ્ટિ થયેલ ચેતવણી (Confirmed Alert)"

            legend_counts[status_label] = legend_counts.get(status_label, 0) + 1

            # Filter check (e.g. coverage range filter)
            matches_filter = True
            if coverage_range:
                if coverage_range == "0-25" and coverage_pct > 25.0:
                    matches_filter = False
                elif coverage_range == "26-50" and not (25.0 < coverage_pct <= 50.0):
                    matches_filter = False
                elif coverage_range == "51-75" and not (50.0 < coverage_pct <= 75.0):
                    matches_filter = False
                elif coverage_range == "76-100" and coverage_pct <= 75.0:
                    matches_filter = False

            if village_id and v_id != village_id:
                matches_filter = False

            item = {
                "village_id": str(v_id),
                "code": v.code,
                "name_en": v.name_en,
                "name_gu": v.name_gu,
                "census_code": v.census_code,
                "latitude": float(v.latitude) if v.latitude else None,
                "longitude": float(v.longitude) if v.longitude else None,
                "animal_count": an_cnt,
                "farmer_count": fm_cnt,
                "target_animals": target_animals,
                "vaccinated_count": vax_done,
                "pending_count": pending_count,
                "overdue_count": 0,
                "coverage_pct": coverage_pct,
                "disease_count": dis_cnt,
                "disease_breakdown": dis_data["breakdown"],
                "species_counts": an_data["species"],
                "assigned_vos": st_data["vos"],
                "assigned_fws": st_data["fws"],
                "campaigns": camps,
                "fill_color": fill_color,
                "status_label": status_label,
                "matches_filter": matches_filter
            }
            village_metrics_list.append(item)

        # 9. Dynamic Legend by layer_mode
        if layer_mode == "disease":
            legend = [
                {"label": "કોઈ કેસ નથી (Case-Free)", "color": "#10B981", "threshold": "0 રિપોર્ટ્સ", "count": legend_counts.get("કોઈ કેસ નથી (Case-Free)", 0)},
                {"label": "ઓછા કેસો (Low)", "color": "#F59E0B", "threshold": "1 થી 2 કેસ", "count": legend_counts.get("ઓછા કેસો (1-2 Cases)", 0)},
                {"label": "મધ્યમ એકાગ્રતા (Moderate)", "color": "#F97316", "threshold": "3 થી 5 કેસ", "count": legend_counts.get("મધ્યમ એકાગ્રતા (3-5 Cases)", 0)},
                {"label": "ઉચ્ચ એકાગ્રતા (>5 Cases)", "color": "#EF4444", "threshold": "> 5 કેસ", "count": legend_counts.get("ઉચ્ચ એકાગ્રતા (>5 Cases)", 0)},
            ]
        elif layer_mode == "pending":
            legend = [
                {"label": "ઓછું બાકી (Low Pending)", "color": "#10B981", "threshold": "0 થી 5 પશુ", "count": legend_counts.get("ઓછું બાકી (0-5 Pending)", 0)},
                {"label": "મધ્યમ બાકી (Moderate)", "color": "#F59E0B", "threshold": "6 થી 15 પશુ", "count": legend_counts.get("મધ્યમ બાકી (6-15 Pending)", 0)},
                {"label": "વધારે બાકી (High)", "color": "#F97316", "threshold": "16 થી 30 પશુ", "count": legend_counts.get("વધારે બાકી (16-30 Pending)", 0)},
                {"label": "ગંભીર બાકી (Critical)", "color": "#EF4444", "threshold": "> 30 પશુ", "count": legend_counts.get("ગંભીર બાકી (>30 Pending)", 0)},
            ]
        elif layer_mode == "campaign":
            legend = [
                {"label": "શરૂ નથી થયેલ (0%)", "color": "#CBD5E1", "threshold": "0%", "count": legend_counts.get("શરૂ નથી થયેલ (0%)", 0)},
                {"label": "ચાલુ છે (1-50%)", "color": "#F59E0B", "threshold": "1% થી 50%", "count": legend_counts.get("ચાલુ છે (1-50%)", 0)},
                {"label": "લગભગ પૂર્ણ (51-89%)", "color": "#3B82F6", "threshold": "51% થી 89%", "count": legend_counts.get("લગભગ પૂર્ણ (51-89%)", 0)},
                {"label": "સંપૂર્ણ (90-100%)", "color": "#10B981", "threshold": "90% થી 100%", "count": legend_counts.get("સંપૂર્ણ (90-100%)", 0)},
                {"label": "ઝુંબેશમાં નથી", "color": "#94A3B8", "threshold": "બહાર", "count": legend_counts.get("ઝુંબેશમાં નથી", 0)},
            ]
        elif layer_mode == "population":
            legend = [
                {"label": "ઓછી વસ્તી (Lowest)", "color": "#BBF7D0", "threshold": f"1 થી {int(max_pop*0.25)} પશુ", "count": legend_counts.get("ઓછી વસ્તી", 0)},
                {"label": "મધ્યમ વસ્તી (Moderate)", "color": "#4ADE80", "threshold": f"{int(max_pop*0.25)+1} થી {int(max_pop*0.50)} પશુ", "count": legend_counts.get("મધ્યમ વસ્તી", 0)},
                {"label": "ઉચ્ચ વસ્તી (High)", "color": "#16A34A", "threshold": f"{int(max_pop*0.50)+1} થી {int(max_pop*0.75)} પશુ", "count": legend_counts.get("ઉચ્ચ વસ્તી", 0)},
                {"label": "સૌથી વધુ વસ્તી (Highest)", "color": "#14532D", "threshold": f"> {int(max_pop*0.75)} પશુ", "count": legend_counts.get("સૌથી વધુ વસ્તી", 0)},
            ]
        elif layer_mode == "risk":
            legend = [
                {"label": "સામાન્ય સ્થિતિ (Normal)", "color": "#10B981", "threshold": "કોઈ રોગ સિગ્નલ નથી", "count": legend_counts.get("સામાન્ય સ્થિતિ (Normal)", 0)},
                {"label": "તપાસ હેઠળ (Investigation)", "color": "#F59E0B", "threshold": "૧ શંકાસ્પદ કેસ", "count": legend_counts.get("તપાસ હેઠળ (Investigation)", 0)},
                {"label": "શંકાસ્પદ ક્લસ્ટર (Cluster Signal)", "color": "#F97316", "threshold": "૨+ શંકાસ્પદ કેસો", "count": legend_counts.get("શંકાસ્પદ ક્લસ્ટર (Cluster Signal)", 0)},
                {"label": "પુષ્ટિ થયેલ ચેતવણી (Confirmed Alert)", "color": "#EF4444", "threshold": "લેબ પુષ્ટિ કેસ", "count": legend_counts.get("પુષ્ટિ થયેલ ચેતવણી (Confirmed Alert)", 0)},
            ]
        else: # coverage
            legend = [
                {"label": "અતિ ઓછું કવરેજ (0-25%)", "color": "#EF4444", "threshold": "0% થી 25%", "count": legend_counts.get("અતિ ઓછું કવરેજ (0-25%)", 0)},
                {"label": "લક્ષ્યાંકથી ઓછું (26-50%)", "color": "#F97316", "threshold": "26% થી 50%", "count": legend_counts.get("લક્ષ્યાંકથી ઓછું (26-50%)", 0)},
                {"label": "મધ્યમ કવરેજ (51-75%)", "color": "#F59E0B", "threshold": "51% થી 75%", "count": legend_counts.get("મધ્યમ કવરેજ (51-75%)", 0)},
                {"label": "ઉચ્ચ કવરેજ (76-100%)", "color": "#10B981", "threshold": "76% થી 100%", "count": legend_counts.get("ઉચ્ચ કવરેજ (76-100%)", 0)},
                {"label": "પશુધન નોંધાયેલ નથી", "color": "#E2E8F0", "threshold": "0 પશુ", "count": legend_counts.get("પશુધન નોંધાયેલ નથી", 0)},
            ]

        # 10. Summary KPIs
        total_villages = len(villages)
        total_animals = sum(m["animal_count"] for m in village_metrics_list)
        total_farmers = sum(m["farmer_count"] for m in village_metrics_list)
        total_vaccinated = sum(m["vaccinated_count"] for m in village_metrics_list)
        total_pending = sum(m["pending_count"] for m in village_metrics_list)
        total_disease = sum(m["disease_count"] for m in village_metrics_list)
        active_investigations = sum(1 for m in village_metrics_list if m["disease_count"] > 0)
        overall_cov = round((total_vaccinated / total_animals * 100), 1) if total_animals > 0 else 0.0

        summary = {
            "total_villages": total_villages,
            "filtered_villages_count": sum(1 for m in village_metrics_list if m["matches_filter"]),
            "total_animals": total_animals,
            "total_farmers": total_farmers,
            "vaccinated_animals": total_vaccinated,
            "pending_vaccinations": total_pending,
            "overdue_vaccinations": 0,
            "overall_coverage_pct": overall_cov,
            "total_disease_reports": total_disease,
            "active_disease_investigations": active_investigations,
            "active_campaigns": len(all_campaigns),
            "disease_clusters_count": sum(1 for m in village_metrics_list if m["disease_count"] >= 2)
        }

        # 11. Connected Charts Datasets
        sorted_by_cov = sorted(village_metrics_list, key=lambda x: x["coverage_pct"], reverse=True)
        village_coverage_chart = [
            {"village_name": m["name_gu"] or m["name_en"], "village_id": m["village_id"], "coverage_pct": m["coverage_pct"], "vaccinated": m["vaccinated_count"], "target": m["target_animals"]}
            for m in sorted_by_cov[:15]
        ]

        sorted_by_pen = sorted(village_metrics_list, key=lambda x: x["pending_count"], reverse=True)
        village_pending_chart = [
            {"village_name": m["name_gu"] or m["name_en"], "village_id": m["village_id"], "pending_count": m["pending_count"], "total_animals": m["animal_count"]}
            for m in sorted_by_pen[:15] if m["pending_count"] > 0
        ]

        disease_names = {
            "FMD": "ખરવા-મોવાસા (FMD)",
            "ANTHRAX": "કાળિયો તાવ (Anthrax)",
            "BRUCELLOSIS": "બ્રુસેલોસિસ (Brucellosis)",
            "HS": "ગળસૂંઠો (HS)",
            "BQ": "ગાઠીયો તાવ (BQ)",
            "LSD": "લમ્પી સ્કીન (LSD)",
            "FEVER": "સામાન્ય તાવ (Fever)"
        }
        disease_breakdown_chart = [
            {"code": c, "name": disease_names.get(c, c), "count": cnt}
            for c, cnt in sorted(disease_totals.items(), key=lambda x: x[1], reverse=True)
        ]

        sorted_by_dis = sorted([m for m in village_metrics_list if m["disease_count"] > 0], key=lambda x: x["disease_count"], reverse=True)
        disease_by_village_chart = [
            {"village_name": m["name_gu"] or m["name_en"], "village_id": m["village_id"], "disease_count": m["disease_count"], "breakdown": m["disease_breakdown"]}
            for m in sorted_by_dis[:15]
        ]

        vaccine_names = {
            "FMD": "FMD રસી",
            "BRUCELLOSIS": "બ્રુસેલા S19",
            "HS": "HS રસી",
            "BQ": "BQ રસી",
            "ANTHRAX": "એન્થ્રેક્સ રસી",
            "LSD": "ગોટપોક્સ / LSD"
        }
        vaccine_coverage_chart = [
            {"code": c, "name": vaccine_names.get(c, c), "doses": cnt}
            for c, cnt in sorted(vaccine_totals.items(), key=lambda x: x[1], reverse=True)
        ]

        species_names = {
            "CATTLE": "ગાય (Cattle)",
            "BUFFALO": "ભેંસ (Buffalo)",
            "GOAT": "બકરી (Goat)",
            "SHEEP": "ઘેટાં (Sheep)"
        }
        species_vaccination_chart = [
            {"code": c, "name": species_names.get(c, c), "count": cnt}
            for c, cnt in sorted(species_vax_totals.items(), key=lambda x: x[1], reverse=True)
        ]

        campaign_progress_chart = [
            {"village_name": m["name_gu"] or m["name_en"], "village_id": m["village_id"], "progress_pct": m["coverage_pct"]}
            for m in village_metrics_list if m["campaigns"]
        ][:15]

        sorted_dis_days = sorted(daily_dis_counts.items(), key=lambda x: x[0])
        disease_trends_chart = [{"date": d, "cases": cnt} for d, cnt in sorted_dis_days[-30:]]

        sorted_vax_days = sorted(daily_vax_counts.items(), key=lambda x: x[0])
        vaccination_trends_chart = [{"date": d, "doses": cnt} for d, cnt in sorted_vax_days[-30:]]

        status_labels = {
            "REPORTED": "નોંધાયેલ (Reported)",
            "UNDER_INVESTIGATION": "તપાસ હેઠળ (Under Investigation)",
            "CONFIRMED": "પુષ્ટિ થયેલ (Confirmed)",
            "RESOLVED": "ઉકેલાયેલ (Resolved)"
        }
        investigation_status_chart = [
            {"status": st, "label": status_labels.get(st, st), "count": cnt}
            for st, cnt in disease_status_totals.items()
        ]

        filter_options = {
            "villages": [{"id": str(v.id), "name_en": v.name_en, "name_gu": v.name_gu or v.name_en} for v in villages],
            "vaccines": [{"code": c, "name": vaccine_names.get(c, c)} for c in ["FMD", "BRUCELLOSIS", "HS", "BQ", "ANTHRAX", "LSD"]],
            "diseases": [{"code": c, "name": disease_names.get(c, c)} for c in ["FMD", "HS", "BQ", "BRUCELLOSIS", "ANTHRAX", "LSD", "FEVER"]],
            "campaigns": list(all_campaigns.values()),
            "species": [{"code": c, "name": species_names.get(c, c)} for c in ["CATTLE", "BUFFALO", "GOAT", "SHEEP"]],
            "vos": [{"id": uid, "name": name} for uid, name in all_vos.items()],
            "fws": [{"id": uid, "name": name} for uid, name in all_fws.items()]
        }

        return {
            "taluka_id": str(taluka.id),
            "taluka_name_en": taluka.name_en,
            "taluka_name_gu": taluka.name_gu,
            "district_name_en": district.name_en,
            "district_name_gu": district.name_gu,
            "layer_mode": layer_mode,
            "summary": summary,
            "legend": legend,
            "villages": village_metrics_list,
            "charts": {
                "village_coverage": village_coverage_chart,
                "village_pending": village_pending_chart,
                "disease_breakdown": disease_breakdown_chart,
                "disease_by_village": disease_by_village_chart,
                "vaccine_coverage": vaccine_coverage_chart,
                "species_vaccination": species_vaccination_chart,
                "campaign_progress": campaign_progress_chart,
                "disease_trends": disease_trends_chart,
                "vaccination_trends": vaccination_trends_chart,
                "investigation_status": investigation_status_chart
            },
            "filter_options": filter_options
        }

    async def get_village_analytics(
        self,
        taho_user: User,
        village_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Return deep analytical telemetry for a clicked village on the Taluka GIS map."""
        taluka, _ = await self.get_taho_taluka(taho_user)
        v = (await self.db.execute(
            select(Village).where(Village.id == village_id, Village.taluka_id == taluka.id)
        )).scalar_one_or_none()

        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found within your assigned Taluka.")

        an_cnt = (await self.db.execute(
            select(func.count(distinct(Animal.id))).where(Animal.village_id == v.id, Animal.status == "ACTIVE")
        )).scalar() or 0

        fm_cnt = (await self.db.execute(
            select(func.count(distinct(Farmer.id))).where(Farmer.village_id == v.id, Farmer.active == True)
        )).scalar() or 0

        vax_cnt = (await self.db.execute(
            select(func.count(AnimalEvent.event_id)).where(AnimalEvent.village_id == v.id, AnimalEvent.event_type == "VACCINATION")
        )).scalar() or 0

        dis_cnt = (await self.db.execute(
            select(func.count(DiseaseReport.report_id)).where(DiseaseReport.village_id == v.id)
        )).scalar() or 0

        # Assigned staff
        asgn_staff = (await self.db.execute(
            select(User.id, User.full_name, User.username, User.mobile_e164, User.role)
            .join(UserVillageAssignment, User.id == UserVillageAssignment.user_id)
            .where(UserVillageAssignment.village_id == v.id, UserVillageAssignment.ended_at.is_(None))
        )).fetchall()

        staff_list = [
            {
                "user_id": str(u_id),
                "full_name": name,
                "username": uname,
                "mobile": mob,
                "role": r
            }
            for u_id, name, uname, mob, r in asgn_staff
        ]

        # Species breakdown in village
        sp_rows = (await self.db.execute(
            select(Animal.species_code, func.count(Animal.id))
            .where(Animal.village_id == v.id, Animal.status == "ACTIVE")
            .group_by(Animal.species_code)
        )).fetchall()
        species_map = {sp: cnt for sp, cnt in sp_rows}

        # Disease reports in village
        dis_reports = (await self.db.execute(
            select(DiseaseReport)
            .where(DiseaseReport.village_id == v.id)
            .order_by(DiseaseReport.report_date.desc())
            .limit(10)
        )).scalars().all()
        disease_list = [
            {
                "report_id": str(dr.report_id),
                "report_no": dr.report_no or f"REP-{dr.disease_code}",
                "disease_code": dr.disease_code,
                "status": dr.status,
                "report_date": dr.report_date.isoformat() if dr.report_date else None,
                "symptoms": dr.symptoms or [],
                "observation_text": dr.observation_text
            }
            for dr in dis_reports
        ]

        # Campaigns linked to village
        camp_rows = (await self.db.execute(
            select(Campaign)
            .join(CampaignVillage, Campaign.id == CampaignVillage.campaign_id)
            .where(CampaignVillage.village_id == v.id)
        )).scalars().all()
        campaign_list = [
            {
                "id": str(c.id),
                "name": c.name,
                "code": c.code,
                "status": c.status
            }
            for c in camp_rows
        ]

        # Recent events in village
        recent_events = (await self.db.execute(
            select(AnimalEvent).where(AnimalEvent.village_id == v.id).order_by(AnimalEvent.event_date.desc()).limit(10)
        )).scalars().all()

        return {
            "village_id": str(v.id),
            "code": v.code,
            "name_en": v.name_en,
            "name_gu": v.name_gu,
            "taluka_name_en": taluka.name_en,
            "taluka_name_gu": taluka.name_gu,
            "census_code": v.census_code,
            "latitude": float(v.latitude) if v.latitude else None,
            "longitude": float(v.longitude) if v.longitude else None,
            "animal_count": an_cnt,
            "farmer_count": fm_cnt,
            "target_animals": an_cnt,
            "vaccinated_count": vax_cnt,
            "pending_count": max(0, an_cnt - vax_cnt),
            "overdue_count": 0,
            "coverage_pct": round((vax_cnt / an_cnt * 100), 1) if an_cnt > 0 else 0.0,
            "disease_count": dis_cnt,
            "species_breakdown": species_map,
            "disease_reports": disease_list,
            "campaigns": campaign_list,
            "staff": staff_list,
            "recent_events": [
                {
                    "event_id": str(e.event_id),
                    "type": e.event_type,
                    "date": e.event_date.isoformat() if e.event_date else None,
                    "status": e.review_status,
                    "remarks": e.remarks
                }
                for e in recent_events
            ]
        }

    # ==========================================================================
    # 3. VO (Veterinary Officer) Management & Email Activation
    # ==========================================================================
    async def list_vos(self, taho_user: User) -> List[Dict[str, Any]]:
        """List all Veterinary Officers assigned to villages within this Taluka."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        # Find VOs with active village assignments in this taluka
        rows = (await self.db.execute(
            select(
                User,
                func.array_agg(distinct(Village.name_en)).label("village_names_en"),
                func.array_agg(distinct(Village.name_gu)).label("village_names_gu"),
                func.array_agg(distinct(Village.id)).label("village_ids")
            )
            .join(UserVillageAssignment, User.id == UserVillageAssignment.user_id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(Village.taluka_id == taluka.id, User.role == "VET_OFFICER", UserVillageAssignment.ended_at.is_(None))
            .group_by(User.id)
            .order_by(User.full_name)
        )).fetchall()

        results = []
        for u, v_en_list, v_gu_list, v_id_list in rows:
            vax_done = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.performed_by == u.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0

            results.append({
                "id": str(u.id),
                "full_name": u.full_name,
                "username": u.username,
                "email": u.email,
                "mobile_e164": u.mobile_e164,
                "designation": u.designation or "વેટરનરી અધિકારી (VO)",
                "status": u.status,
                "assigned_village_ids": [str(vid) for vid in v_id_list if vid],
                "assigned_village_names_gu": [v for v in v_gu_list if v],
                "assigned_village_names_en": [v for v in v_en_list if v],
                "village_count": len([v for v in v_id_list if vid]),
                "vaccinations_count": vax_done,
                "created_at": u.created_at.isoformat() if u.created_at else None
            })

        return results

    async def create_vo(
        self,
        taho_user: User,
        payload: Dict[str, Any],
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new Veterinary Officer with village assignments and onboarding email."""
        taluka, district = await self.get_taho_taluka(taho_user)

        full_name = payload["full_name"].strip()
        username = payload["username"].strip().lower()
        email_clean = payload.get("email", "").strip().lower() or None
        mobile = payload.get("mobile_e164", "").strip() or None
        assigned_village_ids = payload.get("village_ids", [])

        # Validate unique username
        existing_u = (await self.db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if existing_u:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Username '{username}' already exists.")

        # Validate assigned villages belong to taluka
        valid_villages = []
        if assigned_village_ids:
            uuids = [uuid.UUID(str(v)) for v in assigned_village_ids]
            valid_villages = list((await self.db.execute(
                select(Village).where(Village.id.in_(uuids), Village.taluka_id == taluka.id)
            )).scalars().all())

        now_dt = datetime.now(timezone.utc)
        initial_pw = payload.get("password") or f"VO@{secrets.token_hex(4)}"
        pw_hash = get_password_hash(initial_pw)

        new_vo = User(
            id=uuid.uuid4(),
            role="VET_OFFICER",
            full_name=full_name,
            username=username,
            email=email_clean,
            password_hash=pw_hash,
            mobile_e164=mobile,
            designation=payload.get("designation") or "વેટરનરી અધિકારી (VO)",
            organisation="પશુપાલન વિભાગ, ગુજરાત સરકાર",
            status="ACTIVE",
            must_change_password=True,
            failed_attempts=0,
            created_by=taho_user.id,
            created_at=now_dt,
            updated_at=now_dt
        )
        self.db.add(new_vo)
        await self.db.flush()

        # Assign villages
        assigned_names = []
        for v in valid_villages:
            asgn = UserVillageAssignment(
                id=uuid.uuid4(),
                user_id=new_vo.id,
                village_id=v.id,
                assigned_by=taho_user.id,
                assigned_at=now_dt
            )
            self.db.add(asgn)
            assigned_names.append(v.name_gu or v.name_en)

        # Audit event
        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="VO_ACCOUNT_CREATED",
            object_type="user",
            object_id=str(new_vo.id),
            result="SUCCESS",
            reason=f"Created VO {full_name} for Taluka {taluka.name_en}",
            after_state={"user_id": str(new_vo.id), "username": username, "villages": [str(v.id) for v in valid_villages]},
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        # Send activation email
        email_status = "NOT_CONFIGURED"
        email_error = None
        if email_clean:
            try:
                mail_res = await send_vo_activation_email(
                    vo_name=full_name,
                    to_email=email_clean,
                    username=username,
                    taluka_name=taluka.name_en,
                    district_name=district.name_en,
                    assigned_villages=assigned_names,
                    temp_password=initial_pw,
                    db=self.db,
                    recipient_user_id=new_vo.id
                )
                email_status = mail_res.status
                email_error = mail_res.error_message
            except Exception as ex:
                logger.error("Failed to send VO onboarding email: %s", ex)
                email_status = "FAILED"
                email_error = str(ex)

        return {
            "id": str(new_vo.id),
            "full_name": new_vo.full_name,
            "username": new_vo.username,
            "email": email_clean,
            "role": "VET_OFFICER",
            "status": new_vo.status,
            "assigned_villages_count": len(valid_villages),
            "email_status": email_status,
            "email_error": email_error,
            "created_at": now_dt.isoformat()
        }

    async def update_vo_status(
        self,
        taho_user: User,
        vo_id: uuid.UUID,
        new_status: str,
        reason: str,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Activate or deactivate a Veterinary Officer."""
        vo = (await self.db.execute(select(User).where(User.id == vo_id, User.role == "VET_OFFICER"))).scalar_one_or_none()
        if not vo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VO not found.")

        old_status = vo.status
        vo.status = new_status
        vo.updated_at = datetime.now(timezone.utc)
        if new_status == "INACTIVE":
            vo.deactivated_at = datetime.now(timezone.utc)
            vo.deactivated_reason = reason.strip()

        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="VO_STATUS_UPDATED",
            object_type="user",
            object_id=str(vo.id),
            result="SUCCESS",
            reason=reason.strip(),
            before_state={"status": old_status},
            after_state={"status": new_status},
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        return {"status": "SUCCESS", "user_id": str(vo.id), "new_status": new_status}

    # ==========================================================================
    # 4. FW (Field Worker) Management & Location-based Village Assignment
    # ==========================================================================
    async def list_fws(self, taho_user: User) -> List[Dict[str, Any]]:
        """List all Field Workers assigned to villages within this Taluka."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        rows = (await self.db.execute(
            select(
                User,
                func.array_agg(distinct(Village.name_en)).label("village_names_en"),
                func.array_agg(distinct(Village.name_gu)).label("village_names_gu"),
                func.array_agg(distinct(Village.id)).label("village_ids")
            )
            .join(UserVillageAssignment, User.id == UserVillageAssignment.user_id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(Village.taluka_id == taluka.id, User.role == "FIELD_WORKER", UserVillageAssignment.ended_at.is_(None))
            .group_by(User.id)
            .order_by(User.full_name)
        )).fetchall()

        results = []
        for u, v_en_list, v_gu_list, v_id_list in rows:
            vax_done = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.performed_by == u.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0

            results.append({
                "id": str(u.id),
                "full_name": u.full_name,
                "username": u.username,
                "email": u.email,
                "mobile_e164": u.mobile_e164,
                "designation": u.designation or "પશુધન નિરીક્ષક / ક્ષેત્રીય કાર્યકર",
                "status": u.status,
                "assigned_village_ids": [str(vid) for vid in v_id_list if vid],
                "assigned_village_names_gu": [v for v in v_gu_list if v],
                "assigned_village_names_en": [v for v in v_en_list if v],
                "village_count": len([v for v in v_id_list if vid]),
                "vaccinations_count": vax_done,
                "created_at": u.created_at.isoformat() if u.created_at else None
            })

        return results

    async def create_fw(
        self,
        taho_user: User,
        payload: Dict[str, Any],
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new Field Worker with location-based village assignments and onboarding email."""
        taluka, district = await self.get_taho_taluka(taho_user)

        full_name = payload["full_name"].strip()
        username = payload["username"].strip().lower()
        email_clean = payload.get("email", "").strip().lower() or None
        mobile = payload.get("mobile_e164", "").strip() or None
        assigned_village_ids = payload.get("village_ids", [])

        existing_u = (await self.db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if existing_u:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Username '{username}' already exists.")

        valid_villages = []
        if assigned_village_ids:
            uuids = [uuid.UUID(str(v)) for v in assigned_village_ids]
            valid_villages = list((await self.db.execute(
                select(Village).where(Village.id.in_(uuids), Village.taluka_id == taluka.id)
            )).scalars().all())

        now_dt = datetime.now(timezone.utc)
        initial_pw = payload.get("password") or f"FW@{secrets.token_hex(4)}"
        pw_hash = get_password_hash(initial_pw)

        new_fw = User(
            id=uuid.uuid4(),
            role="FIELD_WORKER",
            full_name=full_name,
            username=username,
            email=email_clean,
            password_hash=pw_hash,
            mobile_e164=mobile,
            designation=payload.get("designation") or "પશુધન નિરીક્ષક / ક્ષેત્રીય કાર્યકર",
            organisation="પશુપાલન શાખા, તાલુકા પંચાયત",
            status="ACTIVE",
            must_change_password=True,
            failed_attempts=0,
            created_by=taho_user.id,
            created_at=now_dt,
            updated_at=now_dt
        )
        self.db.add(new_fw)
        await self.db.flush()

        assigned_names = []
        for v in valid_villages:
            asgn = UserVillageAssignment(
                id=uuid.uuid4(),
                user_id=new_fw.id,
                village_id=v.id,
                assigned_by=taho_user.id,
                assigned_at=now_dt
            )
            self.db.add(asgn)
            assigned_names.append(v.name_gu or v.name_en)

        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="FW_ACCOUNT_CREATED",
            object_type="user",
            object_id=str(new_fw.id),
            result="SUCCESS",
            reason=f"Created FW {full_name} for Taluka {taluka.name_en}",
            after_state={"user_id": str(new_fw.id), "username": username, "villages": [str(v.id) for v in valid_villages]},
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        email_status = "NOT_CONFIGURED"
        email_error = None
        if email_clean:
            try:
                mail_res = await send_fw_activation_email(
                    fw_name=full_name,
                    to_email=email_clean,
                    username=username,
                    taluka_name=taluka.name_en,
                    district_name=district.name_en,
                    assigned_villages=assigned_names,
                    temp_password=initial_pw,
                    db=self.db,
                    recipient_user_id=new_fw.id
                )
                email_status = mail_res.status
                email_error = mail_res.error_message
            except Exception as ex:
                logger.error("Failed to send FW onboarding email: %s", ex)
                email_status = "FAILED"
                email_error = str(ex)

        return {
            "id": str(new_fw.id),
            "full_name": new_fw.full_name,
            "username": new_fw.username,
            "email": email_clean,
            "role": "FIELD_WORKER",
            "status": new_fw.status,
            "assigned_villages_count": len(valid_villages),
            "email_status": email_status,
            "email_error": email_error,
            "created_at": now_dt.isoformat()
        }

    async def update_fw_status(
        self,
        taho_user: User,
        fw_id: uuid.UUID,
        new_status: str,
        reason: str,
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Activate or deactivate a Field Worker."""
        fw = (await self.db.execute(select(User).where(User.id == fw_id, User.role == "FIELD_WORKER"))).scalar_one_or_none()
        if not fw:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field Worker not found.")

        old_status = fw.status
        fw.status = new_status
        fw.updated_at = datetime.now(timezone.utc)
        if new_status == "INACTIVE":
            fw.deactivated_at = datetime.now(timezone.utc)
            fw.deactivated_reason = reason.strip()

        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="FW_STATUS_UPDATED",
            object_type="user",
            object_id=str(fw.id),
            result="SUCCESS",
            reason=reason.strip(),
            before_state={"status": old_status},
            after_state={"status": new_status},
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        return {"status": "SUCCESS", "user_id": str(fw.id), "new_status": new_status}

    # ==========================================================================
    # 5. Taluka Campaign Management
    # ==========================================================================
    async def list_campaigns(self, taho_user: User) -> List[Dict[str, Any]]:
        """List all vaccination campaigns active or scheduled in this Taluka."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        # Find campaigns linked to villages in this taluka
        rows = (await self.db.execute(
            select(
                Campaign,
                func.count(distinct(CampaignVillage.village_id)).label("village_count")
            )
            .join(CampaignVillage, Campaign.id == CampaignVillage.campaign_id)
            .join(Village, CampaignVillage.village_id == Village.id)
            .where(Village.taluka_id == taluka.id)
            .group_by(Campaign.id)
            .order_by(Campaign.start_date.desc())
        )).fetchall()

        results = []
        for c, v_cnt in rows:
            # Calculate total vaccinated animals under this campaign
            vax_done = (await self.db.execute(
                select(func.count(AnimalEvent.event_id))
                .join(Village, AnimalEvent.village_id == Village.id)
                .where(Village.taluka_id == taluka.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0

            # Estimate target animals in these villages
            target_animals = (await self.db.execute(
                select(func.count(distinct(Animal.id)))
                .join(CampaignVillage, Animal.village_id == CampaignVillage.village_id)
                .where(CampaignVillage.campaign_id == c.id, Animal.status == "ACTIVE")
            )).scalar() or 0

            pct = round((vax_done / target_animals * 100), 1) if target_animals > 0 else 0.0

            results.append({
                "id": str(c.id),
                "code": c.code,
                "name": c.name,
                "status": c.status,
                "start_date": c.start_date.isoformat() if c.start_date else None,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "target_villages_count": v_cnt,
                "target_animals": target_animals,
                "vaccinated_count": vax_done,
                "completion_pct": pct,
                "created_at": c.created_at.isoformat() if c.created_at else None
            })

        return results

    async def create_campaign(
        self,
        taho_user: User,
        payload: Dict[str, Any],
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new vaccination campaign in this Taluka and bind target villages."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        name = payload["name"].strip()
        code = payload.get("code", "").strip().upper() or f"CAMP-{taluka.code}-{datetime.now().strftime('%Y%m%d')}"
        start_date = datetime.strptime(payload["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(payload["end_date"], "%Y-%m-%d").date()
        village_ids = payload.get("village_ids", [])

        # Validate villages
        valid_villages = []
        if village_ids:
            uuids = [uuid.UUID(str(v)) for v in village_ids]
            valid_villages = list((await self.db.execute(
                select(Village).where(Village.id.in_(uuids), Village.taluka_id == taluka.id)
            )).scalars().all())
        else:
            # Defaults to all villages in taluka
            valid_villages = list((await self.db.execute(
                select(Village).where(Village.taluka_id == taluka.id, Village.active == True)
            )).scalars().all())

        now_dt = datetime.now(timezone.utc)
        new_camp = Campaign(
            id=uuid.uuid4(),
            code=code,
            name=name,
            status="ACTIVE",
            start_date=start_date,
            end_date=end_date,
            created_by=taho_user.id,
            created_at=now_dt
        )
        self.db.add(new_camp)
        await self.db.flush()

        for v in valid_villages:
            cv = CampaignVillage(
                campaign_id=new_camp.id,
                village_id=v.id
            )
            self.db.add(cv)

        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="CAMPAIGN_CREATED",
            object_type="campaign",
            object_id=str(new_camp.id),
            result="SUCCESS",
            reason=f"Created campaign {name} in {taluka.name_en}",
            after_state={"code": code, "target_villages": len(valid_villages)},
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        return {
            "id": str(new_camp.id),
            "code": new_camp.code,
            "name": new_camp.name,
            "status": new_camp.status,
            "target_villages_count": len(valid_villages),
            "start_date": new_camp.start_date.isoformat(),
            "end_date": new_camp.end_date.isoformat()
        }

    # ==========================================================================
    # 5.1 Taluka Vaccination Telemetry
    # ==========================================================================
    async def list_vaccinations(
        self,
        taho_user: User,
        village_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """Return Taluka-scoped vaccination telemetry with animal, owner, village and staff details."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        base_query = (
            select(
                AnimalEvent,
                Animal.animal_code,
                Animal.species_code,
                Farmer.full_name.label("farmer_name"),
                Farmer.mobile_e164.label("farmer_mobile"),
                Village.name_en.label("village_name_en"),
                Village.name_gu.label("village_name_gu"),
                User.full_name.label("performer_name"),
                User.role.label("performer_role")
            )
            .join(Village, AnimalEvent.village_id == Village.id)
            .outerjoin(Animal, AnimalEvent.animal_id == Animal.id)
            .outerjoin(Farmer, Animal.farmer_id == Farmer.id)
            .outerjoin(User, AnimalEvent.performed_by == User.id)
            .where(Village.taluka_id == taluka.id, AnimalEvent.event_type == "VACCINATION")
        )

        if village_id:
            base_query = base_query.where(Village.id == village_id)

        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        offset = (page - 1) * page_size
        rows = (await self.db.execute(
            base_query.order_by(AnimalEvent.event_date.desc(), AnimalEvent.received_at.desc())
            .offset(offset).limit(page_size)
        )).fetchall()

        items = []
        for ev, an_code, sp_code, f_name, f_mob, v_en, v_gu, p_name, p_role in rows:
            items.append({
                "event_id": str(ev.event_id),
                "animal_id": str(ev.animal_id) if ev.animal_id else None,
                "animal_code": an_code or "N/A",
                "species_code": sp_code or "CATTLE",
                "farmer_name": f_name or "N/A",
                "farmer_mobile": f_mob or "N/A",
                "village_id": str(ev.village_id),
                "village_name_en": v_en,
                "village_name_gu": v_gu,
                "performed_by_name": p_name or "ક્ષેત્રીય સ્ટાફ",
                "performed_by_role": p_role or "FIELD_WORKER",
                "event_date": ev.event_date.isoformat() if ev.event_date else None,
                "review_status": ev.review_status,
                "remarks": ev.remarks,
                "received_at": ev.received_at.isoformat() if ev.received_at else None
            })

        return {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items
        }

    # ==========================================================================
    # 6. Taluka-scoped Animals & Farmers Records
    # ==========================================================================
    async def list_animals(
        self,
        taho_user: User,
        search: Optional[str] = None,
        species: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """Return Taluka-scoped animal records with owner and vaccination details."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        base_query = (
            select(
                Animal,
                Farmer.full_name.label("farmer_name"),
                Farmer.mobile_e164.label("farmer_mobile"),
                Village.name_en.label("village_name_en"),
                Village.name_gu.label("village_name_gu")
            )
            .join(Village, Animal.village_id == Village.id)
            .outerjoin(Farmer, Animal.farmer_id == Farmer.id)
            .where(Village.taluka_id == taluka.id)
        )

        if village_id:
            base_query = base_query.where(Village.id == village_id)
        if species:
            base_query = base_query.where(Animal.species_code.ilike(species))
        if search:
            s_clean = f"%{search.strip()}%"
            base_query = base_query.where(
                or_(
                    Animal.animal_code.ilike(s_clean),
                    Farmer.full_name.ilike(s_clean),
                    Farmer.mobile_e164.ilike(s_clean),
                    Village.name_en.ilike(s_clean),
                    Village.name_gu.ilike(s_clean)
                )
            )

        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        offset = (page - 1) * page_size
        rows = (await self.db.execute(base_query.order_by(Animal.created_at.desc()).offset(offset).limit(page_size))).fetchall()

        items = []
        for an, f_name, f_mob, v_en, v_gu in rows:
            vax_done = (await self.db.execute(
                select(func.count(AnimalEvent.event_id)).where(AnimalEvent.animal_id == an.id, AnimalEvent.event_type == "VACCINATION")
            )).scalar() or 0

            items.append({
                "id": str(an.id),
                "animal_code": an.animal_code,
                "species_code": an.species_code,
                "breed_id": str(an.breed_id) if an.breed_id else None,
                "sex": an.sex,
                "birth_date": an.birth_date.isoformat() if an.birth_date else None,
                "age_months_estimate": an.age_months_estimate,
                "status": an.status,
                "farmer_name": f_name or "N/A",
                "farmer_mobile": f_mob or "N/A",
                "village_name_en": v_en,
                "village_name_gu": v_gu,
                "vaccination_count": vax_done,
                "created_at": an.created_at.isoformat() if an.created_at else None
            })

        return {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items
        }

    async def list_farmers(
        self,
        taho_user: User,
        search: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """Return Taluka-scoped farmer directory with animal counts."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        base_query = (
            select(
                Farmer,
                Village.name_en.label("village_name_en"),
                Village.name_gu.label("village_name_gu"),
                func.count(Animal.id).label("animal_count")
            )
            .join(Village, Farmer.village_id == Village.id)
            .outerjoin(Animal, and_(Animal.farmer_id == Farmer.id, Animal.status == "ACTIVE"))
            .where(Village.taluka_id == taluka.id)
        )

        if village_id:
            base_query = base_query.where(Village.id == village_id)
        if search:
            s_clean = f"%{search.strip()}%"
            base_query = base_query.where(
                or_(
                    Farmer.full_name.ilike(s_clean),
                    Farmer.mobile_e164.ilike(s_clean),
                    Farmer.farmer_code.ilike(s_clean),
                    Village.name_en.ilike(s_clean),
                    Village.name_gu.ilike(s_clean)
                )
            )

        base_query = base_query.group_by(Farmer.id, Village.id)

        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        offset = (page - 1) * page_size
        rows = (await self.db.execute(base_query.order_by(Farmer.created_at.desc()).offset(offset).limit(page_size))).fetchall()

        items = []
        for f, v_en, v_gu, an_cnt in rows:
            items.append({
                "id": str(f.id),
                "farmer_code": f.farmer_code,
                "full_name": f.full_name,
                "mobile_e164": f.mobile_e164,
                "village_id": str(f.village_id),
                "village_name_en": v_en,
                "village_name_gu": v_gu,
                "address_text": f.address_text,
                "active": f.active,
                "animal_count": an_cnt or 0,
                "created_at": f.created_at.isoformat() if f.created_at else None
            })

        return {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items
        }

    # ==========================================================================
    # 7. Disease Surveillance & Early Warning
    # ==========================================================================
    async def list_surveillance(
        self,
        taho_user: User,
        village_id: Optional[uuid.UUID] = None,
        disease_code: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List disease reports in Taluka with animal, owner and clinical observation details."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        stmt = (
            select(
                DiseaseReport,
                Village.name_en.label("village_name_en"),
                Village.name_gu.label("village_name_gu"),
                Animal.animal_code,
                Animal.species_code,
                Farmer.full_name.label("farmer_name"),
                Farmer.mobile_e164.label("farmer_mobile")
            )
            .join(Village, DiseaseReport.village_id == Village.id)
            .outerjoin(Animal, DiseaseReport.animal_id == Animal.id)
            .outerjoin(Farmer, DiseaseReport.farmer_id == Farmer.id)
            .where(Village.taluka_id == taluka.id)
        )

        if village_id:
            stmt = stmt.where(Village.id == village_id)
        if disease_code:
            stmt = stmt.where(DiseaseReport.disease_code.ilike(disease_code))
        if status:
            stmt = stmt.where(DiseaseReport.status == status)

        rows = (await self.db.execute(stmt.order_by(DiseaseReport.report_date.desc()))).fetchall()

        results = []
        for dr, v_en, v_gu, an_code, sp_code, f_name, f_mob in rows:
            results.append({
                "report_id": str(dr.report_id),
                "report_no": dr.report_no or f"REP-{dr.disease_code}-{str(dr.report_id)[:6].upper()}",
                "disease_code": dr.disease_code,
                "report_date": dr.report_date.isoformat() if dr.report_date else None,
                "status": dr.status,
                "village_id": str(dr.village_id),
                "village_name_en": v_en,
                "village_name_gu": v_gu,
                "animal_code": an_code or "N/A",
                "species_code": sp_code or "CATTLE",
                "farmer_name": f_name or "N/A",
                "farmer_mobile": f_mob or "N/A",
                "symptoms": dr.symptoms or [],
                "observation_text": dr.observation_text
            })

        return results

    async def list_disease_alerts(self, taho_user: User) -> List[Dict[str, Any]]:
        """Detect potential disease surge and cluster signals in the Taluka."""
        taluka, _ = await self.get_taho_taluka(taho_user)

        stmt = (
            select(
                DiseaseReport.disease_code,
                DiseaseReport.village_id,
                Village.name_en.label("village_name_en"),
                Village.name_gu.label("village_name_gu"),
                func.count(DiseaseReport.report_id).label("report_count"),
                func.max(DiseaseReport.report_date).label("latest_date"),
                func.array_agg(DiseaseReport.status).label("statuses"),
                func.array_agg(DiseaseReport.report_id).label("report_ids")
            )
            .join(Village, DiseaseReport.village_id == Village.id)
            .where(Village.taluka_id == taluka.id)
            .group_by(DiseaseReport.disease_code, DiseaseReport.village_id, Village.name_en, Village.name_gu)
        )
        clusters = (await self.db.execute(stmt)).fetchall()

        disease_info = {
            "FMD": {"name_gu": "ખરવા-મોવાસા (FMD)", "severity": "CRITICAL"},
            "ANTHRAX": {"name_gu": "કાળિયો તાવ (Anthrax)", "severity": "CRITICAL"},
            "BRUCELLOSIS": {"name_gu": "બ્રુસેલોસિસ (Brucellosis)", "severity": "HIGH"},
            "HS": {"name_gu": "ગળસૂંઠો (HS)", "severity": "HIGH"},
            "BQ": {"name_gu": "ગાઠીયો તાવ (BQ)", "severity": "HIGH"},
            "LSD": {"name_gu": "લમ્પી સ્કીન ડિસીઝ (LSD)", "severity": "HIGH"},
            "FEVER": {"name_gu": "સામાન્ય તાવ (Fever)", "severity": "MEDIUM"}
        }

        alerts = []
        for idx, (code, v_id, v_en, v_gu, cnt, lat_d, st_list, r_ids) in enumerate(clusters, 1):
            d_meta = disease_info.get(code.upper() if code else "", {"name_gu": code or "અજ્ઞાત રોગ", "severity": "MEDIUM"})
            severity = d_meta["severity"]
            if cnt >= 2 and severity == "HIGH":
                severity = "CRITICAL"

            status = "CONFIRMED" if "CONFIRMED" in st_list else "UNDER_INVESTIGATION" if "UNDER_INVESTIGATION" in st_list else "REPORTED"

            alerts.append({
                "alert_id": f"ALT-{taluka.code[:4]}-{idx:03d}",
                "disease_code": code,
                "disease_name_gu": d_meta["name_gu"],
                "severity": severity,
                "village_id": str(v_id),
                "village_name_en": v_en,
                "village_name_gu": v_gu,
                "report_count": cnt,
                "latest_report_date": lat_d.isoformat() if lat_d else None,
                "status": status,
                "report_ids": [str(rid) for rid in (r_ids or [])],
                "reason": f"તાલુકાના {v_gu or v_en} ગામમાં {code} રોગના {cnt} શંકાસ્પદ કેસ નોંધાયા છે.",
                "recommended_action": "નજીકના વેટરનરી ઓફિસરને સેમ્પલ કલેક્શન અને ક્લિનિકલ વેરિફિકેશન માટે તાત્કાલિક મોકલો."
            })

        return alerts

    # ==========================================================================
    # 8. Demonstration Dataset Management (Requirement 19)
    # ==========================================================================
    async def seed_demo_data(self, taho_user: User, client_ip: Optional[str] = None) -> Dict[str, Any]:
        """Seed exactly 2 interconnected realistic demo records in each module for demo & testing."""
        taluka, district = await self.get_taho_taluka(taho_user)
        taluka_id = taluka.id

        # Check sample villages
        villages = list((await self.db.execute(
            select(Village).where(Village.taluka_id == taluka_id, Village.active == True).order_by(Village.name_en).limit(4)
        )).scalars().all())

        if len(villages) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Need at least 2 active villages to seed demo records.")

        v1, v2 = villages[0], villages[1]
        now_dt = datetime.now(timezone.utc)
        demo_tag = f"[DEMO-{taluka.code}]"

        # 1. Two VOs
        pw_hash = get_password_hash("DemoVO@1234")
        vo1 = User(
            id=uuid.uuid4(),
            role="VET_OFFICER",
            full_name=f"Dr. Ramesh V. Patel {demo_tag}",
            username=f"vo_demo_ramesh_{taluka.code.lower()[:6]}",
            email=f"demo.vo1.{taluka.code.lower()[:6]}@anivera.gov.in",
            password_hash=pw_hash,
            mobile_e164="+919825100011",
            designation="વેટરનરી અધિકારી (VO) [DEMO]",
            organisation="પશુપાલન વિભાગ, ગુજરાત સરકાર",
            status="ACTIVE",
            must_change_password=False,
            created_by=taho_user.id,
            created_at=now_dt
        )
        vo2 = User(
            id=uuid.uuid4(),
            role="VET_OFFICER",
            full_name=f"Dr. Priya N. Shah {demo_tag}",
            username=f"vo_demo_priya_{taluka.code.lower()[:6]}",
            email=f"demo.vo2.{taluka.code.lower()[:6]}@anivera.gov.in",
            password_hash=pw_hash,
            mobile_e164="+919825100012",
            designation="વેટરનરી અધિકારી (VO) [DEMO]",
            organisation="પશુપાલન વિભાગ, ગુજરાત સરકાર",
            status="ACTIVE",
            must_change_password=False,
            created_by=taho_user.id,
            created_at=now_dt
        )
        self.db.add_all([vo1, vo2])
        await self.db.flush()

        # Assign villages to VOs
        asgn_vo1 = UserVillageAssignment(id=uuid.uuid4(), user_id=vo1.id, village_id=v1.id, assigned_by=taho_user.id, assigned_at=now_dt)
        asgn_vo2 = UserVillageAssignment(id=uuid.uuid4(), user_id=vo2.id, village_id=v2.id, assigned_by=taho_user.id, assigned_at=now_dt)
        self.db.add_all([asgn_vo1, asgn_vo2])

        # 2. Two FWs
        fw_pw_hash = get_password_hash("DemoFW@1234")
        fw1 = User(
            id=uuid.uuid4(),
            role="FIELD_WORKER",
            full_name=f"Bharat K. Solanki {demo_tag}",
            username=f"fw_demo_bharat_{taluka.code.lower()[:6]}",
            email=f"demo.fw1.{taluka.code.lower()[:6]}@anivera.gov.in",
            password_hash=fw_pw_hash,
            mobile_e164="+919825100021",
            designation="પશુધન નિરીક્ષક / ક્ષેત્રીય કાર્યકર [DEMO]",
            organisation="પશુપાલન શાખા, તાલુકા પંચાયત",
            status="ACTIVE",
            must_change_password=False,
            created_by=taho_user.id,
            created_at=now_dt
        )
        fw2 = User(
            id=uuid.uuid4(),
            role="FIELD_WORKER",
            full_name=f"Jagdish M. Vaghela {demo_tag}",
            username=f"fw_demo_jagdish_{taluka.code.lower()[:6]}",
            email=f"demo.fw2.{taluka.code.lower()[:6]}@anivera.gov.in",
            password_hash=fw_pw_hash,
            mobile_e164="+919825100022",
            designation="ક્ષેત્રીય રસીકરણ સહાયક [DEMO]",
            organisation="પશુપાલન શાખા, તાલુકા પંચાયત",
            status="ACTIVE",
            must_change_password=False,
            created_by=taho_user.id,
            created_at=now_dt
        )
        self.db.add_all([fw1, fw2])
        await self.db.flush()

        asgn_fw1 = UserVillageAssignment(id=uuid.uuid4(), user_id=fw1.id, village_id=v1.id, assigned_by=taho_user.id, assigned_at=now_dt)
        asgn_fw2 = UserVillageAssignment(id=uuid.uuid4(), user_id=fw2.id, village_id=v2.id, assigned_by=taho_user.id, assigned_at=now_dt)
        self.db.add_all([asgn_fw1, asgn_fw2])

        # 3. Two Farmers
        far1 = Farmer(
            id=uuid.uuid4(),
            farmer_code=f"FAR-DEMO-{taluka.code[:4]}-001",
            full_name=f"વલ્લભભાઈ કે. હીરપરા (Vallabhbhai Hirpara) {demo_tag}",
            mobile_e164="+919825100031",
            village_id=v1.id,
            address_text=f"રામજી મંદિર પાસે, {v1.name_gu or v1.name_en}",
            registration_status="VERIFIED",
            active=True,
            created_by=taho_user.id,
            created_at=now_dt
        )
        far2 = Farmer(
            id=uuid.uuid4(),
            farmer_code=f"FAR-DEMO-{taluka.code[:4]}-002",
            full_name=f"સવિતાબેન એમ. મકવાણા (Savitaben Makwana) {demo_tag}",
            mobile_e164="+919825100032",
            village_id=v2.id,
            address_text=f"પ્રાથમિક શાળા સામે, {v2.name_gu or v2.name_en}",
            registration_status="VERIFIED",
            active=True,
            created_by=taho_user.id,
            created_at=now_dt
        )
        self.db.add_all([far1, far2])
        await self.db.flush()

        # 4. Realistic Animals
        an1 = Animal(
            id=uuid.uuid4(),
            animal_code=f"ANM-DEMO-{taluka.code[:4]}-101",
            species_code="CATTLE",
            sex="F",
            farmer_id=far1.id,
            village_id=v1.id,
            registration_status="VERIFIED",
            status="ACTIVE",
            created_by=taho_user.id,
            created_at=now_dt
        )
        an2 = Animal(
            id=uuid.uuid4(),
            animal_code=f"ANM-DEMO-{taluka.code[:4]}-102",
            species_code="BUFFALO",
            sex="F",
            farmer_id=far1.id,
            village_id=v1.id,
            registration_status="VERIFIED",
            status="ACTIVE",
            created_by=taho_user.id,
            created_at=now_dt
        )
        an3 = Animal(
            id=uuid.uuid4(),
            animal_code=f"ANM-DEMO-{taluka.code[:4]}-201",
            species_code="CATTLE",
            sex="M",
            farmer_id=far2.id,
            village_id=v2.id,
            registration_status="VERIFIED",
            status="ACTIVE",
            created_by=taho_user.id,
            created_at=now_dt
        )
        an4 = Animal(
            id=uuid.uuid4(),
            animal_code=f"ANM-DEMO-{taluka.code[:4]}-202",
            species_code="BUFFALO",
            sex="F",
            farmer_id=far2.id,
            village_id=v2.id,
            registration_status="VERIFIED",
            status="ACTIVE",
            created_by=taho_user.id,
            created_at=now_dt
        )
        self.db.add_all([an1, an2, an3, an4])
        await self.db.flush()

        # 5. Two Campaigns
        start_d = (now_dt - timedelta(days=10)).date()
        end_d = (now_dt + timedelta(days=20)).date()
        camp1 = Campaign(
            id=uuid.uuid4(),
            code=f"CAMP-DEMO-FMD-{taluka.code[:4]}",
            name=f"FMD મુક્ત તાલુકો રસીકરણ ઝુંબેશ ૨૦૨૬ {demo_tag}",
            status="ACTIVE",
            start_date=start_d,
            end_date=end_d,
            created_by=taho_user.id,
            created_at=now_dt
        )
        camp2 = Campaign(
            id=uuid.uuid4(),
            code=f"CAMP-DEMO-BRUC-{taluka.code[:4]}",
            name=f"બ્રુસેલોસિસ નિયંત્રણ અને રસીકરણ અભિયાન {demo_tag}",
            status="ACTIVE",
            start_date=start_d,
            end_date=end_d,
            created_by=taho_user.id,
            created_at=now_dt
        )
        self.db.add_all([camp1, camp2])
        await self.db.flush()

        self.db.add_all([
            CampaignVillage(campaign_id=camp1.id, village_id=v1.id),
            CampaignVillage(campaign_id=camp1.id, village_id=v2.id),
            CampaignVillage(campaign_id=camp2.id, village_id=v1.id)
        ])

        # 6. Vaccination Events
        ev1 = AnimalEvent(
            event_id=uuid.uuid4(),
            animal_id=an1.id,
            village_id=v1.id,
            event_type="VACCINATION",
            event_date=(now_dt - timedelta(days=3)).date(),
            performed_by=fw1.id,
            review_status="VERIFIED",
            remarks=f"FMD Dose 1 administered successfully {demo_tag}",
            received_at=now_dt - timedelta(days=3)
        )
        ev2 = AnimalEvent(
            event_id=uuid.uuid4(),
            animal_id=an2.id,
            village_id=v1.id,
            event_type="VACCINATION",
            event_date=(now_dt - timedelta(days=2)).date(),
            performed_by=fw1.id,
            review_status="VERIFIED",
            remarks=f"FMD Dose 1 administered {demo_tag}",
            received_at=now_dt - timedelta(days=2)
        )
        ev3 = AnimalEvent(
            event_id=uuid.uuid4(),
            animal_id=an3.id,
            village_id=v2.id,
            event_type="VACCINATION",
            event_date=(now_dt - timedelta(days=1)).date(),
            performed_by=fw2.id,
            review_status="VERIFIED",
            remarks=f"Brucella S19 vaccine given {demo_tag}",
            received_at=now_dt - timedelta(days=1)
        )
        self.db.add_all([ev1, ev2, ev3])

        # 7. Two Disease Reports
        dr1 = DiseaseReport(
            report_id=uuid.uuid4(),
            report_no=f"DIS-DEMO-{taluka.code[:4]}-001",
            animal_id=an4.id,
            farmer_id=far2.id,
            village_id=v2.id,
            disease_code="FMD",
            report_date=(now_dt - timedelta(days=4)).date(),
            symptoms=["BLISTERS_MOUTH", "FEVER", "LAMENESS"],
            observation_text=f"શંકાસ્પદ ખરવા-મોવાસા લક્ષણો. તાત્કાલિક અલગ રાખવાની સલાહ. {demo_tag}",
            reported_by=fw2.id,
            status="UNDER_INVESTIGATION",
            received_at=now_dt - timedelta(days=4)
        )
        dr2 = DiseaseReport(
            report_id=uuid.uuid4(),
            report_no=f"DIS-DEMO-{taluka.code[:4]}-002",
            animal_id=an2.id,
            farmer_id=far1.id,
            village_id=v1.id,
            disease_code="FEVER",
            report_date=(now_dt - timedelta(days=2)).date(),
            symptoms=["HIGH_TEMPERATURE", "LOSS_OF_APPETITE"],
            observation_text=f"તાવ અને ખોરાક ન લેવો. {demo_tag}",
            reported_by=fw1.id,
            status="REPORTED",
            received_at=now_dt - timedelta(days=2)
        )
        self.db.add_all([dr1, dr2])

        # Audit event
        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="DEMO_DATA_SEEDED",
            object_type="taluka",
            object_id=str(taluka.id),
            result="SUCCESS",
            reason=f"Seeded 2 interconnected demonstration records per module for Taluka {taluka.name_en}",
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        return {
            "status": "SUCCESS",
            "message": f"Demonstration dataset successfully seeded for Taluka {taluka.name_en}.",
            "seeded": {
                "vos": 2,
                "fws": 2,
                "farmers": 2,
                "animals": 4,
                "campaigns": 2,
                "vaccinations": 3,
                "disease_reports": 2
            }
        }

    async def reset_demo_data(self, taho_user: User, client_ip: Optional[str] = None) -> Dict[str, Any]:
        """Cleanly remove all demonstration records matching demo tags from the Taluka."""
        taluka, _ = await self.get_taho_taluka(taho_user)
        demo_pattern = f"%[DEMO-{taluka.code}]%"
        code_pattern = f"%DEMO-{taluka.code[:4]}%"

        # Remove animal events
        await self.db.execute(text(f"""
            DELETE FROM animal_events
            WHERE remarks ILIKE '%[DEMO-{taluka.code}]%'
        """))

        # Remove disease reports
        await self.db.execute(text(f"""
            DELETE FROM disease_reports
            WHERE observation_text ILIKE '%[DEMO-{taluka.code}]%'
        """))

        # Remove animals
        await self.db.execute(text(f"""
            DELETE FROM animals
            WHERE animal_code ILIKE '%DEMO-{taluka.code[:4]}%'
        """))

        # Remove farmers
        await self.db.execute(text(f"""
            DELETE FROM farmers
            WHERE full_name ILIKE '%[DEMO-{taluka.code}]%'
        """))

        # Remove campaigns
        await self.db.execute(text(f"""
            DELETE FROM campaign_villages
            WHERE campaign_id IN (
                SELECT id FROM campaigns WHERE code ILIKE '%DEMO-%' AND code ILIKE '%{taluka.code[:4]}%'
            )
        """))
        await self.db.execute(text(f"""
            DELETE FROM campaigns
            WHERE code ILIKE '%DEMO-%' AND code ILIKE '%{taluka.code[:4]}%'
        """))

        # Remove demo users
        await self.db.execute(text(f"""
            DELETE FROM user_village_assignments
            WHERE user_id IN (
                SELECT id FROM users WHERE full_name ILIKE '%[DEMO-{taluka.code}]%'
            )
        """))
        await self.db.execute(text(f"""
            DELETE FROM users
            WHERE full_name ILIKE '%[DEMO-{taluka.code}]%'
        """))

        audit = AuditEvent(
            actor_user_id=taho_user.id,
            actor_role=taho_user.role,
            action="DEMO_DATA_RESET",
            object_type="taluka",
            object_id=str(taluka.id),
            result="SUCCESS",
            reason=f"Reset demonstration dataset for Taluka {taluka.name_en}",
            ip=client_ip
        )
        self.db.add(audit)
        await self.db.commit()

        return {
            "status": "SUCCESS",
            "message": f"Demonstration records cleanly reset for Taluka {taluka.name_en}."
        }
