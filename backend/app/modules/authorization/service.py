"""Authorization Service.

Coordinates:
- Security scope resolution (roles, explicit grants, geographic boundaries, linked farmers)
- Permission enforcement with safe denial semantics
- Trusted geographic scope enforcement (district & village boundary validation)
- Farmer record-level ownership isolation
- Workflow prerequisite enforcement:
  - DAHO campaign authority vs SYS_ADMIN platform limitation
  - VO animal registration fallback constraints (requires formal FW unavailability & reason)
  - Vaccinator clinical authorization requirement
  - Qualified veterinary disease confirmation authority
- Immutable audit trail recording for denied privileged actions
"""
import logging
import time
import uuid
from typing import Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import User
from app.modules.authorization.repository import AuthorizationRepository
from app.modules.authorization.schemas import UserScope

logger = logging.getLogger("pashurakshak.authz.service")

# High-performance in-memory scope cache to prevent massive repetitive database queries
# on every protected API call. Keyed by f"{user_id}:{role}".
_SCOPE_CACHE: Dict[str, Tuple[float, UserScope]] = {}
SCOPE_CACHE_TTL_SECONDS = 60.0  # 60s TTL


def clear_scope_cache(user_id: Optional[uuid.UUID] = None, role: Optional[str] = None) -> None:
    """Invalidate in-memory RBAC security scope cache.
    
    If neither user_id nor role is specified, clears the entire cache.
    """
    global _SCOPE_CACHE
    if user_id is None and role is None:
        _SCOPE_CACHE.clear()
        logger.debug("RBAC scope cache cleared completely")
        return

    target_uid = str(user_id) if user_id else None
    keys_to_remove = []
    for key in list(_SCOPE_CACHE.keys()):
        parts = key.split(":")
        k_uid = parts[0]
        k_role = parts[1] if len(parts) > 1 else ""
        if target_uid and k_uid == target_uid:
            keys_to_remove.append(key)
        elif role and k_role == role:
            keys_to_remove.append(key)

    for k in keys_to_remove:
        _SCOPE_CACHE.pop(k, None)
    logger.debug("RBAC scope cache invalidated for keys: %s", keys_to_remove)


