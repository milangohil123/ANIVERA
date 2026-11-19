"""Animal Management Service.

Coordinates:
- Field Worker primary animal registration (animal.create in assigned village)
- Veterinary Officer fallback animal registration (animal.create.fallback requiring formal FW unavailability)
- Ownership history tracking and transfers
- Physical Bharat Pashudhan 12-digit ear tag validation and duplicate prevention (HTTP 409)
- Physical cryptographic Base32 QR tag token lifecycle
- Physical field verification recording
- Immutable security audit trails
"""
import base64
import logging
import os
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import Village
from app.models.reference import Species, Programme
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
from app.modules.animals.models import Animal, AnimalExternalIdentifier
from app.modules.animals.repository import AnimalRepository
from app.modules.animals.schemas import (
    AnimalCreate,
    AnimalDetailResponse,
    AnimalDiseaseHistoryItem,
    AnimalExternalIdCreate,
    AnimalExternalIdResponse,
    AnimalHistoryResponse,
    AnimalOwnershipTransferRequest,
    AnimalOwnershipTransferResponse,
    AnimalQRTokenAssignRequest,
    AnimalQRTokenResponse,
    AnimalResponse,
    AnimalTransferDecisionRequest,
    AnimalUpdate,
    AnimalVaccinationHistoryItem,
    AnimalVerificationRequest,
    AnimalVerificationResponse,
    TagCheckResponse,
)
from app.modules.campaigns.models import Campaign
from app.modules.disease_surveillance.models import DiseaseReport, DiseaseReportAttachment
from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail

logger = logging.getLogger("pashurakshak.animals.service")


def generate_base32_qr_token() -> str:
    """Generate a random 16-byte RFC 4648 Base32 token (26 characters, no padding)."""
    random_bytes = os.urandom(16)
    return base64.b32encode(random_bytes).decode("ascii").rstrip("=")


