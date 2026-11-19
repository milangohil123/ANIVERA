"""Service orchestrator for Offline Synchronisation domain.

Enforces:
- Verifiable offline authorization grant checking (max 7 days, configurable).
- Stable client-generated UUID idempotency.
- Independent event processing via nested transaction savepoints (partial success).
- Authoritative server-side scope & RBAC verification (never trusts client scope).
- Clinical and domain gates: FW primary registrar, VO fallback availability check,
  separate vaccinator authorization, and non-authoritative disease report intake.
- Explicit conflict logging into sync_conflicts without data loss.
- Payload preservation for rejected or conflicted events in sync_receipts.payload.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.core.security import create_offline_grant, decode_token
from app.models.geography import Village
from app.modules.animals.models import Animal, AnimalExternalIdentifier, AnimalQRToken
from app.modules.authentication.models import Device, User
from app.modules.authentication.repository import AuthRepository
from app.modules.authorization.service import AuthorizationService
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.farmers.models import Farmer
from app.modules.sync.models import SyncBatch, SyncConflict, SyncReceipt
from app.modules.sync.repository import SyncRepository
from app.modules.sync.schemas import (
    ConflictResolveRequest,
    OfflineGrantIssueRequest,
    OfflineGrantIssueResponse,
    ReferenceDataAnimal,
    ReferenceDataFarmer,
    ReferenceDataProgramme,
    ReferenceDataQrToken,
    ReferenceDataResponse,
    ReferenceDataSpecies,
    ReferenceDataVillage,
    SyncConflictItem,
    SyncEventAck,
    SyncEventItem,
    SyncPushRequest,
    SyncPushResponse,
    SyncStatusSummary,
)
from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail, TreatmentDetail, ObservationDetail
from app.modules.vaccinations.repository import VaccinationsRepository


class SyncService:
    """Coordinates batch synchronisation, validation, conflict detection, and receipts."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = SyncRepository(db)
        self.authz_service = AuthorizationService(db)
        self.vacc_repo = VaccinationsRepository(db)

    async def validate_offline_grant_and_device(
        self,
        current_user: User,
        device_id: uuid.UUID,
        offline_grant_token: Optional[str] = None
    ) -> Device:
        """Validate authenticated user, active device, and 7-day offline grant validity."""
        now = datetime.now(timezone.utc)

        # 1. User status check
        if current_user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {current_user.status.lower()}. Synchronisation denied."
            )

        # 2. Device fetch/upsert
        device = await self.repo.upsert_device(device_id=device_id, user_id=current_user.id)
        if device.status == "REVOKED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device access has been revoked by administration."
            )

        # 3. Offline grant validity verification
        max_validity = timedelta(days=settings.OFFLINE_AUTH_VALIDITY_DAYS)

        if offline_grant_token:
            try:
                payload = decode_token(offline_grant_token)
            except Exception as exc:
                logger.warning("Invalid offline grant token provided by user %s: %s", current_user.id, exc)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired offline authorization grant token. Online reauthentication required."
                )

            # Validate subject and device ID binding
            sub = payload.get("sub")
            token_device = payload.get("device_id")
            token_type = payload.get("type")
            exp = payload.get("exp")

            if token_type != "offline_grant":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type: offline authorization grant required."
                )

            if sub != str(current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Offline authorization grant subject mismatch."
                )
            if token_device and token_device != str(device_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Offline authorization grant is bound to a different device."
                )
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < now:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Offline authorization grant has expired. Online reauthentication is required."
                )

        # In addition, check user's last login window relative to server policy
        if current_user.last_login_at:
            if (now - current_user.last_login_at) > max_validity:
                logger.warning("User %s last login %s exceeds offline period %s", current_user.id, current_user.last_login_at, max_validity)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Offline authorization validity period has elapsed. Please login online to synchronise."
                )

        return device

    async def issue_offline_grant(
        self,
        current_user: User,
        req: OfflineGrantIssueRequest,
        client_ip: Optional[str] = None
    ) -> OfflineGrantIssueResponse:
        """Issue a 7-day verifiable offline authorization grant for an active user and device."""
        if current_user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {current_user.status.lower()}. Offline grant denied."
            )

        device = await self.repo.upsert_device(
            device_id=req.device_id,
            user_id=current_user.id,
            label=req.label
        )
        if device.status == "REVOKED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device access has been revoked by administration. Offline grant denied."
            )

        grant_token = create_offline_grant(
            subject=current_user.id,
            device_id=req.device_id,
            expires_delta=timedelta(days=settings.OFFLINE_AUTH_VALIDITY_DAYS)
        )
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=settings.OFFLINE_AUTH_VALIDITY_DAYS)

        await self.repo.record_audit_event(
            action="OFFLINE_GRANT_ISSUED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="device",
            object_id=str(req.device_id),
            reason=f"Issued {settings.OFFLINE_AUTH_VALIDITY_DAYS}-day offline authorization grant",
            ip=client_ip,
            device_id=req.device_id
        )
        await self.db.commit()

        return OfflineGrantIssueResponse(
            offline_grant=grant_token,
            token_type="Bearer",
            expires_at=expires_at,
            device_id=req.device_id,
            user_id=current_user.id,
            validity_days=settings.OFFLINE_AUTH_VALIDITY_DAYS
        )


    async def process_sync_push(
        self,
        request: SyncPushRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> SyncPushResponse:
        """Process a batch of offline events with isolated savepoint handling per event."""
        # 1. Authorize device & offline grant
        device = await self.validate_offline_grant_and_device(
            current_user=current_user,
            device_id=request.device_id,
            offline_grant_token=request.offline_grant
        )

        now = datetime.now(timezone.utc)
        # 2. Record sync batch
        batch = await self.repo.create_sync_batch(
            device_id=request.device_id,
            user_id=current_user.id,
            event_count=len(request.events),
            client_time=request.client_time
        )

        # Sort events by clientCreatedAt to maintain causal dependency order
        ordered_events = sorted(request.events, key=lambda e: e.client_created_at)

        results: List[SyncEventAck] = []
        accepted_count = 0
        already_accepted_count = 0
        rejected_count = 0
        needs_review_count = 0

        # Load user scope once for the batch
        scope = await self.authz_service.get_user_scope(current_user)

        # 3. Process each event inside an independent nested transaction savepoint
        for item in ordered_events:
            try:
                async with self.db.begin_nested():
                    ack = await self._process_single_event(
                        item=item,
                        current_user=current_user,
                        device=device,
                        batch=batch,
                        scope=scope,
                        client_ip=client_ip
                    )
            except Exception as exc:
                logger.error("Error processing sync event %s (%s): %s", item.event_id, item.type, exc)
                # Failed savepoint was cleanly rolled back on context manager exit.
                # In a new savepoint, record the REJECTED receipt with preserved payload.
                async with self.db.begin_nested():
                    await self.repo.create_sync_receipt(
                        event_id=item.event_id,
                        device_id=device.id,
                        user_id=current_user.id,
                        batch_id=batch.id,
                        event_type=item.type,
                        status="REJECTED",
                        code="PROCESSING_ERROR",
                        errors=[{"field": "general", "message": str(exc)}],
                        payload=item.payload
                    )
                ack = SyncEventAck(event_id=item.event_id, status="REJECTED", code="PROCESSING_ERROR")

            results.append(ack)
            if ack.status == "ACCEPTED":
                accepted_count += 1
            elif ack.status == "ALREADY_ACCEPTED":
                already_accepted_count += 1
            elif ack.status == "REJECTED":
                rejected_count += 1
            elif ack.status in ("NEEDS_REVIEW", "HELD_FOR_REVIEW"):
                needs_review_count += 1

        # 4. Update batch outcomes and device telemetry
        await self.repo.update_batch_outcomes(
            batch=batch,
            accepted=accepted_count,
            already_accepted=already_accepted_count,
            rejected=rejected_count,
            needs_review=needs_review_count
        )
        await self.repo.update_device_sync_telemetry(device=device)

        await self.repo.record_audit_event(
            action="SYNC_PUSH_PROCESSED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="sync_batch",
            object_id=str(batch.id),
            reason=f"Processed {len(ordered_events)} offline events: {accepted_count} accepted, {rejected_count} rejected, {needs_review_count} review",
            ip=client_ip,
            device_id=device.id
        )

        await self.db.commit()

        return SyncPushResponse(
            batch_id=batch.id,
            server_time=now,
            total_received=len(ordered_events),
            accepted_count=accepted_count,
            already_accepted_count=already_accepted_count,
            rejected_count=rejected_count,
            needs_review_count=needs_review_count,
            results=results
        )

    async def _process_single_event(
        self,
        item: SyncEventItem,
        current_user: User,
        device: Device,
        batch: SyncBatch,
        scope: Any,
        client_ip: Optional[str]
    ) -> SyncEventAck:
        """Process one event, returning a standard SyncEventAck."""
        event_id = item.event_id
        event_type = item.type.upper().strip()
        payload = item.payload

        # 1. Idempotency Check: check if event receipt exists
        existing_receipt = await self.repo.get_sync_receipt(event_id)
        if existing_receipt and existing_receipt.status in ("ACCEPTED", "ALREADY_ACCEPTED"):
            await self.repo.record_existing_receipt_revisit(existing_receipt, batch.id)
            return SyncEventAck(
                event_id=event_id,
                status="ALREADY_ACCEPTED",
                code="IDEMPOTENT_DUPLICATE",
                server_event_seq=None
            )

        # 2. Dispatch to domain processor
        if event_type == "FARMER_REGISTRATION":
            return await self._handle_farmer_registration(item, current_user, device, batch, scope, client_ip)
        elif event_type == "ANIMAL_REGISTRATION":
            return await self._handle_animal_registration(item, current_user, device, batch, scope, client_ip)
        elif event_type == "VACCINATION":
            return await self._handle_vaccination(item, current_user, device, batch, scope, client_ip)
        elif event_type in ("TREATMENT", "OBSERVATION"):
            return await self._handle_clinical_event(item, current_user, device, batch, scope, client_ip)
        elif event_type == "DISEASE_REPORT":
            return await self._handle_disease_report(item, current_user, device, batch, scope, client_ip)
        else:
            await self.repo.create_sync_receipt(
                event_id=event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type=event_type,
                status="REJECTED",
                code="UNRECOGNIZED_EVENT_TYPE",
                errors=[{"field": "type", "message": f"Unsupported sync event type '{event_type}'"}],
                payload=payload
            )
            return SyncEventAck(event_id=event_id, status="REJECTED", code="UNRECOGNIZED_EVENT_TYPE")

    async def _handle_farmer_registration(
        self,
        item: SyncEventItem,
        current_user: User,
        device: Device,
        batch: SyncBatch,
        scope: Any,
        client_ip: Optional[str]
    ) -> SyncEventAck:
        """Handle offline assisted farmer registration."""
        payload = item.payload
        village_id_raw = payload.get("village_id") or payload.get("villageId")
        if not village_id_raw:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="FARMER_REGISTRATION",
                status="REJECTED",
                code="MISSING_VILLAGE",
                errors=[{"field": "village_id", "message": "Village ID is mandatory"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="MISSING_VILLAGE")

        try:
            village_id = uuid.UUID(str(village_id_raw))
        except ValueError:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="FARMER_REGISTRATION",
                status="REJECTED",
                code="INVALID_VILLAGE_UUID",
                errors=[{"field": "village_id", "message": "Malformed village UUID"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="INVALID_VILLAGE_UUID")

        # Scope Check
        if not scope.can_access_village(village_id):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="FARMER_REGISTRATION",
                status="REJECTED",
                code="FORBIDDEN_SCOPE",
                errors=[{"field": "village_id", "message": "User is not assigned to this village"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FORBIDDEN_SCOPE")

        # Permission check
        if not scope.has_any_permission("farmer.register", "farmer.create"):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="FARMER_REGISTRATION",
                status="REJECTED",
                code="UNAUTHORIZED_ROLE",
                errors=[{"field": "permission", "message": "Missing farmer.register permission"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="UNAUTHORIZED_ROLE")

        full_name = payload.get("full_name") or payload.get("fullName", "")
        name_norm = " ".join(full_name.upper().split())
        mobile = payload.get("mobile_e164") or payload.get("mobileE164")

        # Create Farmer record
        farmer = Farmer(
            id=item.event_id,
            full_name=full_name,
            name_norm=name_norm,
            village_id=village_id,
            mobile_e164=mobile,
            mobile_status="UNVERIFIED" if mobile else "NONE",
            mobile_shared=bool(payload.get("mobile_shared", False)),
            has_smartphone=payload.get("has_smartphone", "UNKNOWN"),
            address_text=payload.get("address_text"),
            registration_status="SUBMITTED",
            registration_path=payload.get("registration_path", "STAFF_ASSISTED"),
            registered_by=current_user.id,
            data_consent_at=datetime.now(timezone.utc),
            outreach_consent=payload.get("outreach_consent", "UNKNOWN"),
            consent_basis=payload.get("consent_basis"),
            active=True,
            created_by=current_user.id
        )
        self.db.add(farmer)
        await self.db.flush()

        await self.repo.create_sync_receipt(
            event_id=item.event_id,
            device_id=device.id,
            user_id=current_user.id,
            batch_id=batch.id,
            event_type="FARMER_REGISTRATION",
            status="ACCEPTED",
            code="SUCCESS"
        )
        return SyncEventAck(event_id=item.event_id, status="ACCEPTED", code="SUCCESS")

    async def _handle_animal_registration(
        self,
        item: SyncEventItem,
        current_user: User,
        device: Device,
        batch: SyncBatch,
        scope: Any,
        client_ip: Optional[str]
    ) -> SyncEventAck:
        """Handle offline animal registration with FW-primary and VO-fallback enforcement."""
        payload = item.payload
        village_id_raw = payload.get("village_id") or payload.get("villageId")
        farmer_id_raw = payload.get("farmer_id") or payload.get("farmerId")

        if not village_id_raw or not farmer_id_raw:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="ANIMAL_REGISTRATION",
                status="REJECTED",
                code="MISSING_MANDATORY_FIELDS",
                errors=[{"field": "village_id/farmer_id", "message": "Village and Farmer IDs are mandatory"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="MISSING_MANDATORY_FIELDS")

        village_id = uuid.UUID(str(village_id_raw))
        farmer_id = uuid.UUID(str(farmer_id_raw))

        # Scope Check
        if not scope.can_access_village(village_id):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="ANIMAL_REGISTRATION",
                status="REJECTED",
                code="FORBIDDEN_SCOPE",
                errors=[{"field": "village_id", "message": "User is not assigned to this village"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FORBIDDEN_SCOPE")

        # VO Fallback Gate Check (TRD §6.4 & APPFLOW v0.4)
        if current_user.role == "VET_OFFICER":
            try:
                await self.authz_service.assert_vo_animal_fallback_eligibility(
                    user=current_user,
                    village_id=village_id,
                    ip=client_ip
                )
            except HTTPException as exc:
                # If FW is available or fallback is not authorized, record conflict for review
                conflict = await self.repo.create_sync_conflict(
                    event_id=item.event_id,
                    entity_type="ANIMAL",
                    entity_id=item.event_id,
                    conflict_type="POSSIBLE_DUPLICATE_EVENT",
                    details={
                        "reason": "VO_FALLBACK_NOT_ELIGIBLE",
                        "detail": exc.detail,
                        "village_id": str(village_id),
                        "payload": payload
                    }
                )
                await self.repo.create_sync_receipt(
                    event_id=item.event_id,
                    device_id=device.id,
                    user_id=current_user.id,
                    batch_id=batch.id,
                    event_type="ANIMAL_REGISTRATION",
                    status="NEEDS_REVIEW",
                    code="VO_FALLBACK_UNAUTHORIZED",
                    errors=[{"field": "role", "message": exc.detail}],
                    payload=payload
                )
                return SyncEventAck(
                    event_id=item.event_id,
                    status="NEEDS_REVIEW",
                    code="VO_FALLBACK_UNAUTHORIZED",
                    conflict_id=conflict.id
                )

        # Create Animal entity
        animal = Animal(
            id=item.event_id,
            species_code=payload.get("species_code", "CATTLE"),
            breed_id=uuid.UUID(str(payload["breed_id"])) if payload.get("breed_id") else None,
            sex=payload.get("sex", "UNKNOWN"),
            birth_date=date.fromisoformat(payload["birth_date"]) if payload.get("birth_date") else None,
            age_months_estimate=payload.get("age_months_estimate"),
            farmer_id=farmer_id,
            village_id=village_id,
            registration_status="SUBMITTED",
            status="ACTIVE",
            submission_source="FIELD_WORKER" if current_user.role == "FIELD_WORKER" else "VET_OFFICER",
            submitted_by=current_user.id,
            created_by=current_user.id
        )
        self.db.add(animal)
        await self.db.flush()

        candidate_tag = payload.get("tag_value") or payload.get("bharat_pashudhan_tag")
        if candidate_tag and str(candidate_tag).strip():
            import re
            cand_str = str(candidate_tag).strip()
            is_12_digit = bool(re.match(r"^\d{12}$", cand_str))
            tag_id_type = "BHARAT_PASHUDHAN_12" if (payload.get("bharat_pashudhan_tag") or is_12_digit) else "OTHER_EAR_TAG"
            ext_tag = AnimalExternalIdentifier(
                id=uuid.uuid4(),
                animal_id=animal.id,
                id_type=tag_id_type,
                id_value=cand_str,
                status="ACTIVE",
                recorded_by=current_user.id
            )
            self.db.add(ext_tag)
            await self.db.flush()

        # Ensure permanent Base32 QR token exists in animal_qr_tokens
        qr_token_val = payload.get("qr_token")
        if not qr_token_val:
            import re
            cand_u = str(candidate_tag or "").strip().upper()
            if re.match(r"^[A-Z2-7]{26}$", cand_u):
                qr_token_val = cand_u
            else:
                from app.modules.animals.service import generate_base32_qr_token
                qr_token_val = generate_base32_qr_token()

        qr_obj = AnimalQRToken(
            token=qr_token_val,
            animal_id=animal.id,
            status="ACTIVE",
            issued_by=current_user.id,
            issued_at=datetime.now(timezone.utc)
        )
        self.db.add(qr_obj)
        await self.db.flush()

        await self.repo.create_sync_receipt(
            event_id=item.event_id,
            device_id=device.id,
            user_id=current_user.id,
            batch_id=batch.id,
            event_type="ANIMAL_REGISTRATION",
            status="ACCEPTED",
            code="SUCCESS"
        )
        return SyncEventAck(event_id=item.event_id, status="ACCEPTED", code="SUCCESS")

    async def _handle_vaccination(
        self,
        item: SyncEventItem,
        current_user: User,
        device: Device,
        batch: SyncBatch,
        scope: Any,
        client_ip: Optional[str]
    ) -> SyncEventAck:
        """Handle offline vaccination record requiring independent vaccinator authorization."""
        payload = item.payload
        animal_id_raw = payload.get("animal_id") or payload.get("animalId")
        programme_code = payload.get("programme_code") or payload.get("programmeCode")
        event_date_raw = payload.get("event_date") or payload.get("eventDate") or payload.get("administeredOn")

        if not animal_id_raw or not programme_code or not event_date_raw:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="VACCINATION",
                status="REJECTED",
                code="MISSING_VACCINATION_FIELDS",
                errors=[{"field": "animal_id/programme_code/event_date", "message": "Required fields missing"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="MISSING_VACCINATION_FIELDS")

        animal_id = uuid.UUID(str(animal_id_raw))
        event_date = date.fromisoformat(str(event_date_raw))

        # Date validation: no future dates
        if event_date > date.today():
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="VACCINATION",
                status="REJECTED",
                code="FUTURE_DATE_NOT_PERMITTED",
                errors=[{"field": "event_date", "message": "Vaccination date cannot be in the future"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FUTURE_DATE_NOT_PERMITTED")

        # Fetch animal to verify village scope
        animal = await self.db.get(Animal, animal_id)
        if not animal:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="VACCINATION",
                status="REJECTED",
                code="ANIMAL_NOT_FOUND",
                errors=[{"field": "animal_id", "message": "Target animal does not exist"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="ANIMAL_NOT_FOUND")

        if not scope.can_access_village(animal.village_id):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="VACCINATION",
                status="REJECTED",
                code="FORBIDDEN_SCOPE",
                errors=[{"field": "village_id", "message": "Animal belongs to an unauthorized village"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FORBIDDEN_SCOPE")

        # Independent Vaccinator Authorization Check (TRD §6.4)
        is_auth = await self.vacc_repo.is_authorized_vaccinator(current_user.id, check_date=event_date)
        if not is_auth and current_user.role != "VET_OFFICER":
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="VACCINATION",
                status="REJECTED",
                code="UNAUTHORIZED_VACCINATOR",
                errors=[{"field": "vaccinator", "message": "User lacks approved vaccinator authorization"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="UNAUTHORIZED_VACCINATOR")

        # Create AnimalEvent + VaccinationDetail
        event = AnimalEvent(
            event_id=item.event_id,
            animal_id=animal.id,
            village_id=animal.village_id,
            event_type="VACCINATION",
            event_date=event_date,
            performed_by=current_user.id,
            device_id=device.id,
            client_created_at=item.client_created_at,
            source="SYNC",
            remarks=payload.get("remarks")
        )
        self.db.add(event)
        await self.db.flush()

        detail = VaccinationDetail(
            event_id=event.event_id,
            programme_code=programme_code,
            batch_number=payload.get("batch_number"),
            dose_note=payload.get("dose_note") or str(payload.get("dose_number", "")) if payload.get("dose_note") or payload.get("dose_number") else None,
            administered_by_user_id=current_user.id,
            authorization_check="AUTHORIZED" if is_auth else "NOT_CHECKED"
        )
        self.db.add(detail)
        await self.db.flush()

        await self.repo.create_sync_receipt(
            event_id=item.event_id,
            device_id=device.id,
            user_id=current_user.id,
            batch_id=batch.id,
            event_type="VACCINATION",
            status="ACCEPTED",
            code="SUCCESS"
        )
        return SyncEventAck(event_id=item.event_id, status="ACCEPTED", code="SUCCESS")

    async def _handle_clinical_event(
        self,
        item: SyncEventItem,
        current_user: User,
        device: Device,
        batch: SyncBatch,
        scope: Any,
        client_ip: Optional[str]
    ) -> SyncEventAck:
        """Handle treatment or observation clinical event sync."""
        payload = item.payload
        event_type = item.type.upper().strip()
        animal_id_raw = payload.get("animal_id") or payload.get("animalId")
        event_date_raw = payload.get("event_date") or payload.get("eventDate")

        if not animal_id_raw or not event_date_raw:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type=event_type,
                status="REJECTED",
                code="MISSING_FIELDS",
                errors=[{"field": "animal_id/event_date", "message": "Missing required fields"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="MISSING_FIELDS")

        animal_id = uuid.UUID(str(animal_id_raw))
        event_date = date.fromisoformat(str(event_date_raw))

        animal = await self.db.get(Animal, animal_id)
        if not animal:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type=event_type,
                status="REJECTED",
                code="ANIMAL_NOT_FOUND",
                errors=[{"field": "animal_id", "message": "Animal not found"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="ANIMAL_NOT_FOUND")

        if not scope.can_access_village(animal.village_id):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type=event_type,
                status="REJECTED",
                code="FORBIDDEN_SCOPE",
                errors=[{"field": "village_id", "message": "Unauthorized village"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FORBIDDEN_SCOPE")

        event = AnimalEvent(
            event_id=item.event_id,
            animal_id=animal.id,
            village_id=animal.village_id,
            event_type=event_type,
            event_date=event_date,
            performed_by=current_user.id,
            device_id=device.id,
            client_created_at=item.client_created_at,
            source="SYNC",
            remarks=payload.get("remarks")
        )
        self.db.add(event)
        await self.db.flush()

        if event_type == "TREATMENT":
            treat = TreatmentDetail(
                event_id=event.event_id,
                diagnosis_text=payload.get("diagnosis_text") or payload.get("diagnosis", "Treatment recorded offline"),
                treatment_text=payload.get("treatment_text") or payload.get("treatment", "Treatment administered offline"),
                medicine_text=payload.get("medicine_text"),
                follow_up_date=date.fromisoformat(str(payload["follow_up_date"])) if payload.get("follow_up_date") else None
            )
            self.db.add(treat)
        else:
            obs = ObservationDetail(
                event_id=event.event_id,
                symptoms=payload.get("symptoms") or [],
                notes=payload.get("notes") or payload.get("observation_text")
            )
            self.db.add(obs)

        await self.db.flush()

        await self.repo.create_sync_receipt(
            event_id=item.event_id,
            device_id=device.id,
            user_id=current_user.id,
            batch_id=batch.id,
            event_type=event_type,
            status="ACCEPTED",
            code="SUCCESS"
        )
        return SyncEventAck(event_id=item.event_id, status="ACCEPTED", code="SUCCESS")

    async def _handle_disease_report(
        self,
        item: SyncEventItem,
        current_user: User,
        device: Device,
        batch: SyncBatch,
        scope: Any,
        client_ip: Optional[str]
    ) -> SyncEventAck:
        """Handle offline disease report intake. Never auto-confirms outbreaks."""
        payload = item.payload
        village_id_raw = payload.get("village_id") or payload.get("villageId")
        disease_code = payload.get("disease_code") or payload.get("diseaseCode")
        report_date_raw = payload.get("report_date") or payload.get("reportDate")

        if not village_id_raw or not disease_code or not report_date_raw:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="DISEASE_REPORT",
                status="REJECTED",
                code="MISSING_REPORT_FIELDS",
                errors=[{"field": "disease_code/village_id/report_date", "message": "Required fields missing"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="MISSING_REPORT_FIELDS")

        # 1. Safe parsing of village_id UUID
        try:
            village_id = uuid.UUID(str(village_id_raw).strip())
        except (ValueError, TypeError):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="DISEASE_REPORT",
                status="REJECTED",
                code="INVALID_UUID_FORMAT",
                errors=[{"field": "village_id", "message": f"Invalid UUID format for village_id: '{village_id_raw}'"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="INVALID_UUID_FORMAT")

        # 2. Check village existence in database
        village = await self.db.get(Village, village_id)
        if not village:
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="DISEASE_REPORT",
                status="REJECTED",
                code="VILLAGE_NOT_FOUND",
                errors=[{"field": "village_id", "message": f"Village with ID '{village_id}' was not found."}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="VILLAGE_NOT_FOUND")

        # 3. Safe parsing of report_date
        try:
            date_str = str(report_date_raw).strip().split("T")[0]
            report_date = date.fromisoformat(date_str)
        except (ValueError, TypeError):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="DISEASE_REPORT",
                status="REJECTED",
                code="INVALID_DATE_FORMAT",
                errors=[{"field": "report_date", "message": f"Invalid ISO date format: '{report_date_raw}'"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="INVALID_DATE_FORMAT")

        # 4. Scope verification
        if not scope.can_access_village(village_id):
            await self.repo.create_sync_receipt(
                event_id=item.event_id,
                device_id=device.id,
                user_id=current_user.id,
                batch_id=batch.id,
                event_type="DISEASE_REPORT",
                status="REJECTED",
                code="FORBIDDEN_SCOPE",
                errors=[{"field": "village_id", "message": "Unauthorized village for report"}],
                payload=payload
            )
            return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FORBIDDEN_SCOPE")

        # 5. Safe parsing and existence check for optional animal_id
        parsed_animal_id: Optional[uuid.UUID] = None
        animal_id_raw = payload.get("animal_id") or payload.get("animalId")
        if animal_id_raw is not None and str(animal_id_raw).strip() and str(animal_id_raw).strip().lower() != "null":
            clean_animal_str = str(animal_id_raw).strip()
            try:
                parsed_animal_id = uuid.UUID(clean_animal_str)
            except (ValueError, TypeError):
                await self.repo.create_sync_receipt(
                    event_id=item.event_id,
                    device_id=device.id,
                    user_id=current_user.id,
                    batch_id=batch.id,
                    event_type="DISEASE_REPORT",
                    status="REJECTED",
                    code="INVALID_UUID_FORMAT",
                    errors=[{"field": "animal_id", "message": f"Invalid UUID format for animal_id: '{animal_id_raw}'"}],
                    payload=payload
                )
                return SyncEventAck(event_id=item.event_id, status="REJECTED", code="INVALID_UUID_FORMAT")

            animal = await self.db.get(Animal, parsed_animal_id)
            if not animal:
                await self.repo.create_sync_receipt(
                    event_id=item.event_id,
                    device_id=device.id,
                    user_id=current_user.id,
                    batch_id=batch.id,
                    event_type="DISEASE_REPORT",
                    status="REJECTED",
                    code="ANIMAL_NOT_FOUND",
                    errors=[{"field": "animal_id", "message": f"Animal with ID '{parsed_animal_id}' was not found."}],
                    payload=payload
                )
                return SyncEventAck(event_id=item.event_id, status="REJECTED", code="ANIMAL_NOT_FOUND")

        # 6. Safe parsing and existence check for optional farmer_id
        parsed_farmer_id: Optional[uuid.UUID] = None
        farmer_id_raw = payload.get("farmer_id") or payload.get("farmerId")
        if farmer_id_raw is not None and str(farmer_id_raw).strip() and str(farmer_id_raw).strip().lower() != "null":
            clean_farmer_str = str(farmer_id_raw).strip()
            try:
                parsed_farmer_id = uuid.UUID(clean_farmer_str)
            except (ValueError, TypeError):
                await self.repo.create_sync_receipt(
                    event_id=item.event_id,
                    device_id=device.id,
                    user_id=current_user.id,
                    batch_id=batch.id,
                    event_type="DISEASE_REPORT",
                    status="REJECTED",
                    code="INVALID_UUID_FORMAT",
                    errors=[{"field": "farmer_id", "message": f"Invalid UUID format for farmer_id: '{farmer_id_raw}'"}],
                    payload=payload
                )
                return SyncEventAck(event_id=item.event_id, status="REJECTED", code="INVALID_UUID_FORMAT")

            farmer = await self.db.get(Farmer, parsed_farmer_id)
            if not farmer:
                await self.repo.create_sync_receipt(
                    event_id=item.event_id,
                    device_id=device.id,
                    user_id=current_user.id,
                    batch_id=batch.id,
                    event_type="DISEASE_REPORT",
                    status="REJECTED",
                    code="FARMER_NOT_FOUND",
                    errors=[{"field": "farmer_id", "message": f"Farmer with ID '{parsed_farmer_id}' was not found."}],
                    payload=payload
                )
                return SyncEventAck(event_id=item.event_id, status="REJECTED", code="FARMER_NOT_FOUND")

        # 7. Map GPS coordinates satisfying CHECK ((latitude IS NULL) = (longitude IS NULL))
        parsed_lat: Optional[Decimal] = None
        parsed_lon: Optional[Decimal] = None
        lat_val = payload.get("latitude")
        lon_val = payload.get("longitude")
        if lat_val is not None and lon_val is not None:
            try:
                parsed_lat = Decimal(str(lat_val))
                parsed_lon = Decimal(str(lon_val))
            except Exception:
                parsed_lat = None
                parsed_lon = None

        # 8. Create report (strictly SUBMITTED pending clinical investigation)
        existing_report = await self.db.get(DiseaseReport, item.event_id)
        if not existing_report:
            report = DiseaseReport(
                report_id=item.event_id,
                animal_id=parsed_animal_id,
                farmer_id=parsed_farmer_id,
                village_id=village_id,
                disease_code=str(disease_code).strip(),
                report_source="FIELD_WORKER" if current_user.role == "FIELD_WORKER" else "VET_OFFICER",
                report_date=report_date,
                symptoms=payload.get("symptoms") if isinstance(payload.get("symptoms"), list) else [],
                observation_text=payload.get("observation_text"),
                latitude=parsed_lat,
                longitude=parsed_lon,
                reported_by=current_user.id,
                device_id=device.id,
                status="SUBMITTED"
            )
            self.db.add(report)
            await self.db.flush()

            # Notify assigned VOs in-app & simulated external dispatch
            try:
                from app.modules.notifications.service import NotificationService
                from app.modules.authorization.models import UserVillageAssignment
                notif_service = NotificationService(self.db)
                vil_res = await self.db.execute(select(Village.name_gu).where(Village.id == village_id))
                vil_name = vil_res.scalar_one_or_none() or "બોટાદ"

                vo_stmt = (
                    select(UserVillageAssignment.user_id)
                    .join(User, User.id == UserVillageAssignment.user_id)
                    .where(
                        UserVillageAssignment.village_id == village_id,
                        UserVillageAssignment.ended_at.is_(None),
                        User.role.in_(["VET_OFFICER", "VO"])
                    )
                )
                vo_res = await self.db.execute(vo_stmt)
                vo_ids = [row[0] for row in vo_res.fetchall()]
                if not vo_ids:
                    any_vo = await self.db.execute(select(User.id).where(User.role.in_(["VET_OFFICER", "VO"])).limit(3))
                    vo_ids = [row[0] for row in any_vo.fetchall()]

                for vo_id in vo_ids:
                    await notif_service.notify(
                        recipient_user_id=vo_id,
                        kind="REPORT_SUBMITTED",
                        message_key="REPORT_SUBMITTED",
                        params={
                            "village_name": vil_name,
                            "disease_name": report.disease_code,
                            "report_no": report.report_no or str(report.report_id)[:8]
                        },
                        related_type="disease_report",
                        related_id=str(report.report_id),
                        scope_village_id=village_id
                    )
            except Exception as n_err:
                logger.warning("Notification dispatch error on sync disease report: %s", n_err)

        await self.repo.create_sync_receipt(
            event_id=item.event_id,
            device_id=device.id,
            user_id=current_user.id,
            batch_id=batch.id,
            event_type="DISEASE_REPORT",
            status="ACCEPTED",
            code="SUCCESS"
        )
        return SyncEventAck(event_id=item.event_id, status="ACCEPTED", code="SUCCESS")

    async def get_sync_status(
        self,
        device_id: uuid.UUID,
        current_user: User
    ) -> SyncStatusSummary:
        """Fetch device synchronization health and open conflict counts."""
        device = await self.repo.upsert_device(device_id=device_id, user_id=current_user.id)
        open_conflicts = await self.repo.count_open_conflicts_for_device(device_id)
        total_batches = await self.repo.count_batches_for_device(device_id)

        return SyncStatusSummary(
            device_id=device.id,
            device_status=device.status,
            last_sync_at=device.last_sync_at,
            open_conflicts_count=open_conflicts,
            total_batches_synced=total_batches
        )

    async def list_conflicts(
        self,
        current_user: User,
        limit: int = 50
    ) -> List[SyncConflictItem]:
        """List open conflicts restricted to authorized clinical/administrative staff."""
        scope = await self.authz_service.get_user_scope(current_user)
        # Disallow operational conflict review by SYS_ADMIN
        if current_user.role == "SYS_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform administrator cannot perform clinical/operational conflict review."
            )

        conflicts = await self.repo.list_open_conflicts(limit=limit)
        return [SyncConflictItem.model_validate(c) for c in conflicts]

    async def resolve_conflict(
        self,
        conflict_id: uuid.UUID,
        req: ConflictResolveRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> SyncConflictItem:
        """Resolve a sync conflict with recorded justification."""
        if current_user.role not in ("VET_OFFICER", "DAHO"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Veterinary Officers or DAHO may resolve synchronization conflicts."
            )

        conflict = await self.repo.get_sync_conflict(conflict_id)
        if not conflict:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict record not found")

        await self.repo.resolve_conflict(
            conflict=conflict,
            resolution=f"{req.resolution}: {req.notes or 'No notes'}",
            resolved_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="SYNC_CONFLICT_RESOLVED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="sync_conflict",
            object_id=str(conflict.id),
            reason=f"Resolved conflict {conflict.conflict_type} as {req.resolution}",
            ip=client_ip
        )
        await self.db.commit()

        return SyncConflictItem.model_validate(conflict)

    async def get_reference_data(
        self,
        current_user: User,
        since: Optional[datetime] = None,
        client_ip: Optional[str] = None
    ) -> ReferenceDataResponse:
        """Fetch scoped reference data strictly derived from user's assignments."""
        now = datetime.now(timezone.utc)

        # 1. Authoritative server-side scope enforcement (never trust client)
        scope = await self.authz_service.get_user_scope(current_user)

        target_village_ids: Set[uuid.UUID] = set(scope.assigned_village_ids)

        if current_user.role == "DAHO":
            for dist_id in scope.assigned_district_ids:
                v_ids = await self.authz_service.repo.get_villages_in_district(dist_id)
                target_village_ids.update(v_ids)

        # Fallback for demo/development if no formal assignment was created
        if not target_village_ids:
            v_all = await self.db.execute(select(Village.id).where(Village.active == True).limit(20))
            target_village_ids = {row[0] for row in v_all.fetchall()}
            if not target_village_ids:
                v_all2 = await self.db.execute(select(Village.id).limit(20))
                target_village_ids = {row[0] for row in v_all2.fetchall()}

        # 2. Query villages
        v_stmt = select(Village).where(Village.id.in_(target_village_ids), Village.active == True)
        if since:
            v_stmt = v_stmt.where(Village.updated_at >= since)
        v_res = await self.db.execute(v_stmt)
        villages = [
            ReferenceDataVillage(
                id=v.id,
                code=v.code,
                name_gu=v.name_gu,
                name_en=v.name_en,
                taluka_id=v.taluka_id,
                district_id=v.district_id,
                latitude=float(v.latitude) if v.latitude is not None else None,
                longitude=float(v.longitude) if v.longitude is not None else None,
                active=v.active
            )
            for v in v_res.scalars().all()
        ]

        # 3. Query farmers in scope
        f_stmt = select(Farmer).where(Farmer.village_id.in_(target_village_ids), Farmer.active == True)
        if since:
            f_stmt = f_stmt.where(Farmer.updated_at >= since)
        f_res = await self.db.execute(f_stmt)
        farmers = [
            ReferenceDataFarmer(
                id=f.id,
                farmer_code=f.farmer_code,
                full_name=f.full_name,
                name_norm=f.name_norm,
                mobile_e164=f.mobile_e164,
                mobile_status=f.mobile_status,
                village_id=f.village_id,
                address_text=f.address_text,
                registration_status=f.registration_status,
                active=f.active,
                updated_at=f.updated_at
            )
            for f in f_res.scalars().all()
        ]

        # 4. Query animals in scope
        a_stmt = select(Animal).where(Animal.village_id.in_(target_village_ids), Animal.status == "ACTIVE")
        if since:
            a_stmt = a_stmt.where(Animal.updated_at >= since)
        a_res = await self.db.execute(a_stmt)
        animal_list = a_res.scalars().all()
        animal_ids = [a.id for a in animal_list]

        animals = [
            ReferenceDataAnimal(
                id=a.id,
                animal_code=a.animal_code,
                species_code=a.species_code,
                breed_id=a.breed_id,
                sex=a.sex or "UNKNOWN",
                birth_date=a.birth_date.isoformat() if a.birth_date else None,
                age_months_estimate=a.age_months_estimate,
                farmer_id=a.farmer_id,
                village_id=a.village_id,
                registration_status=a.registration_status,
                status=a.status,
                tag12=getattr(a, "tag12", None),
                updated_at=a.updated_at
            )
            for a in animal_list
        ]

        # 5. Query active QR tokens for animals in scope
        qr_tokens: List[ReferenceDataQrToken] = []
        if animal_ids:
            qr_stmt = select(AnimalQRToken).where(
                AnimalQRToken.animal_id.in_(animal_ids),
                AnimalQRToken.status == "ACTIVE"
            )
            qr_res = await self.db.execute(qr_stmt)
            qr_tokens = [
                ReferenceDataQrToken(
                    token=q.token,
                    animal_id=q.animal_id,
                    status=q.status
                )
                for q in qr_res.scalars().all()
            ]

        # 6. Master data: species & programmes
        sp_res = await self.db.execute(text("SELECT code, name_gu, name_en FROM species WHERE active = true"))
        species = [
            ReferenceDataSpecies(code=row[0], name_gu=row[1], name_en=row[2])
            for row in sp_res.fetchall()
        ]

        pr_res = await self.db.execute(text("SELECT code, name_en FROM programmes"))
        programmes = [
            ReferenceDataProgramme(code=row[0], name_en=row[1])
            for row in pr_res.fetchall()
        ]

        # 7. User permissions
        auth_repo = AuthRepository(self.db)
        _, _, permissions = await auth_repo.get_user_profile_data(current_user)

        return ReferenceDataResponse(
            server_time=now,
            since=since,
            offline_valid_days=settings.OFFLINE_AUTH_VALIDITY_DAYS,
            permissions=permissions,
            villages=villages,
            farmers=farmers,
            animals=animals,
            qr_tokens=qr_tokens,
            species=species,
            programmes=programmes
        )