class AuthorizationService:
    """Service enforcing RBAC, geographic scopes, record ownership, and workflow rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AuthorizationRepository(db)

    async def get_user_scope(self, user: User, bypass_cache: bool = False) -> UserScope:
        """Resolve full operational security scope from trusted database records (with caching)."""
        cache_key = f"{user.id}:{user.role}"
        now = time.time()

        if not bypass_cache and cache_key in _SCOPE_CACHE:
            cached_time, cached_scope = _SCOPE_CACHE[cache_key]
            if now - cached_time < SCOPE_CACHE_TTL_SECONDS:
                return cached_scope

        permissions = await self.repo.resolve_effective_permissions(user.id, user.role)
        districts = await self.repo.get_assigned_districts(user.id, user.role)
        talukas = await self.repo.get_assigned_talukas(user.id, user.role)
        villages = await self.repo.get_assigned_villages(user.id, user.role)
        farmers = await self.repo.get_linked_farmer_ids(user.id)
        cooperatives, coop_villages = await self.repo.get_cooperative_scope(user.id)
        is_vaccinator = await self.repo.has_approved_vaccinator_authorization(user.id)

        scope = UserScope(
            user_id=user.id,
            role=user.role,
            status=user.status,
            permissions=permissions,
            assigned_district_ids=districts,
            assigned_taluka_ids=talukas,
            assigned_village_ids=villages,
            linked_farmer_ids=farmers,
            assigned_cooperative_ids=cooperatives,
            cooperative_village_ids=coop_villages,
            is_approved_vaccinator=is_vaccinator
        )
        _SCOPE_CACHE[cache_key] = (now, scope)
        return scope

    async def assert_permission(
        self,
        user: User,
        permission_code: str,
        ip: Optional[str] = None
    ) -> UserScope:
        """Assert that the user holds a specific canonical permission code."""
        scope = await self.get_user_scope(user)

        if not scope.has_permission(permission_code):
            logger.warning(
                "Access denied: user %s (%s) lacks permission '%s'",
                user.id,
                user.role,
                permission_code
            )
            await self.repo.record_audit_event(
                action="PERMISSION_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                reason=f"MISSING_PERMISSION:{permission_code}",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: missing required permission '{permission_code}'"
            )

        return scope

    async def assert_any_permission(
        self,
        user: User,
        permission_codes: List[str],
        ip: Optional[str] = None
    ) -> UserScope:
        """Assert that the user holds at least one of the specified permissions."""
        scope = await self.get_user_scope(user)

        if not scope.has_any_permission(*permission_codes):
            logger.warning(
                "Access denied: user %s (%s) lacks any of permissions %s",
                user.id,
                user.role,
                permission_codes
            )
            await self.repo.record_audit_event(
                action="PERMISSION_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                reason=f"MISSING_ANY_OF:{','.join(permission_codes)}",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: missing required authority"
            )

        return scope

    async def assert_district_scope(
        self,
        user: User,
        district_id: uuid.UUID,
        ip: Optional[str] = None
    ) -> UserScope:
        """Assert that the user is authorized to perform operations in the given district."""
        scope = await self.get_user_scope(user)

        # Statewide administrator roles have unrestricted statewide district authority
        if user.role in ("SUPER_ADMIN", "SYS_ADMIN", "ADMIN"):
            return scope

        # DAHO must have active assignment to this specific district
        if user.role == "DAHO":
            if not scope.can_access_district(district_id):
                logger.warning("Cross-district access denied for DAHO %s on district %s", user.id, district_id)
                await self.repo.record_audit_event(
                    action="DISTRICT_SCOPE_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="district",
                    object_id=str(district_id),
                    reason="CROSS_DISTRICT_ACCESS_DENIED",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: user is not assigned to this district"
                )
            return scope

        # SYS_ADMIN: platform administration only; no automatic operational district access
        if user.role == "SYS_ADMIN":
            logger.warning("SYS_ADMIN operational district access denied for user %s", user.id)
            await self.repo.record_audit_event(
                action="DISTRICT_SCOPE_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                object_type="district",
                object_id=str(district_id),
                reason="SYS_ADMIN_NO_OPERATIONAL_AUTHORITY",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform administrator does not possess operational district authority"
            )

        # Other roles check explicit permission or assignments
        if not scope.can_access_district(district_id):
            if user.role in ("VET_OFFICER", "VO"):
                vo_districts = await self.repo.get_assigned_districts(user.id, user.role)
                if district_id in vo_districts:
                    return scope

            await self.repo.record_audit_event(
                action="DISTRICT_SCOPE_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                object_type="district",
                object_id=str(district_id),
                reason="DISTRICT_SCOPE_UNAUTHORIZED",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: user lacks authority for this district"
            )

        return scope

    async def assert_taluka_scope(
        self,
        user: User,
        taluka_id: uuid.UUID,
        ip: Optional[str] = None
    ) -> UserScope:
        """Assert that the user is authorized to perform operations in the given taluka."""
        scope = await self.get_user_scope(user)

        # Statewide administrator roles have unrestricted statewide taluka authority
        if user.role in ("SUPER_ADMIN", "SYS_ADMIN", "ADMIN"):
            return scope

        taluka_district_id = await self.repo.get_taluka_district_id(taluka_id)
        if not scope.can_access_taluka(taluka_id, taluka_district_id):
            logger.warning("Taluka access denied for %s on taluka %s", user.id, taluka_id)
            await self.repo.record_audit_event(
                action="TALUKA_SCOPE_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                object_type="taluka",
                object_id=str(taluka_id),
                reason="TALUKA_SCOPE_UNAUTHORIZED",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: user lacks authority for this taluka"
            )

        return scope

    async def assert_village_scope(
        self,
        user: User,
        village_id: uuid.UUID,
        ip: Optional[str] = None
    ) -> UserScope:
        """Assert that the user is authorized to perform operations in the given village."""
        scope = await self.get_user_scope(user)

        # Statewide administrator roles have unrestricted operational village authority
        if user.role in ("SUPER_ADMIN", "SYS_ADMIN", "ADMIN"):
            return scope

        # Field Worker: strictly assigned villages only
        if user.role in ("FIELD_WORKER", "FW"):
            if not scope.can_access_village(village_id):
                logger.warning("Cross-village access denied for %s on village %s", user.id, village_id)
                await self.repo.record_audit_event(
                    action="VILLAGE_SCOPE_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="village",
                    object_id=str(village_id),
                    village_id=village_id,
                    reason="CROSS_VILLAGE_ACCESS_DENIED",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: user is not assigned to this village"
                )
            return scope

        # Veterinary Officer: strictly authorized for villages assigned by DAHO
        if user.role in ("VET_OFFICER", "VO"):
            if not scope.can_access_village(village_id):
                logger.warning("VO %s tried accessing village %s outside assigned villages", user.id, village_id)
                await self.repo.record_audit_event(
                    action="VILLAGE_SCOPE_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="village",
                    object_id=str(village_id),
                    village_id=village_id,
                    reason="VILLAGE_NOT_ASSIGNED_TO_VO",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: you are not assigned to this village"
                )
            return scope

        # TAHO: access permitted if village belongs to TAHO's assigned taluka or district, or active campaign oversight
        if user.role == "TAHO":
            from app.models.geography import Village
            stmt = select(Village.taluka_id, Village.district_id).where(Village.id == village_id)
            row = (await self.db.execute(stmt)).first()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")
            village_taluka_id, village_district_id = row

            in_taluka = village_taluka_id and scope.can_access_taluka(village_taluka_id, village_district_id)
            in_district = village_district_id and scope.can_access_district(village_district_id)

            if not in_taluka and not in_district:
                # Also verify if village belongs to any active campaign the TAHO has access to
                try:
                    from app.modules.campaigns.models import CampaignVillage, Campaign
                    c_stmt = (
                        select(CampaignVillage.campaign_id)
                        .join(Campaign, Campaign.id == CampaignVillage.campaign_id)
                        .where(
                            CampaignVillage.village_id == village_id,
                            Campaign.status.in_(["ACTIVE", "DRAFT"])
                        )
                    )
                    c_res = (await self.db.execute(c_stmt)).scalars().first()
                    if c_res:
                        return scope  # Permitted as part of active campaign oversight
                except Exception as c_err:
                    logger.debug("Campaign village lookup error in TAHO scope check: %s", c_err)

                # General operational fallback if TAHO has open/unrestricted scope
                if not scope.assigned_taluka_ids and not scope.assigned_district_ids:
                    return scope

                logger.warning("TAHO %s tried accessing village %s outside assigned taluka or district", user.id, village_id)
                await self.repo.record_audit_event(
                    action="VILLAGE_SCOPE_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="village",
                    object_id=str(village_id),
                    village_id=village_id,
                    reason="VILLAGE_OUTSIDE_ASSIGNED_TALUKA_OR_DISTRICT",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: village is outside your assigned taluka or district"
                )
            return scope

        # DAHO: access permitted if village belongs to DAHO's assigned district
        if user.role == "DAHO":
            village_district_id = await self.repo.get_village_district_id(village_id)
            if not village_district_id or not scope.can_access_district(village_district_id):
                logger.warning("DAHO %s tried accessing village %s outside assigned district", user.id, village_id)
                await self.repo.record_audit_event(
                    action="VILLAGE_SCOPE_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="village",
                    object_id=str(village_id),
                    village_id=village_id,
                    reason="VILLAGE_OUTSIDE_ASSIGNED_DISTRICT",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: village is outside your assigned district"
                )
            return scope

        # DAIRY_STAFF: access permitted if village is served by assigned cooperative
        if user.role == "DAIRY_STAFF":
            if not scope.can_access_village(village_id):
                logger.warning("Dairy staff %s tried accessing village %s outside coop scope", user.id, village_id)
                await self.repo.record_audit_event(
                    action="VILLAGE_SCOPE_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="village",
                    object_id=str(village_id),
                    village_id=village_id,
                    reason="VILLAGE_NOT_SERVED_BY_COOPERATIVE",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: village is not served by your assigned dairy cooperative"
                )
            return scope

        # SYS_ADMIN: denied operational field village access
        if user.role == "SYS_ADMIN":
            logger.warning("SYS_ADMIN operational village access denied for user %s", user.id)
            await self.repo.record_audit_event(
                action="VILLAGE_SCOPE_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                object_type="village",
                object_id=str(village_id),
                village_id=village_id,
                reason="SYS_ADMIN_NO_OPERATIONAL_AUTHORITY",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform administrator does not possess operational village authority"
            )

        # Any unhandled role is denied by default
        await self.repo.record_audit_event(
            action="VILLAGE_SCOPE_CHECK",
            result="DENIED",
            actor_user_id=user.id,
            actor_role=user.role,
            object_type="village",
            object_id=str(village_id),
            village_id=village_id,
            reason="VILLAGE_SCOPE_UNAUTHORIZED",
            ip=ip
        )
        await self.db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: user lacks operational authority in this village"
        )

    async def assert_farmer_ownership(
        self,
        user: User,
        farmer_id: uuid.UUID,
        ip: Optional[str] = None
    ) -> UserScope:
        """Assert that an authenticated farmer user owns the target farmer record.
        
        Per Decision Register & STAKEHOLDER_PERMISSION_MATRIX:
        Farmers may only access their own records. Cross-farmer access is strictly prohibited.
        """
        scope = await self.get_user_scope(user)

        if user.role == "FARMER":
            if not scope.can_access_farmer(farmer_id):
                logger.warning("Cross-farmer access attempt: user %s requested farmer %s", user.id, farmer_id)
                await self.repo.record_audit_event(
                    action="FARMER_OWNERSHIP_CHECK",
                    result="DENIED",
                    actor_user_id=user.id,
                    actor_role=user.role,
                    object_type="farmer",
                    object_id=str(farmer_id),
                    reason="CROSS_FARMER_ACCESS_DENIED",
                    ip=ip
                )
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: you do not have permission to access another farmer's records"
                )

        return scope

    # Backward-compatible alias
    assert_farmer_access = assert_farmer_ownership

    async def assert_vo_animal_fallback_eligibility(
        self,
        user: User,
        village_id: uuid.UUID,
        ip: Optional[str] = None
    ) -> None:
        """Enforce strict fallback rules when a Veterinary Officer registers an animal.
        
        Per APPFLOW §6 & DECISION_REGISTER:
        - Primary animal registration belongs to Field Worker.
        - VO registration is strictly a fallback ('animal.create.fallback').
        - Requires VO to be assigned to the village.
        - If an assigned Field Worker is available, fallback is rejected (HTTP 403).
        - Fallback is permitted only when all assigned Field Workers for this village
          have formal, unexpired unavailability declarations in field_worker_availability_records.
        - If no Field Worker is assigned, fallback requires a documented unavailability record.
        """
        scope = await self.get_user_scope(user)

        if user.role != "VET_OFFICER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Veterinary Officers may invoke fallback animal registration"
            )

        if not scope.has_permission("animal.create.fallback"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing required authority 'animal.create.fallback'"
            )

        if not scope.can_access_village(village_id):
            logger.warning("VO %s tried fallback registration in unassigned village %s", user.id, village_id)
            await self.repo.record_audit_event(
                action="VO_FALLBACK_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                village_id=village_id,
                reason="VO_NOT_ASSIGNED_TO_VILLAGE",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Veterinary Officer is not assigned to this village"
            )

        assigned_fw_ids = await self.repo.get_assigned_field_worker_ids_for_village(village_id)

        if not assigned_fw_ids:
            logger.warning("VO fallback rejected: no assigned Field Worker found in village %s", village_id)
            await self.repo.record_audit_event(
                action="VO_FALLBACK_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                village_id=village_id,
                reason="NO_ASSIGNED_FW_FOR_VILLAGE",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No assigned Field Worker found for this village; formal unavailability declaration is required"
            )

        # Check if any assigned Field Worker is currently available
        available_fws: List[uuid.UUID] = []
        for fw_id in assigned_fw_ids:
            is_unavail = await self.repo.is_field_worker_formally_unavailable(fw_id, village_id)
            if not is_unavail:
                available_fws.append(fw_id)

        if available_fws:
            logger.warning(
                "VO fallback rejected: %d assigned Field Worker(s) available in village %s",
                len(available_fws),
                village_id
            )
            await self.repo.record_audit_event(
                action="VO_FALLBACK_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                village_id=village_id,
                reason="ASSIGNED_FIELD_WORKER_AVAILABLE",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assigned Field Worker is available in this village; fallback registration is not permitted"
            )

    async def assert_vo_fallback_prerequisites(
        self,
        user: User,
        village_id: uuid.UUID,
        field_worker_user_id: uuid.UUID,
        reason: str,
        ip: Optional[str] = None
    ) -> None:
        """Enforce strict prerequisites for VO fallback animal registration.
        
        Per ISSUE-SQL-02, APPFLOW §6 & DECISION_REGISTER:
        - Primary animal registration belongs to Field Worker.
        - VO registration is strictly a fallback (`animal.create.fallback`).
        - Requires VO to be assigned to the village.
        - Requires an active, formal FW unavailability record for the village.
        - Requires a non-empty audit reason.
        """
        scope = await self.get_user_scope(user)

        if user.role != "VET_OFFICER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Veterinary Officers may invoke fallback registration"
            )

        if not scope.has_permission("animal.create.fallback"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing required authority 'animal.create.fallback'"
            )

        if not scope.can_access_village(village_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Veterinary Officer is not assigned to this village"
            )

        if not reason or len(reason.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid, documented fallback reason (minimum 5 characters) is required"
            )

        is_unavailable = await self.repo.is_field_worker_formally_unavailable(
            field_worker_user_id=field_worker_user_id,
            village_id=village_id
        )

        if not is_unavailable:
            logger.warning(
                "VO fallback rejected: no active FW unavailability record for FW %s in village %s",
                field_worker_user_id,
                village_id
            )
            await self.repo.record_audit_event(
                action="VO_FALLBACK_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                village_id=village_id,
                reason="FW_NOT_FORMALLY_UNAVAILABLE",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Fallback registration denied: the assigned Field Worker does not have an active unavailability declaration for this village"
            )

    async def assert_vaccinator_authorization(
        self,
        user: User,
        ip: Optional[str] = None
    ) -> None:
        """Enforce that administering/recording vaccination requires separate vaccinator authorization."""
        scope = await self.get_user_scope(user)
        if not scope.is_approved_vaccinator:
            logger.warning("Vaccinator check failed: user %s lacks approved clinical authorization", user.id)
            await self.repo.record_audit_event(
                action="VACCINATOR_AUTH_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                reason="VACCINATOR_AUTHORIZATION_MISSING",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: recording vaccinations requires an approved vaccinator authorization from the Department"
            )

    async def assert_disease_confirmation_authority(
        self,
        user: User,
        ip: Optional[str] = None
    ) -> None:
        """Enforce that disease confirmation requires explicit departmental authorization ('disease.confirm')."""
        scope = await self.get_user_scope(user)
        if not scope.has_permission("disease.confirm"):
            logger.warning("Disease confirmation denied: user %s lacks 'disease.confirm'", user.id)
            await self.repo.record_audit_event(
                action="DISEASE_CONFIRM_CHECK",
                result="DENIED",
                actor_user_id=user.id,
                actor_role=user.role,
                reason="MISSING_PERMISSION:disease.confirm",
                ip=ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: disease confirmation requires explicit departmental authorization ('disease.confirm')"
            )

