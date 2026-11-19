"""Asynchronous database repository for Farmers domain."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import AuditEvent, User
from app.modules.authorization.models import FarmerUserLink
from app.modules.farmers.models import Farmer, FarmerAccountProvisioning, FarmerVerification


class FarmerRepository:
    """Repository managing Farmer database entities and duplicate prevention queries."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_farmer_by_id(self, farmer_id: uuid.UUID) -> Optional[Farmer]:
        """Fetch a farmer entity by primary key."""
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_farmer_by_code(self, farmer_code: str) -> Optional[Farmer]:
        """Fetch a farmer entity by unique code (e.g. FRM-BOT-000123)."""
        stmt = select(Farmer).where(Farmer.farmer_code == farmer_code.strip())
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def check_duplicate_farmer(
        self,
        name_norm: str,
        village_id: uuid.UUID,
        mobile_e164: Optional[str] = None
    ) -> bool:
        """Check if an active farmer with identical normalized name and phone already exists in this village."""
        conditions = [
            Farmer.village_id == village_id,
            Farmer.name_norm == name_norm,
            Farmer.active.is_(True)
        ]
        if mobile_e164:
            conditions.append(Farmer.mobile_e164 == mobile_e164.strip())

        stmt = select(func.count(Farmer.id)).where(*conditions)
        count = await self.db.scalar(stmt)
        return bool(count and count > 0)

    async def list_farmers(
        self,
        village_ids: Optional[Set[uuid.UUID]] = None,
        search: Optional[str] = None,
        active_only: bool = True,
        offset: int = 0,
        limit: int = 50
    ) -> List[Farmer]:
        """List farmers subject to caller's geographic scope and optional search filters."""
        stmt = select(Farmer)
        if village_ids is not None:
            if len(village_ids) == 0:
                return []
            stmt = stmt.where(Farmer.village_id.in_(village_ids))
        if active_only:
            stmt = stmt.where(Farmer.active.is_(True))
        if search:
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Farmer.full_name.ilike(search_term),
                    Farmer.farmer_code.ilike(search_term),
                    Farmer.mobile_e164.ilike(search_term)
                )
            )

        stmt = stmt.order_by(Farmer.created_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def count_farmers(
        self,
        village_ids: Optional[Set[uuid.UUID]] = None,
        search: Optional[str] = None,
        active_only: bool = True
    ) -> int:
        """Count total farmers in scope matching filters."""
        if village_ids is not None and len(village_ids) == 0:
            return 0
        stmt = select(func.count(Farmer.id))
        if village_ids is not None:
            stmt = stmt.where(Farmer.village_id.in_(village_ids))
        if active_only:
            stmt = stmt.where(Farmer.active.is_(True))
        if search:
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Farmer.full_name.ilike(search_term),
                    Farmer.farmer_code.ilike(search_term),
                    Farmer.mobile_e164.ilike(search_term)
                )
            )
        return (await self.db.scalar(stmt)) or 0

    async def create_farmer(
        self,
        full_name: str,
        name_norm: str,
        village_id: uuid.UUID,
        mobile_e164: Optional[str],
        mobile_shared: bool,
        has_smartphone: str,
        address_text: Optional[str],
        registration_path: str,
        registered_by: uuid.UUID,
        data_consent_at: Optional[datetime],
        outreach_consent: str,
        consent_basis: Optional[str],
        created_by: uuid.UUID
    ) -> Farmer:
        """Create a physical farmer record."""
        farmer = Farmer(
            id=uuid.uuid4(),
            full_name=full_name.strip(),
            name_norm=name_norm.strip(),
            village_id=village_id,
            mobile_e164=mobile_e164.strip() if mobile_e164 else None,
            mobile_status="UNVERIFIED" if mobile_e164 else "NONE",
            mobile_shared=mobile_shared,
            has_smartphone=has_smartphone,
            address_text=address_text.strip() if address_text else None,
            registration_status="SUBMITTED",
            registration_path=registration_path,
            registered_by=registered_by,
            data_consent_at=data_consent_at,
            outreach_consent=outreach_consent,
            consent_basis=consent_basis.strip() if consent_basis else None,
            consent_recorded_by=created_by if outreach_consent != "UNKNOWN" else None,
            consent_recorded_at=datetime.now(timezone.utc) if outreach_consent != "UNKNOWN" else None,
            active=True,
            created_by=created_by
        )
        self.db.add(farmer)
        await self.db.flush()
        await self.db.refresh(farmer)
        return farmer

    async def update_farmer(
        self,
        farmer: Farmer,
        full_name: Optional[str] = None,
        name_norm: Optional[str] = None,
        mobile_e164: Optional[str] = None,
        mobile_shared: Optional[bool] = None,
        has_smartphone: Optional[str] = None,
        address_text: Optional[str] = None,
        outreach_consent: Optional[str] = None,
        consent_basis: Optional[str] = None,
        active: Optional[bool] = None,
        inactive_reason: Optional[str] = None
    ) -> Farmer:
        """Update farmer profile fields."""
        if full_name is not None:
            farmer.full_name = full_name.strip()
        if name_norm is not None:
            farmer.name_norm = name_norm.strip()
        if mobile_e164 is not None:
            farmer.mobile_e164 = mobile_e164.strip() if mobile_e164 else None
            farmer.mobile_status = "UNVERIFIED" if farmer.mobile_e164 else "NONE"
        if mobile_shared is not None:
            farmer.mobile_shared = mobile_shared
        if has_smartphone is not None:
            farmer.has_smartphone = has_smartphone
        if address_text is not None:
            farmer.address_text = address_text.strip() if address_text else None
        if outreach_consent is not None:
            farmer.outreach_consent = outreach_consent
        if consent_basis is not None:
            farmer.consent_basis = consent_basis.strip() if consent_basis else None
        if active is not None:
            farmer.active = active
            if not active and inactive_reason:
                farmer.inactive_reason = inactive_reason.strip()
                farmer.registration_status = "INACTIVE"

        farmer.row_version += 1
        farmer.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return farmer

    async def get_farmer_owned_animals_count(self, farmer_id: uuid.UUID) -> int:
        """Count active animals registered to this farmer."""
        # Using text or direct query on animals table
        from app.models.geography import Village  # sanity import
        from sqlalchemy import text
        stmt = text("SELECT count(*) FROM animals WHERE farmer_id = :farmer_id AND status = 'ACTIVE'")
        res = await self.db.execute(stmt, {"farmer_id": farmer_id})
        return res.scalar() or 0

    async def get_farmer_user_link(self, farmer_id: uuid.UUID) -> Optional[FarmerUserLink]:
        """Fetch linked user login record if provisioned."""
        stmt = select(FarmerUserLink).where(FarmerUserLink.farmer_id == farmer_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def is_farmer_account_provisioned(self, farmer_id: uuid.UUID) -> bool:
        """Check if farmer already has a provisioned user account."""
        stmt = select(func.count(FarmerAccountProvisioning.user_id)).where(
            FarmerAccountProvisioning.farmer_id == farmer_id,
            FarmerAccountProvisioning.activation_status.in_(["PENDING", "ACTIVE"])
        )
        count = await self.db.scalar(stmt)
        return bool(count and count > 0)

    async def create_farmer_user_and_provisioning(
        self,
        farmer_id: uuid.UUID,
        full_name: str,
        mobile_e164: Optional[str],
        username: Optional[str],
        password_hash: Optional[str],
        provisioned_by: uuid.UUID
    ) -> FarmerAccountProvisioning:
        """Create user account for farmer and link via farmer_user_links and farmer_account_provisioning."""
        # 1. Create User
        user = User(
            id=uuid.uuid4(),
            role="FARMER",
            full_name=full_name,
            username=username.strip() if username else None,
            password_hash=password_hash,
            mobile_e164=mobile_e164.strip() if mobile_e164 else None,
            designation="Livestock Owner",
            organisation="Farmer",
            status="ACTIVE",
            created_by=provisioned_by
        )
        self.db.add(user)
        await self.db.flush()

        # 2. Create FarmerUserLink
        link = FarmerUserLink(
            user_id=user.id,
            farmer_id=farmer_id,
            linked_by=provisioned_by,
            linked_at=datetime.now(timezone.utc)
        )
        self.db.add(link)

        # 3. Create FarmerAccountProvisioning
        provisioning = FarmerAccountProvisioning(
            user_id=user.id,
            farmer_id=farmer_id,
            provisioned_by=provisioned_by,
            activation_status="ACTIVE",
            activated_at=datetime.now(timezone.utc)
        )
        self.db.add(provisioning)
        await self.db.flush()
        return provisioning

    async def record_farmer_verification(
        self,
        farmer: Farmer,
        method: str,
        outcome: str,
        verified_by: Optional[uuid.UUID],
        notes: Optional[str]
    ) -> FarmerVerification:
        """Record formal farmer verification attempt and update farmer status."""
        verification = FarmerVerification(
            id=uuid.uuid4(),
            farmer_id=farmer.id,
            method=method,
            outcome=outcome,
            verified_by=verified_by,
            notes=notes.strip() if notes else None,
            at=datetime.now(timezone.utc)
        )
        self.db.add(verification)

        if outcome == "VERIFIED":
            farmer.registration_status = "VERIFIED"
            farmer.verified_by = verified_by
            farmer.verified_at = datetime.now(timezone.utc)
            if method in ("OTP", "STAFF_IN_PERSON") and farmer.mobile_e164:
                farmer.mobile_status = "VERIFIED_OTP" if method == "OTP" else "VERIFIED_STAFF"

        await self.db.flush()
        return verification

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
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        ip: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> AuditEvent:
        """Append an immutable audit entry."""
        event = AuditEvent(
            action=action,
            result=result,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            object_type=object_type,
            object_id=object_id,
            village_id=village_id,
            reason=reason,
            before_state=before_state,
            after_state=after_state,
            ip=ip,
            request_id=request_id
        )
        self.db.add(event)
        await self.db.flush()
        return event

