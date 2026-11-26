"""Pydantic v2 schemas for Campaigns domain."""
import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CampaignProgrammeItem(BaseModel):
    """Pair of species and programme for campaign coverage."""
    species_code: str = Field(..., description="Species code (e.g. CATTLE, BUFFALO, GOAT, SHEEP)")
    programme_code: str = Field(..., description="Vaccination programme code (e.g. FMD, HS, BQ)")


class CampaignProgrammeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    species_code: str
    programme_code: str


class CampaignCreate(BaseModel):
    """Payload to create and configure a vaccination campaign."""
    code: str = Field(..., min_length=2, max_length=50, description="Unique campaign reference code")
    name: str = Field(..., min_length=2, max_length=200, description="Campaign display name")
    schedule_version_id: Optional[uuid.UUID] = Field(None, description="Approved schedule version")
    start_date: Optional[date] = Field(None, description="Planned campaign start date")
    end_date: Optional[date] = Field(None, description="Planned campaign end date")
    village_ids: List[uuid.UUID] = Field(default_factory=list, description="Target village identifiers")
    district_ids: List[uuid.UUID] = Field(default_factory=list, description="Target district identifiers (for statewide/multi-district campaigns)")
    scope_type: Optional[str] = Field("DISTRICT", description="Scope type (STATEWIDE, DISTRICT, TALUKA)")
    min_age_months: Optional[int] = Field(None, ge=0, description="Minimum animal age in months for eligibility")
    max_age_months: Optional[int] = Field(None, ge=0, description="Maximum animal age in months for eligibility")
    species_codes: List[str] = Field(default_factory=list, description="Selected animal species codes (e.g. CATTLE, BUFFALO)")
    disease_code: Optional[str] = Field(None, description="Target disease code (e.g. FMD, HS, BQ)")
    vaccine_code: Optional[str] = Field(None, description="Selected vaccine master code (e.g. VAC-FMD-01)")
    vaccine_name: Optional[str] = Field(None, description="Vaccine display name")
    custom_vaccine_name: Optional[str] = Field(None, description="Custom vaccine name if entered manually")
    is_custom_vaccine: bool = Field(False, description="Whether vaccine was entered manually")
    target_animals_count: Optional[int] = Field(None, description="Planned target animal count by DAHO")
    programmes: List[CampaignProgrammeItem] = Field(default_factory=list, description="Species and programmes covered")
    notes: Optional[str] = Field(None, description="Additional notes / instructions")
    interval_months: Optional[int] = Field(6, description="Recurring vaccination interval in months (e.g. 6 or 12)")
    is_recurring_schedule: bool = Field(False, description="Whether this campaign is a recurring schedule-based vaccination programme")
    assigned_vo_ids: List[uuid.UUID] = Field(default_factory=list, description="Optional VO user IDs to assign")
    assigned_fw_ids: List[uuid.UUID] = Field(default_factory=list, description="Optional FW user IDs to assign")


class CampaignUpdate(BaseModel):
    """Payload to update an existing campaign configuration."""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(DRAFT|ACTIVE|CLOSED|CANCELLED)$")


class CampaignActivateRequest(BaseModel):
    """Payload to activate a campaign and snapshot animal population targets."""
    schedule_version_id: Optional[uuid.UUID] = Field(None, description="Approved department schedule version reference")
    start_date: date = Field(..., description="Activation start date")
    end_date: Optional[date] = Field(None, description="Optional campaign closing date")


