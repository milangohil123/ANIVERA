"""Pydantic v2 schemas for Animal domain."""
import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PreviousVaccinationCreate(BaseModel):
    """Prior historical vaccination record provided at animal registration."""
    programme_code: str = Field(..., max_length=50, description="Programme code e.g. FMD, HS, BQ, BRUCELLOSIS, PPR, LSD, RABIES")
    vaccination_date: date = Field(..., description="Date of prior vaccination")
    source: str = Field(
        "CARD_VERIFIED",
        pattern="^(CARD_VERIFIED|FARMER_REPORTED|TAG_EXTRACTED)$",
        description="Source of verification: CARD_VERIFIED, FARMER_REPORTED, or TAG_EXTRACTED"
    )
    batch_number: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = Field(None, max_length=500)

    @field_validator("vaccination_date", mode="after")
    @classmethod
    def cap_future_date(cls, v: date) -> date:
        today = date.today()
        if v > today:
            return today
        return v


class AnimalCreate(BaseModel):
    """Payload to register a new livestock animal."""
    species_code: str = Field(..., max_length=20, description="Species identifier (e.g. CATTLE, BUFFALO, GOAT, SHEEP)")
    breed_id: Optional[uuid.UUID] = Field(None, description="Optional breed identifier")
    sex: str = Field("UNKNOWN", pattern="^(F|M|UNKNOWN)$", description="Animal sex")
    birth_date: Optional[date] = Field(None, description="Exact birth date if known")
    age_months_estimate: Optional[int] = Field(None, ge=0, le=600, description="Estimated age in months")
    farmer_id: uuid.UUID = Field(..., description="Owner farmer technical identifier")
    village_id: uuid.UUID = Field(..., description="Village where the animal is kept")

    # Universal Tag Identification Fields
    tag_identification_method: Optional[str] = Field(
        None,
        pattern="^(EXISTING_QR|EXISTING_BARCODE|INTERNAL_QR|INTERNAL_BARCODE)$",
        description="Identification method used"
    )
    tag_value: Optional[str] = Field(None, description="Physical tag number / identifier")
    tag_payload: Optional[str] = Field(None, description="Original decoded string / payload from tag")
    tag_format: Optional[str] = Field(None, description="FORMAT_1_PLAIN | FORMAT_2_URL | FORMAT_3_STRUCTURED | FORMAT_4_UNKNOWN")

    # Historical vaccination history recorded during registration
    previous_vaccinations: List[PreviousVaccinationCreate] = Field(default_factory=list)

    # Legacy fields maintained for backward compatibility
    bharat_pashudhan_tag: Optional[str] = Field(
        None,
        pattern=r"^[0-9]{12}$",
        description="Optional 12-digit Bharat Pashudhan government ear tag"
    )
    qr_token: Optional[str] = Field(
        None,
        description="Optional Base32 physical QR tag token"
    )


class AnimalUpdate(BaseModel):
    """Payload to update an existing animal record."""
    breed_id: Optional[uuid.UUID] = None
    sex: Optional[str] = Field(None, pattern="^(F|M|UNKNOWN)$")
    age_months_estimate: Optional[int] = Field(None, ge=0, le=600)
    status: Optional[str] = Field(None, pattern="^(ACTIVE|DECEASED|SOLD|MOVED_OUT|INACTIVE|MERGED)$")
    status_reason: Optional[str] = Field(None, max_length=500)


class AnimalResponse(BaseModel):
    """Standard animal response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    animal_code: Optional[str]
    species_code: str
    breed_id: Optional[uuid.UUID]
    sex: str
    age_months_estimate: Optional[int]
    farmer_id: uuid.UUID
    village_id: uuid.UUID
    registration_status: str
    status: str
    created_at: datetime
    updated_at: datetime


class AnimalDetailResponse(AnimalResponse):
    """Detailed animal response with owner information and physical tag identifiers."""
    birth_date: Optional[date] = None
    age_estimated_on: Optional[date] = None
    status_changed_on: Optional[date] = None
    status_reason: Optional[str] = None
    submission_source: str
    submitted_by: Optional[uuid.UUID] = None
    verified_by: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None
    active_tag: Optional[str] = None
    active_qr_token: Optional[str] = None
    farmer_name: Optional[str] = None
    farmer_code: Optional[str] = None
    village_name: Optional[str] = None


class AnimalQRTokenAssignRequest(BaseModel):
    """Payload to assign or re-tag an animal with a physical QR token."""
    token: Optional[str] = Field(
        None,
        description="Base32 26-character token; automatically generated if omitted"
    )

    @field_validator("token", mode="before")
    @classmethod
    def clean_token(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        return str(v).strip().upper()


class AnimalQRTokenResponse(BaseModel):
    """Response returned upon assigning a physical QR token."""
    model_config = ConfigDict(from_attributes=True)

    token: str
    animal_id: uuid.UUID
    status: str
    issued_at: datetime


class AnimalExternalIdCreate(BaseModel):
    """Payload to attach a physical ear tag or external identifier."""
    id_type: str = Field(
        "OTHER_EAR_TAG",
        pattern="^(EXISTING_QR|EXISTING_BARCODE|INTERNAL_QR|INTERNAL_BARCODE|PHYSICAL_EAR_TAG|OTHER_EAR_TAG|BHARAT_PASHUDHAN_12)$"
    )
    id_value: str = Field(..., min_length=1, description="Physical tag or external identifier value")


class AnimalExternalIdResponse(BaseModel):
    """Response returned upon recording an external identifier."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    animal_id: uuid.UUID
    id_type: str
    id_value: str
    status: str
    recorded_at: datetime


