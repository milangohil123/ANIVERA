"""Authentication Database Repository.

Encapsulates all asynchronous SQLAlchemy 2.0 database queries for:
- User credentials & lockout status
- Farmer provisioning checks
- OTP challenge management (creation, verification, consumption, retry counting, rate limiting)
- Device registration tracking
- Refresh token storage, rotation, and revocation
- Audit event trail logging
- User profile associations (villages, districts, combined permissions)
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import District, Village

logger = logging.getLogger("pashurakshak.auth.repository")
from app.modules.authentication.models import (
    AuditEvent,
    DahoDistrictAssignment,
    Device,
    FarmerAccountProvisioning,
    OtpChallenge,
    RefreshToken,
    RolePermission,
    User,
    UserPermissionGrant,
    UserVillageAssignment,
)


class AuthRepository:
    """Repository handling all database interactions for authentication workflows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Fetch user by case-insensitive username."""
        stmt = select(User).where(func.lower(User.username) == username.lower().strip())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Fetch user by case-insensitive email."""
        stmt = select(User).where(func.lower(User.email) == email.lower().strip())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_user_by_mobile(self, mobile_e164: str) -> Optional[User]:
        """Fetch user by E.164 mobile number."""
        stmt = select(User).where(User.mobile_e164 == mobile_e164.strip())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Fetch user by primary key UUID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update_user_failed_attempts(
        self,
        user: User,
        failed_attempts: int,
        locked_until: Optional[datetime]
    ) -> None:
        """Update failed login counter and lockout expiry."""
        user.failed_attempts = failed_attempts
        user.locked_until = locked_until
        user.updated_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def record_successful_login(self, user: User) -> None:
        """Reset failed attempt counters and record login timestamp."""
        now = datetime.now(timezone.utc)
        user.failed_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        user.updated_at = now
        await self.db.flush()

    async def is_farmer_provisioned(self, user_id: uuid.UUID) -> bool:
        """Check if farmer account has an ACTIVE provisioning record."""
        stmt = (
            select(FarmerAccountProvisioning)
            .where(
                FarmerAccountProvisioning.user_id == user_id,
                FarmerAccountProvisioning.activation_status == "ACTIVE"
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first() is not None

    async def create_otp_challenge(
        self,
        mobile_e164: str,
        code_hash: str,
        expires_at: datetime,
        request_ip: Optional[str] = None
    ) -> OtpChallenge:
        """Record a newly generated hashed OTP challenge."""
        challenge = OtpChallenge(
            id=uuid.uuid4(),
            mobile_e164=mobile_e164.strip(),
            code_hash=code_hash,
            expires_at=expires_at,
            attempts=0,
            consumed_at=None,
            request_ip=request_ip,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(challenge)
        await self.db.flush()
        return challenge

    async def get_latest_active_otp_challenge(
        self,
        mobile_e164: str
    ) -> Optional[OtpChallenge]:
        """Fetch the latest unconsumed, unexpired OTP challenge for a mobile number."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(OtpChallenge)
            .where(
                OtpChallenge.mobile_e164 == mobile_e164.strip(),
                OtpChallenge.consumed_at.is_(None),
                OtpChallenge.expires_at > now
            )
            .order_by(OtpChallenge.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_recent_otp_requests_count(
        self,
        mobile_e164: str,
        window_minutes: int = 15
    ) -> int:
        """Count OTP challenges generated for this mobile number in the given time window."""
        now = datetime.now(timezone.utc)
        since = now - timedelta(minutes=window_minutes)
        stmt = (
            select(func.count(OtpChallenge.id))
            .where(
                OtpChallenge.mobile_e164 == mobile_e164.strip(),
                OtpChallenge.created_at >= since
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def increment_otp_attempts(self, challenge: OtpChallenge) -> int:
        """Increment failed attempts counter on an OTP challenge."""
        challenge.attempts += 1
        await self.db.flush()
        return challenge.attempts

    async def mark_otp_consumed(self, challenge: OtpChallenge) -> None:
        """Mark an OTP challenge as consumed to prevent replay attacks."""
        challenge.consumed_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def upsert_device(
        self,
        device_id: uuid.UUID,
        user_id: uuid.UUID,
        label: Optional[str] = None
    ) -> Device:
        """Register or update a device used by the authenticating user."""
        stmt = select(Device).where(Device.id == device_id)
        result = await self.db.execute(stmt)
        device = result.scalars().first()
        now = datetime.now(timezone.utc)

        if device:
            device.last_seen_at = now
            if label and not device.label:
                device.label = label
        else:
            device = Device(
                id=device_id,
                user_id=user_id,
                label=label,
                first_seen_at=now,
                last_seen_at=now,
                status="ACTIVE"
            )
            self.db.add(device)
            
        await self.db.flush()
        return device

    async def create_refresh_token(
        self,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        device_id: Optional[uuid.UUID] = None,
        rotated_from: Optional[uuid.UUID] = None
    ) -> RefreshToken:
        """Persist a new refresh token entry."""
        refresh_token = RefreshToken(
            id=uuid.uuid4(),
            user_id=user_id,
            device_id=device_id,
            token_hash=token_hash,
            issued_at=datetime.now(timezone.utc),
            expires_at=expires_at,
            rotated_from=rotated_from,
            revoked_at=None
        )
        self.db.add(refresh_token)
        await self.db.flush()
        return refresh_token

    async def get_active_refresh_token_by_hash(
        self,
        token_hash: str
    ) -> Optional[RefreshToken]:
        """Fetch an active (unrevoked, unexpired) refresh token by its SHA-256 hash."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def revoke_refresh_token(self, token: RefreshToken) -> None:
        """Revoke a refresh token."""
        token.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def record_audit_event(
        self,
        action: str,
        result: str,
        actor_user_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        reason: Optional[str] = None,
        ip: Optional[str] = None,
        device_id: Optional[uuid.UUID] = None
    ) -> Optional[AuditEvent]:
        """Append an immutable audit entry safely."""
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
                result=result,
                reason=reason,
                ip=clean_ip,
                device_id=device_id
            )
            self.db.add(event)
            await self.db.flush()
            return event
        except Exception as exc:
            logger.warning("Audit event recording skipped due to non-fatal error: %s", exc)
            return None

    async def get_user_profile_data(
        self,
        user: User
    ) -> Tuple[List[uuid.UUID], List[uuid.UUID], List[uuid.UUID], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
        """Retrieve assigned villages, districts, talukas, and combined permissions for a user.
        
        Returns:
            Tuple of (assigned_village_ids, assigned_district_ids, assigned_taluka_ids, assigned_districts_details, assigned_talukas_details, permission_codes)
        """
        from app.models.geography import District, Taluka, Village
        # 1. Active Village Assignments
        assigned_villages: List[uuid.UUID] = []
        try:
            v_stmt = (
                select(UserVillageAssignment.village_id)
                .where(
                    UserVillageAssignment.user_id == user.id,
                    UserVillageAssignment.ended_at.is_(None)
                )
            )
            v_res = await self.db.execute(v_stmt)
            assigned_villages = [row[0] for row in v_res.fetchall()]
            # DAHO has district-level authority, so if DAHO queries assigned_villages, resolve all active villages in DAHO's district
            if not assigned_villages and user.role == "DAHO":
                v_all = await self.db.execute(select(Village.id).where(Village.active == True).limit(200))
                assigned_villages = [row[0] for row in v_all.fetchall()]
        except Exception as v_err:
            logger.warning("Error resolving user assigned villages: %s", v_err)

        # 2. Active DAHO District Assignments
        assigned_districts: List[uuid.UUID] = []
        assigned_districts_details: List[Dict[str, Any]] = []
        if user.role in ("DAHO", "SYS_ADMIN", "SUPER_ADMIN"):
            try:
                d_stmt = (
                    select(DahoDistrictAssignment.district_id)
                    .where(
                        DahoDistrictAssignment.daho_user_id == user.id,
                        DahoDistrictAssignment.ended_at.is_(None)
                    )
                )
                d_res = await self.db.execute(d_stmt)
                assigned_districts = [row[0] for row in d_res.fetchall()]
                if not assigned_districts and user.role in ("SYS_ADMIN", "SUPER_ADMIN"):
                    d_all = await self.db.execute(select(District.id).where(District.active == True))
                    assigned_districts = [row[0] for row in d_all.fetchall()]

                if assigned_districts:
                    d_objs = await self.db.execute(select(District).where(District.id.in_(assigned_districts)))
                    for d in d_objs.scalars().all():
                        assigned_districts_details.append({
                            "id": str(d.id),
                            "code": d.code,
                            "name_en": d.name_en,
                            "name_gu": d.name_gu
                        })
            except Exception as d_err:
                logger.warning("Error resolving user assigned districts: %s", d_err)

        # 3. Active TAHO Taluka Assignments
        assigned_talukas: List[uuid.UUID] = []
        assigned_talukas_details: List[Dict[str, Any]] = []
        if user.role in ("TAHO", "DAHO", "SYS_ADMIN"):
            try:
                from app.modules.authentication.models import TahoTalukaAssignment
                if user.role == "TAHO":
                    t_stmt = select(TahoTalukaAssignment.taluka_id).where(
                        TahoTalukaAssignment.taho_user_id == user.id,
                        TahoTalukaAssignment.ended_at.is_(None)
                    )
                    t_res = await self.db.execute(t_stmt)
                    assigned_talukas = [row[0] for row in t_res.fetchall()]
                    if assigned_talukas:
                        t_info = await self.db.execute(
                            select(Taluka, District.name_en.label("dist_en"), District.name_gu.label("dist_gu"))
                            .join(District, Taluka.district_id == District.id)
                            .where(Taluka.id.in_(assigned_talukas))
                        )
                        for t_row in t_info.all():
                            t_obj, dist_en, dist_gu = t_row[0], t_row[1], t_row[2]
                            assigned_talukas_details.append({
                                "id": str(t_obj.id),
                                "code": t_obj.code,
                                "name_en": t_obj.name_en,
                                "name_gu": t_obj.name_gu,
                                "district_id": str(t_obj.district_id),
                                "district_name_en": dist_en,
                                "district_name_gu": dist_gu
                            })
                            if t_obj.district_id not in assigned_districts:
                                assigned_districts.append(t_obj.district_id)
                                assigned_districts_details.append({
                                    "id": str(t_obj.district_id),
                                    "code": t_obj.code,
                                    "name_en": dist_en,
                                    "name_gu": dist_gu
                                })
            except Exception as t_err:
                logger.warning("Error resolving user assigned talukas: %s", t_err)

        # 4. Role-based permissions strictly from database
        from app.modules.authorization.rbac_catalog import (
            DEFAULT_ROLE_CAPABILITIES,
            expand_permissions,
            get_role_aliases,
        )

        rp_roles = get_role_aliases(user.role)
        rp_stmt = (
            select(RolePermission.permission_code)
            .where(RolePermission.role.in_(rp_roles))
        )
        rp_res = await self.db.execute(rp_stmt)
        permissions: Set[str] = {row[0] for row in rp_res.fetchall()}

        # 5. Explicit user permission grants (active only)
        up_stmt = (
            select(UserPermissionGrant.permission_code)
            .where(
                UserPermissionGrant.user_id == user.id,
                UserPermissionGrant.revoked_at.is_(None)
            )
        )
        up_res = await self.db.execute(up_stmt)
        for row in up_res.fetchall():
            permissions.add(row[0])

        # 6. Canonical fallback permissions only if database is completely unseeded
        if not permissions:
            for r in rp_roles:
                if r in DEFAULT_ROLE_CAPABILITIES:
                    permissions.update(DEFAULT_ROLE_CAPABILITIES[r])
                    break

        # 7. Expand with compatibility aliases
        effective_permissions = expand_permissions(permissions)

        return (
            assigned_villages,
            assigned_districts,
            assigned_talukas,
            assigned_districts_details,
            assigned_talukas_details,
            sorted(list(effective_permissions))
        )