class CampaignResponse(BaseModel):
    """Standard campaign response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    status: str
    schedule_version_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    activated_by: Optional[uuid.UUID] = None
    activated_at: Optional[datetime] = None
    target_animals_count: Optional[int] = None
    disease_code: Optional[str] = None
    disease_name: Optional[str] = None
    target_species: Optional[str] = None
    coverage_pct: Optional[float] = None
    scope_type: Optional[str] = "DISTRICT"
    target_district_ids: Optional[List[uuid.UUID]] = None
    min_age_months: Optional[int] = None
    max_age_months: Optional[int] = None
    interval_months: Optional[int] = 6
    is_recurring_schedule: Optional[bool] = False


class CampaignDetailResponse(CampaignResponse):
    """Detailed campaign response with village scope, programmes, and animal target counts."""
    village_ids: List[uuid.UUID] = Field(default_factory=list)
    programmes: List[CampaignProgrammeResponse] = Field(default_factory=list)
    target_count: int = 0


class CampaignAssignmentCreate(BaseModel):
    """Payload to assign a field worker to an authorized campaign village."""
    village_id: uuid.UUID = Field(..., description="Village within the campaign")
    worker_user_id: uuid.UUID = Field(..., description="Field worker user identifier")


class CampaignAssignmentResponse(BaseModel):
    """Response representing a field worker campaign village assignment."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    village_id: uuid.UUID
    worker_user_id: uuid.UUID
    assigned_by: uuid.UUID
    assigned_at: datetime
    ended_at: Optional[datetime] = None


class PendingAnimalItem(BaseModel):
    """Animal target item in a campaign village pending list."""
    model_config = ConfigDict(from_attributes=True)

    animal_id: uuid.UUID
    animal_code: str
    species_code: str
    sex: str
    age_months_estimate: Optional[int] = None
    tag_number: Optional[str] = None
    qr_token: Optional[str] = None
    programme_code: str
    is_vaccinated: bool = False
    vaccinated_date: Optional[date] = None
    batch_number: Optional[str] = None


class PendingFarmerGroup(BaseModel):
    """Farmer group in campaign pending module with eligible and remaining counts."""
    model_config = ConfigDict(from_attributes=True)

    farmer_id: uuid.UUID
    farmer_name: str
    farmer_code: Optional[str] = None
    mobile_e164: Optional[str] = None
    eligible_count: int = 0
    vaccinated_count: int = 0
    remaining_count: int = 0
    animals: List[PendingAnimalItem] = Field(default_factory=list)


class CampaignPendingVaccinationsResponse(BaseModel):
    """Village-restricted and campaign-specific pending vaccination coverage."""
    model_config = ConfigDict(from_attributes=True)

    campaign_id: uuid.UUID
    campaign_code: str
    campaign_name: str
    campaign_status: str
    village_id: uuid.UUID
    village_name_gu: str
    village_name_en: str
    total_eligible: int = 0
    total_vaccinated: int = 0
    total_remaining: int = 0
    completion_percentage: float = 0.0
    farmers: List[PendingFarmerGroup] = Field(default_factory=list)


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    designation: Optional[str] = None


class SpeciesItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name_gu: str
    name_en: str


class DistrictMetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str


class TalukaMetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    district_id: Optional[uuid.UUID] = None
    code: str
    name_gu: str
    name_en: str


class VillageMetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    district_id: Optional[uuid.UUID] = None
    code: str
    name_gu: str
    name_en: str
    taluka_id: Optional[uuid.UUID] = None
    taluka_name_gu: Optional[str] = None
    taluka_name_en: Optional[str] = None
    assigned_vo: Optional[UserBrief] = None


class CampaignCreationMetaResponse(BaseModel):
    districts: List[DistrictMetaItem] = Field(default_factory=list)
    species: List[SpeciesItem]
    talukas: List[TalukaMetaItem]
    villages: List[VillageMetaItem]
    default_programmes: List[str]


class CampaignRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for rejecting campaign assignment")


