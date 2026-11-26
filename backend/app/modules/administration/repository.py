"""Asynchronous database repository for Administrative Management.

Encapsulates all database operations for:
- Districts, Talukas, Villages
- Gram Panchayats & GP-to-Village Mappings
- Cooperatives, Served Villages & Cooperative Staff
- Veterinary Officers & VO Profiles
- Field Workers
- User-to-Village and DAHO-to-District Assignments
- Audit Logging
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import (
    AuditEvent,
    DahoDistrictAssignment,
    User,
    UserVillageAssignment,
)
from app.modules.administration.models import (
    Cooperative,
    GramPanchayat,
    GramPanchayatStaffAssignment,
    GramPanchayatVillage,
    VeterinaryOfficerProfile,
)
from app.modules.authorization.models import (
    CooperativeStaffAssignment,
    CooperativeVillage,
)


class AdministrationRepository:
    """Repository handling all database interactions for administration."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # =========================================================================
    # 1. District Operations
    # =========================================================================
    async def list_districts(
        self,
        district_ids: Optional[Set[uuid.UUID]] = None,
        active_only: bool = False,
        offset: int = 0,
        limit: int = 50
    ) -> List[District]:
        stmt = select(District)
        if district_ids is not None:
            stmt = stmt.where(District.id.in_(district_ids))
        if active_only:
            stmt = stmt.where(District.active.is_(True))
        stmt = stmt.order_by(District.code).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_district_by_id(self, district_id: uuid.UUID) -> Optional[District]:
        stmt = select(District).where(District.id == district_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_district_by_code(self, code: str) -> Optional[District]:
        stmt = select(District).where(District.code == code.strip().upper())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_district(
        self,
        code: str,
        name_gu: str,
        name_en: str,
        active: bool = True
    ) -> District:
        now = datetime.now(timezone.utc)
        dist = District(
            id=uuid.uuid4(),
            code=code.strip().upper(),
            name_gu=name_gu.strip(),
            name_en=name_en.strip(),
            active=active,
            created_at=now,
            updated_at=now
        )
        self.db.add(dist)
        await self.db.flush()
        return dist

    async def update_district(
        self,
        district: District,
        name_gu: Optional[str] = None,
        name_en: Optional[str] = None,
        active: Optional[bool] = None
    ) -> District:
        if name_gu is not None:
            district.name_gu = name_gu.strip()
        if name_en is not None:
            district.name_en = name_en.strip()
        if active is not None:
            district.active = active
        district.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return district

    async def get_district_summary(self, district_id: uuid.UUID) -> Dict[str, Any]:
        """Aggregate administrative entity counts for a district."""
        taluka_count_stmt = select(func.count(Taluka.id)).where(Taluka.district_id == district_id)
        taluka_count = (await self.db.execute(taluka_count_stmt)).scalar() or 0

        village_count_stmt = select(func.count(Village.id)).where(Village.district_id == district_id)
        village_count = (await self.db.execute(village_count_stmt)).scalar() or 0

        gp_count_stmt = (
            select(func.count(GramPanchayat.id))
            .join(Taluka, GramPanchayat.taluka_id == Taluka.id)
            .where(Taluka.district_id == district_id)
        )
        gp_count = (await self.db.execute(gp_count_stmt)).scalar() or 0

        # Distinct VOs and FWs assigned to villages in this district
        vo_count_stmt = (
            select(func.count(func.distinct(UserVillageAssignment.user_id)))
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .join(User, UserVillageAssignment.user_id == User.id)
            .where(
                Village.district_id == district_id,
                UserVillageAssignment.ended_at.is_(None),
                User.role.in_(["VET_OFFICER", "VO"])
            )
        )
        vo_count = (await self.db.execute(vo_count_stmt)).scalar() or 0

        fw_count_stmt = (
            select(func.count(func.distinct(UserVillageAssignment.user_id)))
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .join(User, UserVillageAssignment.user_id == User.id)
            .where(
                Village.district_id == district_id,
                UserVillageAssignment.ended_at.is_(None),
                User.role.in_(["FIELD_WORKER", "FW"])
            )
        )
        fw_count = (await self.db.execute(fw_count_stmt)).scalar() or 0

        coop_count_stmt = select(func.count(Cooperative.id))
        coop_count = (await self.db.execute(coop_count_stmt)).scalar() or 0

        # Genuine database counts for animals, farmers, vaccinations, disease reports in this district
        total_animals = 0
        total_farmers = 0
        total_vaccinations = 0
        pending_vaccinations = 0
        active_disease_reports = 0

        try:
            from app.modules.animals.models import Animal
            from app.modules.farmers.models import Farmer
            from app.modules.vaccinations.models import AnimalEvent
            from app.modules.disease_surveillance.models import DiseaseReport

            anm_stmt = (
                select(func.count(Animal.id))
                .join(Village, Animal.village_id == Village.id)
                .where(Village.district_id == district_id, Animal.status == "ACTIVE")
            )
            total_animals = (await self.db.execute(anm_stmt)).scalar() or 0

            frm_stmt = (
                select(func.count(Farmer.id))
                .join(Village, Farmer.village_id == Village.id)
                .where(Village.district_id == district_id, Farmer.active == True)
            )
            total_farmers = (await self.db.execute(frm_stmt)).scalar() or 0

            vacc_stmt = (
                select(func.count(AnimalEvent.event_id))
                .join(Village, AnimalEvent.village_id == Village.id)
                .where(Village.district_id == district_id, AnimalEvent.event_type == "VACCINATION")
            )
            total_vaccinations = (await self.db.execute(vacc_stmt)).scalar() or 0

            dr_stmt = (
                select(func.count(DiseaseReport.report_id))
                .join(Village, DiseaseReport.village_id == Village.id)
                .where(
                    Village.district_id == district_id,
                    DiseaseReport.status.in_(["SUBMITTED", "UNDER_REVIEW", "SUSPECTED", "NEEDS_MORE_INFORMATION"])
                )
            )
            active_disease_reports = (await self.db.execute(dr_stmt)).scalar() or 0

            pending_vaccinations = max(0, total_animals - total_vaccinations)
        except Exception:
            pass

        return {
            "taluka_count": taluka_count,
            "village_count": village_count,
            "gram_panchayat_count": gp_count,
            "cooperative_count": coop_count,
            "vo_count": vo_count,
            "fw_count": fw_count,
            "total_animals": total_animals,
            "total_farmers": total_farmers,
            "total_vaccinations": total_vaccinations,
            "pending_vaccinations": pending_vaccinations,
            "active_disease_reports": active_disease_reports,
        }

    # =========================================================================
    # 2. Taluka Operations
    # =========================================================================
    async def list_talukas(
        self,
        district_id: Optional[uuid.UUID] = None,
        district_ids: Optional[List[uuid.UUID]] = None,
        offset: int = 0,
        limit: int = 500
    ) -> List[Taluka]:
        stmt = select(Taluka)
        if district_id:
            stmt = stmt.where(Taluka.district_id == district_id)
        elif district_ids:
            stmt = stmt.where(Taluka.district_id.in_(district_ids))
        stmt = stmt.order_by(Taluka.code).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_taluka_by_id(self, taluka_id: uuid.UUID) -> Optional[Taluka]:
        stmt = select(Taluka).where(Taluka.id == taluka_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_taluka_by_code(self, code: str) -> Optional[Taluka]:
        stmt = select(Taluka).where(Taluka.code == code.strip().upper())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_taluka(
        self,
        district_id: uuid.UUID,
        code: str,
        name_gu: str,
        name_en: str
    ) -> Taluka:
        taluka = Taluka(
            id=uuid.uuid4(),
            district_id=district_id,
            code=code.strip().upper(),
            name_gu=name_gu.strip(),
            name_en=name_en.strip()
        )
        self.db.add(taluka)
        await self.db.flush()
        return taluka

    async def update_taluka(
        self,
        taluka: Taluka,
        name_gu: Optional[str] = None,
        name_en: Optional[str] = None
    ) -> Taluka:
        if name_gu is not None:
            taluka.name_gu = name_gu.strip()
        if name_en is not None:
            taluka.name_en = name_en.strip()
        await self.db.flush()
        return taluka

    # =========================================================================
    # 3. Village Operations
    # =========================================================================
    async def list_villages(
        self,
        district_id: Optional[uuid.UUID] = None,
        taluka_id: Optional[uuid.UUID] = None,
        district_ids: Optional[List[uuid.UUID]] = None,
        taluka_ids: Optional[List[uuid.UUID]] = None,
        village_ids: Optional[Set[uuid.UUID]] = None,
        offset: int = 0,
        limit: int = 2000
    ) -> List[Village]:
        stmt = select(Village)
        if district_id:
            stmt = stmt.where(Village.district_id == district_id)
        elif district_ids:
            stmt = stmt.where(Village.district_id.in_(district_ids))
        if taluka_id:
            stmt = stmt.where(Village.taluka_id == taluka_id)
        elif taluka_ids:
            stmt = stmt.where(Village.taluka_id.in_(taluka_ids))
        if village_ids is not None:
            if len(village_ids) == 0:
                return []
            stmt = stmt.where(Village.id.in_(village_ids))
        stmt = stmt.order_by(Village.code).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_village_by_id(self, village_id: uuid.UUID) -> Optional[Village]:
        stmt = select(Village).where(Village.id == village_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_village_by_code(self, code: str) -> Optional[Village]:
        stmt = select(Village).where(Village.code == code.strip().upper())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_village(
        self,
        district_id: uuid.UUID,
        taluka_id: uuid.UUID,
        code: str,
        name_gu: str,
        name_en: str,
        census_code: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        is_pilot: bool = False,
        active: bool = True
    ) -> Village:
        now = datetime.now(timezone.utc)
        coord_status = "VERIFIED" if (latitude is not None and longitude is not None) else "UNAVAILABLE"
        village = Village(
            id=uuid.uuid4(),
            district_id=district_id,
            taluka_id=taluka_id,
            code=code.strip().upper(),
            name_gu=name_gu.strip(),
            name_en=name_en.strip(),
            census_code=census_code.strip() if census_code else None,
            latitude=latitude,
            longitude=longitude,
            coord_status=coord_status,
            is_pilot=is_pilot,
            active=active,
            created_at=now,
            updated_at=now
        )
        self.db.add(village)
        await self.db.flush()
        return village

    async def update_village(
        self,
        village: Village,
        name_gu: Optional[str] = None,
        name_en: Optional[str] = None,
        census_code: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        is_pilot: Optional[bool] = None,
        active: Optional[bool] = None,
        google_place_id: Optional[str] = None,
        formatted_address: Optional[str] = None,
        location_source: Optional[str] = None,
        boundary_geojson: Optional[Any] = None
    ) -> Village:
        if name_gu is not None:
            village.name_gu = name_gu.strip()
        if name_en is not None:
            village.name_en = name_en.strip()
        if census_code is not None:
            village.census_code = census_code.strip()
        if latitude is not None:
            village.latitude = latitude
        if longitude is not None:
            village.longitude = longitude
        if is_pilot is not None:
            village.is_pilot = is_pilot
        if active is not None:
            village.active = active
        if hasattr(village, "google_place_id") and google_place_id is not None:
            village.google_place_id = google_place_id
        if hasattr(village, "formatted_address") and formatted_address is not None:
            village.formatted_address = formatted_address
        if hasattr(village, "location_source") and location_source is not None:
            village.location_source = location_source
        if hasattr(village, "boundary_geojson") and boundary_geojson is not None:
            village.boundary_geojson = boundary_geojson

        if village.latitude is not None and village.longitude is not None:
            village.coord_status = "VERIFIED"
        else:
            village.coord_status = "UNAVAILABLE"

        village.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return village

    # =========================================================================
    # 4. Gram Panchayat Operations
    # =========================================================================
    async def list_gram_panchayats(
        self,
        taluka_ids: Optional[Set[uuid.UUID]] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[GramPanchayat]:
        stmt = select(GramPanchayat)
        if taluka_ids is not None:
            stmt = stmt.where(GramPanchayat.taluka_id.in_(taluka_ids))
        stmt = stmt.order_by(GramPanchayat.code).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_gram_panchayat_by_id(self, gp_id: uuid.UUID) -> Optional[GramPanchayat]:
        stmt = select(GramPanchayat).where(GramPanchayat.id == gp_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_gram_panchayat_by_code(self, code: str) -> Optional[GramPanchayat]:
        stmt = select(GramPanchayat).where(GramPanchayat.code == code.strip().upper())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_gram_panchayat(
        self,
        taluka_id: uuid.UUID,
        code: str,
        name_gu: str,
        name_en: str,
        created_by: uuid.UUID,
        active: bool = True
    ) -> GramPanchayat:
        now = datetime.now(timezone.utc)
        gp = GramPanchayat(
            id=uuid.uuid4(),
            taluka_id=taluka_id,
            code=code.strip().upper(),
            name_gu=name_gu.strip(),
            name_en=name_en.strip(),
            active=active,
            created_by=created_by,
            created_at=now,
            updated_at=now
        )
        self.db.add(gp)
        await self.db.flush()
        return gp

    async def update_gram_panchayat(
        self,
        gp: GramPanchayat,
        name_gu: Optional[str] = None,
        name_en: Optional[str] = None,
        active: Optional[bool] = None
    ) -> GramPanchayat:
        if name_gu is not None:
            gp.name_gu = name_gu.strip()
        if name_en is not None:
            gp.name_en = name_en.strip()
        if active is not None:
            gp.active = active
        gp.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return gp

    async def is_village_actively_mapped_to_gp(self, village_id: uuid.UUID) -> Optional[uuid.UUID]:
        """Check if a village is already actively mapped to any Gram Panchayat."""
        stmt = select(GramPanchayatVillage.gram_panchayat_id).where(
            GramPanchayatVillage.village_id == village_id,
            GramPanchayatVillage.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def map_gp_village(
        self,
        gp_id: uuid.UUID,
        village_id: uuid.UUID,
        mapped_by: uuid.UUID
    ) -> GramPanchayatVillage:

        mapping = GramPanchayatVillage(
            gram_panchayat_id=gp_id,
            village_id=village_id,
            mapped_by=mapped_by,
            mapped_at=datetime.now(timezone.utc),
            ended_at=None
        )
        self.db.add(mapping)
        await self.db.flush()
        return mapping

    async def get_gp_villages(self, gp_id: uuid.UUID) -> List[uuid.UUID]:
        stmt = select(GramPanchayatVillage.village_id).where(
            GramPanchayatVillage.gram_panchayat_id == gp_id,
            GramPanchayatVillage.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return [row[0] for row in res.fetchall()]

    # =========================================================================
    # 5. Cooperative Operations
    # =========================================================================
    async def list_cooperatives(
        self,
        coop_ids: Optional[Set[uuid.UUID]] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[Cooperative]:
        stmt = select(Cooperative)
        if coop_ids is not None:
            stmt = stmt.where(Cooperative.id.in_(coop_ids))
        stmt = stmt.order_by(Cooperative.code).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_cooperative_by_id(self, coop_id: uuid.UUID) -> Optional[Cooperative]:
        stmt = select(Cooperative).where(Cooperative.id == coop_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_cooperative_by_code(self, code: str) -> Optional[Cooperative]:
        stmt = select(Cooperative).where(Cooperative.code == code.strip().upper())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_cooperative(
        self,
        code: str,
        name_gu: str,
        name_en: str,
        org_type: str,
        status: str,
        created_by: uuid.UUID
    ) -> Cooperative:
        coop = Cooperative(
            id=uuid.uuid4(),
            code=code.strip().upper(),
            name_gu=name_gu.strip(),
            name_en=name_en.strip(),
            org_type=org_type,
            status=status,
            created_by=created_by,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(coop)
        await self.db.flush()
        return coop

    async def update_cooperative(
        self,
        coop: Cooperative,
        name_gu: Optional[str] = None,
        name_en: Optional[str] = None,
        org_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> Cooperative:
        if name_gu is not None:
            coop.name_gu = name_gu.strip()
        if name_en is not None:
            coop.name_en = name_en.strip()
        if org_type is not None:
            coop.org_type = org_type
        if status is not None:
            coop.status = status
        await self.db.flush()
        return coop

    async def is_cooperative_village_mapped(self, coop_id: uuid.UUID, village_id: uuid.UUID) -> bool:
        """Check if a village is already mapped to a cooperative."""
        stmt = select(CooperativeVillage).where(
            CooperativeVillage.cooperative_id == coop_id,
            CooperativeVillage.village_id == village_id
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def map_cooperative_village(
        self,
        coop_id: uuid.UUID,
        village_id: uuid.UUID
    ) -> CooperativeVillage:

        mapping = CooperativeVillage(
            cooperative_id=coop_id,
            village_id=village_id
        )
        self.db.add(mapping)
        await self.db.flush()
        return mapping

    async def get_cooperative_villages(self, coop_id: uuid.UUID) -> List[uuid.UUID]:
        stmt = select(CooperativeVillage.village_id).where(
            CooperativeVillage.cooperative_id == coop_id
        )
        res = await self.db.execute(stmt)
        return [row[0] for row in res.fetchall()]

    async def is_cooperative_staff_actively_assigned(
        self,
        coop_id: uuid.UUID,
        user_id: uuid.UUID,
        coop_role: str
    ) -> bool:
        """Check if staff member already holds an active assignment in this role."""
        stmt = select(CooperativeStaffAssignment).where(
            CooperativeStaffAssignment.cooperative_id == coop_id,
            CooperativeStaffAssignment.user_id == user_id,
            CooperativeStaffAssignment.coop_role == coop_role,
            CooperativeStaffAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def assign_cooperative_staff(

        self,
        coop_id: uuid.UUID,
        user_id: uuid.UUID,
        coop_role: str,
        assigned_by: uuid.UUID
    ) -> CooperativeStaffAssignment:
        assignment = CooperativeStaffAssignment(
            id=uuid.uuid4(),
            cooperative_id=coop_id,
            user_id=user_id,
            coop_role=coop_role,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc),
            ended_at=None
        )
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    async def get_cooperative_staff_assignments(
        self,
        coop_id: uuid.UUID
    ) -> List[CooperativeStaffAssignment]:
        stmt = select(CooperativeStaffAssignment).where(
            CooperativeStaffAssignment.cooperative_id == coop_id,
            CooperativeStaffAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    # =========================================================================
    # 6. Staff Operations (VO & Field Worker)
    # =========================================================================
    async def list_staff_by_role(
        self,
        role: str,
        user_ids: Optional[Set[uuid.UUID]] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[User]:
        target_roles = [role]
        if role in ("FIELD_WORKER", "FW"):
            target_roles = ["FIELD_WORKER", "FW"]
        elif role in ("VET_OFFICER", "VO"):
            target_roles = ["VET_OFFICER", "VO"]
        elif role in ("DAHO",):
            target_roles = ["DAHO"]

        stmt = select(User).where(User.role.in_(target_roles))
        if user_ids is not None:
            if len(user_ids) == 0:
                return []
            stmt = stmt.where(User.id.in_(user_ids))
        stmt = stmt.order_by(User.full_name).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_staff_by_id_and_role(
        self,
        user_id: uuid.UUID,
        role: str
    ) -> Optional[User]:
        target_roles = [role]
        if role in ("FIELD_WORKER", "FW"):
            target_roles = ["FIELD_WORKER", "FW"]
        elif role in ("VET_OFFICER", "VO"):
            target_roles = ["VET_OFFICER", "VO"]
        elif role in ("DAHO",):
            target_roles = ["DAHO"]
        stmt = select(User).where(User.id == user_id, User.role.in_(target_roles))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> Optional[User]:
        stmt = select(User).where(func.lower(User.username) == username.strip().lower())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_user_by_mobile(self, mobile_e164: str) -> Optional[User]:
        stmt = select(User).where(User.mobile_e164 == mobile_e164.strip())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_staff_user(
        self,
        role: str,
        full_name: str,
        username: str,
        password_hash: str,
        mobile_e164: Optional[str],
        designation: Optional[str],
        organisation: Optional[str],
        created_by: uuid.UUID
    ) -> User:
        now = datetime.now(timezone.utc)
        user = User(
            id=uuid.uuid4(),
            role=role,
            full_name=full_name.strip(),
            username=username.strip().lower(),
            password_hash=password_hash,
            mobile_e164=mobile_e164.strip() if mobile_e164 else None,
            designation=designation.strip() if designation else None,
            organisation=organisation.strip() if organisation else None,
            status="ACTIVE",
            must_change_password=True,
            failed_attempts=0,
            created_by=created_by,
            created_at=now,
            updated_at=now
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def upsert_vo_profile(
        self,
        user_id: uuid.UUID,
        employee_ref: Optional[str],
        designation: Optional[str],
        office_name: Optional[str],
        contact_mobile: Optional[str],
        created_by: uuid.UUID
    ) -> VeterinaryOfficerProfile:
        stmt = select(VeterinaryOfficerProfile).where(VeterinaryOfficerProfile.user_id == user_id)
        res = await self.db.execute(stmt)
        profile = res.scalar_one_or_none()

        if profile:
            if employee_ref is not None:
                profile.employee_ref = employee_ref.strip()
            if designation is not None:
                profile.designation = designation.strip()
            if office_name is not None:
                profile.office_name = office_name.strip()
            if contact_mobile is not None:
                profile.contact_mobile = contact_mobile.strip()
        else:
            profile = VeterinaryOfficerProfile(
                user_id=user_id,
                employee_ref=employee_ref.strip() if employee_ref else None,
                designation=designation.strip() if designation else None,
                office_name=office_name.strip() if office_name else None,
                contact_mobile=contact_mobile.strip() if contact_mobile else None,
                created_by=created_by,
                created_at=datetime.now(timezone.utc)
            )
            self.db.add(profile)

        await self.db.flush()
        return profile

    async def get_vo_profile(self, user_id: uuid.UUID) -> Optional[VeterinaryOfficerProfile]:
        stmt = select(VeterinaryOfficerProfile).where(VeterinaryOfficerProfile.user_id == user_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def update_staff_status(
        self,
        user: User,
        status: str,
        reason: Optional[str] = None
    ) -> User:
        now = datetime.now(timezone.utc)
        user.status = status
        user.updated_at = now
        if status == "INACTIVE":
            user.deactivated_at = now
            user.deactivated_reason = reason
        elif status == "ACTIVE":
            user.deactivated_at = None
            user.deactivated_reason = None
            user.locked_until = None
            user.failed_attempts = 0
        await self.db.flush()
        return user

    async def get_user_active_villages(self, user_id: uuid.UUID) -> List[uuid.UUID]:
        stmt = select(UserVillageAssignment.village_id).where(
            UserVillageAssignment.user_id == user_id,
            UserVillageAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return [row[0] for row in res.fetchall()]

    async def get_taluka_ids_for_district(self, district_id: uuid.UUID) -> Set[uuid.UUID]:
        stmt = select(Taluka.id).where(Taluka.district_id == district_id)
        res = await self.db.execute(stmt)
        return {row[0] for row in res.fetchall()}

    async def get_staff_assigned_to_district_villages(
        self,
        district_id: uuid.UUID,
        role: str,
        creator_id: Optional[uuid.UUID] = None
    ) -> Set[uuid.UUID]:
        """Find staff IDs belonging to this district:
        1. Actively assigned to at least one village in this district.
        2. Created by this administrator.
        3. Unassigned to any village.
        Excludes staff who are actively assigned exclusively to other districts.
        """
        # 1. Active assignments in this district
        stmt_assigned = (
            select(UserVillageAssignment.user_id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(
                Village.district_id == district_id,
                UserVillageAssignment.ended_at.is_(None)
            )
        )
        res_assigned = await self.db.execute(stmt_assigned)
        assigned_in_dist = {row[0] for row in res_assigned.fetchall()}

        # 2. Active assignments in OTHER districts (to exclude)
        stmt_other = (
            select(UserVillageAssignment.user_id)
            .join(Village, UserVillageAssignment.village_id == Village.id)
            .where(
                Village.district_id != district_id,
                UserVillageAssignment.ended_at.is_(None)
            )
        )
        res_other = await self.db.execute(stmt_other)
        assigned_in_other = {row[0] for row in res_other.fetchall()}

        # 3. Unassigned staff of this role, or staff created by this admin
        target_roles = [role]
        if role in ("FIELD_WORKER", "FW"):
            target_roles = ["FIELD_WORKER", "FW"]
        elif role in ("VET_OFFICER", "VO"):
            target_roles = ["VET_OFFICER", "VO"]
        elif role in ("DAHO",):
            target_roles = ["DAHO"]

        active_assignments_subquery = (
            select(UserVillageAssignment.user_id)
            .where(UserVillageAssignment.ended_at.is_(None))
        )
        if creator_id:
            stmt_unassigned = select(User.id).where(
                User.role.in_(target_roles),
                or_(
                    User.created_by == creator_id,
                    ~User.id.in_(active_assignments_subquery)
                )
            )
        else:
            stmt_unassigned = select(User.id).where(
                User.role.in_(target_roles),
                ~User.id.in_(active_assignments_subquery)
            )
        res_unassigned = await self.db.execute(stmt_unassigned)
        unassigned_ids = {row[0] for row in res_unassigned.fetchall()}

        return (assigned_in_dist | unassigned_ids) - assigned_in_other

    # =========================================================================
    # 7. Assignment Operations
    # =========================================================================
    async def is_user_actively_assigned_to_village(
        self,
        user_id: uuid.UUID,
        village_id: uuid.UUID
    ) -> bool:
        """Check if user has an active village assignment."""
        stmt = select(UserVillageAssignment).where(
            UserVillageAssignment.user_id == user_id,
            UserVillageAssignment.village_id == village_id,
            UserVillageAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def assign_user_to_village(

        self,
        user_id: uuid.UUID,
        village_id: uuid.UUID,
        assigned_by: uuid.UUID
    ) -> UserVillageAssignment:
        assignment = UserVillageAssignment(
            id=uuid.uuid4(),
            user_id=user_id,
            village_id=village_id,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc),
            ended_at=None
        )
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    async def end_user_village_assignment(
        self,
        user_id: uuid.UUID,
        village_id: uuid.UUID
    ) -> Optional[UserVillageAssignment]:
        stmt = select(UserVillageAssignment).where(
            UserVillageAssignment.user_id == user_id,
            UserVillageAssignment.village_id == village_id,
            UserVillageAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        assignment = res.scalar_one_or_none()
        if assignment:
            assignment.ended_at = datetime.now(timezone.utc)
            await self.db.flush()
        return assignment

    async def is_daho_actively_assigned_to_district(
        self,
        daho_user_id: uuid.UUID,
        district_id: uuid.UUID
    ) -> bool:
        """Check if DAHO has an active assignment to this district."""
        stmt = select(DahoDistrictAssignment).where(
            DahoDistrictAssignment.daho_user_id == daho_user_id,
            DahoDistrictAssignment.district_id == district_id,
            DahoDistrictAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def assign_daho_to_district(

        self,
        daho_user_id: uuid.UUID,
        district_id: uuid.UUID,
        assigned_by: uuid.UUID
    ) -> DahoDistrictAssignment:
        assignment = DahoDistrictAssignment(
            id=uuid.uuid4(),
            daho_user_id=daho_user_id,
            district_id=district_id,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc),
            ended_at=None
        )
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    async def record_audit_event(
        self,
        action: str,
        result: str,
        actor_user_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
        ip: Optional[str] = None
    ) -> None:
        event = AuditEvent(
            occurred_at=datetime.now(timezone.utc),
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            object_type=object_type,
            object_id=object_id,
            village_id=village_id,
            result=result,
            reason=reason,
            ip=ip
        )
        self.db.add(event)
        await self.db.flush()

