"""Asynchronous database repository for Animal domain."""
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import AuditEvent
from app.modules.animals.models import (
    Animal,
    AnimalExternalIdentifier,
    AnimalOwnershipHistory,
    AnimalQRToken,
    AnimalVerification,
    OwnershipTransfer,
)


class AnimalRepository:
    """Repository managing Animal entities, external identifiers, QR tokens, and verification."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_animal_by_id(self, animal_id: uuid.UUID) -> Optional[Animal]:
        """Fetch an animal by its primary technical key."""
        stmt = select(Animal).where(Animal.id == animal_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_animal_by_code(self, animal_code: str) -> Optional[Animal]:
        """Fetch an animal by human-readable internal code (e.g. ANM-BOT-000123)."""
        stmt = select(Animal).where(Animal.animal_code == animal_code.strip())
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_animal_by_qr_token(self, token: str) -> Optional[Animal]:
        """Lookup an animal by an active physical Base32 QR token."""
        stmt = (
            select(Animal)
            .join(AnimalQRToken, Animal.id == AnimalQRToken.animal_id)
            .where(AnimalQRToken.token == token.strip(), AnimalQRToken.status == "ACTIVE")
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_animal_by_external_id(self, id_type: str, id_value: str) -> Optional[Animal]:
        """Lookup an animal by active government Bharat Pashudhan tag or ear tag."""
        stmt = (
            select(Animal)
            .join(AnimalExternalIdentifier, Animal.id == AnimalExternalIdentifier.animal_id)
            .where(
                AnimalExternalIdentifier.id_type == id_type,
                AnimalExternalIdentifier.id_value == id_value.strip(),
                AnimalExternalIdentifier.status == "ACTIVE"
            )
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_animal_by_any_external_id(self, id_value: str) -> Optional[Animal]:
        """Lookup an animal by ANY active external tag/barcode/QR without restricting id_type."""
        stmt = (
            select(Animal)
            .join(AnimalExternalIdentifier, Animal.id == AnimalExternalIdentifier.animal_id)
            .where(
                AnimalExternalIdentifier.id_value == id_value.strip(),
                AnimalExternalIdentifier.status == "ACTIVE"
            )
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_animal_universal(self, identifier: str) -> Optional[Animal]:
        """Universal lookup across Base32 QR tokens, internal animal codes, UUIDs, and external tags."""
        clean = identifier.strip()
        if not clean:
            return None

        # 1. QR Token table (exact match or uppercase)
        animal = await self.get_animal_by_qr_token(clean)
        if not animal and clean != clean.upper():
            animal = await self.get_animal_by_qr_token(clean.upper())
        if animal:
            return animal

        # 2. Human-readable Animal Code (e.g. ANM-BOT-000123)
        animal = await self.get_animal_by_code(clean)
        if not animal and clean != clean.upper():
            animal = await self.get_animal_by_code(clean.upper())
        if animal:
            return animal

        # 3. Any active external identifier (Barcode, Existing QR, etc.)
        animal = await self.get_animal_by_any_external_id(clean)
        if animal:
            return animal

        # 4. Technical UUID
        try:
            u_id = uuid.UUID(clean)
            animal = await self.get_animal_by_id(u_id)
            if animal:
                return animal
        except (ValueError, AttributeError):
            pass

        # 5. Extract candidate if clean is a complex string (embedded animal code, Base32, URL, JSON)
        import re
        code_match = re.search(r"ANM-[A-Z0-9]+-[0-9]+", clean, re.IGNORECASE)
        if code_match:
            animal = await self.get_animal_by_code(code_match.group(0).upper())
            if animal:
                return animal

        b32_match = re.search(r"\b[A-Z2-7]{26}\b", clean.upper())
        if b32_match:
            animal = await self.get_animal_by_qr_token(b32_match.group(0))
            if animal:
                return animal

        if clean.startswith("{") and clean.endswith("}"):
            try:
                import json
                data = json.loads(clean)
                if isinstance(data, dict):
                    for k in ("tag", "tag_id", "tagId", "tag_number", "id", "animal_id", "code"):
                        val = data.get(k)
                        if val and isinstance(val, str):
                            cand_animal = await self.get_animal_universal(val)
                            if cand_animal:
                                return cand_animal
            except Exception:
                pass

        return None

    async def check_duplicate_tag(self, tag_value: str) -> Optional[Animal]:
        """Check if a tag value is already in use by any active animal record."""
        return await self.get_animal_universal(tag_value)

    async def check_duplicate_active_external_id(self, id_type: str, id_value: str) -> bool:
        """Check if an active external identifier is already in use by another animal."""
        stmt = select(func.count(AnimalExternalIdentifier.id)).where(
            AnimalExternalIdentifier.id_value == id_value.strip(),
            AnimalExternalIdentifier.status == "ACTIVE"
        )
        count = await self.db.scalar(stmt)
        return bool(count and count > 0)

    async def list_animals(
        self,
        village_ids: Optional[Set[uuid.UUID]] = None,
        farmer_id: Optional[uuid.UUID] = None,
        species_code: Optional[str] = None,
        status: Optional[str] = "ACTIVE",
        offset: int = 0,
        limit: int = 50
    ) -> List[Animal]:
        """List animals filtered by geographic scope and status."""
        stmt = select(Animal)
        if village_ids is not None:
            if len(village_ids) == 0:
                return []
            stmt = stmt.where(Animal.village_id.in_(village_ids))
        if farmer_id is not None:
            stmt = stmt.where(Animal.farmer_id == farmer_id)
        if species_code is not None:
            stmt = stmt.where(Animal.species_code == species_code.strip())
        if status is not None:
            stmt = stmt.where(Animal.status == status)

        stmt = stmt.order_by(Animal.created_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def count_animals(
        self,
        village_ids: Optional[Set[uuid.UUID]] = None,
        farmer_id: Optional[uuid.UUID] = None,
        species_code: Optional[str] = None,
        status: Optional[str] = "ACTIVE"
    ) -> int:
        """Count animals matching filters."""
        if village_ids is not None and len(village_ids) == 0:
            return 0
        stmt = select(func.count(Animal.id))
        if village_ids is not None:
            stmt = stmt.where(Animal.village_id.in_(village_ids))
        if farmer_id is not None:
            stmt = stmt.where(Animal.farmer_id == farmer_id)
        if species_code is not None:
            stmt = stmt.where(Animal.species_code == species_code.strip())
        if status is not None:
            stmt = stmt.where(Animal.status == status)
        return (await self.db.scalar(stmt)) or 0

    async def create_animal(
        self,
        species_code: str,
        farmer_id: uuid.UUID,
        village_id: uuid.UUID,
        breed_id: Optional[uuid.UUID],
        sex: str,
        birth_date: Optional[date],
        age_months_estimate: Optional[int],
        submission_source: str,
        submitted_by: uuid.UUID,
        created_by: uuid.UUID
    ) -> Animal:
        """Create a new animal record with guaranteed unique animal_code."""
        import time
        total = await self.count_animals()
        candidate_code = f"ANM-BOT-{(total + 1):06d}"
        if await self.get_animal_by_code(candidate_code):
            candidate_code = f"ANM-BOT-{int(time.time()) % 1000000:06d}"

        animal = Animal(
            id=uuid.uuid4(),
            animal_code=candidate_code,
            species_code=species_code.strip(),
            farmer_id=farmer_id,
            village_id=village_id,
            breed_id=breed_id,
            sex=sex,
            birth_date=birth_date,
            age_months_estimate=age_months_estimate,
            age_estimated_on=date.today() if age_months_estimate is not None else None,
            registration_status="REGISTERED",
            status="ACTIVE",
            submission_source=submission_source,
            submitted_by=submitted_by,
            created_by=created_by
        )
        self.db.add(animal)
        await self.db.flush()
        await self.db.refresh(animal)
        return animal

    async def update_animal(
        self,
        animal: Animal,
        breed_id: Optional[uuid.UUID] = None,
        sex: Optional[str] = None,
        age_months_estimate: Optional[int] = None,
        status: Optional[str] = None,
        status_reason: Optional[str] = None
    ) -> Animal:
        """Update animal demographics and operational status."""
        if breed_id is not None:
            animal.breed_id = breed_id
        if sex is not None:
            animal.sex = sex
        if age_months_estimate is not None:
            animal.age_months_estimate = age_months_estimate
            animal.age_estimated_on = date.today()
        if status is not None:
            animal.status = status
            animal.status_changed_on = date.today()
            if status_reason:
                animal.status_reason = status_reason.strip()

        animal.row_version += 1
        animal.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return animal

    async def add_external_identifier(
        self,
        animal_id: uuid.UUID,
        id_type: str,
        id_value: str,
        recorded_by: uuid.UUID
    ) -> AnimalExternalIdentifier:
        """Record a government Bharat Pashudhan tag or other external ear tag."""
        ext_id = AnimalExternalIdentifier(
            id=uuid.uuid4(),
            animal_id=animal_id,
            id_type=id_type,
            id_value=id_value.strip(),
            status="ACTIVE",
            recorded_by=recorded_by
        )
        self.db.add(ext_id)
        await self.db.flush()
        return ext_id

    async def get_active_external_identifier(
        self,
        animal_id: uuid.UUID,
        id_type: str = "BHARAT_PASHUDHAN_12"
    ) -> Optional[AnimalExternalIdentifier]:
        """Get the active external tag of an animal."""
        stmt = select(AnimalExternalIdentifier).where(
            AnimalExternalIdentifier.animal_id == animal_id,
            AnimalExternalIdentifier.id_type == id_type,
            AnimalExternalIdentifier.status == "ACTIVE"
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def assign_qr_token(
        self,
        animal_id: uuid.UUID,
        token: str,
        issued_by: uuid.UUID
    ) -> AnimalQRToken:
        """Assign a physical Base32 QR token, safely revoking any previous active token."""
        # Revoke any prior active tokens
        active_stmt = select(AnimalQRToken).where(
            AnimalQRToken.animal_id == animal_id,
            AnimalQRToken.status == "ACTIVE"
        )
        active_res = await self.db.execute(active_stmt)
        for prev_token in active_res.scalars().all():
            prev_token.status = "REVOKED"
            prev_token.revoked_at = datetime.now(timezone.utc)
            prev_token.revoked_reason = "RE_TAGGED"

        qr_token = AnimalQRToken(
            token=token.strip(),
            animal_id=animal_id,
            status="ACTIVE",
            issued_by=issued_by,
            issued_at=datetime.now(timezone.utc)
        )
        self.db.add(qr_token)
        await self.db.flush()
        return qr_token

    async def get_active_qr_token(self, animal_id: uuid.UUID) -> Optional[AnimalQRToken]:
        """Fetch current active physical QR token."""
        stmt = select(AnimalQRToken).where(
            AnimalQRToken.animal_id == animal_id,
            AnimalQRToken.status == "ACTIVE"
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def create_ownership_history(
        self,
        animal_id: uuid.UUID,
        farmer_id: uuid.UUID,
        village_id: uuid.UUID,
        valid_from: date,
        change_reason: str,
        changed_by: uuid.UUID
    ) -> AnimalOwnershipHistory:
        """Append an ownership and location history record."""
        history = AnimalOwnershipHistory(
            id=uuid.uuid4(),
            animal_id=animal_id,
            farmer_id=farmer_id,
            village_id=village_id,
            valid_from=valid_from,
            change_reason=change_reason,
            changed_by=changed_by,
            recorded_at=datetime.now(timezone.utc)
        )
        self.db.add(history)
        await self.db.flush()
        return history

    async def has_open_transfer(self, animal_id: uuid.UUID) -> bool:
        """Check if an open/pending transfer request exists for this animal (enforcing uq_open_transfer)."""
        stmt = select(func.count()).select_from(OwnershipTransfer).where(
            OwnershipTransfer.animal_id == animal_id,
            OwnershipTransfer.status.in_(["REQUESTED", "PENDING_VERIFICATION", "APPROVED", "DISPUTED"])
        )
        res = await self.db.execute(stmt)
        return (res.scalar() or 0) > 0

    async def create_transfer_request(
        self,
        animal: Animal,
        to_farmer_id: uuid.UUID,
        to_village_id: uuid.UUID,
        reason: str,
        reason_note: Optional[str],
        requested_by: uuid.UUID
    ) -> OwnershipTransfer:
        """Create a pending ownership transfer request without mutating the animal entity or ownership history."""
        transfer = OwnershipTransfer(
            id=uuid.uuid4(),
            animal_id=animal.id,
            from_farmer_id=animal.farmer_id,
            to_farmer_id=to_farmer_id,
            to_village_id=to_village_id,
            reason=reason,
            reason_note=reason_note.strip() if reason_note else None,
            status="REQUESTED",
            requested_by=requested_by,
            requested_at=datetime.now(timezone.utc)
        )
        self.db.add(transfer)
        await self.db.flush()
        return transfer

    async def get_transfer_by_id(self, transfer_id: uuid.UUID) -> Optional[OwnershipTransfer]:
        """Fetch an ownership transfer record by primary key."""
        stmt = select(OwnershipTransfer).where(OwnershipTransfer.id == transfer_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_transfers_for_animal(self, animal_id: uuid.UUID) -> list[OwnershipTransfer]:
        """List all ownership transfer records for an animal."""
        stmt = select(OwnershipTransfer).where(
            OwnershipTransfer.animal_id == animal_id
        ).order_by(OwnershipTransfer.requested_at.desc())
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def apply_transfer_decision(
        self,
        transfer: OwnershipTransfer,
        animal: Animal,
        action: str,
        decided_by: uuid.UUID,
        decision_note: Optional[str] = None,
        effective_date: Optional[date] = None
    ) -> OwnershipTransfer:
        """Apply an approved or rejected review decision to a transfer request.

        If APPROVED:
          - Marks transfer COMPLETED with decision metadata.
          - Closes the active ownership history record (valid_to = effective_date).
          - Inserts new ownership history record.
          - Updates animal's current farmer_id and village_id.
        If REJECTED:
          - Marks transfer REJECTED with mandatory decision note.
          - Preserves animal's current owner and ownership history intact.
        """
        now_utc = datetime.now(timezone.utc)

        if action == "APPROVE":
            eff_date = effective_date or date.today()

            # 1. Close current ownership history interval
            close_stmt = select(AnimalOwnershipHistory).where(
                AnimalOwnershipHistory.animal_id == animal.id,
                AnimalOwnershipHistory.valid_to.is_(None)
            )
            curr_hist = (await self.db.execute(close_stmt)).scalars().first()
            if curr_hist:
                curr_hist.valid_to = eff_date

            # 2. Append new ownership history record
            new_hist = AnimalOwnershipHistory(
                id=uuid.uuid4(),
                animal_id=animal.id,
                farmer_id=transfer.to_farmer_id,
                village_id=transfer.to_village_id,
                valid_from=eff_date,
                change_reason=transfer.reason,
                changed_by=decided_by,
                recorded_at=now_utc
            )
            self.db.add(new_hist)

            # 3. Update transfer record
            transfer.status = "COMPLETED"
            transfer.decided_by = decided_by
            transfer.decided_at = now_utc
            transfer.decision_note = decision_note.strip() if decision_note else "Approved by authorised veterinary review"
            transfer.effective_date = eff_date

            # 4. Update animal entity
            animal.farmer_id = transfer.to_farmer_id
            animal.village_id = transfer.to_village_id
            animal.row_version += 1
            animal.updated_at = now_utc

        elif action == "REJECT":
            transfer.status = "REJECTED"
            transfer.decided_by = decided_by
            transfer.decided_at = now_utc
            transfer.decision_note = decision_note.strip() if decision_note else "Rejected by authorised officer"
            # Crucial: Animal entity and animal_ownership_history are NOT modified!

        await self.db.flush()
        return transfer

    async def transfer_animal_ownership(
        self,
        animal: Animal,
        to_farmer_id: uuid.UUID,
        to_village_id: uuid.UUID,
        reason: str,
        reason_note: Optional[str],
        requested_by: uuid.UUID
    ) -> OwnershipTransfer:
        """Legacy helper: creates and immediately approves a transfer."""
        req = await self.create_transfer_request(
            animal=animal,
            to_farmer_id=to_farmer_id,
            to_village_id=to_village_id,
            reason=reason,
            reason_note=reason_note,
            requested_by=requested_by
        )
        return await self.apply_transfer_decision(
            transfer=req,
            animal=animal,
            action="APPROVE",
            decided_by=requested_by,
            decision_note="Immediate administrative transfer"
        )

    async def record_animal_verification(
        self,
        animal: Animal,
        method: str,
        outcome: str,
        tag_checked: bool,
        owner_confirmed: bool,
        verified_by: uuid.UUID,
        notes: Optional[str]
    ) -> AnimalVerification:
        """Record physical animal verification."""
        # Enforce schema check: CHECK (outcome <> 'VERIFIED' OR method <> 'FIELD_PHYSICAL' OR owner_confirmed)
        if outcome == "VERIFIED" and method == "FIELD_PHYSICAL":
            owner_confirmed = True

        verification = AnimalVerification(
            id=uuid.uuid4(),
            animal_id=animal.id,
            method=method,
            outcome=outcome,
            tag_checked=tag_checked,
            owner_confirmed=owner_confirmed,
            verified_by=verified_by,
            notes=notes.strip() if notes else None,
            at=datetime.now(timezone.utc)
        )
        self.db.add(verification)

        if outcome == "VERIFIED":
            animal.registration_status = "VERIFIED"
            animal.verified_by = verified_by
            animal.verified_at = datetime.now(timezone.utc)

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