class TagCheckResponse(BaseModel):
    """Response returned when checking a physical tag's registration status."""
    is_registered: bool
    tag_value: str
    message: str
    animal: Optional[AnimalDetailResponse] = None


class AnimalOwnershipTransferRequest(BaseModel):
    """Payload to request animal ownership transfer or change registered location."""
    to_farmer_id: uuid.UUID = Field(..., description="Target new owner farmer identifier")
    to_village_id: uuid.UUID = Field(..., description="Target village for the animal")
    reason: str = Field("SALE", pattern="^(SALE|GIFT|INHERITANCE|DATA_CORRECTION|MOVED_VILLAGE|OTHER)$")
    reason_note: Optional[str] = Field(None, max_length=500)


class AnimalTransferDecisionRequest(BaseModel):
    """Payload for an authorised officer to review and decide an ownership transfer request."""
    action: str = Field(..., pattern="^(APPROVE|REJECT)$", description="Review decision (APPROVE or REJECT)")
    decision_note: Optional[str] = Field(None, max_length=500, description="Mandatory note on rejection; optional note on approval")
    effective_date: Optional[date] = Field(None, description="Effective date of ownership transfer (defaults to current date on approval)")


class AnimalOwnershipTransferResponse(BaseModel):
    """Response representing an ownership transfer workflow record."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    animal_id: uuid.UUID
    from_farmer_id: uuid.UUID
    to_farmer_id: uuid.UUID
    to_village_id: uuid.UUID
    reason: str
    reason_note: Optional[str] = None
    status: str
    requested_by: uuid.UUID
    requested_at: datetime
    verified_by: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None
    decided_by: Optional[uuid.UUID] = None
    decided_at: Optional[datetime] = None
    decision_note: Optional[str] = None
    effective_date: Optional[date] = None


class AnimalVerificationRequest(BaseModel):
    """Payload to record an animal physical field verification."""
    method: str = Field("FIELD_PHYSICAL", pattern="^(FIELD_PHYSICAL|OFFICE_REVIEW|IMPORT_REVIEW)$")
    outcome: str = Field("VERIFIED", pattern="^(VERIFIED|REJECTED|MORE_INFO)$")
    tag_checked: bool = Field(True, description="Whether the physical ear tag was verified")
    owner_confirmed: bool = Field(True, description="Whether the livestock owner confirmed ownership")
    notes: Optional[str] = Field(None, max_length=500)


class AnimalVerificationResponse(BaseModel):
    """Response returned upon completing animal verification."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    animal_id: uuid.UUID
    method: str
    outcome: str
    tag_checked: bool
    owner_confirmed: bool
    verified_by: uuid.UUID
    at: datetime


class AnimalVaccinationHistoryItem(BaseModel):
    """Chronological vaccination record item."""
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    programme_code: str
    programme_name_gu: Optional[str] = None
    event_date: date
    batch_number: Optional[str] = None
    dose_note: Optional[str] = None
    administered_by_name: Optional[str] = None
    campaign_id: Optional[uuid.UUID] = None
    campaign_name: Optional[str] = None
    camp_id: Optional[uuid.UUID] = None
    camp_code: Optional[str] = None
    authorization_check: str
    review_status: str
    remarks: Optional[str] = None


class AnimalDiseaseHistoryItem(BaseModel):
    """Chronological disease report item with triage review status."""
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    report_no: Optional[str] = None
    disease_code: str
    disease_name_gu: Optional[str] = None
    report_date: date
    symptoms: list[str] = Field(default_factory=list)
    observation_text: Optional[str] = None
    status: str  # SUBMITTED, UNDER_REVIEW, SUSPECTED, CONFIRMED, NOT_CONFIRMED
    reported_by_name: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmation_basis: Optional[str] = None
    attachment_ids: list[uuid.UUID] = Field(default_factory=list)


class AnimalHistoryResponse(BaseModel):
    """Unified chronological medical, vaccination, and surveillance history for an animal."""
    model_config = ConfigDict(from_attributes=True)

    animal: AnimalDetailResponse
    vaccinations: list[AnimalVaccinationHistoryItem] = Field(default_factory=list)
    disease_reports: list[AnimalDiseaseHistoryItem] = Field(default_factory=list)
    total_vaccinations: int = 0
    total_disease_reports: int = 0


