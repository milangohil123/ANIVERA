"""RBAC (Role-Based Access Control) Management Service.

Provides complete persistence, matrix management, user role assignment,
and immutable audit event tracking for the System Admin portal.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import AuditEvent, Permission, RolePermission, User
from app.modules.authorization.rbac_catalog import (
    ALL_PERMISSION_CODES,
    DEFAULT_ROLE_CAPABILITIES,
    PERMISSION_CATEGORIES,
    ROLE_DEFINITIONS,
    get_role_aliases,
)
from app.modules.authorization.service import clear_scope_cache

logger = logging.getLogger("pashurakshak.rbac.service")


class RbacService:
    """Service handling RBAC catalog inspection, editing, matrix updates, and auditing."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def ensure_catalog_initialized(self) -> None:
        """Seed all standard RBAC permissions and baseline role matrices if not present."""
        # 1. Check existing permissions in DB
        existing_perms_res = await self.db.execute(select(Permission.code))
        existing_codes = set(existing_perms_res.scalars().all())

        new_permissions = []
        for cat in PERMISSION_CATEGORIES:
            for perm in cat["permissions"]:
                if perm["code"] not in existing_codes:
                    new_permissions.append(
                        Permission(
                            code=perm["code"],
                            description=f"{perm['name_en']} — {perm['name_gu']} ({perm['desc']})"
                        )
                    )
                    existing_codes.add(perm["code"])

        if new_permissions:
            self.db.add_all(new_permissions)
            await self.db.flush()
            logger.info("Seeded %d new RBAC permissions into database.", len(new_permissions))

        # 2. Check existing role permissions
        rp_res = await self.db.execute(select(RolePermission.role, RolePermission.permission_code))
        existing_rps = set((row[0], row[1]) for row in rp_res.fetchall())

        # Only seed baseline role permissions if role_permissions is completely empty (first installation).
        # Never revive un-checked/revoked permissions in an already initialized database!
        if not existing_rps:
            new_rps = []
            for role, perm_codes in DEFAULT_ROLE_CAPABILITIES.items():
                for code in perm_codes:
                    if code in existing_codes:
                        new_rps.append(RolePermission(role=role, permission_code=code))
                        existing_rps.add((role, code))

            if new_rps:
                self.db.add_all(new_rps)
                await self.db.flush()
                logger.info("Seeded %d baseline role permissions into database.", len(new_rps))

        await self.db.commit()

    async def get_overview(self) -> Dict[str, Any]:
        """Fetch complete RBAC overview: roles, permission categories, matrix, and KPIs."""
        await self.ensure_catalog_initialized()

        # 1. Fetch current role_permissions mapping from DB
        rp_stmt = select(RolePermission.role, RolePermission.permission_code)
        rp_res = await self.db.execute(rp_stmt)
        matrix: Dict[str, List[str]] = {}
        for role, code in rp_res.fetchall():
            if role not in matrix:
                matrix[role] = []
            matrix[role].append(code)

        # 2. Count users per role
        user_count_stmt = select(User.role, func.count(User.id)).group_by(User.role)
        uc_res = await self.db.execute(user_count_stmt)
        user_counts = {row[0]: row[1] for row in uc_res.fetchall()}

        # 3. Total stats
        total_users_res = await self.db.execute(select(func.count(User.id)))
        total_users = total_users_res.scalar() or 0

        total_logs_res = await self.db.execute(
            select(func.count(AuditEvent.id)).where(
                AuditEvent.action.in_([
                    "ROLE_PERMISSIONS_UPDATE",
                    "USER_ROLE_ASSIGN",
                    "PERMISSION_GRANT",
                    "RBAC_MATRIX_UPDATE"
                ])
            )
        )
        total_logs = total_logs_res.scalar() or 0

        # Construct roles detail
        roles_output = []
        for role_meta in ROLE_DEFINITIONS:
            rcode = role_meta["code"]
            active_perms = matrix.get(rcode, [])
            if not active_perms:
                for alias in get_role_aliases(rcode):
                    if alias in matrix and matrix[alias]:
                        active_perms = matrix[alias]
                        break
            matrix[rcode] = active_perms

            # Calculate total user count across all aliases
            total_role_users = sum(user_counts.get(a, 0) for a in get_role_aliases(rcode))

            roles_output.append({
                **role_meta,
                "user_count": total_role_users,
                "permissions_count": len(set(active_perms)),
                "permissions": sorted(list(set(active_perms))),
            })

        return {
            "summary": {
                "total_roles": len(ROLE_DEFINITIONS),
                "total_permissions": len(ALL_PERMISSION_CODES),
                "total_users": total_users,
                "total_rbac_logs": total_logs,
            },
            "roles": roles_output,
            "categories": PERMISSION_CATEGORIES,
            "matrix": matrix,
        }

    async def update_role_permissions(
        self,
        role: str,
        permission_codes: List[str],
        actor_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update permissions for a specific role and record an audit event."""
        # Find all recognized role aliases (canonical and legacy)
        target_roles = get_role_aliases(role)

        # Fetch before state
        before_stmt = select(RolePermission.permission_code).where(RolePermission.role == role)
        before_res = await self.db.execute(before_stmt)
        before_perms = sorted(before_res.scalars().all())

        # Validate permission codes against catalogue
        valid_codes = [c for c in permission_codes if c in ALL_PERMISSION_CODES]

        # Delete existing permissions for these roles
        await self.db.execute(
            delete(RolePermission).where(RolePermission.role.in_(target_roles))
        )

        # Insert new permissions for all target aliases
        new_entries = []
        for r in target_roles:
            for code in valid_codes:
                new_entries.append(RolePermission(role=r, permission_code=code))

        if new_entries:
            self.db.add_all(new_entries)

        # Record audit event
        audit = AuditEvent(
            action="ROLE_PERMISSIONS_UPDATE",
            object_type="ROLE",
            object_id=role,
            actor_user_id=actor_id,
            actor_role=actor_role or "SUPER_ADMIN",
            result="SUCCESS",
            reason=f"Updated permissions for role {role} ({len(valid_codes)} permissions)",
            before_state={"role": role, "permissions": before_perms},
            after_state={"role": role, "permissions": valid_codes},
            ip=ip
        )
        self.db.add(audit)
        await self.db.commit()

        # Invalidate in-memory RBAC scope cache across all users of these roles
        clear_scope_cache()

        logger.info("Updated permissions for role %s: %d permissions", role, len(valid_codes))
        return {
            "status": "success",
            "role": role,
            "permissions_count": len(valid_codes),
            "permissions": valid_codes
        }

    async def update_matrix(
        self,
        matrix_updates: Dict[str, List[str]],
        actor_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Batch update role-permission matrix across multiple roles."""
        updated_roles = []
        for role, codes in matrix_updates.items():
            await self.update_role_permissions(
                role=role,
                permission_codes=codes,
                actor_id=actor_id,
                actor_role=actor_role,
                ip=ip
            )
            updated_roles.append(role)

        return {
            "status": "success",
            "message": f"Successfully updated permissions for {len(updated_roles)} roles.",
            "updated_roles": updated_roles
        }

    async def list_users(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """List users with role, status, and geographic scope details."""
        stmt = select(User)
        if role:
            # Handle role aliases
            if role in ("SUPER_ADMIN", "SYS_ADMIN"):
                stmt = stmt.where(User.role.in_(["SUPER_ADMIN", "SYS_ADMIN"]))
            elif role in ("VO", "VET_OFFICER"):
                stmt = stmt.where(User.role.in_(["VO", "VET_OFFICER"]))
            elif role in ("FW", "FIELD_WORKER"):
                stmt = stmt.where(User.role.in_(["FW", "FIELD_WORKER"]))
            elif role in ("COOPERATIVE", "DAIRY_STAFF"):
                stmt = stmt.where(User.role.in_(["COOPERATIVE", "DAIRY_STAFF"]))
            else:
                stmt = stmt.where(User.role == role)

        if search:
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                func.lower(User.full_name).like(term)
                | func.lower(User.username).like(term)
                | func.lower(User.email).like(term)
                | User.mobile_e164.like(term)
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await self.db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Execute page query
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        users = res.scalars().all()

        output_users = []
        for u in users:
            # Determine geographic scope description
            scope_desc = "રાજ્ય સ્તરે (Statewide)"
            if u.role == "DAHO":
                scope_desc = "જિલ્લા કચેરી (District Scope)"
            elif u.role == "TAHO":
                scope_desc = "તાલુકા કચેરી (Taluka Scope)"
            elif u.role in ("VO", "VET_OFFICER"):
                scope_desc = "વેટરનરી કેન્દ્ર / સોંપાયેલ ગામો"
            elif u.role in ("FW", "FIELD_WORKER"):
                scope_desc = "સોંપાયેલ ગામો (Village Scope)"
            elif u.role in ("COOPERATIVE", "DAIRY_STAFF"):
                scope_desc = "ડેરી સહકારી મંડળી વિસ્તાર"
            elif u.role == "FARMER":
                scope_desc = "પોતાનું પશુધન (Self)"
            elif u.role == "GRAM_PANCHAYAT":
                scope_desc = "ગ્રામ પંચાયત વિસ્તાર"

            output_users.append({
                "id": str(u.id),
                "full_name": u.full_name,
                "username": u.username,
                "email": u.email,
                "mobile_e164": u.mobile_e164,
                "role": u.role,
                "designation": u.designation,
                "organisation": u.organisation,
                "status": u.status,
                "geographic_scope": scope_desc,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            })

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "users": output_users
        }

    async def assign_user_role(
        self,
        user_id: uuid.UUID,
        new_role: str,
        reason: Optional[str] = None,
        actor_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Change a user's role and record an audit log."""
        user = await self.db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        old_role = user.role
        user.role = new_role
        user.updated_at = datetime.now(timezone.utc)

        audit = AuditEvent(
            action="USER_ROLE_ASSIGN",
            object_type="USER",
            object_id=str(user_id),
            actor_user_id=actor_id,
            actor_role=actor_role or "SUPER_ADMIN",
            result="SUCCESS",
            reason=reason or f"Role changed from {old_role} to {new_role}",
            before_state={"user_id": str(user_id), "role": old_role},
            after_state={"user_id": str(user_id), "role": new_role},
            ip=ip
        )
        self.db.add(audit)
        await self.db.commit()

        # Invalidate in-memory RBAC scope cache for this user
        clear_scope_cache(user_id=user_id)

        logger.info("Assigned role %s to user %s (was %s)", new_role, user_id, old_role)
        return {
            "status": "success",
            "user_id": str(user_id),
            "old_role": old_role,
            "new_role": new_role
        }

    async def list_audit_logs(
        self,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Fetch audit logs related to RBAC operations."""
        stmt = (
            select(AuditEvent)
            .where(
                AuditEvent.action.in_([
                    "ROLE_PERMISSIONS_UPDATE",
                    "USER_ROLE_ASSIGN",
                    "PERMISSION_GRANT",
                    "RBAC_MATRIX_UPDATE",
                    "PERMISSION_CHECK"
                ])
            )
            .order_by(AuditEvent.occurred_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        logs = res.scalars().all()

        output = []
        for log in logs:
            output.append({
                "id": log.id,
                "occurred_at": log.occurred_at.isoformat() if log.occurred_at else None,
                "actor_user_id": str(log.actor_user_id) if log.actor_user_id else None,
                "actor_role": log.actor_role,
                "action": log.action,
                "object_type": log.object_type,
                "object_id": log.object_id,
                "result": log.result,
                "reason": log.reason,
                "before_state": log.before_state,
                "after_state": log.after_state,
            })

        count_stmt = select(func.count(AuditEvent.id)).where(
            AuditEvent.action.in_([
                "ROLE_PERMISSIONS_UPDATE",
                "USER_ROLE_ASSIGN",
                "PERMISSION_GRANT",
                "RBAC_MATRIX_UPDATE",
                "PERMISSION_CHECK"
            ])
        )
        total_res = await self.db.execute(count_stmt)
        total = total_res.scalar() or 0

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "logs": output
        }