class AnimalService:
    """Service handling animal lifecycle, registration rules, tagging, and transfers."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AnimalRepository(db)
        self.authz_service = AuthorizationService(db)

    async def list_animals(
        self,
        current_user: User,
        village_id: Optional[uuid.UUID] = None,
        farmer_id: Optional[uuid.UUID] = None,
        species_code: Optional[str] = None,
        status_filter: Optional[str] = "ACTIVE",
        offset: int = 0,
        limit: int = 50
    ) -> List[AnimalResponse]:
        """List animals within caller's verified geographic and ownership scope."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.read", "own.read", "aggregate.view"]
        )
        scope = await self.authz_service.get_user_scope(current_user)

        target_village_ids: Optional[Set[uuid.UUID]] = None

        if current_user.role == "FARMER":
            # Farmer is restricted strictly to animals owned by their linked profiles
            animals = []
            for fid in scope.linked_farmer_ids:
                f_animals = await self.repo.list_animals(
                    village_ids=None,
                    farmer_id=fid,
                    species_code=species_code,
                    status=status_filter,
                    offset=offset,
                    limit=limit
                )
                animals.extend(f_animals)
            return [AnimalResponse.model_validate(a) for a in animals]

        elif current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            target_village_ids = scope.assigned_village_ids
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}

        elif current_user.role == "DAHO":
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}
            else:
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
            if village_id:
                await self.authz_service.assert_village_scope(current_user, village_id)
                target_village_ids = {village_id}

        animals = await self.repo.list_animals(
            village_ids=target_village_ids,
            farmer_id=farmer_id,
            species_code=species_code,
            status=status_filter,
            offset=offset,
            limit=limit
        )
        return [AnimalResponse.model_validate(a) for a in animals]

    async def get_animal(
        self,
        animal_id: uuid.UUID,
        current_user: User
    ) -> AnimalDetailResponse:
        """Fetch complete animal details including active tags and owner information."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.read", "own.read", "aggregate.view"]
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        # Verify scope
        scope = await self.authz_service.get_user_scope(current_user)
        if current_user.role == "FARMER":
            if animal.farmer_id not in scope.linked_farmer_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: not your animal record")
        elif current_user.role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO"):
            if animal.village_id not in scope.assigned_village_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: animal outside assigned villages")
        elif current_user.role == "DAHO":
            await self.authz_service.assert_village_scope(current_user, animal.village_id)
        elif current_user.role == "DAIRY_STAFF":
            if animal.village_id not in scope.cooperative_village_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: village not served by your cooperative")

        stmt_ext = (
            select(AnimalExternalIdentifier)
            .where(
                AnimalExternalIdentifier.animal_id == animal.id,
                AnimalExternalIdentifier.status == "ACTIVE"
            )
            .order_by(AnimalExternalIdentifier.recorded_at.desc())
        )
        ext_tag = (await self.db.execute(stmt_ext)).scalars().first()
        qr = await self.repo.get_active_qr_token(animal.id)

        # Lookup farmer and village names
        farmer = await self.db.get(Farmer, animal.farmer_id)
        village = await self.db.get(Village, animal.village_id)

        return AnimalDetailResponse(
            id=animal.id,
            animal_code=animal.animal_code,
            species_code=animal.species_code,
            breed_id=animal.breed_id,
            sex=animal.sex,
            age_months_estimate=animal.age_months_estimate,
            farmer_id=animal.farmer_id,
            village_id=animal.village_id,
            registration_status=animal.registration_status,
            status=animal.status,
            created_at=animal.created_at,
            updated_at=animal.updated_at,
            birth_date=animal.birth_date,
            age_estimated_on=animal.age_estimated_on,
            status_changed_on=animal.status_changed_on,
            status_reason=animal.status_reason,
            submission_source=animal.submission_source,
            submitted_by=animal.submitted_by,
            verified_by=animal.verified_by,
            verified_at=animal.verified_at,
            active_tag=ext_tag.id_value if ext_tag else None,
            active_qr_token=qr.token if qr else None,
            farmer_name=farmer.full_name if farmer else None,
            farmer_code=farmer.farmer_code if farmer else None,
            village_name=village.name_en if village else None
        )

    async def get_animal_history(
        self,
        animal_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalHistoryResponse:
        """Fetch complete chronological medical, vaccination, and surveillance history for an animal."""
        # 1. Fetch verified animal details (handles permission and village scope check)
        animal_detail = await self.get_animal(animal_id, current_user)

        # 2. Query vaccination history
        vax_stmt = (
            select(AnimalEvent, VaccinationDetail)
            .join(VaccinationDetail, AnimalEvent.event_id == VaccinationDetail.event_id)
            .where(
                AnimalEvent.animal_id == animal_id,
                AnimalEvent.event_type == "VACCINATION"
            )
            .order_by(AnimalEvent.event_date.desc(), AnimalEvent.received_at.desc())
        )
        vax_res = await self.db.execute(vax_stmt)
        vax_rows = vax_res.all()

        campaign_ids = {vd.campaign_id for _, vd in vax_rows if vd.campaign_id}
        camp_ids = {vd.camp_id for _, vd in vax_rows if vd.camp_id}
        campaign_map: dict[uuid.UUID, str] = {}
        camp_map: dict[uuid.UUID, str] = {}

        if campaign_ids:
            c_res = await self.db.execute(select(Campaign.id, Campaign.name).where(Campaign.id.in_(campaign_ids)))
            for cid, cname in c_res.all():
                campaign_map[cid] = cname

        if camp_ids:
            from app.modules.camps.models import Camp
            cp_res = await self.db.execute(select(Camp.id, Camp.camp_code).where(Camp.id.in_(camp_ids)))
            for cpid, ccode in cp_res.all():
                camp_map[cpid] = ccode

        PROG_NAMES_GU = {
            "FMD": "ખરવા-મોવાસા (FMD)",
            "HS": "ગળસૂંઠો (HS)",
            "BQ": "ગાઠીયો તાવ (BQ)",
            "BRUCELLOSIS": "બ્રુસેલોસિસ (Brucellosis)",
            "PPR": "પીપીઆર (PPR)",
            "LSD": "લમ્પી સ્કીન ડીસીઝ (LSD)",
            "RABIES": "હડકવા (Rabies)"
        }

        vax_items: list[AnimalVaccinationHistoryItem] = []
        for ev, vd in vax_rows:
            vax_items.append(
                AnimalVaccinationHistoryItem(
                    event_id=ev.event_id,
                    programme_code=vd.programme_code,
                    programme_name_gu=PROG_NAMES_GU.get(vd.programme_code.upper(), vd.programme_code),
                    event_date=ev.event_date,
                    batch_number=vd.batch_number,
                    dose_note=vd.dose_note,
                    administered_by_name=vd.administered_by_name,
                    campaign_id=vd.campaign_id,
                    campaign_name=campaign_map.get(vd.campaign_id) if vd.campaign_id else None,
                    camp_id=vd.camp_id,
                    camp_code=camp_map.get(vd.camp_id) if vd.camp_id else None,
                    authorization_check=vd.authorization_check,
                    review_status=ev.review_status,
                    remarks=ev.remarks
                )
            )

        # 3. Query disease surveillance history
        dis_stmt = (
            select(DiseaseReport, User.full_name)
            .outerjoin(User, DiseaseReport.reported_by == User.id)
            .where(DiseaseReport.animal_id == animal_id)
            .order_by(DiseaseReport.report_date.desc(), DiseaseReport.received_at.desc())
        )
        dis_res = await self.db.execute(dis_stmt)
        dis_rows = dis_res.all()

        report_ids = [dr.report_id for dr, _ in dis_rows]
        attach_map: dict[uuid.UUID, list[uuid.UUID]] = {rid: [] for rid in report_ids}
        if report_ids:
            att_stmt = select(DiseaseReportAttachment.id, DiseaseReportAttachment.report_id).where(
                DiseaseReportAttachment.report_id.in_(report_ids)
            )
            att_res = await self.db.execute(att_stmt)
            for att_id, r_id in att_res.all():
                attach_map[r_id].append(att_id)

        DISEASE_NAMES_GU = {
            "FMD": "ખરવા-મોવાસા (FMD)",
            "LSD": "લમ્પી સ્કીન ડીસીઝ (LSD)",
            "ANTHRAX": "એન્થ્રેક્સ (Anthrax)",
            "HS": "ગળસૂંઠો (HS)",
            "BQ": "ગાઠીયો તાવ (BQ)",
            "BRUCELLOSIS": "બ્રુસેલોસિસ (Brucellosis)",
            "PPR": "પીપીઆર (PPR)",
            "RABIES": "હડકવા (Rabies)",
            "UNKNOWN": "અજ્ઞાત રોગ / શંકાસ્પદ"
        }

        disease_items: list[AnimalDiseaseHistoryItem] = []
        for dr, reporter_name in dis_rows:
            disease_items.append(
                AnimalDiseaseHistoryItem(
                    report_id=dr.report_id,
                    report_no=dr.report_no,
                    disease_code=dr.disease_code,
                    disease_name_gu=DISEASE_NAMES_GU.get(dr.disease_code.upper(), dr.disease_code),
                    report_date=dr.report_date,
                    symptoms=dr.symptoms or [],
                    observation_text=dr.observation_text,
                    status=dr.status,
                    reported_by_name=reporter_name,
                    confirmed_at=dr.confirmed_at,
                    confirmation_basis=dr.confirmation_basis,
                    attachment_ids=attach_map.get(dr.report_id, [])
                )
            )

        return AnimalHistoryResponse(
            animal=animal_detail,
            vaccinations=vax_items,
            disease_reports=disease_items,
            total_vaccinations=len(vax_items),
            total_disease_reports=len(disease_items)
        )

    async def lookup_by_qr(self, token: str, current_user: User) -> AnimalDetailResponse:
        """Universal field resolution: lookup animal by physical Base32 QR token or any unique identifier."""
        clean_token = token.strip()
        animal = await self.repo.get_animal_universal(clean_token)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="આ QR ટોકન અથવા ઓળખ નંબર સાથે કોઈ પશુ મળ્યું નથી.")
        return await self.get_animal(animal.id, current_user)

    async def lookup_by_tag(self, tag_value: str, current_user: User) -> AnimalDetailResponse:
        """Universal field resolution: lookup animal by physical ear tag, barcode, or any identifier."""
        clean_tag = tag_value.strip()
        animal = await self.repo.get_animal_universal(clean_tag)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="આ ટેગ અથવા બારકોડ નંબર સાથે કોઈ પશુ મળ્યું નથી.")
        return await self.get_animal(animal.id, current_user)

    async def check_tag(self, tag_value: str, current_user: User) -> TagCheckResponse:
        """Check whether a physical ear tag, barcode, or QR code is already registered in PashuRakshak."""
        clean_tag = tag_value.strip()
        if not clean_tag:
            return TagCheckResponse(
                is_registered=False,
                tag_value=clean_tag,
                message="કોઈ ટેગ નંબર દાખલ કરવામાં આવ્યો નથી."
            )

        animal = await self.repo.check_duplicate_tag(clean_tag)
        if animal:
            try:
                detail = await self.get_animal(animal.id, current_user)
            except Exception:
                detail = None

            return TagCheckResponse(
                is_registered=True,
                tag_value=clean_tag,
                message=f"આ Tag પહેલેથી જ પશુ {animal.animal_code or 'નોંધાયેલ'} માટે PashuRakshak માં સક્રિય છે!",
                animal=detail
            )

        return TagCheckResponse(
            is_registered=False,
            tag_value=clean_tag,
            message="આ Tag ઉપલબ્ધ છે અને નવી નોંધણી માટે વાપરી શકાય છે."
        )

    async def register_animal(
        self,
        payload: AnimalCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalDetailResponse:
        """Register a new livestock animal enforcing primary vs fallback authority rules.
        
        - FIELD_WORKER: Primary registrar holding 'animal.create' within assigned village.
        - VET_OFFICER: Fallback-only registrar holding 'animal.create.fallback'.
                       Must verify formal FW unavailability in field_worker_availability_records.
        """
        submission_source: str

        if current_user.role in ("FIELD_WORKER", "FW"):
            await self.authz_service.assert_permission(current_user, "animal.create", ip=client_ip)
            await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)
            submission_source = "FIELD_WORKER"

        elif current_user.role in ("VET_OFFICER", "VO"):
            await self.authz_service.assert_permission(current_user, "animal.create.fallback", ip=client_ip)
            await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)
            # Strict fallback prerequisite enforcement
            await self.authz_service.assert_vo_animal_fallback_eligibility(
                user=current_user,
                village_id=payload.village_id,
                ip=client_ip
            )
            submission_source = "VET_OFFICER"

        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized to register animals"
            )

        # 1. Validate species
        species_stmt = select(Species).where(Species.code == payload.species_code.strip())
        species = (await self.db.execute(species_stmt)).scalars().first()
        if not species:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid species code '{payload.species_code}'"
            )

        # 2. Validate farmer exists and belongs to the registered village
        farmer = await self.db.get(Farmer, payload.farmer_id)
        if not farmer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owner farmer record not found"
            )
        if farmer.village_id != payload.village_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Animal village must match the owner farmer's registered village"
            )

        # 3. Determine candidate physical tag value & check duplicates
        candidate_tag = payload.tag_value.strip() if payload.tag_value else None
        if not candidate_tag and payload.bharat_pashudhan_tag:
            candidate_tag = payload.bharat_pashudhan_tag.strip()

        if candidate_tag:
            dup_animal = await self.repo.check_duplicate_tag(candidate_tag)
            if dup_animal:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"આ Tag '{candidate_tag}' પહેલેથી જ પશુ {dup_animal.animal_code or ''} સાથે નોંધાયેલ છે"
                )

        # 4. Handle QR token - ensure every registered animal receives an active Base32 cryptographic QR token
        import re
        qr_token_to_assign = payload.qr_token
        if not qr_token_to_assign:
            if candidate_tag and re.match(r"^[A-Z2-7]{26}$", candidate_tag.upper()):
                qr_token_to_assign = candidate_tag.upper()
            else:
                qr_token_to_assign = generate_base32_qr_token()

        if qr_token_to_assign:
            existing_qr = await self.repo.get_animal_by_qr_token(qr_token_to_assign)
            if existing_qr:
                qr_token_to_assign = generate_base32_qr_token()

        # 5. Create Animal record
        animal = await self.repo.create_animal(
            species_code=payload.species_code,
            farmer_id=payload.farmer_id,
            village_id=payload.village_id,
            breed_id=payload.breed_id,
            sex=payload.sex,
            birth_date=payload.birth_date,
            age_months_estimate=payload.age_months_estimate,
            submission_source=submission_source,
            submitted_by=current_user.id,
            created_by=current_user.id
        )

        # 6. Append Initial Ownership History
        await self.repo.create_ownership_history(
            animal_id=animal.id,
            farmer_id=animal.farmer_id,
            village_id=animal.village_id,
            valid_from=date.today(),
            change_reason="INITIAL_REGISTRATION",
            changed_by=current_user.id
        )

        # 7. Record physical tag if provided (conforming strictly to DB check constraint: BHARAT_PASHUDHAN_12 or OTHER_EAR_TAG)
        if candidate_tag:
            is_12_digit = bool(re.match(r"^\d{12}$", candidate_tag))
            tag_id_type = "BHARAT_PASHUDHAN_12" if (payload.bharat_pashudhan_tag or is_12_digit) else "OTHER_EAR_TAG"

            await self.repo.add_external_identifier(
                animal_id=animal.id,
                id_type=tag_id_type,
                id_value=candidate_tag,
                recorded_by=current_user.id
            )

        # 8. Record QR token if generated or provided
        if qr_token_to_assign:
            await self.repo.assign_qr_token(
                animal_id=animal.id,
                token=qr_token_to_assign,
                issued_by=current_user.id
            )

        # 9. Record previous historical vaccinations if provided
        if payload.previous_vaccinations:
            source_labels = {
                "CARD_VERIFIED": "રસીકરણ કાર્ડમાંથી ચકાસાયેલ",
                "FARMER_REPORTED": "ખેડૂત દ્વારા મૌખિક જણાવેલ",
                "TAG_EXTRACTED": "ટેગમાંથી આપોઆપ મળેલ માહિતી"
            }
            # Fetch valid programme codes from database
            prog_res = await self.db.execute(select(Programme.code))
            valid_progs = {p.upper() for p in prog_res.scalars().all()}
            if not valid_progs:
                valid_progs = {"FMD", "HS", "BQ", "BRUCELLOSIS", "PPR"}

            for vax in payload.previous_vaccinations:
                ev_id = uuid.uuid4()
                src_label = source_labels.get(vax.source, vax.source)
                remark_text = f"નોંધણી વખતે અગાઉનું રસીકરણ | સ્ત્રોત: {src_label}"
                if vax.remarks:
                    remark_text += f" | {vax.remarks}"

                prog_code = vax.programme_code.strip().upper()
                if prog_code not in valid_progs:
                    if "HS" in prog_code:
                        prog_code = "HS"
                    elif "BQ" in prog_code:
                        prog_code = "BQ"
                    elif "PPR" in prog_code:
                        prog_code = "PPR"
                    elif "BRUCELL" in prog_code:
                        prog_code = "BRUCELLOSIS"
                    else:
                        prog_code = "FMD"

                # Defensive guard: ensure event_date is never in the future or before birth_date
                safe_event_date = vax.vaccination_date
                today = date.today()
                if safe_event_date > today:
                    safe_event_date = today
                if animal.birth_date and safe_event_date < animal.birth_date:
                    safe_event_date = animal.birth_date

                animal_event = AnimalEvent(
                    event_id=ev_id,
                    animal_id=animal.id,
                    village_id=animal.village_id,
                    event_type="VACCINATION",
                    event_date=safe_event_date,
                    performed_by=current_user.id,
                    source="ONLINE",
                    remarks=remark_text,
                    review_status="NONE"
                )
                self.db.add(animal_event)

                # Strictly conforms to DB constraint CHECK (authorization_check IN ('AUTHORIZED','NOT_CHECKED','UNAUTHORIZED_FLAGGED'))
                vax_detail = VaccinationDetail(
                    event_id=ev_id,
                    programme_code=prog_code,
                    batch_number=vax.batch_number,
                    dose_note="અગાઉનું રસીકરણ (પ્રારંભિક પશુ નોંધણી)",
                    administered_by_name=f"અગાઉનું રસીકરણ ({src_label})",
                    authorization_check="NOT_CHECKED"
                )
                self.db.add(vax_detail)
            await self.db.flush()

        await self.repo.record_audit_event(
            action="ANIMAL_REGISTERED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="animal",
            object_id=str(animal.id),
            village_id=animal.village_id,
            reason=f"Registered {animal.species_code} animal ({submission_source})",
            ip=client_ip
        )
        await self.db.commit()
        return await self.get_animal(animal.id, current_user)

    async def update_animal(
        self,
        animal_id: uuid.UUID,
        payload: AnimalUpdate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalResponse:
        """Update animal demographics and operational status."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.edit", "animal.create"],
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        await self.authz_service.assert_village_scope(current_user, animal.village_id, ip=client_ip)

        updated = await self.repo.update_animal(
            animal=animal,
            breed_id=payload.breed_id,
            sex=payload.sex,
            age_months_estimate=payload.age_months_estimate,
            status=payload.status,
            status_reason=payload.status_reason
        )

        await self.repo.record_audit_event(
            action="ANIMAL_UPDATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="animal",
            object_id=str(updated.id),
            village_id=updated.village_id,
            reason=f"Updated animal record {updated.animal_code or str(updated.id)}",
            ip=client_ip
        )
        await self.db.commit()
        return AnimalResponse.model_validate(updated)

    async def assign_qr_token(
        self,
        animal_id: uuid.UUID,
        payload: AnimalQRTokenAssignRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalQRTokenResponse:
        """Assign or re-tag an animal with a physical cryptographic Base32 QR token."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.tag", "animal.edit", "animal.create"],
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        await self.authz_service.assert_village_scope(current_user, animal.village_id, ip=client_ip)

        import re
        if payload.token and re.match(r"^[A-Z2-7]{26}$", payload.token.strip().upper()):
            token_to_assign = payload.token.strip().upper()
        else:
            token_to_assign = generate_base32_qr_token()

        # Duplicate check across active tokens
        existing = await self.repo.get_animal_by_qr_token(token_to_assign)
        if existing and existing.id != animal.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"QR token '{token_to_assign}' is already assigned to another active animal"
            )

        token_obj = await self.repo.assign_qr_token(
            animal_id=animal.id,
            token=token_to_assign,
            issued_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ANIMAL_QR_TOKEN_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="animal_qr_token",
            object_id=token_obj.token,
            village_id=animal.village_id,
            reason=f"Assigned QR token {token_obj.token} to animal {animal.animal_code or str(animal.id)}",
            ip=client_ip
        )
        await self.db.commit()
        return AnimalQRTokenResponse.model_validate(token_obj)

    async def add_external_id(
        self,
        animal_id: uuid.UUID,
        payload: AnimalExternalIdCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalExternalIdResponse:
        """Attach an external government tag or third-party identifier."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.edit", "animal.tag", "animal.create"],
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        await self.authz_service.assert_village_scope(current_user, animal.village_id, ip=client_ip)

        # Validate Bharat Pashudhan 12-digit format
        if payload.id_type == "BHARAT_PASHUDHAN_12":
            if not payload.id_value.isdigit() or len(payload.id_value) != 12:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bharat Pashudhan ear tag must consist of exactly 12 numeric digits"
                )

        is_dup = await self.repo.check_duplicate_active_external_id(
            id_type=payload.id_type,
            id_value=payload.id_value
        )
        if is_dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{payload.id_type} identifier '{payload.id_value}' is already active on another animal"
            )

        tag = await self.repo.add_external_identifier(
            animal_id=animal.id,
            id_type=payload.id_type,
            id_value=payload.id_value,
            recorded_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ANIMAL_TAG_RECORDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="animal_external_identifier",
            object_id=str(tag.id),
            village_id=animal.village_id,
            reason=f"Attached {tag.id_type} tag {tag.id_value}",
            ip=client_ip
        )
        await self.db.commit()
        return AnimalExternalIdResponse.model_validate(tag)

    async def request_transfer(
        self,
        animal_id: uuid.UUID,
        payload: AnimalOwnershipTransferRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalOwnershipTransferResponse:
        """Submit an ownership transfer request (DEC-022: stores pending request, does NOT mutate animal)."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.transfer.request", "animal.transfer"],
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        # Validate caller scope / ownership
        if current_user.role == "FARMER":
            prov_stmt = select(FarmerAccountProvisioning.farmer_id).where(
                FarmerAccountProvisioning.user_id == current_user.id
            )
            linked_farmer_id = (await self.db.execute(prov_stmt)).scalars().first()
            if not linked_farmer_id or linked_farmer_id != animal.farmer_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Farmers may only request ownership transfer for their own registered animals"
                )
        else:
            await self.authz_service.assert_village_scope(current_user, animal.village_id, ip=client_ip)

        # Validate target farmer and village
        target_farmer = await self.db.get(Farmer, payload.to_farmer_id)
        if not target_farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target farmer not found")
        if target_farmer.village_id != payload.to_village_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target village does not match target farmer's registered village"
            )

        # Prevent no-op transfer to exact same farmer
        if animal.farmer_id == payload.to_farmer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Animal is already registered to this farmer"
            )

        # Enforce uq_open_transfer constraint (only 1 open transfer per animal)
        has_open = await self.repo.has_open_transfer(animal.id)
        if has_open:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active ownership transfer request already exists for this animal"
            )

        # Create transfer request with status='REQUESTED' without mutating animal or ownership history
        transfer = await self.repo.create_transfer_request(
            animal=animal,
            to_farmer_id=payload.to_farmer_id,
            to_village_id=payload.to_village_id,
            reason=payload.reason,
            reason_note=payload.reason_note,
            requested_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="ANIMAL_TRANSFER_REQUESTED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="ownership_transfer",
            object_id=str(transfer.id),
            village_id=animal.village_id,
            reason=f"Ownership transfer requested for animal {animal.animal_code or str(animal.id)} to farmer {target_farmer.farmer_code or str(target_farmer.id)}",
            ip=client_ip
        )

        # Notify target farmer user if linked
        try:
            from app.modules.notifications.service import NotificationService
            from app.modules.authorization.models import FarmerUserLink
            notif_service = NotificationService(self.db)
            link_stmt = select(FarmerUserLink.user_id).where(FarmerUserLink.farmer_id == payload.to_farmer_id)
            link_res = await self.db.execute(link_stmt)
            target_user_id = link_res.scalars().first()
            if target_user_id:
                await notif_service.notify(
                    recipient_user_id=target_user_id,
                    kind="TRANSFER_REQUESTED",
                    message_key="TRANSFER_REQUESTED",
                    params={"animal_code": animal.animal_code or str(animal.id)[:8]},
                    related_type="ownership_transfer",
                    related_id=str(transfer.id)
                )
        except Exception as n_err:
            logger.warning("Notification dispatch error on transfer request: %s", n_err)

        await self.db.commit()
        return AnimalOwnershipTransferResponse.model_validate(transfer)

    async def decide_transfer(
        self,
        animal_id: uuid.UUID,
        transfer_id: uuid.UUID,
        payload: AnimalTransferDecisionRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalOwnershipTransferResponse:
        """Review and decide (approve or reject) an ownership transfer request.

        Authority:
          Requires 'animal.transfer.decide'. Granted to VET_OFFICER (and DAHO by supervisor authority).
          Field workers and farmers receive HTTP 403 Forbidden.
        Behavior:
          - If APPROVE: closes current history, appends new history, updates animal entity, sets transfer status COMPLETED.
          - If REJECT: requires non-empty decision_note, preserves current ownership and history, sets status REJECTED.
        """
        await self.authz_service.assert_permission(
            current_user,
            "animal.transfer.decide",
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer or transfer.animal_id != animal.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ownership transfer request not found")

        # Verify officer scope
        await self.authz_service.assert_village_scope(current_user, animal.village_id, ip=client_ip)

        # Check pending status
        if transfer.status not in ("REQUESTED", "PENDING_VERIFICATION"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot decide transfer with status '{transfer.status}'"
            )

        # Mandatory note for rejection (per database constraint)
        if payload.action == "REJECT":
            if not payload.decision_note or not payload.decision_note.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A non-empty decision note is required when rejecting an ownership transfer"
                )

        transfer = await self.repo.apply_transfer_decision(
            transfer=transfer,
            animal=animal,
            action=payload.action,
            decided_by=current_user.id,
            decision_note=payload.decision_note,
            effective_date=payload.effective_date
        )

        await self.repo.record_audit_event(
            action="ANIMAL_TRANSFER_DECIDED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="ownership_transfer",
            object_id=str(transfer.id),
            village_id=animal.village_id,
            reason=f"Transfer {payload.action}ED by officer: {payload.decision_note or 'Approved'}",
            ip=client_ip
        )

        # Notify requester
        try:
            from app.modules.notifications.service import NotificationService
            notif_service = NotificationService(self.db)
            if transfer.requested_by:
                decision_gu = "મંજૂર" if payload.action == "APPROVE" else "અસ્વીકાર"
                await notif_service.notify(
                    recipient_user_id=transfer.requested_by,
                    kind="TRANSFER_DECIDED",
                    message_key="TRANSFER_DECIDED",
                    params={
                        "animal_code": animal.animal_code or str(animal.id)[:8],
                        "decision": decision_gu
                    },
                    related_type="ownership_transfer",
                    related_id=str(transfer.id)
                )
        except Exception as n_err:
            logger.warning("Notification dispatch error on transfer decision: %s", n_err)

        await self.db.commit()
        return AnimalOwnershipTransferResponse.model_validate(transfer)

    async def list_transfers(
        self,
        animal_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[AnimalOwnershipTransferResponse]:
        """List all transfer requests for an animal."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["animal.read", "animal.transfer.request"],
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        transfers = await self.repo.list_transfers_for_animal(animal.id)
        return [AnimalOwnershipTransferResponse.model_validate(t) for t in transfers]

    async def transfer_ownership(
        self,
        animal_id: uuid.UUID,
        payload: AnimalOwnershipTransferRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalOwnershipTransferResponse:
        """Backward-compatible endpoint: submits a transfer request."""
        return await self.request_transfer(animal_id, payload, current_user, client_ip)

    async def verify_animal(
        self,
        animal_id: uuid.UUID,
        payload: AnimalVerificationRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> AnimalVerificationResponse:
        """Record formal physical or office animal verification."""
        await self.authz_service.assert_permission(
            current_user,
            "animal.verify",
            ip=client_ip
        )

        animal = await self.repo.get_animal_by_id(animal_id)
        if not animal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

        await self.authz_service.assert_village_scope(current_user, animal.village_id, ip=client_ip)

        verification = await self.repo.record_animal_verification(
            animal=animal,
            method=payload.method,
            outcome=payload.outcome,
            tag_checked=payload.tag_checked,
            owner_confirmed=payload.owner_confirmed,
            verified_by=current_user.id,
            notes=payload.notes
        )

        await self.repo.record_audit_event(
            action="ANIMAL_VERIFIED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="animal",
            object_id=str(animal.id),
            village_id=animal.village_id,
            reason=f"Verified animal {animal.animal_code or str(animal.id)}: outcome={payload.outcome}",
            ip=client_ip
        )
        await self.db.commit()
        return AnimalVerificationResponse.model_validate(verification)