class VoCampaignAssignmentItem(BaseModel):
    campaign_id: uuid.UUID
    campaign_code: str
    campaign_name: str
    disease_code: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    campaign_status: str
    village_id: uuid.UUID
    village_code: str
    village_name_gu: str
    village_name_en: str
    taluka_name: Optional[str] = None
    acceptance_status: str  # "PENDING_ACCEPTANCE", "ACCEPTED", "REJECTED"
    rejection_reason: Optional[str] = None
    assigned_at: Optional[datetime] = None
    eligible_animals_count: int = 0
    vaccinated_animals_count: int = 0
    pending_animals_count: int = 0
    species_names_gu: List[str] = Field(default_factory=list)
    assigned_fws: List[UserBrief] = Field(default_factory=list)
    verification_status: str = "ASSIGNED"
    completion_notes: Optional[str] = None
    evidence_photo_urls: List[str] = Field(default_factory=list)
    submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None


class CampaignMonitoringVillageItem(BaseModel):
    village_id: uuid.UUID
    village_code: str
    village_name_gu: str
    village_name_en: str
    taluka_name: Optional[str] = None
    assigned_vo: Optional[UserBrief] = None
    vo_acceptance_status: str  # "PENDING_ACCEPTANCE", "ACCEPTED", "REJECTED", "UNASSIGNED"
    rejection_reason: Optional[str] = None
    assigned_at: Optional[datetime] = None
    eligible_count: int = 0
    vaccinated_count: int = 0
    remaining_count: int = 0
    completion_percentage: float = 0.0
    assigned_fws: List[UserBrief] = Field(default_factory=list)
    verification_status: str = "ASSIGNED"  # "ASSIGNED", "IN_PROGRESS", "SUBMITTED_FOR_VERIFICATION", "VERIFIED_COMPLETED", "REJECTED", "REOPENED"
    submitted_at: Optional[datetime] = None
    submitted_by_name: Optional[str] = None
    completion_notes: Optional[str] = None
    evidence_photo_urls: List[str] = Field(default_factory=list)
    verified_at: Optional[datetime] = None
    verified_by_name: Optional[str] = None
    verification_notes: Optional[str] = None


class CampaignMonitoringResponse(BaseModel):
    campaign_id: uuid.UUID
    campaign_code: str
    campaign_name: str
    disease_code: Optional[str] = None
    campaign_status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    planned_target_count: Optional[int] = None
    actual_eligible_count: int = 0
    total_vaccinated_count: int = 0
    total_remaining_count: int = 0
    overall_completion_percentage: float = 0.0
    assigned_villages_count: int = 0
    in_progress_villages_count: int = 0
    submitted_villages_count: int = 0
    verified_villages_count: int = 0
    rejected_villages_count: int = 0
    unassigned_villages_count: int = 0
    assigned_staff_count: int = 0
    villages: List[CampaignMonitoringVillageItem] = Field(default_factory=list)


class CampaignBulkAssignWorkersRequest(BaseModel):
    village_ids: List[uuid.UUID] = Field(..., min_length=1)
    worker_user_id: uuid.UUID
    role: Optional[str] = None


class CampaignVillageVerificationSubmitRequest(BaseModel):
    field_observations: Optional[str] = None
    completion_notes: Optional[str] = None
    evidence_photo_urls: Optional[List[str]] = Field(default_factory=list)
    animals_visited_count: Optional[int] = 0


class CampaignVillageVerificationReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT|REOPEN)$")
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    follow_up_instructions: Optional[str] = None


class CampaignVillageVerificationItem(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    village_id: uuid.UUID
    village_name_gu: Optional[str] = None
    village_name_en: Optional[str] = None
    village_code: Optional[str] = None
    taluka_name: Optional[str] = None
    status: str
    assigned_vo: Optional[UserBrief] = None
    assigned_fws: List[UserBrief] = Field(default_factory=list)
    animals_visited_count: int = 0
    vaccinations_completed_count: int = 0
    pending_animals_count: int = 0
    field_observations: Optional[str] = None
    completion_notes: Optional[str] = None
    evidence_photo_urls: List[str] = Field(default_factory=list)
    submitted_by: Optional[uuid.UUID] = None
    submitted_by_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_by: Optional[uuid.UUID] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None



