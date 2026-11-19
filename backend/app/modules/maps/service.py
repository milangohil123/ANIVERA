"""Geospatial and Maps Service Layer.

Enforces:
- Scope enforcement: DAHO gets assigned district; VO/FW gets assigned villages.
- Never trusts client-supplied district or village parameters.
- Verified coordinates only on the map canvas; unverified or missing coordinates appear in 'સ્થાન ઉપલબ્ધ નથી' list.
- Neutral 'ડેટા અપૂરતો / કોઈ રિપોર્ટ નથી' state when zero disease reports exist; NEVER 'safe/green'.
- Suspected and confirmed counts strictly separate (DEC-020).
- Counts only for vaccination coverage; no invented percentage bands or outbreak radii.
"""
import uuid
from typing import Dict, List, Optional, Set
from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.geography import District, Taluka, Village
from app.modules.animals.models import Animal
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.authorization.service import AuthorizationService
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.maps.boundaries import get_village_boundary
from app.modules.maps.schemas import (
    MapLayersResponse,
    VillageMapPoint,
    VillageSurveillanceMapItem,
    VillageVaccinationMapItem,
)
from app.modules.vaccinations.models import AnimalEvent


class MapService:
    """Service providing scope-filtered geodata and aggregated map layers."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.authz = AuthorizationService(db)

    async def get_map_layers(self, current_user: User, client_ip: Optional[str] = None) -> MapLayersResponse:
        """Fetch scope-filtered map layers for DAHO / VO / FW."""
        try:
            scope = await self.authz.get_user_scope(current_user)

            if current_user.role == "DAHO":
                if not scope.assigned_district_ids:
                    return MapLayersResponse(
                        mappedVillages=[],
                        unmappedVillages=[],
                        surveillanceLayer={},
                        vaccinationLayer={}
                    )
                # All villages in assigned district
                v_stmt = select(Village).where(
                    Village.district_id.in_(scope.assigned_district_ids),
                    Village.active == True
                ).order_by(Village.name_gu)
            elif current_user.role in ("VET_OFFICER", "VO", "FIELD_WORKER", "FW"):
                if not scope.assigned_village_ids:
                    return MapLayersResponse(
                        mappedVillages=[],
                        unmappedVillages=[],
                        surveillanceLayer={},
                        vaccinationLayer={}
                    )
                v_stmt = select(Village).where(
                    Village.id.in_(scope.assigned_village_ids),
                    Village.active == True
                ).order_by(Village.name_gu)
            elif current_user.role in ("DAIRY_STAFF", "COOPERATIVE"):
                if not scope.cooperative_village_ids:
                    return MapLayersResponse(
                        mappedVillages=[],
                        unmappedVillages=[],
                        surveillanceLayer={},
                        vaccinationLayer={}
                    )
                v_stmt = select(Village).where(
                    Village.id.in_(scope.cooperative_village_ids),
                    Village.active == True
                ).order_by(Village.name_gu)
            else:
                return MapLayersResponse(
                    mappedVillages=[],
                    unmappedVillages=[],
                    surveillanceLayer={},
                    vaccinationLayer={}
                )

            all_villages = list((await self.db.execute(v_stmt)).scalars().all())
            mapped_list: List[VillageMapPoint] = []
            unmapped_list: List[VillageMapPoint] = []
            surveillance_dict: Dict[str, VillageSurveillanceMapItem] = {}
            vaccination_dict: Dict[str, VillageVaccinationMapItem] = {}

            if not all_villages:
                return MapLayersResponse(
                    mappedVillages=[],
                    unmappedVillages=[],
                    surveillanceLayer={},
                    vaccinationLayer={}
                )

            village_ids = [v.id for v in all_villages]
            taluka_ids = list({v.taluka_id for v in all_villages if v.taluka_id})
            district_ids = list({v.district_id for v in all_villages if v.district_id})

            # Fetch Taluka & District names
            taluka_map: Dict[uuid.UUID, str] = {}
            if taluka_ids:
                t_res = await self.db.execute(select(Taluka.id, Taluka.name_gu).where(Taluka.id.in_(taluka_ids)))
                taluka_map = {r[0]: r[1] for r in t_res.fetchall()}

            district_map: Dict[uuid.UUID, str] = {}
            if district_ids:
                d_res = await self.db.execute(select(District.id, District.name_gu).where(District.id.in_(district_ids)))
                district_map = {r[0]: r[1] for r in d_res.fetchall()}

            # Fetch assigned VOs for these villages
            vo_map: Dict[uuid.UUID, str] = {}
            if village_ids:
                vo_stmt = (
                    select(UserVillageAssignment.village_id, User.full_name)
                    .join(User, User.id == UserVillageAssignment.user_id)
                    .where(
                        UserVillageAssignment.village_id.in_(village_ids),
                        UserVillageAssignment.ended_at.is_(None),
                        User.role.in_(["VET_OFFICER", "VO"])
                    )
                )
                for row in (await self.db.execute(vo_stmt)).fetchall():
                    vo_map[row[0]] = row[1]

            # 1. Separate mapped vs unmapped and attach boundary polygons
            for v in all_villages:
                is_verified = (v.coord_status == "VERIFIED" and v.latitude is not None and v.longitude is not None)
                boundary = getattr(v, "boundary_geojson", None) or get_village_boundary(v.name_gu, v.code)

                pt = VillageMapPoint(
                    villageId=v.id,
                    code=v.code,
                    nameGu=v.name_gu,
                    nameEn=v.name_en or v.name_gu or v.code,
                    talukaId=v.taluka_id,
                    talukaNameGu=taluka_map.get(v.taluka_id, "બોટાદ"),
                    districtNameGu=district_map.get(v.district_id, "બોટાદ"),
                    latitude=float(v.latitude) if v.latitude else None,
                    longitude=float(v.longitude) if v.longitude else None,
                    coordStatus=v.coord_status or "UNAVAILABLE",
                    isPilot=bool(v.is_pilot),
                    assignedVoName=vo_map.get(v.id),
                    googlePlaceId=getattr(v, "google_place_id", None),
                    formattedAddress=getattr(v, "formatted_address", None),
                    boundaryGeojson=boundary
                )
                if is_verified:
                    mapped_list.append(pt)
                else:
                    unmapped_list.append(pt)

            # 2. Disease Surveillance aggregation per village
            surv_rows = {}
            if village_ids:
                surv_stmt = (
                    select(
                        DiseaseReport.village_id,
                        func.count(
                            case((DiseaseReport.status.in_(["SUBMITTED", "UNDER_REVIEW", "SUSPECTED", "NEEDS_MORE_INFORMATION"]), 1))
                        ).label("suspected"),
                        func.count(
                            case((DiseaseReport.status == "CONFIRMED", 1))
                        ).label("confirmed"),
                        func.count(
                            case((DiseaseReport.status == "NOT_CONFIRMED", 1))
                        ).label("not_confirmed"),
                        func.count(
                            case((DiseaseReport.status == "INSUFFICIENT_INFORMATION", 1))
                        ).label("insufficient"),
                        func.max(DiseaseReport.report_date).label("latest_date")
                    )
                    .where(
                        DiseaseReport.village_id.in_(village_ids),
                        DiseaseReport.duplicate_of.is_(None)
                    )
                    .group_by(DiseaseReport.village_id)
                )
                surv_rows = {r.village_id: r for r in (await self.db.execute(surv_stmt)).all()}

            # 3. Vaccination Coverage aggregation per village
            vac_rows = {}
            if village_ids:
                vac_stmt = (
                    select(
                        AnimalEvent.village_id,
                        func.count(distinct(AnimalEvent.animal_id)).label("vaccinated")
                    )
                    .where(
                        AnimalEvent.village_id.in_(village_ids),
                        AnimalEvent.event_type == "VACCINATION"
                    )
                    .group_by(AnimalEvent.village_id)
                )
                vac_rows = {r.village_id: r.vaccinated for r in (await self.db.execute(vac_stmt)).all()}

            # 4. Animal totals per village
            anim_rows = {}
            if village_ids:
                anim_stmt = (
                    select(
                        Animal.village_id,
                        func.count(Animal.id).label("total")
                    )
                    .where(
                        Animal.village_id.in_(village_ids),
                        Animal.status == "ACTIVE"
                    )
                    .group_by(Animal.village_id)
                )
                anim_rows = {r.village_id: r.total for r in (await self.db.execute(anim_stmt)).all()}

            # Populate dictionaries
            for v in all_villages:
                v_key = str(v.id)
                sr = surv_rows.get(v.id)

                if sr and (sr.suspected > 0 or sr.confirmed > 0 or sr.not_confirmed > 0):
                    surv_item = VillageSurveillanceMapItem(
                        villageId=v.id,
                        suspectedCount=sr.suspected,
                        confirmedCount=sr.confirmed,
                        notConfirmedCount=sr.not_confirmed,
                        insufficientCount=sr.insufficient,
                        latestReportDate=sr.latest_date,
                        statusLabelGu="રિપોર્ટ નોંધાયેલ"
                    )
                else:
                    # MANDATORY INVARIANT: NEVER show 'safe/disease-free'; use neutral state
                    surv_item = VillageSurveillanceMapItem(
                        villageId=v.id,
                        suspectedCount=0,
                        confirmedCount=0,
                        notConfirmedCount=0,
                        insufficientCount=0,
                        latestReportDate=None,
                        statusLabelGu="ડેટા અપૂરતો / કોઈ રિપોર્ટ નથી"
                    )
                surveillance_dict[v_key] = surv_item

                vac_count = vac_rows.get(v.id, 0)
                anim_count = anim_rows.get(v.id, 0)
                pct = round((vac_count / anim_count) * 100, 1) if anim_count > 0 else 0.0
                pending = max(0, anim_count - vac_count)

                if anim_count == 0:
                    vac_status_label = "માહિતી ઉપલબ્ધ નથી"
                elif pct >= 80.0:
                    vac_status_label = f"ઉચ્ચ રસીકરણ કવરેજ ({pct}%)"
                elif pct >= 60.0:
                    vac_status_label = f"મધ્યમ રસીકરણ કવરેજ ({pct}%)"
                else:
                    vac_status_label = f"ઓછું રસીકરણ કવરેજ ({pct}%)"

                vaccination_dict[v_key] = VillageVaccinationMapItem(
                    villageId=v.id,
                    totalVaccinatedCount=vac_count,
                    totalRegisteredAnimals=anim_count,
                    coveragePercentage=pct,
                    pendingVaccinations=pending,
                    thresholdConfigured=True if anim_count > 0 else False,
                    statusLabelGu=vac_status_label
                )

            return MapLayersResponse(
                mappedVillages=mapped_list,
                unmappedVillages=unmapped_list,
                surveillanceLayer=surveillance_dict,
                vaccinationLayer=vaccination_dict
            )
        except Exception as exc:
            logger.exception("Failed to get map layers for user %s (%s): %s", getattr(current_user, "id", None), getattr(current_user, "role", None), exc)
            return MapLayersResponse(
                mappedVillages=[],
                unmappedVillages=[],
                surveillanceLayer={},
                vaccinationLayer={}
            )

