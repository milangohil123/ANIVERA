"""Farmer Management Service.

Coordinates:
- Staff-assisted physical farmer record registration
- Geographic village and district boundary enforcement
- Name normalization and duplicate detection (HTTP 409)
- Independent, decoupled farmer login user account provisioning
- Formal farmer verification recording
- Immutable audit trail generation
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_password_hash
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.farmers.models import Farmer
from app.modules.farmers.repository import FarmerRepository
from app.modules.farmers.schemas import (
    FarmerAccountProvisionRequest,
    FarmerAccountProvisionResponse,
    FarmerCreate,
    FarmerDetailResponse,
    FarmerResponse,
    FarmerUpdate,
    FarmerVerificationRequest,
    FarmerVerificationResponse,
)

logger = logging.getLogger("pashurakshak.farmers.service")


def normalize_name(name: str) -> str:
    """Normalize full name for search and duplicate detection."""
    return " ".join(name.strip().upper().split())


class FarmerService:
    """Service handling farmer profile registration, scope isolation, and account provisioning."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = FarmerRepository(db)
        self.authz_service = AuthorizationService(db)

    async def list_farmers(
        self,
        current_user: User,
        village_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        active_only: bool = True,
        offset: int = 0,
        limit: int = 50
    ) -> List[FarmerResponse]:
        """List farmer profiles within caller's verified geographic scope."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["farmer.read", "own.read", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        target_village_ids: Optional[Set[uuid.UUID]] = None

        if current_user.role == "FARMER":
            # Farmer can only see their own linked profile(s)
            farmers = []
            for fid in scope.linked_farmer_ids:
                f = await self.repo.get_farmer_by_id(fid)
                if f and (not active_only or f.active):
                    farmers.append(f)
            return [FarmerResponse.model_validate(f) for f in farmers]

        elif current_user.role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO"):
            target_village_ids = scope.assigned_village_ids
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}

        elif current_user.role == "DAHO":
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}
            else:
                # Filter to all villages belonging to DAHO's assigned district
                district_id = next(iter(scope.assigned_district_ids), None)
                if district_id:
                    v_ids = await self.authz_service.repo.get_villages_in_district(district_id)
                    target_village_ids = set(v_ids)

        elif current_user.role == "DAIRY_STAFF":
            target_village_ids = scope.cooperative_village_ids
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}

        elif current_user.role == "SYS_ADMIN":
            # SYS_ADMIN has platform aggregate view only, no automatic operational district access
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}

        farmers = await self.repo.list_farmers(
            village_ids=target_village_ids,
            search=search,
            active_only=active_only,
            offset=offset,
            limit=limit
        )
        return [FarmerResponse.model_validate(f) for f in farmers]

    async def get_farmer(
        self,
        farmer_id: uuid.UUID,
        current_user: User
    ) -> FarmerDetailResponse:
        """Fetch complete farmer details, verifying caller scope and owned animals count."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["farmer.read", "own.read", "aggregate.view"]
        )

        farmer = await self.repo.get_farmer_by_id(farmer_id)
        if not farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmer not found")

        # Verify caller scope
        scope = await self.authz_service.get_user_scope(current_user)
        if current_user.role == "FARMER":
            if farmer.id not in scope.linked_farmer_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: not your farmer record")
        elif current_user.role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO"):
            if farmer.village_id not in scope.assigned_village_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: farmer outside assigned villages")
        elif current_user.role == "DAHO":
            await self.authz_service.assert_village_scope(current_user, farmer.village_id)
        elif current_user.role == "DAIRY_STAFF":
            if farmer.village_id not in scope.cooperative_village_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: village not served by your cooperative")

        animals_count = await self.repo.get_farmer_owned_animals_count(farmer.id)
        user_link = await self.repo.get_farmer_user_link(farmer.id)

        return FarmerDetailResponse(
            id=farmer.id,
            farmer_code=farmer.farmer_code,
            full_name=farmer.full_name,
            name_norm=farmer.name_norm,
            mobile_e164=farmer.mobile_e164,
            mobile_status=farmer.mobile_status,
            mobile_shared=farmer.mobile_shared,
            has_smartphone=farmer.has_smartphone,
            village_id=farmer.village_id,
            address_text=farmer.address_text,
            registration_status=farmer.registration_status,
            registration_path=farmer.registration_path,
            active=farmer.active,
            created_at=farmer.created_at,
            updated_at=farmer.updated_at,
            registered_by=farmer.registered_by,
            data_consent_at=farmer.data_consent_at,
            outreach_consent=farmer.outreach_consent,
            verified_by=farmer.verified_by,
            verified_at=farmer.verified_at,
            owned_animals_count=animals_count,
            has_login_account=user_link is not None,
            login_user_id=user_link.user_id if user_link else None
        )

    async def register_farmer(
        self,
        payload: FarmerCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FarmerResponse:
        """Register a new physical farmer record."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["farmer.register", "farmer.create"],
            ip=client_ip
        )

        # Enforce village authority
        await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)

        if not payload.data_consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Farmer data consent is mandatory for registration"
            )

        name_norm = normalize_name(payload.full_name)

        # Duplicate detection: active farmer with identical name & mobile in village
        is_dup = await self.repo.check_duplicate_farmer(
            name_norm=name_norm,
            village_id=payload.village_id,
            mobile_e164=payload.mobile_e164
        )
        if is_dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A farmer with identical name and mobile number is already registered in this village"
            )

        farmer = await self.repo.create_farmer(
            full_name=payload.full_name,
            name_norm=name_norm,
            village_id=payload.village_id,
            mobile_e164=payload.mobile_e164,
            mobile_shared=payload.mobile_shared,
            has_smartphone=payload.has_smartphone,
            address_text=payload.address_text,
            registration_path=payload.registration_path,
            registered_by=current_user.id,
            data_consent_at=datetime.now(timezone.utc),
            outreach_consent=payload.outreach_consent,
            consent_basis=payload.consent_basis,
            created_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="FARMER_REGISTERED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="farmer",
            object_id=str(farmer.id),
            village_id=farmer.village_id,
            reason=f"Registered farmer {farmer.full_name}",
            ip=client_ip
        )
        await self.db.commit()
        return FarmerResponse.model_validate(farmer)

    async def update_farmer(
        self,
        farmer_id: uuid.UUID,
        payload: FarmerUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FarmerResponse:
        """Update farmer profile information."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["farmer.edit", "farmer.register"],
            ip=client_ip
        )

        farmer = await self.repo.get_farmer_by_id(farmer_id)
        if not farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmer not found")

        await self.authz_service.assert_village_scope(current_user, farmer.village_id, ip=client_ip)

        name_norm = normalize_name(payload.full_name) if payload.full_name else None

        updated = await self.repo.update_farmer(
            farmer=farmer,
            full_name=payload.full_name,
            name_norm=name_norm,
            mobile_e164=payload.mobile_e164,
            mobile_shared=payload.mobile_shared,
            has_smartphone=payload.has_smartphone,
            address_text=payload.address_text,
            outreach_consent=payload.outreach_consent,
            consent_basis=payload.consent_basis,
            active=payload.active,
            inactive_reason=payload.inactive_reason
        )

        await self.repo.record_audit_event(
            action="FARMER_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="farmer",
            object_id=str(updated.id),
            village_id=updated.village_id,
            reason=f"Updated farmer profile {updated.farmer_code or updated.full_name}",
            ip=client_ip
        )
        await self.db.commit()
        return FarmerResponse.model_validate(updated)

    async def provision_farmer_account(
        self,
        farmer_id: uuid.UUID,
        payload: FarmerAccountProvisionRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FarmerAccountProvisionResponse:
        """Provision a separate login user account for an existing farmer profile.
        
        Strictly decoupled from physical farmer registration.
        Requires explicit canonical permission 'farmer.account.provision'.
        """
        scope = await self.authz_service.get_user_scope(current_user)
        if not (scope.has_permission("user.manage") or scope.has_permission("farmer.account.provision")):
            await self.repo.record_audit_event(
                action="PERMISSION_CHECK",
                result="DENIED",
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                reason="MISSING_PERMISSION:farmer.account.provision",
                ip=client_ip
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: missing required permission 'farmer.account.provision' or 'user.manage'"
            )

        farmer = await self.repo.get_farmer_by_id(farmer_id)
        if not farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmer not found")

        await self.authz_service.assert_village_scope(current_user, farmer.village_id, ip=client_ip)

        if not farmer.mobile_e164:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Farmer record must have a mobile phone number before a login account can be provisioned"
            )

        # Check if already provisioned
        is_already_provisioned = await self.repo.is_farmer_account_provisioned(farmer.id)
        if is_already_provisioned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Farmer already possesses an active provisioned login account"
            )

        pw_hash = get_password_hash(payload.password) if payload.password else None
        username = payload.username.strip() if payload.username else f"frm_{farmer.mobile_e164.replace('+', '')}"

        # Ensure username uniqueness
        from sqlalchemy import select
        u_res = await self.db.execute(select(User).where(User.username == username))
        existing_user = u_res.scalars().first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Login username '{username}' is already in use"
            )

        provisioning = await self.repo.create_farmer_user_and_provisioning(
            farmer_id=farmer.id,
            full_name=farmer.full_name,
            mobile_e164=farmer.mobile_e164,
            username=username,
            password_hash=pw_hash,
            provisioned_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="FARMER_ACCOUNT_PROVISIONED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="farmer_account_provisioning",
            object_id=str(provisioning.user_id),
            village_id=farmer.village_id,
            reason=f"Provisioned login account for farmer {farmer.farmer_code or farmer.full_name}",
            ip=client_ip
        )

        # Notify the newly provisioned farmer account in-app & simulated external dispatch
        try:
            from app.modules.notifications.service import NotificationService
            notif_service = NotificationService(self.db)
            await notif_service.notify(
                recipient_user_id=provisioning.user_id,
                kind="ACCOUNT_PROVISIONED",
                message_key="ACCOUNT_PROVISIONED",
                params={"farmer_name": farmer.full_name},
                related_type="farmer",
                related_id=str(farmer.id)
            )
        except Exception as n_err:
            logger.warning("Notification dispatch error on farmer provisioning: %s", n_err)

        await self.db.commit()

        return FarmerAccountProvisionResponse(
            user_id=provisioning.user_id,
            farmer_id=farmer.id,
            username=username,
            mobile_e164=farmer.mobile_e164,
            activation_status=provisioning.activation_status,
            provisioned_at=provisioning.provisioned_at
        )

    async def verify_farmer(
        self,
        farmer_id: uuid.UUID,
        payload: FarmerVerificationRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> FarmerVerificationResponse:
        """Record formal farmer physical or in-person verification."""
        await self.authz_service.assert_permission(
            current_user,
            "farmer.verify",
            ip=client_ip
        )

        farmer = await self.repo.get_farmer_by_id(farmer_id)
        if not farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmer not found")

        await self.authz_service.assert_village_scope(current_user, farmer.village_id, ip=client_ip)

        verification = await self.repo.record_farmer_verification(
            farmer=farmer,
            method=payload.method,
            outcome="VERIFIED",
            verified_by=current_user.id,
            notes=payload.notes
        )

        await self.repo.record_audit_event(
            action="FARMER_VERIFIED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="farmer",
            object_id=str(farmer.id),
            village_id=farmer.village_id,
            reason=f"Verified farmer {farmer.farmer_code or farmer.full_name} via {payload.method}",
            ip=client_ip
        )
        await self.db.commit()
        return FarmerVerificationResponse.model_validate(verification)

