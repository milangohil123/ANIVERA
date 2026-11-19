"""Administrative Management Service.

Coordinates:
- District, Taluka, and Village administrative hierarchies
- Gram Panchayat records and village linkages
- Cooperative records, village coverage, and staff assignments
- Veterinary Officer accounts and profiles
- Field Worker staff accounts
- Administrative assignments (VO-to-village, DAHO-to-district)
- Strict scope enforcement and immutable security auditing
"""
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_password_hash
from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import User
from app.modules.authorization.schemas import UserScope
from app.modules.authorization.service import AuthorizationService
from app.modules.administration.models import (
    Cooperative,
    GramPanchayat,
    VeterinaryOfficerProfile,
)
from app.modules.administration.repository import AdministrationRepository
from app.modules.administration.schemas import (
    CooperativeCreate,
    CooperativeResponse,
    CooperativeStaffAssignmentResponse,
    CooperativeUpdate,
    DahoDistrictAssignResponse,
    DistrictCreate,
    DistrictResponse,
    DistrictSummaryResponse,
    DistrictUpdate,
    FieldWorkerCreate,
    FieldWorkerResponse,
    FieldWorkerUpdate,
    GPVillageMappingResponse,
    GramPanchayatCreate,
    GramPanchayatResponse,
    GramPanchayatUpdate,
    TalukaCreate,
    TalukaResponse,
    TalukaUpdate,
    UserVillageAssignResponse,
    UserVillageBulkAssignResponse,
    VeterinaryOfficerCreate,
    VeterinaryOfficerResponse,
    VeterinaryOfficerUpdate,
    VillageCreate,
    VillageResponse,
    VillageUpdate,
)

logger = logging.getLogger("pashurakshak.admin.service")


