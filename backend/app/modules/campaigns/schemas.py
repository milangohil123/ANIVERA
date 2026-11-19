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
    species_codes: List[str] = Field(default_factory=list, description="Selected animal species codes (e.g. CATTLE, BUFFALO)")
    disease_code: Optional[str] = Field(None, description="Target disease code (e.g. FMD, HS, BQ)")
    target_animals_count: Optional[int] = Field(None, description="Planned target animal count by DAHO")
    programmes: List[CampaignProgrammeItem] = Field(default_factory=list, description="Species and programmes covered")
    notes: Optional[str] = Field(None, description="Additional notes / instructions")


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
    created_by: uuid.UUID
    created_at: datetime
    activated_by: Optional[uuid.UUID] = None
    activated_at: Optional[datetime] = None
    target_animals_count: Optional[int] = None
    disease_code: Optional[str] = None


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


class TalukaMetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str


class VillageMetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    taluka_id: Optional[uuid.UUID] = None
    taluka_name_gu: Optional[str] = None
    taluka_name_en: Optional[str] = None
    assigned_vo: Optional[UserBrief] = None


class CampaignCreationMetaResponse(BaseModel):
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
    villages: List[CampaignMonitoringVillageItem] = Field(default_factory=list)



