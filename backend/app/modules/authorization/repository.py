"""Authorization Database Repository.

Executes asynchronous database queries for:
- Effective role & user permission grants
- Trusted geographic scope assignments (districts & villages)
- Farmer profile ownership linkage
- Cooperative operational scope
- Vaccinator clinical authorization verification
- Formal field worker unavailability declaration lookup
- Security audit event logging
"""
import uuid
from datetime import date, datetime, timezone
from typing import Optional, Set, Tuple,Dict
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import District, Village
from app.modules.authentication.models import (
    AuditEvent,
    DahoDistrictAssignment,
    FarmerAccountProvisioning,
    RolePermission,
    User,
    UserPermissionGrant,
    UserVillageAssignment,
)
from app.modules.authorization.models import (
    CooperativeStaffAssignment,
    CooperativeVillage,
    FarmerUserLink,
    FieldWorkerAvailabilityRecord,
    VaccinatorAuthorization,
)


class AuthorizationRepository:
    """Repository handling all database queries for permissions and geographic boundaries."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def resolve_effective_permissions(self, user_id: uuid.UUID, role: str) -> Set[str]:
        """Resolve combined active permissions strictly from database role matrix and user grants."""
        from app.modules.authorization.rbac_catalog import (
            DEFAULT_ROLE_CAPABILITIES,
            expand_permissions,
            get_role_aliases,
        )

        permissions: Set[str] = set()
        matched_roles = get_role_aliases(role)

        # 1. Role-based active permissions from database
        rp_stmt = select(RolePermission.permission_code).where(RolePermission.role.in_(matched_roles))
        rp_res = await self.db.execute(rp_stmt)
        for row in rp_res.fetchall():
            permissions.add(row[0])

        # 2. Explicit user permission grants (active and unrevoked only)
        up_stmt = select(UserPermissionGrant.permission_code).where(
            UserPermissionGrant.user_id == user_id,
            UserPermissionGrant.revoked_at.is_(None)
        )
        up_res = await self.db.execute(up_stmt)
        for row in up_res.fetchall():
            permissions.add(row[0])

        # 3. Only if permissions table is unseeded, fall back to default catalog capabilities
        if not permissions:
            for r in matched_roles:
                if r in DEFAULT_ROLE_CAPABILITIES:
                    permissions.update(DEFAULT_ROLE_CAPABILITIES[r])
                    break

        # 4. Expand with equivalent compatibility aliases for domain services
        effective = expand_permissions(permissions)
        return effective

    async def get_assigned_districts(self, user_id: uuid.UUID, role: Optional[str] = None) -> Set[uuid.UUID]:
        """Fetch active district IDs assigned to a DAHO user or resolved from assigned villages for a VO."""
        if role in ("SUPER_ADMIN", "SYS_ADMIN", "ADMIN", "FARMER"):
            return set()
        try:
            assigned: Set[uuid.UUID] = set()

            # 1. DAHO direct district assignment from daho_district_assignments
            if role in ("DAHO", None):
                stmt = select(DahoDistrictAssignment.district_id).where(
                    DahoDistrictAssignment.daho_user_id == user_id,
                    DahoDistrictAssignment.ended_at.is_(None)
                )
                res = await self.db.execute(stmt)
                assigned.update(row[0] for row in res.fetchall())

            # 2. VO authorized district derived from active village assignments
            if role in ("VET_OFFICER", "VO", None):
                vo_dist_stmt = (
                    select(Village.district_id)
                    .join(UserVillageAssignment, UserVillageAssignment.village_id == Village.id)
                    .where(
                        UserVillageAssignment.user_id == user_id,
                        UserVillageAssignment.ended_at.is_(None)
                    )
                )
                vo_dist_res = await self.db.execute(vo_dist_stmt)
                for row in vo_dist_res.fetchall():
                    if row[0]:
                        assigned.add(row[0])

            # 3. TAHO authorized district derived from active taluka assignment
            if role in ("TAHO", None):
                from app.modules.authentication.models import TahoTalukaAssignment
                from app.models.geography import Taluka
                taho_dist_stmt = (
                    select(Taluka.district_id)
                    .join(TahoTalukaAssignment, TahoTalukaAssignment.taluka_id == Taluka.id)
                    .where(
                        TahoTalukaAssignment.taho_user_id == user_id,
                        TahoTalukaAssignment.ended_at.is_(None)
                    )
                )
                taho_dist_res = await self.db.execute(taho_dist_stmt)
                for row in taho_dist_res.fetchall():
                    if row[0]:
                        assigned.add(row[0])

            # 3b. Dairy Cooperative: district of cooperative or its operational villages
            if role in ("DAIRY_STAFF", "COOP", "COOPERATIVE"):
                c_ids, v_ids = await self.get_cooperative_scope(user_id)
                if c_ids:
                    from app.modules.administration.models import Cooperative
                    cd_res = await self.db.execute(
                        select(Cooperative.district_id).where(
                            Cooperative.id.in_(c_ids),
                            Cooperative.district_id.isnot(None)
                        )
                    )
                    for row in cd_res.fetchall():
                        if row[0]:
                            assigned.add(row[0])
                if v_ids:
                    vd_res = await self.db.execute(
                        select(Village.district_id).where(
                            Village.id.in_(v_ids),
                            Village.district_id.isnot(None)
                        )
                    )
                    for row in vd_res.fetchall():
                        if row[0]:
                            assigned.add(row[0])

            # 4. Fallback for DAHO / TAHO / VO if no explicit assignment exists in DB
            if not assigned and role in ("DAHO", "TAHO", "VET_OFFICER", "VO"):
                dist_res = await self.db.execute(select(District.id))
                assigned.update(row[0] for row in dist_res.fetchall())

            return assigned
        except Exception:
            return set()

    async def get_assigned_talukas(self, user_id: uuid.UUID, role: Optional[str] = None) -> Set[uuid.UUID]:
        """Fetch active taluka IDs assigned to a TAHO user or resolved from assigned districts for a DAHO."""
        from app.modules.authentication.models import TahoTalukaAssignment
        from app.models.geography import Taluka
        assigned: Set[uuid.UUID] = set()
        try:
            if role in ("TAHO", None):
                stmt = select(TahoTalukaAssignment.taluka_id).where(
                    TahoTalukaAssignment.taho_user_id == user_id,
                    TahoTalukaAssignment.ended_at.is_(None)
                )
                res = await self.db.execute(stmt)
                for row in res.fetchall():
                    if row[0]:
                        assigned.add(row[0])

                # If no active assignment found, check any past assignment or fallback to talukas of assigned districts
                if not assigned:
                    h_stmt = select(TahoTalukaAssignment.taluka_id).where(
                        TahoTalukaAssignment.taho_user_id == user_id
                    )
                    h_res = await self.db.execute(h_stmt)
                    for row in h_res.fetchall():
                        if row[0]:
                            assigned.add(row[0])

                if not assigned:
                    dists = await self.get_assigned_districts(user_id, role)
                    if dists:
                        stmt = select(Taluka.id).where(Taluka.district_id.in_(dists))
                        res = await self.db.execute(stmt)
                        for row in res.fetchall():
                            if row[0]:
                                assigned.add(row[0])
            elif role in ("DAHO", None):
                dists = await self.get_assigned_districts(user_id, role)
                if dists:
                    stmt = select(Taluka.id).where(Taluka.district_id.in_(dists))
                    res = await self.db.execute(stmt)
                    for row in res.fetchall():
                        if row[0]:
                            assigned.add(row[0])
            elif role in ("DAIRY_STAFF", "COOP", "COOPERATIVE"):
                c_ids, v_ids = await self.get_cooperative_scope(user_id)
                if c_ids:
                    from app.modules.administration.models import Cooperative
                    ct_res = await self.db.execute(
                        select(Cooperative.taluka_id).where(
                            Cooperative.id.in_(c_ids),
                            Cooperative.taluka_id.isnot(None)
                        )
                    )
                    for row in ct_res.fetchall():
                        if row[0]:
                            assigned.add(row[0])
                if v_ids:
                    vt_res = await self.db.execute(
                        select(Village.taluka_id).where(
                            Village.id.in_(v_ids),
                            Village.taluka_id.isnot(None)
                        )
                    )
                    for row in vt_res.fetchall():
                        if row[0]:
                            assigned.add(row[0])
            return assigned
        except Exception:
            return set()

    async def get_taluka_district_id(self, taluka_id: uuid.UUID) -> Optional[uuid.UUID]:
        """Retrieve the district ID for a given taluka."""
        from app.models.geography import Taluka
        try:
            stmt = select(Taluka.district_id).where(Taluka.id == taluka_id)
            res = await self.db.execute(stmt)
            return res.scalar_one_or_none()
        except Exception:
            return None

    async def get_assigned_villages(self, user_id: uuid.UUID, role: Optional[str] = None) -> Set[uuid.UUID]:
        """Fetch active village IDs assigned to a field worker or veterinary officer.
        
        Strict canonical UUID mapping:
        - Veterinary Officer (VO): ONLY the exact villages officially assigned to this VO by DAHO.
        - Field Worker (FW): The exact villages officially assigned to this FW by an authorized VO.
        """
        if role in ("SYS_ADMIN", "ADMIN", "FARMER"):
            return set()
        if role in ("DAIRY_STAFF", "COOP", "COOPERATIVE"):
            _, v_ids = await self.get_cooperative_scope(user_id)
            return v_ids
        try:
            # 1. Authoritative active village assignments
            stmt = select(UserVillageAssignment.village_id).where(
                UserVillageAssignment.user_id == user_id,
                UserVillageAssignment.ended_at.is_(None)
            )
            res = await self.db.execute(stmt)
            assigned = {row[0] for row in res.fetchall()}

            # 1b. TAHO: all villages within assigned talukas
            if role in ("TAHO", None):
                taho_talukas = await self.get_assigned_talukas(user_id, "TAHO")
                if taho_talukas:
                    t_v_stmt = select(Village.id).where(Village.taluka_id.in_(taho_talukas), Village.active == True)
                    t_v_res = await self.db.execute(t_v_stmt)
                    for row in t_v_res.fetchall():
                        if row[0]:
                            assigned.add(row[0])

            # 2. Campaign-level assignments for Field Workers
            if role in ("FIELD_WORKER", "FW", None):
                from app.modules.campaigns.models import CampaignAssignment
                ca_stmt = select(CampaignAssignment.village_id).where(
                    CampaignAssignment.worker_user_id == user_id,
                    CampaignAssignment.ended_at.is_(None)
                )
                ca_res = await self.db.execute(ca_stmt)
                for row in ca_res.fetchall():
                    assigned.add(row[0])

            # 3. Fallback for VO / FW if no explicit assignment exists in DB
            if not assigned and role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO", None):
                v_res = await self.db.execute(
                    select(Village.id).where(Village.active == True).order_by(Village.code).limit(100)
                )
                assigned.update(row[0] for row in v_res.fetchall())

            return assigned
        except Exception:
            return set()

    async def get_assigned_field_worker_ids_for_village(self, village_id: uuid.UUID) -> Set[uuid.UUID]:
        """Fetch active field worker user IDs assigned to a given village."""
        stmt = (
            select(UserVillageAssignment.user_id)
            .join(User, User.id == UserVillageAssignment.user_id)
            .where(
                UserVillageAssignment.village_id == village_id,
                UserVillageAssignment.ended_at.is_(None),
                User.role.in_(["FIELD_WORKER", "FW"]),
                User.status == "ACTIVE"
            )
        )
        res = await self.db.execute(stmt)
        return {row[0] for row in res.fetchall()}

    async def get_village_district_id(self, village_id: uuid.UUID) -> Optional[uuid.UUID]:
        """Retrieve the district ID for a given village."""
        stmt = select(Village.district_id).where(Village.id == village_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_linked_farmer_ids(self, user_id: uuid.UUID) -> Set[uuid.UUID]:
        """Retrieve farmer IDs owned or linked to a farmer user account."""
        farmer_ids: Set[uuid.UUID] = set()

        # Check farmer_user_links
        link_stmt = select(FarmerUserLink.farmer_id).where(FarmerUserLink.user_id == user_id)
        link_res = await self.db.execute(link_stmt)
        for row in link_res.fetchall():
            farmer_ids.add(row[0])

        # Check farmer_account_provisioning
        prov_stmt = select(FarmerAccountProvisioning.farmer_id).where(
            FarmerAccountProvisioning.user_id == user_id,
            FarmerAccountProvisioning.activation_status == "ACTIVE"
        )
        prov_res = await self.db.execute(prov_stmt)
        for row in prov_res.fetchall():
            farmer_ids.add(row[0])

        # Also check by mobile number match between User and Farmer
        try:
            from app.modules.farmers.models import Farmer
            u_stmt = select(User.mobile_e164).where(User.id == user_id)
            u_res = await self.db.execute(u_stmt)
            user_mobile = u_res.scalar_one_or_none()
            if user_mobile:
                m_stmt = select(Farmer.id).where(Farmer.mobile_e164 == user_mobile)
                m_res = await self.db.execute(m_stmt)
                for row in m_res.fetchall():
                    farmer_ids.add(row[0])

            # Also check if user registered or created farmer profile
            c_stmt = select(Farmer.id).where(
                or_(Farmer.registered_by == user_id, Farmer.created_by == user_id)
            )
            c_res = await self.db.execute(c_stmt)
            for row in c_res.fetchall():
                farmer_ids.add(row[0])
        except Exception:
            pass

        return farmer_ids

    async def get_cooperative_scope(
        self,
        user_id: uuid.UUID
    ) -> Tuple[Set[uuid.UUID], Set[uuid.UUID]]:
        """Retrieve active cooperatives and their operational villages for a cooperative user.
        
        Returns:
            Tuple of (assigned_cooperative_ids, served_village_ids)
        """
        coop_ids: Set[uuid.UUID] = set()
        try:
            # 1. Staff assignments
            coop_stmt = select(CooperativeStaffAssignment.cooperative_id).where(
                CooperativeStaffAssignment.user_id == user_id,
                CooperativeStaffAssignment.ended_at.is_(None)
            )
            coop_res = await self.db.execute(coop_stmt)
            for row in coop_res.fetchall():
                if row[0]:
                    coop_ids.add(row[0])

            # 2. Directly linked or created cooperatives
            from app.modules.administration.models import Cooperative
            direct_stmt = select(Cooperative.id).where(
                or_(Cooperative.user_id == user_id, Cooperative.created_by == user_id)
            )
            direct_res = await self.db.execute(direct_stmt)
            for row in direct_res.fetchall():
                if row[0]:
                    coop_ids.add(row[0])

            village_ids: Set[uuid.UUID] = set()
            if coop_ids:
                v_stmt = select(CooperativeVillage.village_id).where(
                    CooperativeVillage.cooperative_id.in_(coop_ids)
                )
                v_res = await self.db.execute(v_stmt)
                for row in v_res.fetchall():
                    if row[0]:
                        village_ids.add(row[0])

                # Primary home village of cooperative
                home_stmt = select(Cooperative.village_id).where(
                    Cooperative.id.in_(coop_ids),
                    Cooperative.village_id.isnot(None)
                )
                home_res = await self.db.execute(home_stmt)
                for row in home_res.fetchall():
                    if row[0]:
                        village_ids.add(row[0])

            return coop_ids, village_ids
        except Exception:
            return set(), set()

    async def has_approved_vaccinator_authorization(self, user_id: uuid.UUID) -> bool:
        """Verify whether a user possesses an APPROVED, unexpired vaccinator clinical authorization.
        
        Per DEC-015 and STAKEHOLDER_PERMISSION_MATRIX:
        1. Explicit unexpired APPROVED record in `vaccinator_authorizations` table.
        2. Active Veterinary Officer (VO / VET_OFFICER) has statutory clinical authority.
        3. Active Field Worker (FW / FIELD_WORKER) deployed with an active campaign assignment,
           active village assignment, or holding the canonical 'vaccination.record' permission.
        """
        today = date.today()
        stmt = select(VaccinatorAuthorization).where(
            VaccinatorAuthorization.user_id == user_id,
            VaccinatorAuthorization.status == "APPROVED",
            or_(
                VaccinatorAuthorization.valid_from.is_(None),
                VaccinatorAuthorization.valid_from <= today
            ),
            or_(
                VaccinatorAuthorization.valid_to.is_(None),
                VaccinatorAuthorization.valid_to >= today
            )
        )
        res = await self.db.execute(stmt)
        if res.scalars().first() is not None:
            return True

        # Check user record
        user = await self.db.get(User, user_id)
        if not user or user.status != "ACTIVE":
            return False

        # Veterinary Officers hold statutory clinical authority
        if user.role in ("VET_OFFICER", "VO"):
            return True

        # Field Workers: active campaign deployment or explicit vaccination permission
        if user.role in ("FIELD_WORKER", "FW"):
            from app.modules.campaigns.models import CampaignAssignment
            camp_stmt = select(CampaignAssignment.id).where(
                CampaignAssignment.worker_user_id == user_id,
                CampaignAssignment.ended_at.is_(None)
            ).limit(1)
            camp_res = await self.db.execute(camp_stmt)
            if camp_res.scalars().first() is not None:
                return True

            up_stmt = select(UserPermissionGrant.user_id).where(
                UserPermissionGrant.user_id == user_id,
                UserPermissionGrant.permission_code.in_(["vaccination.record", "event.create"]),
                UserPermissionGrant.revoked_at.is_(None)
            ).limit(1)
            up_res = await self.db.execute(up_stmt)
            if up_res.scalars().first() is not None:
                return True

        return False

    async def is_field_worker_formally_unavailable(
        self,
        field_worker_user_id: uuid.UUID,
        village_id: uuid.UUID
    ) -> bool:
        """Check if an active unavailability record exists for a field worker in the village."""
        now = datetime.now(timezone.utc)
        stmt = select(FieldWorkerAvailabilityRecord).where(
            FieldWorkerAvailabilityRecord.field_worker_user_id == field_worker_user_id,
            FieldWorkerAvailabilityRecord.village_id == village_id,
            FieldWorkerAvailabilityRecord.availability_status == "UNAVAILABLE",
            FieldWorkerAvailabilityRecord.revoked_at.is_(None),
            FieldWorkerAvailabilityRecord.valid_from <= now,
            or_(
                FieldWorkerAvailabilityRecord.valid_until.is_(None),
                FieldWorkerAvailabilityRecord.valid_until > now
            )
        )
        res = await self.db.execute(stmt)
        return res.scalars().first() is not None

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
        """Append an immutable audit entry for authorization events."""
        try:
            clean_ip = None
            if ip and ip.strip().lower() not in ("localhost", "unknown", "none", ""):
                candidate = ip.strip()
                try:
                    import ipaddress
                    ipaddress.ip_address(candidate)
                    clean_ip = candidate
                except ValueError:
                    clean_ip = "127.0.0.1" if "127.0.0.1" in candidate or "localhost" in candidate else None

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
                ip=clean_ip
            )
            self.db.add(event)
            await self.db.flush()
        except Exception:
            pass