class AdministrationService:
    """Service handling administrative master-data business rules and scope verification."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AdministrationRepository(db)
        self.authz_service = AuthorizationService(db)

    # =========================================================================
    # 1. District Management
    # =========================================================================
    async def list_districts(
        self,
        current_user: User,
        active_only: bool = False,
        offset: int = 0,
        limit: int = 50
    ) -> List[DistrictResponse]:
        await self.authz_service.assert_any_permission(
            current_user,
            ["district.setup.manage", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        # DAHO is scoped to their assigned district(s)
        district_ids: Optional[Set[uuid.UUID]] = None
        if current_user.role == "DAHO":
            district_ids = scope.assigned_district_ids
        elif current_user.role not in ("SYS_ADMIN", "GRAM_PANCHAYAT", "DAIRY_STAFF"):
            district_ids = scope.assigned_district_ids if scope.assigned_district_ids else None

        districts = await self.repo.list_districts(
            district_ids=district_ids,
            active_only=active_only,
            offset=offset,
            limit=limit
        )
        return [DistrictResponse.model_validate(d) for d in districts]

    async def get_district(
        self,
        district_id: uuid.UUID,
        current_user: User
    ) -> DistrictResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["district.setup.manage", "aggregate.view"]
        )
        dist = await self.repo.get_district_by_id(district_id)
        if not dist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"District '{district_id}' not found"
            )

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, district_id)

        return DistrictResponse.model_validate(dist)

    async def create_district(
        self,
        payload: DistrictCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DistrictResponse:
        # Platform admin or authorized DAHO setup
        await self.authz_service.assert_permission(current_user, "district.setup.manage", ip=client_ip)

        existing = await self.repo.get_district_by_code(payload.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"District with code '{payload.code}' already exists"
            )

        dist = await self.repo.create_district(
            code=payload.code,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            active=payload.active
        )

        await self.repo.record_audit_event(
            action="ADMIN_DISTRICT_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="district",
            object_id=str(dist.id),
            reason=f"Created district {dist.code}",
            ip=client_ip
        )
        await self.db.commit()
        return DistrictResponse.model_validate(dist)

    async def update_district(
        self,
        district_id: uuid.UUID,
        payload: DistrictUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DistrictResponse:
        await self.authz_service.assert_permission(current_user, "district.setup.manage", ip=client_ip)
        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, district_id, ip=client_ip)

        dist = await self.repo.get_district_by_id(district_id)
        if not dist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"District '{district_id}' not found"
            )

        updated = await self.repo.update_district(
            district=dist,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            active=payload.active
        )

        await self.repo.record_audit_event(
            action="ADMIN_DISTRICT_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="district",
            object_id=str(dist.id),
            reason=f"Updated district {dist.code}",
            ip=client_ip
        )
        await self.db.commit()
        return DistrictResponse.model_validate(updated)

    async def get_district_summary(
        self,
        district_id: uuid.UUID,
        current_user: User
    ) -> DistrictSummaryResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["district.setup.manage", "aggregate.view"]
        )
        dist = await self.repo.get_district_by_id(district_id)
        if not dist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"District '{district_id}' not found"
            )

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, district_id)

        counts = await self.repo.get_district_summary(district_id)
        return DistrictSummaryResponse(
            id=dist.id,
            code=dist.code,
            name_en=dist.name_en,
            name_gu=dist.name_gu,
            active=dist.active,
            **counts
        )

    # =========================================================================
    # 2. Taluka Management
    # =========================================================================
    async def list_talukas(
        self,
        district_id: Optional[uuid.UUID],
        current_user: User,
        offset: int = 0,
        limit: int = 50
    ) -> List[TalukaResponse]:
        await self.authz_service.assert_any_permission(
            current_user,
            ["district.setup.manage", "village.manage", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        target_district_id = district_id
        if current_user.role == "DAHO":
            if target_district_id:
                await self.authz_service.assert_district_scope(current_user, target_district_id)
            else:
                target_district_id = next(iter(scope.assigned_district_ids), None)

        talukas = await self.repo.list_talukas(
            district_id=target_district_id,
            offset=offset,
            limit=limit
        )
        return [TalukaResponse.model_validate(t) for t in talukas]

    async def get_taluka(
        self,
        taluka_id: uuid.UUID,
        current_user: User
    ) -> TalukaResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["district.setup.manage", "village.manage", "aggregate.view"]
        )
        taluka = await self.repo.get_taluka_by_id(taluka_id)
        if not taluka:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taluka not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, taluka.district_id)

        return TalukaResponse.model_validate(taluka)

    async def create_taluka(
        self,
        payload: TalukaCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> TalukaResponse:
        await self.authz_service.assert_permission(current_user, "district.setup.manage", ip=client_ip)
        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, payload.district_id, ip=client_ip)

        # Validate parent district exists
        district = await self.repo.get_district_by_id(payload.district_id)
        if not district:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent district does not exist")

        existing = await self.repo.get_taluka_by_code(payload.code)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Taluka code already exists")

        taluka = await self.repo.create_taluka(
            district_id=payload.district_id,
            code=payload.code,
            name_gu=payload.name_gu,
            name_en=payload.name_en
        )

        await self.repo.record_audit_event(
            action="ADMIN_TALUKA_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="taluka",
            object_id=str(taluka.id),
            reason=f"Created taluka {taluka.code} in district {district.code}",
            ip=client_ip
        )
        await self.db.commit()
        return TalukaResponse.model_validate(taluka)

    async def update_taluka(
        self,
        taluka_id: uuid.UUID,
        payload: TalukaUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> TalukaResponse:
        await self.authz_service.assert_permission(current_user, "district.setup.manage", ip=client_ip)

        taluka = await self.repo.get_taluka_by_id(taluka_id)
        if not taluka:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taluka not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, taluka.district_id, ip=client_ip)

        updated = await self.repo.update_taluka(
            taluka=taluka,
            name_gu=payload.name_gu,
            name_en=payload.name_en
        )

        await self.repo.record_audit_event(
            action="ADMIN_TALUKA_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="taluka",
            object_id=str(taluka.id),
            reason=f"Updated taluka {taluka.code}",
            ip=client_ip
        )
        await self.db.commit()
        return TalukaResponse.model_validate(updated)

    # =========================================================================
    # 3. Village Management
    # =========================================================================
    async def list_villages(
        self,
        district_id: Optional[uuid.UUID],
        taluka_id: Optional[uuid.UUID],
        current_user: User,
        offset: int = 0,
        limit: int = 100
    ) -> List[VillageResponse]:
        if current_user.role not in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO", "DAHO"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["village.manage", "aggregate.view", "animal.read", "farmer.read", "own.read"]
            )
        scope = await self.authz_service.get_user_scope(current_user)

        target_district_id = district_id
        village_ids: Optional[Set[uuid.UUID]] = None

        if current_user.role == "DAHO":
            if target_district_id:
                await self.authz_service.assert_district_scope(current_user, target_district_id)
            else:
                target_district_id = next(iter(scope.assigned_district_ids), None)
        elif current_user.role in ("VET_OFFICER", "VO"):
            # VO is strictly scoped to villages officially assigned to this VO
            village_ids = scope.assigned_village_ids
            target_district_id = None
        elif current_user.role in ("FIELD_WORKER", "FW"):
            # FW is strictly scoped to villages officially assigned to this FW
            village_ids = scope.assigned_village_ids
            target_district_id = None

        villages = await self.repo.list_villages(
            district_id=target_district_id,
            taluka_id=taluka_id,
            village_ids=village_ids,
            offset=offset,
            limit=limit
        )
        return [VillageResponse.model_validate(v) for v in villages]

    async def get_village(
        self,
        village_id: uuid.UUID,
        current_user: User
    ) -> VillageResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["village.manage", "aggregate.view", "animal.read"]
        )
        village = await self.repo.get_village_by_id(village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id)
        elif current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            await self.authz_service.assert_village_scope(current_user, village.id)

        return VillageResponse.model_validate(village)

    async def create_village(
        self,
        payload: VillageCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VillageResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["user.manage", "village.manage"],
            ip=client_ip
        )
        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, payload.district_id, ip=client_ip)

        # Validate parent taluka and district relationship
        taluka = await self.repo.get_taluka_by_id(payload.taluka_id)
        if not taluka:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent taluka does not exist")

        if taluka.district_id != payload.district_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent taluka does not belong to the specified district"
            )

        existing = await self.repo.get_village_by_code(payload.code)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Village code already exists")

        village = await self.repo.create_village(
            district_id=payload.district_id,
            taluka_id=payload.taluka_id,
            code=payload.code,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            census_code=payload.census_code,
            latitude=payload.latitude,
            longitude=payload.longitude,
            is_pilot=payload.is_pilot,
            active=payload.active
        )

        await self.repo.record_audit_event(
            action="ADMIN_VILLAGE_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="village",
            object_id=str(village.id),
            village_id=village.id,
            reason=f"Created village {village.code}",
            ip=client_ip
        )
        await self.db.commit()
        return VillageResponse.model_validate(village)

    async def update_village(
        self,
        village_id: uuid.UUID,
        payload: VillageUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VillageResponse:
        await self.authz_service.assert_permission(current_user, "village.manage", ip=client_ip)

        village = await self.repo.get_village_by_id(village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

        updated = await self.repo.update_village(
            village=village,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            census_code=payload.census_code,
            latitude=payload.latitude,
            longitude=payload.longitude,
            is_pilot=payload.is_pilot,
            active=payload.active,
            google_place_id=payload.google_place_id,
            formatted_address=payload.formatted_address,
            location_source=payload.location_source
        )

        await self.repo.record_audit_event(
            action="ADMIN_VILLAGE_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="village",
            object_id=str(village.id),
            village_id=village.id,
            reason=f"Updated village {village.code}",
            ip=client_ip
        )
        await self.db.commit()
        return VillageResponse.model_validate(updated)

    # =========================================================================
    # 4. Gram Panchayat Management
    # =========================================================================
    async def list_gram_panchayats(
        self,
        current_user: User,
        district_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[GramPanchayatResponse]:
        await self.authz_service.assert_any_permission(
            current_user,
            ["gram_panchayat.manage", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        taluka_ids: Optional[Set[uuid.UUID]] = None
        target_dist = district_id
        if current_user.role == "DAHO":
            if target_dist:
                await self.authz_service.assert_district_scope(current_user, target_dist)
            else:
                target_dist = next(iter(scope.assigned_district_ids), None)

        if target_dist:
            taluka_ids = await self.repo.get_taluka_ids_for_district(target_dist)

        gps = await self.repo.list_gram_panchayats(
            taluka_ids=taluka_ids,
            offset=offset,
            limit=limit
        )

        result: List[GramPanchayatResponse] = []
        for gp in gps:
            associated = await self.repo.get_gp_villages(gp.id)
            res = GramPanchayatResponse(
                id=gp.id,
                taluka_id=gp.taluka_id,
                code=gp.code,
                name_gu=gp.name_gu,
                name_en=gp.name_en,
                active=gp.active,
                created_at=gp.created_at,
                updated_at=gp.updated_at,
                associated_village_ids=associated
            )
            result.append(res)
        return result

    async def get_gram_panchayat(
        self,
        gp_id: uuid.UUID,
        current_user: User
    ) -> GramPanchayatResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["gram_panchayat.manage", "aggregate.view"]
        )
        gp = await self.repo.get_gram_panchayat_by_id(gp_id)
        if not gp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gram Panchayat not found")

        taluka = await self.repo.get_taluka_by_id(gp.taluka_id)
        if taluka and current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, taluka.district_id)

        associated = await self.repo.get_gp_villages(gp.id)
        return GramPanchayatResponse(
            id=gp.id,
            taluka_id=gp.taluka_id,
            code=gp.code,
            name_gu=gp.name_gu,
            name_en=gp.name_en,
            active=gp.active,
            created_at=gp.created_at,
            updated_at=gp.updated_at,
            associated_village_ids=associated
        )

    async def create_gram_panchayat(
        self,
        payload: GramPanchayatCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> GramPanchayatResponse:
        await self.authz_service.assert_permission(current_user, "gram_panchayat.manage", ip=client_ip)

        taluka = await self.repo.get_taluka_by_id(payload.taluka_id)
        if not taluka:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent taluka does not exist")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, taluka.district_id, ip=client_ip)

        existing = await self.repo.get_gram_panchayat_by_code(payload.code)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="GP code already exists")

        gp = await self.repo.create_gram_panchayat(
            taluka_id=payload.taluka_id,
            code=payload.code,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            created_by=current_user.id,
            active=payload.active
        )

        await self.repo.record_audit_event(
            action="ADMIN_GP_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="gram_panchayat",
            object_id=str(gp.id),
            reason=f"Created Gram Panchayat {gp.code}",
            ip=client_ip
        )
        await self.db.commit()
        return GramPanchayatResponse(
            id=gp.id,
            taluka_id=gp.taluka_id,
            code=gp.code,
            name_gu=gp.name_gu,
            name_en=gp.name_en,
            active=gp.active,
            created_at=gp.created_at,
            updated_at=gp.updated_at,
            associated_village_ids=[]
        )

    async def update_gram_panchayat(
        self,
        gp_id: uuid.UUID,
        payload: GramPanchayatUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> GramPanchayatResponse:
        await self.authz_service.assert_permission(current_user, "gram_panchayat.manage", ip=client_ip)

        gp = await self.repo.get_gram_panchayat_by_id(gp_id)
        if not gp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gram Panchayat not found")

        taluka = await self.repo.get_taluka_by_id(gp.taluka_id)
        if taluka and current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, taluka.district_id, ip=client_ip)

        updated = await self.repo.update_gram_panchayat(
            gp=gp,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            active=payload.active
        )

        await self.repo.record_audit_event(
            action="ADMIN_GP_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="gram_panchayat",
            object_id=str(gp.id),
            reason=f"Updated Gram Panchayat {gp.code}",
            ip=client_ip
        )
        await self.db.commit()
        associated = await self.repo.get_gp_villages(gp.id)
        return GramPanchayatResponse(
            id=updated.id,
            taluka_id=updated.taluka_id,
            code=updated.code,
            name_gu=updated.name_gu,
            name_en=updated.name_en,
            active=updated.active,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
            associated_village_ids=associated
        )

    async def map_gp_village(
        self,
        gp_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> GPVillageMappingResponse:
        await self.authz_service.assert_permission(current_user, "gram_panchayat.manage", ip=client_ip)

        gp = await self.repo.get_gram_panchayat_by_id(gp_id)
        if not gp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gram Panchayat not found")

        village = await self.repo.get_village_by_id(village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        if village.taluka_id != gp.taluka_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Village does not belong to the same taluka as the Gram Panchayat"
            )

        already_mapped = await self.repo.is_village_actively_mapped_to_gp(village_id)
        if already_mapped:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Village is already actively mapped to a Gram Panchayat"
            )

        taluka = await self.repo.get_taluka_by_id(gp.taluka_id)
        if taluka and current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, taluka.district_id, ip=client_ip)

        mapping = await self.repo.map_gp_village(
            gp_id=gp_id,
            village_id=village_id,
            mapped_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_GP_VILLAGE_MAPPED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="gram_panchayat_village",
            object_id=f"{gp_id}:{village_id}",
            village_id=village_id,
            reason=f"Mapped village {village.code} to GP {gp.code}",
            ip=client_ip
        )
        await self.db.commit()
        return GPVillageMappingResponse.model_validate(mapping)

    # =========================================================================
    # 5. Cooperative Management
    # =========================================================================
    async def list_cooperatives(
        self,
        current_user: User,
        offset: int = 0,
        limit: int = 50
    ) -> List[CooperativeResponse]:
        await self.authz_service.assert_any_permission(
            current_user,
            ["cooperative.manage", "coop.manage", "camp.view_coop", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        coop_ids: Optional[Set[uuid.UUID]] = None
        if current_user.role == "DAIRY_STAFF":
            coop_ids = scope.assigned_cooperative_ids

        cooperatives = await self.repo.list_cooperatives(
            coop_ids=coop_ids,
            offset=offset,
            limit=limit
        )

        result: List[CooperativeResponse] = []
        for c in cooperatives:
            villages = await self.repo.get_cooperative_villages(c.id)
            result.append(
                CooperativeResponse(
                    id=c.id,
                    code=c.code,
                    name_gu=c.name_gu,
                    name_en=c.name_en,
                    org_type=c.org_type,
                    status=c.status,
                    created_at=c.created_at,
                    served_village_ids=villages
                )
            )
        return result

    async def get_cooperative(
        self,
        coop_id: uuid.UUID,
        current_user: User
    ) -> CooperativeResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["cooperative.manage", "coop.manage", "camp.view_coop", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        if current_user.role == "DAIRY_STAFF" and coop_id not in scope.assigned_cooperative_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: user is not assigned to this cooperative"
            )

        coop = await self.repo.get_cooperative_by_id(coop_id)
        if not coop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cooperative not found")

        villages = await self.repo.get_cooperative_villages(coop.id)
        return CooperativeResponse(
            id=coop.id,
            code=coop.code,
            name_gu=coop.name_gu,
            name_en=coop.name_en,
            org_type=coop.org_type,
            status=coop.status,
            created_at=coop.created_at,
            served_village_ids=villages
        )

    async def create_cooperative(
        self,
        payload: CooperativeCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CooperativeResponse:
        await self.authz_service.assert_permission(current_user, "cooperative.manage", ip=client_ip)

        existing = await self.repo.get_cooperative_by_code(payload.code)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cooperative code already exists")

        coop = await self.repo.create_cooperative(
            code=payload.code,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            org_type=payload.org_type,
            status=payload.status,
            created_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_COOPERATIVE_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="cooperative",
            object_id=str(coop.id),
            reason=f"Created cooperative {coop.code}",
            ip=client_ip
        )
        await self.db.commit()
        return CooperativeResponse(
            id=coop.id,
            code=coop.code,
            name_gu=coop.name_gu,
            name_en=coop.name_en,
            org_type=coop.org_type,
            status=coop.status,
            created_at=coop.created_at,
            served_village_ids=[]
        )

    async def update_cooperative(
        self,
        coop_id: uuid.UUID,
        payload: CooperativeUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CooperativeResponse:
        await self.authz_service.assert_permission(current_user, "cooperative.manage", ip=client_ip)

        coop = await self.repo.get_cooperative_by_id(coop_id)
        if not coop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cooperative not found")

        updated = await self.repo.update_cooperative(
            coop=coop,
            name_gu=payload.name_gu,
            name_en=payload.name_en,
            org_type=payload.org_type,
            status=payload.status
        )

        await self.repo.record_audit_event(
            action="ADMIN_COOPERATIVE_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="cooperative",
            object_id=str(coop.id),
            reason=f"Updated cooperative {coop.code}",
            ip=client_ip
        )
        await self.db.commit()
        villages = await self.repo.get_cooperative_villages(coop.id)
        return CooperativeResponse(
            id=updated.id,
            code=updated.code,
            name_gu=updated.name_gu,
            name_en=updated.name_en,
            org_type=updated.org_type,
            status=updated.status,
            created_at=updated.created_at,
            served_village_ids=villages
        )

    async def map_cooperative_village(
        self,
        coop_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> Dict[str, str]:
        await self.authz_service.assert_permission(current_user, "cooperative.manage", ip=client_ip)

        coop = await self.repo.get_cooperative_by_id(coop_id)
        if not coop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cooperative not found")

        village = await self.repo.get_village_by_id(village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

        already_mapped = await self.repo.is_cooperative_village_mapped(coop_id, village_id)
        if already_mapped:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Village is already mapped to this cooperative"
            )

        await self.repo.map_cooperative_village(coop_id, village_id)

        await self.repo.record_audit_event(
            action="ADMIN_COOPERATIVE_VILLAGE_MAPPED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="cooperative_village",
            object_id=f"{coop_id}:{village_id}",
            village_id=village_id,
            reason=f"Mapped village {village.code} to cooperative {coop.code}",
            ip=client_ip
        )
        await self.db.commit()
        return {"status": "mapped", "cooperative_id": str(coop_id), "village_id": str(village_id)}

    async def assign_cooperative_staff(
        self,
        coop_id: uuid.UUID,
        user_id: uuid.UUID,
        coop_role: str,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CooperativeStaffAssignmentResponse:
        await self.authz_service.assert_any_permission(current_user, ["coop.manage", "cooperative.manage"], ip=client_ip)

        coop = await self.repo.get_cooperative_by_id(coop_id)
        if not coop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cooperative not found")

        target_user = await self.repo.get_staff_by_id_and_role(user_id, role="DAIRY_STAFF")
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target dairy staff user not found")

        already_assigned = await self.repo.is_cooperative_staff_actively_assigned(coop_id, user_id, coop_role)
        if already_assigned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Staff member is already actively assigned to this cooperative with this role"
            )

        assignment = await self.repo.assign_cooperative_staff(
            coop_id=coop_id,
            user_id=user_id,
            coop_role=coop_role,
            assigned_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_COOPERATIVE_STAFF_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="cooperative_staff_assignment",
            object_id=str(assignment.id),
            reason=f"Assigned staff {target_user.username} as {coop_role} to {coop.code}",
            ip=client_ip
        )
        await self.db.commit()
        return CooperativeStaffAssignmentResponse.model_validate(assignment)

    # =========================================================================
    # 6. Veterinary Officer Management
    # =========================================================================
    async def list_veterinary_officers(
        self,
        current_user: User,
        district_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[VeterinaryOfficerResponse]:
        await self.authz_service.assert_any_permission(
            current_user,
            ["veterinary_officer.manage", "user.manage", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        user_ids: Optional[Set[uuid.UUID]] = None
        target_dist = district_id
        if current_user.role == "DAHO":
            if target_dist:
                await self.authz_service.assert_district_scope(current_user, target_dist)
            else:
                target_dist = next(iter(scope.assigned_district_ids), None)

        if target_dist:
            user_ids = await self.repo.get_staff_assigned_to_district_villages(target_dist, role="VET_OFFICER", creator_id=current_user.id)

        vos = await self.repo.list_staff_by_role(
            role="VET_OFFICER",
            user_ids=user_ids,
            offset=offset,
            limit=limit
        )

        result: List[VeterinaryOfficerResponse] = []
        for vo in vos:
            prof = await self.repo.get_vo_profile(vo.id)
            villages = await self.repo.get_user_active_villages(vo.id)
            result.append(
                VeterinaryOfficerResponse(
                    id=vo.id,
                    full_name=vo.full_name,
                    username=vo.username,
                    mobile_e164=vo.mobile_e164,
                    designation=prof.designation if prof else vo.designation,
                    office_name=prof.office_name if prof else None,
                    employee_ref=prof.employee_ref if prof else None,
                    status=vo.status,
                    assigned_village_ids=villages,
                    created_at=vo.created_at
                )
            )
        return result

    async def get_veterinary_officer(
        self,
        vo_user_id: uuid.UUID,
        current_user: User
    ) -> VeterinaryOfficerResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["veterinary_officer.manage", "user.manage", "aggregate.view"]
        )
        vo = await self.repo.get_staff_by_id_and_role(vo_user_id, role="VET_OFFICER")
        if not vo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veterinary Officer not found")

        prof = await self.repo.get_vo_profile(vo.id)
        villages = await self.repo.get_user_active_villages(vo.id)
        return VeterinaryOfficerResponse(
            id=vo.id,
            full_name=vo.full_name,
            username=vo.username,
            mobile_e164=vo.mobile_e164,
            designation=prof.designation if prof else vo.designation,
            office_name=prof.office_name if prof else None,
            employee_ref=prof.employee_ref if prof else None,
            status=vo.status,
            assigned_village_ids=villages,
            created_at=vo.created_at
        )

    async def create_veterinary_officer(
        self,
        payload: VeterinaryOfficerCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VeterinaryOfficerResponse:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["veterinary_officer.manage", "user.manage", "district.setup.manage"],
                ip=client_ip
            )

        existing = await self.repo.get_user_by_username(payload.username)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

        if payload.mobile_e164:
            existing_mobile = await self.repo.get_user_by_mobile(payload.mobile_e164)
            if existing_mobile:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="આ મોબાઇલ નંબર પહેલેથી જ અન્ય એકાઉન્ટ સાથે નોંધાયેલ છે. કૃપા કરીને અલગ નંબર દાખલ કરો."
                )

        pw_hash = get_password_hash(payload.password)
        user = await self.repo.create_staff_user(
            role="VET_OFFICER",
            full_name=payload.full_name,
            username=payload.username,
            password_hash=pw_hash,
            mobile_e164=payload.mobile_e164,
            designation=payload.designation,
            organisation="Government Veterinary Dispensary",
            created_by=current_user.id
        )

        prof = await self.repo.upsert_vo_profile(
            user_id=user.id,
            employee_ref=payload.employee_ref,
            designation=payload.designation,
            office_name=payload.office_name,
            contact_mobile=payload.mobile_e164,
            created_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_VO_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user",
            object_id=str(user.id),
            reason=f"Created Veterinary Officer {user.username}",
            ip=client_ip
        )
        await self.db.commit()

        return VeterinaryOfficerResponse(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            mobile_e164=user.mobile_e164,
            designation=prof.designation,
            office_name=prof.office_name,
            employee_ref=prof.employee_ref,
            status=user.status,
            assigned_village_ids=[],
            created_at=user.created_at
        )

    async def update_veterinary_officer(
        self,
        vo_user_id: uuid.UUID,
        payload: VeterinaryOfficerUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VeterinaryOfficerResponse:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["veterinary_officer.manage", "user.manage", "district.setup.manage"],
                ip=client_ip
            )

        vo = await self.repo.get_staff_by_id_and_role(vo_user_id, role="VET_OFFICER")
        if not vo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veterinary Officer not found")

        if payload.full_name:
            vo.full_name = payload.full_name.strip()
        if payload.designation:
            vo.designation = payload.designation.strip()
        vo.updated_at = datetime.now(timezone.utc)

        prof = await self.repo.upsert_vo_profile(
            user_id=vo.id,
            employee_ref=None,
            designation=payload.designation,
            office_name=payload.office_name,
            contact_mobile=payload.contact_mobile,
            created_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_VO_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user",
            object_id=str(vo.id),
            reason=f"Updated VO {vo.username}",
            ip=client_ip
        )
        await self.db.commit()

        villages = await self.repo.get_user_active_villages(vo.id)
        return VeterinaryOfficerResponse(
            id=vo.id,
            full_name=vo.full_name,
            username=vo.username,
            mobile_e164=vo.mobile_e164,
            designation=prof.designation if prof else vo.designation,
            office_name=prof.office_name if prof else None,
            employee_ref=prof.employee_ref if prof else None,
            status=vo.status,
            assigned_village_ids=villages,
            created_at=vo.created_at
        )

    # =========================================================================
    # 7. Field Worker Management
    # =========================================================================
    async def list_field_workers(
        self,
        current_user: User,
        district_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[FieldWorkerResponse]:
        if current_user.role not in ("DAHO", "VET_OFFICER", "VO"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["user.manage", "veterinary_officer.manage", "aggregate.view", "campaign.manage", "campaign.view", "camp.manage"]
            )
        scope = await self.authz_service.get_user_scope(current_user)

        user_ids: Optional[Set[uuid.UUID]] = None
        target_dist = district_id
        if current_user.role == "DAHO":
            if target_dist:
                await self.authz_service.assert_district_scope(current_user, target_dist)
            else:
                target_dist = next(iter(scope.assigned_district_ids), None)
            if target_dist:
                user_ids = await self.repo.get_staff_assigned_to_district_villages(
                    target_dist, role="FIELD_WORKER", creator_id=current_user.id
                )
        elif current_user.role in ("VET_OFFICER", "VO"):
            # VO can access field workers in their assigned district / villages
            if not target_dist and scope.assigned_village_ids:
                for v_id in scope.assigned_village_ids:
                    d_id = await self.authz_service.repo.get_village_district_id(v_id)
                    if d_id:
                        target_dist = d_id
                        break
            if target_dist:
                user_ids = await self.repo.get_staff_assigned_to_district_villages(
                    target_dist, role="FIELD_WORKER", creator_id=None
                )

        fws = await self.repo.list_staff_by_role(
            role="FIELD_WORKER",
            user_ids=user_ids,
            offset=offset,
            limit=limit
        )

        result: List[FieldWorkerResponse] = []
        for fw in fws:
            villages = await self.repo.get_user_active_villages(fw.id)
            result.append(
                FieldWorkerResponse(
                    id=fw.id,
                    full_name=fw.full_name,
                    username=fw.username,
                    mobile_e164=fw.mobile_e164,
                    designation=fw.designation,
                    organisation=fw.organisation,
                    status=fw.status,
                    assigned_village_ids=villages,
                    created_at=fw.created_at
                )
            )
        return result

    async def get_field_worker(
        self,
        fw_user_id: uuid.UUID,
        current_user: User
    ) -> FieldWorkerResponse:
        await self.authz_service.assert_any_permission(
            current_user,
            ["user.manage", "veterinary_officer.manage", "aggregate.view"]
        )
        fw = await self.repo.get_staff_by_id_and_role(fw_user_id, role="FIELD_WORKER")
        if not fw:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field Worker not found")

        villages = await self.repo.get_user_active_villages(fw.id)
        return FieldWorkerResponse(
            id=fw.id,
            full_name=fw.full_name,
            username=fw.username,
            mobile_e164=fw.mobile_e164,
            designation=fw.designation,
            organisation=fw.organisation,
            status=fw.status,
            assigned_village_ids=villages,
            created_at=fw.created_at
        )

    async def create_field_worker(
        self,
        payload: FieldWorkerCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FieldWorkerResponse:
        # Field Worker provisioning allowed for DAHO, SYS_ADMIN, or user.manage
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["user.manage", "district.setup.manage", "field_worker.manage"],
                ip=client_ip
            )

        existing = await self.repo.get_user_by_username(payload.username)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

        if payload.mobile_e164:
            existing_mobile = await self.repo.get_user_by_mobile(payload.mobile_e164)
            if existing_mobile:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="આ મોબાઇલ નંબર પહેલેથી જ અન્ય એકાઉન્ટ સાથે નોંધાયેલ છે. કૃપા કરીને અલગ નંબર દાખલ કરો."
                )

        pw_hash = get_password_hash(payload.password)
        user = await self.repo.create_staff_user(
            role="FIELD_WORKER",
            full_name=payload.full_name,
            username=payload.username,
            password_hash=pw_hash,
            mobile_e164=payload.mobile_e164,
            designation=payload.designation,
            organisation=payload.organisation or "Animal Husbandry Department",
            created_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_FW_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user",
            object_id=str(user.id),
            reason=f"Created Field Worker {user.username}",
            ip=client_ip
        )
        await self.db.commit()

        return FieldWorkerResponse(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            mobile_e164=user.mobile_e164,
            designation=user.designation,
            organisation=user.organisation,
            status=user.status,
            assigned_village_ids=[],
            created_at=user.created_at
        )

    async def update_field_worker(
        self,
        fw_user_id: uuid.UUID,
        payload: FieldWorkerUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FieldWorkerResponse:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["user.manage", "district.setup.manage", "field_worker.manage"],
                ip=client_ip
            )

        fw = await self.repo.get_staff_by_id_and_role(fw_user_id, role="FIELD_WORKER")
        if not fw:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field Worker not found")

        if payload.full_name:
            fw.full_name = payload.full_name.strip()
        if payload.mobile_e164:
            fw.mobile_e164 = payload.mobile_e164.strip()
        if payload.designation:
            fw.designation = payload.designation.strip()
        if payload.organisation:
            fw.organisation = payload.organisation.strip()
        fw.updated_at = datetime.now(timezone.utc)

        await self.repo.record_audit_event(
            action="ADMIN_FW_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user",
            object_id=str(fw.id),
            reason=f"Updated FW {fw.username}",
            ip=client_ip
        )
        await self.db.commit()

        villages = await self.repo.get_user_active_villages(fw.id)
        return FieldWorkerResponse(
            id=fw.id,
            full_name=fw.full_name,
            username=fw.username,
            mobile_e164=fw.mobile_e164,
            designation=fw.designation,
            organisation=fw.organisation,
            status=fw.status,
            assigned_village_ids=villages,
            created_at=fw.created_at
        )

    async def update_staff_status(
        self,
        user_id: uuid.UUID,
        target_status: str,
        reason: Optional[str],
        current_user: User,
        client_ip: Optional[str] = None
    ) -> Dict[str, str]:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["user.manage", "veterinary_officer.manage", "district.setup.manage"],
                ip=client_ip
            )

        # Prevent users from self-deactivating/activating through staff admin
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Staff cannot modify their own operational status"
            )

        target_user = await self.repo.db.get(User, user_id)
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")

        old_status = target_user.status
        await self.repo.update_staff_status(target_user, target_status, reason)

        await self.repo.record_audit_event(
            action="ADMIN_STAFF_STATUS_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user",
            object_id=str(target_user.id),
            reason=f"Status changed from {old_status} to {target_status}: {reason or 'Administrative update'}",
            ip=client_ip
        )
        await self.db.commit()
        return {"status": "updated", "user_id": str(user_id), "new_status": target_status}

    # =========================================================================
    # 8. Administrative Assignments
    # =========================================================================
    async def assign_vo_to_village(
        self,
        vo_user_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> UserVillageAssignResponse:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["veterinary_officer.manage", "user.manage"],
                ip=client_ip
            )

        vo = await self.repo.get_staff_by_id_and_role(vo_user_id, role="VET_OFFICER")
        if not vo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veterinary Officer not found")

        village = await self.repo.get_village_by_id(village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

        already_assigned = await self.repo.is_user_actively_assigned_to_village(vo_user_id, village_id)
        if already_assigned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="આ વેટરનરી અધિકારી પહેલેથી જ આ ગામ માટે સક્રિય રીતે નિયુક્ત છે (Veterinary Officer is already actively assigned to this village)"
            )

        assignment = await self.repo.assign_user_to_village(
            user_id=vo_user_id,
            village_id=village_id,
            assigned_by=current_user.id
        )

        # 1. Multi-stakeholder in-app notifications
        from app.modules.notifications.service import NotificationService
        notif_service = NotificationService(self.db)
        await notif_service.dispatch_village_vo_assignment_notifications(
            village_id=village_id,
            vo_user=vo,
            daho_user=current_user
        )

        # 2. Campaign Alignment: align active campaigns targeting this village with this newly assigned VO
        from app.modules.campaigns.models import Campaign, CampaignVillage, CampaignAssignment, CampaignProgramme
        from app.models.reference import Species

        cv_stmt = (
            select(CampaignVillage.campaign_id)
            .join(Campaign, Campaign.id == CampaignVillage.campaign_id)
            .where(
                CampaignVillage.village_id == village_id,
                Campaign.status.in_(["ACTIVE", "DRAFT"])
            )
        )
        active_camp_ids = (await self.db.execute(cv_stmt)).scalars().all()
        for c_id in active_camp_ids:
            camp = await self.db.get(Campaign, c_id)
            if camp:
                ca_stmt = select(CampaignAssignment).where(
                    CampaignAssignment.campaign_id == camp.id,
                    CampaignAssignment.village_id == village_id,
                    CampaignAssignment.worker_user_id == vo_user_id,
                    CampaignAssignment.ended_at.is_(None)
                )
                existing_ca = (await self.db.execute(ca_stmt)).scalar_one_or_none()
                if not existing_ca:
                    new_ca = CampaignAssignment(
                        id=uuid.uuid4(),
                        campaign_id=camp.id,
                        village_id=village_id,
                        worker_user_id=vo_user_id,
                        assigned_by=current_user.id
                    )
                    self.db.add(new_ca)

                prog_rows = (await self.db.execute(select(CampaignProgramme).where(CampaignProgramme.campaign_id == camp.id))).scalars().all()
                sp_codes = list({p.species_code for p in prog_rows}) or ["CATTLE", "BUFFALO"]
                sp_rows = (await self.db.execute(select(Species).where(Species.code.in_(sp_codes)))).scalars().all()
                sp_names_gu = [s.name_gu for s in sp_rows]

                await notif_service.notify(
                    recipient_user_id=vo_user_id,
                    kind="CAMPAIGN_VO_ASSIGNMENT",
                    message_key="CAMPAIGN_VO_ASSIGNMENT",
                    params={
                        "campaign_id": str(camp.id),
                        "campaign_code": camp.code,
                        "campaign_name": camp.name,
                        "disease_code": prog_rows[0].programme_code if prog_rows else "FMD",
                        "village_id": str(village.id),
                        "village_name": village.name_gu or village.name_en or village.code,
                        "start_date": str(camp.start_date) if camp.start_date else "",
                        "end_date": str(camp.end_date) if camp.end_date else "",
                        "species_list": sp_names_gu,
                        "acceptance_status": "PENDING_ACCEPTANCE",
                        "rejection_reason": None,
                        "daho_name": current_user.full_name or current_user.username or "DAHO",
                    },
                    related_type="campaign",
                    related_id=str(camp.id)
                )

        await self.repo.record_audit_event(
            action="ADMIN_VO_VILLAGE_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user_village_assignment",
            object_id=str(assignment.id),
            village_id=village_id,
            reason=f"Assigned VO {vo.username} to village {village.code}",
            ip=client_ip
        )
        await self.db.commit()
        return UserVillageAssignResponse.model_validate(assignment)

    async def assign_vo_villages_bulk(
        self,
        vo_user_id: uuid.UUID,
        village_ids: List[uuid.UUID],
        current_user: User,
        client_ip: Optional[str] = None
    ) -> UserVillageBulkAssignResponse:
        """Assign multiple villages to a Veterinary Officer in a single atomic transaction."""
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["veterinary_officer.manage", "user.manage"],
                ip=client_ip
            )

        vo = await self.repo.get_staff_by_id_and_role(vo_user_id, role="VET_OFFICER")
        if not vo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veterinary Officer not found")

        from app.modules.notifications.service import NotificationService
        from app.modules.campaigns.models import Campaign, CampaignVillage, CampaignAssignment, CampaignProgramme
        from app.models.reference import Species

        notif_service = NotificationService(self.db)
        assigned_ids: List[uuid.UUID] = []

        for v_id in village_ids:
            village = await self.repo.get_village_by_id(v_id)
            if not village:
                continue

            if current_user.role == "DAHO":
                await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

            already_assigned = await self.repo.is_user_actively_assigned_to_village(vo_user_id, v_id)
            if already_assigned:
                continue

            assignment = await self.repo.assign_user_to_village(
                user_id=vo_user_id,
                village_id=v_id,
                assigned_by=current_user.id
            )
            assigned_ids.append(v_id)

            # Notifications
            await notif_service.dispatch_village_vo_assignment_notifications(
                village_id=v_id,
                vo_user=vo,
                daho_user=current_user
            )

            # Align campaigns
            cv_stmt = (
                select(CampaignVillage.campaign_id)
                .join(Campaign, Campaign.id == CampaignVillage.campaign_id)
                .where(
                    CampaignVillage.village_id == v_id,
                    Campaign.status.in_(["ACTIVE", "DRAFT"])
                )
            )
            for c_id in (await self.db.execute(cv_stmt)).scalars().all():
                camp = await self.db.get(Campaign, c_id)
                if camp:
                    ca_stmt = select(CampaignAssignment).where(
                        CampaignAssignment.campaign_id == camp.id,
                        CampaignAssignment.village_id == v_id,
                        CampaignAssignment.worker_user_id == vo_user_id,
                        CampaignAssignment.ended_at.is_(None)
                    )
                    existing_ca = (await self.db.execute(ca_stmt)).scalar_one_or_none()
                    if not existing_ca:
                        self.db.add(CampaignAssignment(
                            id=uuid.uuid4(),
                            campaign_id=camp.id,
                            village_id=v_id,
                            worker_user_id=vo_user_id,
                            assigned_by=current_user.id
                        ))
                    prog_rows = (await self.db.execute(select(CampaignProgramme).where(CampaignProgramme.campaign_id == camp.id))).scalars().all()
                    sp_codes = list({p.species_code for p in prog_rows}) or ["CATTLE", "BUFFALO"]
                    sp_rows = (await self.db.execute(select(Species).where(Species.code.in_(sp_codes)))).scalars().all()
                    sp_names_gu = [s.name_gu for s in sp_rows]

                    await notif_service.notify(
                        recipient_user_id=vo_user_id,
                        kind="CAMPAIGN_VO_ASSIGNMENT",
                        message_key="CAMPAIGN_VO_ASSIGNMENT",
                        params={
                            "campaign_id": str(camp.id),
                            "campaign_code": camp.code,
                            "campaign_name": camp.name,
                            "disease_code": prog_rows[0].programme_code if prog_rows else "FMD",
                            "village_id": str(v_id),
                            "village_name": village.name_gu or village.name_en or village.code,
                            "start_date": str(camp.start_date) if camp.start_date else "",
                            "end_date": str(camp.end_date) if camp.end_date else "",
                            "species_list": sp_names_gu,
                            "acceptance_status": "PENDING_ACCEPTANCE",
                            "rejection_reason": None,
                            "daho_name": current_user.full_name or current_user.username or "DAHO",
                        },
                        related_type="campaign",
                        related_id=str(camp.id)
                    )

            await self.repo.record_audit_event(
                action="ADMIN_VO_VILLAGE_ASSIGNED",
                result="SUCCESS",
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                object_type="user_village_assignment",
                object_id=str(assignment.id),
                village_id=v_id,
                reason=f"Bulk assigned VO {vo.username} to village {village.code}",
                ip=client_ip
            )

        await self.db.commit()
        return UserVillageBulkAssignResponse(
            user_id=vo_user_id,
            assigned_count=len(assigned_ids),
            assigned_village_ids=assigned_ids,
            message=f"{len(assigned_ids)} ગામો સફળતાપૂર્વક સોંપાયા અને સંબંધિત તમામ હિતધારકોને સૂચના મોકલાઈ."
        )

    async def end_vo_village_assignment(
        self,
        vo_user_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> Dict[str, str]:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["veterinary_officer.manage", "user.manage"],
                ip=client_ip
            )

        village = await self.repo.get_village_by_id(village_id)
        if village and current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

        assignment = await self.repo.end_user_village_assignment(vo_user_id, village_id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active VO village assignment not found")

        # 1. End any active campaign assignments for this VO in this village
        from app.modules.campaigns.models import CampaignAssignment
        ca_upd = (
            update(CampaignAssignment)
            .where(
                CampaignAssignment.village_id == village_id,
                CampaignAssignment.worker_user_id == vo_user_id,
                CampaignAssignment.ended_at.is_(None)
            )
            .values(ended_at=datetime.now(timezone.utc))
        )
        await self.db.execute(ca_upd)

        # 2. In-app notification to VO
        from app.modules.notifications.service import NotificationService
        notif_service = NotificationService(self.db)
        vo_user = await self.db.get(User, vo_user_id)
        if vo_user:
            await notif_service.dispatch_village_vo_ended_notification(
                village_id=village_id,
                vo_user=vo_user,
                daho_user=current_user
            )

        await self.repo.record_audit_event(
            action="ADMIN_VO_VILLAGE_ENDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user_village_assignment",
            object_id=str(assignment.id),
            village_id=village_id,
            reason="Ended VO village assignment",
            ip=client_ip
        )
        await self.db.commit()
        return {"status": "ended", "user_id": str(vo_user_id), "village_id": str(village_id)}

    async def assign_fw_to_village(
        self,
        fw_user_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> UserVillageAssignResponse:
        if current_user.role not in ("DAHO", "SYS_ADMIN", "VET_OFFICER", "VO"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["field_worker.manage", "user.manage"],
                ip=client_ip
            )

        fw = await self.repo.get_staff_by_id_and_role(fw_user_id, role="FIELD_WORKER")
        if not fw:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field Worker not found")

        village = await self.repo.get_village_by_id(village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        if current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

        already_assigned = await self.repo.is_user_actively_assigned_to_village(fw_user_id, village_id)
        if already_assigned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Field Worker is already actively assigned to this village"
            )

        assignment = await self.repo.assign_user_to_village(
            user_id=fw_user_id,
            village_id=village_id,
            assigned_by=current_user.id
        )

        # Ensure approved clinical vaccinator authorization is recorded for this assigned field worker
        from app.modules.authorization.models import VaccinatorAuthorization
        vauth_stmt = select(VaccinatorAuthorization).where(
            VaccinatorAuthorization.user_id == fw_user_id,
            VaccinatorAuthorization.status == "APPROVED"
        )
        existing_vauth = (await self.db.execute(vauth_stmt)).scalars().first()
        if not existing_vauth:
            new_vauth = VaccinatorAuthorization(
                id=uuid.uuid4(),
                user_id=fw_user_id,
                authority_type="GOVERNMENT_FIELD_WORKER",
                status="APPROVED",
                authorization_reference=f"VILL-ASSIGN-{village.code}",
                authorized_by_name=current_user.full_name or current_user.username or "Administrator",
                requested_by=current_user.id,
                approved_by=current_user.id,
                approved_at=datetime.now(timezone.utc),
                valid_from=date.today(),
                valid_to=None
            )
            self.db.add(new_vauth)

        # Align with any active campaigns targeting this village for this field worker
        from app.modules.campaigns.models import Campaign, CampaignVillage, CampaignAssignment
        cv_stmt = (
            select(CampaignVillage.campaign_id)
            .join(Campaign, Campaign.id == CampaignVillage.campaign_id)
            .where(
                CampaignVillage.village_id == village_id,
                Campaign.status.in_(["ACTIVE", "DRAFT"])
            )
        )
        active_camp_ids = (await self.db.execute(cv_stmt)).scalars().all()
        for c_id in active_camp_ids:
            camp = await self.db.get(Campaign, c_id)
            if camp:
                ca_stmt = select(CampaignAssignment).where(
                    CampaignAssignment.campaign_id == camp.id,
                    CampaignAssignment.village_id == village_id,
                    CampaignAssignment.worker_user_id == fw_user_id,
                    CampaignAssignment.ended_at.is_(None)
                )
                existing_ca = (await self.db.execute(ca_stmt)).scalar_one_or_none()
                if not existing_ca:
                    new_ca = CampaignAssignment(
                        id=uuid.uuid4(),
                        campaign_id=camp.id,
                        village_id=village_id,
                        worker_user_id=fw_user_id,
                        assigned_by=current_user.id
                    )
                    self.db.add(new_ca)

        await self.repo.record_audit_event(
            action="ADMIN_FW_VILLAGE_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user_village_assignment",
            object_id=str(assignment.id),
            village_id=village_id,
            reason=f"Assigned FW {fw.username} to village {village.code}",
            ip=client_ip
        )
        await self.db.commit()
        return UserVillageAssignResponse.model_validate(assignment)

    async def end_fw_village_assignment(
        self,
        fw_user_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> Dict[str, str]:
        if current_user.role not in ("DAHO", "SYS_ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["field_worker.manage", "user.manage"],
                ip=client_ip
            )

        village = await self.repo.get_village_by_id(village_id)
        if village and current_user.role == "DAHO":
            await self.authz_service.assert_district_scope(current_user, village.district_id, ip=client_ip)

        assignment = await self.repo.end_user_village_assignment(fw_user_id, village_id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active FW village assignment not found")

        # End any active campaign assignments for this FW in this village
        from app.modules.campaigns.models import CampaignAssignment
        from sqlalchemy import update
        ca_upd = (
            update(CampaignAssignment)
            .where(
                CampaignAssignment.village_id == village_id,
                CampaignAssignment.worker_user_id == fw_user_id,
                CampaignAssignment.ended_at.is_(None)
            )
            .values(ended_at=datetime.now(timezone.utc))
        )
        await self.db.execute(ca_upd)

        await self.repo.record_audit_event(
            action="ADMIN_FW_VILLAGE_ENDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="user_village_assignment",
            object_id=str(assignment.id),
            village_id=village_id,
            reason="Ended FW village assignment",
            ip=client_ip
        )
        await self.db.commit()
        return {"status": "ended", "user_id": str(fw_user_id), "village_id": str(village_id)}

    async def assign_daho_to_district(
        self,
        daho_user_id: uuid.UUID,
        district_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> DahoDistrictAssignResponse:
        # Only SYS_ADMIN platform administrator can assign DAHO to district
        await self.authz_service.assert_permission(current_user, "user.manage", ip=client_ip)
        if current_user.role != "SYS_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only platform administrator may assign DAHO to districts"
            )

        daho = await self.repo.get_staff_by_id_and_role(daho_user_id, role="DAHO")
        if not daho:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DAHO user not found")

        district = await self.repo.get_district_by_id(district_id)
        if not district:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found")

        already_assigned = await self.repo.is_daho_actively_assigned_to_district(daho_user_id, district_id)
        if already_assigned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="DAHO is already actively assigned to this district"
            )

        assignment = await self.repo.assign_daho_to_district(
            daho_user_id=daho_user_id,
            district_id=district_id,
            assigned_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ADMIN_DAHO_DISTRICT_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="daho_district_assignment",
            object_id=str(assignment.id),
            reason=f"Assigned DAHO {daho.username} to district {district.code}",
            ip=client_ip
        )
        await self.db.commit()
        return DahoDistrictAssignResponse.model_validate(assignment)

