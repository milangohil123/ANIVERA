"""Inference & Analytics Service Layer.

Provides real database-backed aggregated metrics for:
- Vaccination Programme Analytics (coverage, progress, district/species comparisons, time trends)
- Disease Surveillance Analytics (disease reports, trends, confirmations, status, species distribution, hotspots)
- Top-Down Administrative Hierarchy & Server-Side Geographic Scope Enforcement:
    - Super Admin: Statewide Gujarat (All or Multi-District selection)
    - DAHO: Restricted to assigned district(s)
    - TAHO: Restricted to assigned taluka(s)
    - VO / FW: Restricted to assigned villages
    - Dairy Cooperative / GP: Restricted to operational scope
    - Farmer: Restricted to linked livestock
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import and_, case, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import District, Taluka, Village
from app.models.reference import Programme, Species
from app.modules.animals.models import Animal
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.campaigns.models import Campaign
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.master_data.models import DiseaseMaster, VaccineMaster
from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail


# Fallback Gujarat 34 authentic districts mapping
GUJARAT_DISTRICTS_FALLBACK = [
    {"code": "DIST_AHMEDABAD", "name_en": "Ahmedabad", "name_gu": "અમદાવાદ"},
    {"code": "DIST_AMRELI", "name_en": "Amreli", "name_gu": "અમરેલી"},
    {"code": "DIST_ANAND", "name_en": "Anand", "name_gu": "આણંદ"},
    {"code": "DIST_ARAVALLI", "name_en": "Aravalli", "name_gu": "અરવલ્લી"},
    {"code": "DIST_BANASKANTHA", "name_en": "Banaskantha", "name_gu": "બનાસકાંઠા"},
    {"code": "DIST_BHARUCH", "name_en": "Bharuch", "name_gu": "ભરૂચ"},
    {"code": "DIST_BHAVNAGAR", "name_en": "Bhavnagar", "name_gu": "ભાવનગર"},
    {"code": "DIST_BOTAD", "name_en": "Botad", "name_gu": "બોટાદ"},
    {"code": "DIST_CHHOTA_UDELPUR", "name_en": "Chhota Udaipur", "name_gu": "છોટા ઉદેપુર"},
    {"code": "DIST_DAHOD", "name_en": "Dahod", "name_gu": "દાહોદ"},
    {"code": "DIST_DANG", "name_en": "Dang", "name_gu": "ડાંગ"},
    {"code": "DIST_DEVBHUMI_DWARKA", "name_en": "Devbhumi Dwarka", "name_gu": "દેવભૂમિ દ્વારકા"},
    {"code": "DIST_GANDHINAGAR", "name_en": "Gandhinagar", "name_gu": "ગાંધીનગર"},
    {"code": "DIST_GIR_SOMNATH", "name_en": "Gir Somnath", "name_gu": "ગીર સોમનાથ"},
    {"code": "DIST_JAMNAGAR", "name_en": "Jamnagar", "name_gu": "જામનગર"},
    {"code": "DIST_JUNAGADH", "name_en": "Junagadh", "name_gu": "જૂનાગઢ"},
    {"code": "DIST_KHEDA", "name_en": "Kheda", "name_gu": "ખેડા"},
    {"code": "DIST_KUTCH", "name_en": "Kutch", "name_gu": "કચ્છ"},
    {"code": "DIST_MAHISAGAR", "name_en": "Mahisagar", "name_gu": "મહીસાગર"},
    {"code": "DIST_MEHSANA", "name_en": "Mehsana", "name_gu": "મહેસાણા"},
    {"code": "DIST_MORBI", "name_en": "Morbi", "name_gu": "મોરબી"},
    {"code": "DIST_NARMADA", "name_en": "Narmada", "name_gu": "નર્મદા"},
    {"code": "DIST_NAVSARI", "name_en": "Navsari", "name_gu": "નવસારી"},
    {"code": "DIST_PANCHMAHAL", "name_en": "Panchmahal", "name_gu": "પંચમહાલ"},
    {"code": "DIST_PATAN", "name_en": "Patan", "name_gu": "પાટણ"},
    {"code": "DIST_PORBANDAR", "name_en": "Porbandar", "name_gu": "પોરબંદર"},
    {"code": "DIST_RAJKOT", "name_en": "Rajkot", "name_gu": "રાજકોટ"},
    {"code": "DIST_SABARKANTHA", "name_en": "Sabarkantha", "name_gu": "સાબરકાંઠા"},
    {"code": "DIST_SURAT", "name_en": "Surat", "name_gu": "સુરત"},
    {"code": "DIST_SURENDRANAGAR", "name_en": "Surendranagar", "name_gu": "સુરેન્દ્રનગર"},
    {"code": "DIST_TAPI", "name_en": "Tapi", "name_gu": "તાપી"},
    {"code": "DIST_VADODARA", "name_en": "Vadodara", "name_gu": "વડોદરા"},
    {"code": "DIST_VALSAD", "name_en": "Valsad", "name_gu": "વલસાડ"},
]

SPECIES_GU_MAP = {
    "CATTLE": "ગાય (Cattle)",
    "BUFFALO": "ભેંસ (Buffalo)",
    "GOAT": "બકરી (Goat)",
    "SHEEP": "ઘેટાં (Sheep)",
    "CAMEL": "ઊંટ (Camel)",
    "HORSE": "ઘોડા (Horse)",
    "POULTRY": "મરઘાં (Poultry)",
    "PIG": "ડુક્કર (Pig)"
}

DISEASE_STATUS_GU_MAP = {
    "SUBMITTED": "નવી ફરિયાદ (Submitted)",
    "UNDER_REVIEW": "તપાસ હેઠળ (Under Review)",
    "SUSPECTED": "શંકાસ્પદ (Suspected)",
    "NEEDS_MORE_INFORMATION": "વધુ વિગત જરૂરી (More Info Required)",
    "CONFIRMED": "પુષ્ટિ થયેલ (Confirmed)",
    "NOT_CONFIRMED": "અપ્રમાણિત (Not Confirmed)",
    "RESOLVED": "નિરાકરણ થયેલ (Resolved)",
    "CLOSED": "કેસ પૂર્ણ / બંધ (Closed)"
}


class AnalyticsService:
    """Service providing query-level scoped analytics and inference for vaccinations and disease surveillance."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.authz = AuthorizationService(db)

    async def _resolve_scope(
        self,
        current_user: User,
        req_district_ids: Optional[List[uuid.UUID]] = None,
        req_taluka_ids: Optional[List[uuid.UUID]] = None,
        req_village_ids: Optional[List[uuid.UUID]] = None,
    ) -> Dict[str, Any]:
        """Strict server-side enforcement of geographic boundaries based on RBAC scope.
        
        Governance:
        - Admin can view statewide or filter to requested districts/talukas/villages.
        - DAHO is locked to their assigned districts; any requested districts outside assignment are ignored.
        - TAHO is locked to their assigned talukas.
        - VO / FW are locked to their assigned villages.
        - Dairy staff locked to cooperative operational villages.
        - Farmer locked to own registered animals.
        """
        user_scope = await self.authz.get_user_scope(current_user)
        role = current_user.role

        allowed_district_ids: Optional[Set[uuid.UUID]] = None
        allowed_taluka_ids: Optional[Set[uuid.UUID]] = None
        allowed_village_ids: Optional[Set[uuid.UUID]] = None
        allowed_farmer_ids: Optional[Set[uuid.UUID]] = None

        if role in ("SYS_ADMIN", "SUPER_ADMIN", "ADMIN"):
            if req_district_ids:
                allowed_district_ids = set(req_district_ids)
            if req_taluka_ids:
                allowed_taluka_ids = set(req_taluka_ids)
            if req_village_ids:
                allowed_village_ids = set(req_village_ids)

        elif role == "DAHO":
            assigned_districts = user_scope.assigned_district_ids or set()
            if req_district_ids:
                # Intersect requested with assigned
                allowed_district_ids = set(req_district_ids).intersection(assigned_districts)
                if not allowed_district_ids:
                    allowed_district_ids = assigned_districts
            else:
                allowed_district_ids = assigned_districts

            if req_taluka_ids:
                allowed_taluka_ids = set(req_taluka_ids)
            if req_village_ids:
                allowed_village_ids = set(req_village_ids)

        elif role == "TAHO":
            assigned_talukas = user_scope.assigned_taluka_ids or set()
            if req_taluka_ids:
                allowed_taluka_ids = set(req_taluka_ids).intersection(assigned_talukas)
                if not allowed_taluka_ids:
                    allowed_taluka_ids = assigned_talukas
            else:
                allowed_taluka_ids = assigned_talukas

            if req_village_ids:
                allowed_village_ids = set(req_village_ids)

        elif role in ("VET_OFFICER", "VO", "FIELD_WORKER", "FW"):
            assigned_villages = user_scope.assigned_village_ids or set()
            if req_village_ids:
                allowed_village_ids = set(req_village_ids).intersection(assigned_villages)
                if not allowed_village_ids:
                    allowed_village_ids = assigned_villages
            else:
                allowed_village_ids = assigned_villages

        elif role in ("DAIRY_STAFF", "COOPERATIVE", "COOP"):
            allowed_village_ids = user_scope.cooperative_village_ids or set()

        elif role == "FARMER":
            allowed_farmer_ids = user_scope.linked_farmer_ids or set()

        return {
            "role": role,
            "district_ids": allowed_district_ids,
            "taluka_ids": allowed_taluka_ids,
            "village_ids": allowed_village_ids,
            "farmer_ids": allowed_farmer_ids,
        }

    # =========================================================================
    # Filter Metadata Endpoint (Populates Dropdowns with User Scope)
    # =========================================================================
    async def get_filter_metadata(self, current_user: User) -> Dict[str, Any]:
        """Retrieve available filter options strictly permitted for caller's role."""
        scope_info = await self._resolve_scope(current_user)

        # 1. Permitted Districts
        d_stmt = select(District).where(
            District.active == True,
            ~District.code.like("D_%"),
            ~District.name_gu.like("જી%"),
            District.name_gu.not_in(["જી", "જી ૧", "જી ૨", "જી એ"])
        ).order_by(District.name_en)

        if scope_info["district_ids"] is not None:
            if len(scope_info["district_ids"]) > 0:
                d_stmt = d_stmt.where(District.id.in_(scope_info["district_ids"]))
            else:
                d_stmt = d_stmt.where(District.id == uuid.uuid4()) # Empty set

        dist_res = await self.db.execute(d_stmt)
        districts = [
            {"id": str(d.id), "code": d.code, "name_en": d.name_en, "name_gu": d.name_gu}
            for d in dist_res.scalars().all()
        ]

        if not districts and scope_info["role"] in ("SYS_ADMIN", "SUPER_ADMIN"):
            districts = GUJARAT_DISTRICTS_FALLBACK

        # 2. Permitted Talukas
        t_stmt = select(Taluka).order_by(Taluka.name_en)
        if scope_info["taluka_ids"] is not None:
            t_stmt = t_stmt.where(Taluka.id.in_(scope_info["taluka_ids"]))
        elif scope_info["district_ids"] is not None:
            t_stmt = t_stmt.where(Taluka.district_id.in_(scope_info["district_ids"]))

        taluka_res = await self.db.execute(t_stmt.limit(250))
        talukas = [
            {
                "id": str(t.id),
                "district_id": str(t.district_id),
                "code": t.code,
                "name_en": t.name_en,
                "name_gu": t.name_gu
            }
            for t in taluka_res.scalars().all()
        ]

        # 3. Programmes
        p_res = await self.db.execute(select(Programme).order_by(Programme.code))
        programmes = [
            {"code": p.code, "name_en": p.name_en, "name_gu": p.name_gu}
            for p in p_res.scalars().all()
        ]

        # 4. Vaccines
        v_res = await self.db.execute(select(VaccineMaster).where(VaccineMaster.active == True).order_by(VaccineMaster.code))
        vaccines = [
            {"code": v.code, "name_en": v.name_en, "name_gu": v.name_gu, "disease_code": v.disease_code}
            for v in v_res.scalars().all()
        ]

        # 5. Diseases
        dis_res = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.active == True).order_by(DiseaseMaster.code))
        diseases = [
            {"code": d.code, "name_en": d.name_en, "name_gu": d.name_gu, "color": d.color}
            for d in dis_res.scalars().all()
        ]

        # 6. Species
        sp_res = await self.db.execute(select(Species).where(Species.active == True).order_by(Species.code))
        species_list = [
            {"code": s.code, "name_en": s.name_en, "name_gu": s.name_gu}
            for s in sp_res.scalars().all()
        ]
        if not species_list:
            species_list = [{"code": k, "name_en": k.title(), "name_gu": v} for k, v in SPECIES_GU_MAP.items()]

        return {
            "districts": districts,
            "talukas": talukas,
            "programmes": programmes,
            "vaccines": vaccines,
            "diseases": diseases,
            "species": species_list,
            "user_role": scope_info["role"],
            "can_select_all_districts": scope_info["role"] in ("SYS_ADMIN", "SUPER_ADMIN"),
        }

    # =========================================================================
    # 1. Vaccination Analytics (Coverage, Progress, Comparisons, Trends)
    # =========================================================================
    async def get_vaccination_analytics(
        self,
        current_user: User,
        programme_code: Optional[str] = None,
        vaccine_code: Optional[str] = None,
        disease_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        district_ids: Optional[List[uuid.UUID]] = None,
        taluka_ids: Optional[List[uuid.UUID]] = None,
        village_ids: Optional[List[uuid.UUID]] = None,
        species_codes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Aggregate vaccination performance metrics, coverage % and graph telemetry from database."""
        scope_info = await self._resolve_scope(current_user, district_ids, taluka_ids, village_ids)

        # Set default date window (e.g. past 180 days if none supplied)
        effective_end = end_date or date.today()
        effective_start = start_date or (effective_end - timedelta(days=180))

        # ---------------------------------------------------------------------
        # Base Geographic Query Filter for Villages
        # ---------------------------------------------------------------------
        village_filters = [Village.active == True]
        if scope_info["village_ids"]:
            village_filters.append(Village.id.in_(scope_info["village_ids"]))
        elif scope_info["taluka_ids"]:
            village_filters.append(Village.taluka_id.in_(scope_info["taluka_ids"]))
        elif scope_info["district_ids"]:
            village_filters.append(Village.district_id.in_(scope_info["district_ids"]))

        # ---------------------------------------------------------------------
        # A. Total Eligible Livestock Query
        # ---------------------------------------------------------------------
        animal_stmt = (
            select(
                func.count(distinct(Animal.id)).label("total_eligible"),
                Animal.species_code,
                Village.district_id
            )
            .join(Village, Animal.village_id == Village.id)
            .where(
                Animal.status == "ACTIVE",
                *village_filters
            )
        )
        if species_codes:
            animal_stmt = animal_stmt.where(Animal.species_code.in_(species_codes))
        if scope_info["farmer_ids"]:
            animal_stmt = animal_stmt.where(Animal.farmer_id.in_(scope_info["farmer_ids"]))

        animal_res = (await self.db.execute(animal_stmt.group_by(Animal.species_code, Village.district_id))).fetchall()

        total_eligible_animals = sum(row[0] for row in animal_res)
        eligible_by_species: Dict[str, int] = {}
        eligible_by_district: Dict[uuid.UUID, int] = {}

        for cnt, sp, dist_id in animal_res:
            eligible_by_species[sp] = eligible_by_species.get(sp, 0) + cnt
            if dist_id:
                eligible_by_district[dist_id] = eligible_by_district.get(dist_id, 0) + cnt

        # ---------------------------------------------------------------------
        # B. Vaccinated Livestock Query (AnimalEvent + VaccinationDetail)
        # ---------------------------------------------------------------------
        vax_event_stmt = (
            select(
                AnimalEvent.animal_id,
                AnimalEvent.event_date,
                VaccinationDetail.programme_code,
                Animal.species_code,
                Village.district_id,
                District.name_gu.label("district_name_gu"),
                District.name_en.label("district_name_en")
            )
            .join(VaccinationDetail, VaccinationDetail.event_id == AnimalEvent.event_id)
            .join(Animal, Animal.id == AnimalEvent.animal_id)
            .join(Village, Village.id == AnimalEvent.village_id)
            .outerjoin(District, District.id == Village.district_id)
            .where(
                AnimalEvent.event_type == "VACCINATION",
                AnimalEvent.event_date >= effective_start,
                AnimalEvent.event_date <= effective_end,
                Animal.status == "ACTIVE",
                *village_filters
            )
        )

        if programme_code:
            vax_event_stmt = vax_event_stmt.where(VaccinationDetail.programme_code == programme_code)
        if species_codes:
            vax_event_stmt = vax_event_stmt.where(Animal.species_code.in_(species_codes))
        if scope_info["farmer_ids"]:
            vax_event_stmt = vax_event_stmt.where(Animal.farmer_id.in_(scope_info["farmer_ids"]))

        vax_rows = (await self.db.execute(vax_event_stmt)).fetchall()

        # Aggregation buckets (strictly deduplicated unique animals vaccinated)
        unique_vaccinated_animals: Set[uuid.UUID] = set()
        vax_by_programme: Dict[str, Set[uuid.UUID]] = {}
        vax_by_species: Dict[str, Set[uuid.UUID]] = {}
        vax_by_district: Dict[uuid.UUID, Dict[str, Any]] = {}
        vax_by_date: Dict[str, int] = {}

        total_doses_administered = len(vax_rows)

        for a_id, ev_date, prog, sp, d_id, d_name_gu, d_name_en in vax_rows:
            unique_vaccinated_animals.add(a_id)

            # Programme breakdown
            if prog not in vax_by_programme:
                vax_by_programme[prog] = set()
            vax_by_programme[prog].add(a_id)

            # Species breakdown
            if sp not in vax_by_species:
                vax_by_species[sp] = set()
            vax_by_species[sp].add(a_id)

            # District breakdown
            if d_id:
                if d_id not in vax_by_district:
                    vax_by_district[d_id] = {
                        "district_id": str(d_id),
                        "district_name_gu": d_name_gu or "અજ્ઞાત જિલ્લો",
                        "district_name_en": d_name_en or "District",
                        "vaccinated_animals": set(),
                    }
                vax_by_district[d_id]["vaccinated_animals"].add(a_id)

            # Date trend
            d_str = ev_date.isoformat()
            vax_by_date[d_str] = vax_by_date.get(d_str, 0) + 1

        vaccinated_animals_count = len(unique_vaccinated_animals)
        pending_animals_count = max(0, total_eligible_animals - vaccinated_animals_count)
        coverage_pct = round((vaccinated_animals_count / total_eligible_animals * 100), 1) if total_eligible_animals > 0 else 0.0

        # Distinct programmes available in scope
        prog_count_res = await self.db.execute(select(func.count(distinct(VaccinationDetail.programme_code))))
        total_programmes_count = prog_count_res.scalar() or len(vax_by_programme) or 1

        # ---------------------------------------------------------------------
        # C. Construct Graphs Telemetry
        # ---------------------------------------------------------------------
        # 1. Overall Coverage Breakdown
        coverage_graph = {
            "eligible": total_eligible_animals,
            "vaccinated": vaccinated_animals_count,
            "pending": pending_animals_count,
            "coverage_pct": coverage_pct,
            "total_doses": total_doses_administered,
        }

        # 2. Programme-wise Progress Graph
        programme_progress = []
        for p_code, a_set in vax_by_programme.items():
            v_cnt = len(a_set)
            # Estimate target from total eligible
            t_cnt = total_eligible_animals if total_eligible_animals > 0 else v_cnt
            p_cov = round((v_cnt / t_cnt * 100), 1) if t_cnt > 0 else 0.0
            programme_progress.append({
                "programme_code": p_code,
                "programme_name": p_code,
                "vaccinated_count": v_cnt,
                "pending_count": max(0, t_cnt - v_cnt),
                "total_target": t_cnt,
                "coverage_pct": p_cov,
            })
        programme_progress.sort(key=lambda x: x["vaccinated_count"], reverse=True)

        # 3. District-wise Comparison
        district_comparison = []
        # Include all districts in scope even if zero vaccinations
        target_dist_ids = set(vax_by_district.keys()).union(set(eligible_by_district.keys()))
        if scope_info["district_ids"]:
            target_dist_ids = target_dist_ids.intersection(scope_info["district_ids"])

        for d_id in target_dist_ids:
            d_data = vax_by_district.get(d_id)
            d_elig = eligible_by_district.get(d_id, 0)
            d_vax = len(d_data["vaccinated_animals"]) if d_data else 0
            d_pend = max(0, d_elig - d_vax)
            d_cov = round((d_vax / d_elig * 100), 1) if d_elig > 0 else 0.0

            name_gu = d_data["district_name_gu"] if d_data else "જિલ્લો"
            name_en = d_data["district_name_en"] if d_data else "District"

            district_comparison.append({
                "district_id": str(d_id),
                "district_name_gu": name_gu,
                "district_name_en": name_en,
                "eligible_count": d_elig,
                "vaccinated_count": d_vax,
                "pending_count": d_pend,
                "coverage_pct": d_cov,
            })
        district_comparison.sort(key=lambda x: x["vaccinated_count"], reverse=True)

        # 4. Species-wise Vaccination Graph
        species_comparison = []
        all_species = set(list(eligible_by_species.keys()) + list(vax_by_species.keys()))
        for sp in all_species:
            sp_elig = eligible_by_species.get(sp, 0)
            sp_vax = len(vax_by_species.get(sp, set()))
            sp_pend = max(0, sp_elig - sp_vax)
            sp_cov = round((sp_vax / sp_elig * 100), 1) if sp_elig > 0 else 0.0
            species_comparison.append({
                "species_code": sp,
                "species_name_gu": SPECIES_GU_MAP.get(sp, sp),
                "species_name_en": sp.title(),
                "eligible_count": sp_elig,
                "vaccinated_count": sp_vax,
                "pending_count": sp_pend,
                "coverage_pct": sp_cov,
            })
        species_comparison.sort(key=lambda x: x["vaccinated_count"], reverse=True)

        # 5. Time-wise Vaccination Trend (Sorted Date Series)
        time_trend = []
        sorted_dates = sorted(list(vax_by_date.keys()))
        cumul = 0
        for d_str in sorted_dates:
            daily_cnt = vax_by_date[d_str]
            cumul += daily_cnt
            # Format friendly label
            time_trend.append({
                "period": d_str,
                "label": d_str[5:], # MM-DD
                "value": daily_cnt,
                "cumulative": cumul,
            })

        return {
            "kpis": {
                "total_eligible_animals": total_eligible_animals,
                "vaccinated_animals": vaccinated_animals_count,
                "pending_animals": pending_animals_count,
                "coverage_percentage": coverage_pct,
                "total_programmes": total_programmes_count,
                "total_doses_administered": total_doses_administered,
            },
            "filters_applied": {
                "start_date": effective_start.isoformat(),
                "end_date": effective_end.isoformat(),
                "programme_code": programme_code,
                "vaccine_code": vaccine_code,
                "disease_code": disease_code,
                "species_codes": species_codes,
            },
            "graphs": {
                "coverage": coverage_graph,
                "programme_progress": programme_progress,
                "district_comparison": district_comparison,
                "species_comparison": species_comparison,
                "time_trend": time_trend,
            }
        }

    # =========================================================================
    # 2. Disease Surveillance Analytics (Incidence, Trends, Hotspots, Status)
    # =========================================================================
    async def get_disease_analytics(
        self,
        current_user: User,
        disease_code: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        district_ids: Optional[List[uuid.UUID]] = None,
        taluka_ids: Optional[List[uuid.UUID]] = None,
        village_ids: Optional[List[uuid.UUID]] = None,
        species_codes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Aggregate disease incident reports, verification patterns, and cluster hotspot telemetry."""
        scope_info = await self._resolve_scope(current_user, district_ids, taluka_ids, village_ids)

        effective_end = end_date or date.today()
        effective_start = start_date or (effective_end - timedelta(days=180))

        # Base Filters
        filters = [
            DiseaseReport.report_date >= effective_start,
            DiseaseReport.report_date <= effective_end,
            Village.active == True,
        ]

        if disease_code:
            filters.append(DiseaseReport.disease_code == disease_code)
        if status:
            filters.append(DiseaseReport.status == status)

        if scope_info["village_ids"]:
            filters.append(Village.id.in_(scope_info["village_ids"]))
        elif scope_info["taluka_ids"]:
            filters.append(Village.taluka_id.in_(scope_info["taluka_ids"]))
        elif scope_info["district_ids"]:
            filters.append(Village.district_id.in_(scope_info["district_ids"]))

        # Execute Main Disease Query
        stmt = (
            select(
                DiseaseReport.report_id,
                DiseaseReport.disease_code,
                DiseaseReport.report_date,
                DiseaseReport.status,
                DiseaseReport.treatment_status,
                DiseaseReport.urgency,
                DiseaseReport.confirmed_at,
                Animal.species_code,
                Village.id.label("village_id"),
                Village.name_gu.label("village_name_gu"),
                Village.taluka_id,
                Taluka.name_gu.label("taluka_name_gu"),
                Village.district_id,
                District.name_gu.label("district_name_gu"),
                District.name_en.label("district_name_en")
            )
            .join(Village, Village.id == DiseaseReport.village_id)
            .outerjoin(Taluka, Taluka.id == Village.taluka_id)
            .outerjoin(District, District.id == Village.district_id)
            .outerjoin(Animal, Animal.id == DiseaseReport.animal_id)
            .where(*filters)
        )

        if species_codes:
            stmt = stmt.where(Animal.species_code.in_(species_codes))
        if scope_info["farmer_ids"]:
            stmt = stmt.where(DiseaseReport.farmer_id.in_(scope_info["farmer_ids"]))

        rows = (await self.db.execute(stmt)).fetchall()

        # ---------------------------------------------------------------------
        # Aggregate KPI Totals
        # ---------------------------------------------------------------------
        total_reports = len(rows)
        confirmed_cases_count = 0
        pending_cases_count = 0
        completed_verified_count = 0
        distinct_diseases: Set[str] = set()

        by_disease: Dict[str, Dict[str, Any]] = {}
        by_date: Dict[str, Dict[str, int]] = {}
        by_district: Dict[uuid.UUID, Dict[str, Any]] = {}
        by_species: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        by_taluka: Dict[uuid.UUID, Dict[str, Any]] = {}

        for r_id, dis_c, rep_d, st, tr_st, urg, conf_at, sp, v_id, v_gu, t_id, t_gu, d_id, d_gu, d_en in rows:
            distinct_diseases.add(dis_c)

            is_confirmed = (st == "CONFIRMED" or conf_at is not None)
            is_pending = (st in ("SUBMITTED", "UNDER_REVIEW", "SUSPECTED", "NEEDS_MORE_INFORMATION") or tr_st in ("SUBMITTED", "ASSIGNED"))
            is_completed = (st in ("RESOLVED", "CLOSED") or tr_st in ("VERIFIED", "CLOSED"))

            if is_confirmed:
                confirmed_cases_count += 1
            if is_pending:
                pending_cases_count += 1
            if is_completed:
                completed_verified_count += 1

            # Disease-wise breakdown
            if dis_c not in by_disease:
                by_disease[dis_c] = {
                    "disease_code": dis_c,
                    "total_cases": 0,
                    "confirmed_cases": 0,
                    "suspected_cases": 0,
                }
            by_disease[dis_c]["total_cases"] += 1
            if is_confirmed:
                by_disease[dis_c]["confirmed_cases"] += 1
            else:
                by_disease[dis_c]["suspected_cases"] += 1

            # Time trend
            d_str = rep_d.isoformat()
            if d_str not in by_date:
                by_date[d_str] = {"total": 0, "confirmed": 0, "suspected": 0}
            by_date[d_str]["total"] += 1
            if is_confirmed:
                by_date[d_str]["confirmed"] += 1
            else:
                by_date[d_str]["suspected"] += 1

            # District breakdown
            if d_id:
                if d_id not in by_district:
                    by_district[d_id] = {
                        "district_id": str(d_id),
                        "district_name_gu": d_gu or "જિલ્લો",
                        "district_name_en": d_en or "District",
                        "total_cases": 0,
                        "confirmed_cases": 0,
                        "pending_cases": 0,
                    }
                by_district[d_id]["total_cases"] += 1
                if is_confirmed:
                    by_district[d_id]["confirmed_cases"] += 1
                if is_pending:
                    by_district[d_id]["pending_cases"] += 1

            # Species breakdown
            if sp:
                by_species[sp] = by_species.get(sp, 0) + 1

            # Status breakdown
            clean_status = st or "SUBMITTED"
            by_status[clean_status] = by_status.get(clean_status, 0) + 1

            # Taluka Hotspots
            if t_id:
                if t_id not in by_taluka:
                    by_taluka[t_id] = {
                        "taluka_id": str(t_id),
                        "taluka_name_gu": t_gu or "તાલુકો",
                        "case_count": 0,
                        "confirmed_count": 0,
                        "district_name_gu": d_gu or "",
                    }
                by_taluka[t_id]["case_count"] += 1
                if is_confirmed:
                    by_taluka[t_id]["confirmed_count"] += 1

        # ---------------------------------------------------------------------
        # Construct Output Graphs
        # ---------------------------------------------------------------------
        # 1. Disease-wise Reports Graph with percentages
        disease_reports_graph = []
        for dis_c, val in by_disease.items():
            pct = round((val["total_cases"] / total_reports * 100), 1) if total_reports > 0 else 0.0
            disease_reports_graph.append({
                "disease_code": dis_c,
                "disease_name_gu": dis_c,
                "disease_name_en": dis_c,
                "total_cases": val["total_cases"],
                "confirmed_cases": val["confirmed_cases"],
                "suspected_cases": val["suspected_cases"],
                "percentage": pct,
            })
        disease_reports_graph.sort(key=lambda x: x["total_cases"], reverse=True)

        # 2. Time-wise Cases Trend
        cases_trend = []
        sorted_dates = sorted(list(by_date.keys()))
        for d_str in sorted_dates:
            pt = by_date[d_str]
            cases_trend.append({
                "period": d_str,
                "label": d_str[5:],
                "total_reports": pt["total"],
                "confirmed_cases": pt["confirmed"],
                "suspected_cases": pt["suspected"],
            })

        # 3. District Comparison
        district_comparison = list(by_district.values())
        district_comparison.sort(key=lambda x: x["total_cases"], reverse=True)

        # 4. Species Distribution
        species_distribution = []
        for sp, cnt in by_species.items():
            pct = round((cnt / total_reports * 100), 1) if total_reports > 0 else 0.0
            species_distribution.append({
                "species_code": sp,
                "species_name_gu": SPECIES_GU_MAP.get(sp, sp),
                "case_count": cnt,
                "percentage": pct,
            })
        species_distribution.sort(key=lambda x: x["case_count"], reverse=True)

        # 5. Disease Status Graph
        status_breakdown = []
        for st_key, cnt in by_status.items():
            pct = round((cnt / total_reports * 100), 1) if total_reports > 0 else 0.0
            status_breakdown.append({
                "status": st_key,
                "label_gu": DISEASE_STATUS_GU_MAP.get(st_key, st_key),
                "count": cnt,
                "percentage": pct,
            })
        status_breakdown.sort(key=lambda x: x["count"], reverse=True)

        # 6. Regional Hotspots
        regional_hotspots = []
        for t_info in by_taluka.values():
            c_cnt = t_info["case_count"]
            risk = "HIGH" if c_cnt >= 10 else ("MODERATE" if c_cnt >= 3 else "LOW")
            regional_hotspots.append({
                "taluka_id": t_info["taluka_id"],
                "taluka_name_gu": t_info["taluka_name_gu"],
                "district_name_gu": t_info["district_name_gu"],
                "case_count": c_cnt,
                "confirmed_count": t_info["confirmed_count"],
                "risk_level": risk,
            })
        regional_hotspots.sort(key=lambda x: x["case_count"], reverse=True)

        return {
            "kpis": {
                "total_disease_reports": total_reports,
                "confirmed_cases": confirmed_cases_count,
                "pending_disease_reports": pending_cases_count,
                "completed_verified_cases": completed_verified_count,
                "distinct_diseases_count": len(distinct_diseases),
            },
            "filters_applied": {
                "start_date": effective_start.isoformat(),
                "end_date": effective_end.isoformat(),
                "disease_code": disease_code,
                "status": status,
                "species_codes": species_codes,
            },
            "graphs": {
                "disease_wise_reports": disease_reports_graph,
                "cases_trend": cases_trend,
                "district_comparison": district_comparison,
                "species_distribution": species_distribution,
                "status_breakdown": status_breakdown,
                "regional_hotspots": regional_hotspots[:15],
            }
        }
