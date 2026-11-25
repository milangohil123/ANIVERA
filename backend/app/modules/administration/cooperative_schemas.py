"""Pydantic schemas for DAHO Dairy Cooperative Management and Cooperative Portal."""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class CooperativeRegisterRequest(BaseModel):
    """Payload submitted by DAHO to register a new Dairy Cooperative."""
    model_config = ConfigDict(extra="ignore")

    code: str = Field(..., min_length=2, max_length=50, description="Unique cooperative identifier")
    name_gu: str = Field(..., min_length=1, max_length=150, description="Cooperative name in Gujarati")
    name_en: str = Field(..., min_length=1, max_length=150, description="Cooperative name in English")
    org_type: str = Field(default="DAIRY_COOPERATIVE", description="DAIRY_COOPERATIVE, MILK_UNION, or OTHER")
    registration_no: Optional[str] = Field(default=None, max_length=100)
    contact_person: str = Field(..., min_length=2, max_length=120)
    designation: Optional[str] = Field(default="સચિવ (Secretary)", max_length=100)
    mobile_e164: str = Field(..., min_length=10, max_length=15)
    email: str = Field(..., min_length=5, max_length=150, description="Valid email address")
    district_id: uuid.UUID
    taluka_id: Optional[uuid.UUID] = None
    village_id: Optional[uuid.UUID] = None
    taluka_ids: Optional[List[uuid.UUID]] = None
    village_ids: Optional[List[uuid.UUID]] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    status: str = Field(default="ACTIVE")
    notes: Optional[str] = None
    initial_password: Optional[str] = None


class CooperativeUpdateRequest(BaseModel):
    """Payload to update cooperative profile details."""
    model_config = ConfigDict(extra="ignore")

    name_gu: Optional[str] = None
    name_en: Optional[str] = None
    org_type: Optional[str] = None
    registration_no: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    mobile_e164: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    notes: Optional[str] = None


class CooperativeStatusRequest(BaseModel):
    """Payload to activate/deactivate a cooperative."""
    status: str = Field(..., description="ACTIVE or INACTIVE")
    reason: Optional[str] = None


class CooperativeSummaryItem(BaseModel):
    """Lightweight item for listing in DAHO portal."""
    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    org_type: str
    status: str
    registration_no: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    mobile_e164: Optional[str] = None
    email: Optional[str] = None
    district_id: Optional[uuid.UUID] = None
    district_name: Optional[str] = None
    taluka_id: Optional[uuid.UUID] = None
    taluka_name: Optional[str] = None
    village_id: Optional[uuid.UUID] = None
    village_name: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    created_at: datetime
    linked_farmers_count: int = 0
    linked_animals_count: int = 0
    vaccinated_animals_count: int = 0
    coverage_percent: float = 0.0
    is_demo: bool = False


class CooperativeDetailResponse(BaseModel):
    """Comprehensive details and telemetry of a single cooperative."""
    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    org_type: str
    status: str
    registration_no: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    mobile_e164: Optional[str] = None
    email: Optional[str] = None
    district_id: Optional[uuid.UUID] = None
    district_name: Optional[str] = None
    taluka_id: Optional[uuid.UUID] = None
    taluka_name: Optional[str] = None
    village_id: Optional[uuid.UUID] = None
    village_name: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    notes: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    username: Optional[str] = None
    user_status: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None
    linked_farmers_count: int = 0
    linked_animals_count: int = 0
    vaccinated_animals_count: int = 0
    pending_vaccinations_count: int = 0
    overdue_vaccinations_count: int = 0
    coverage_percent: float = 0.0
    active_campaigns_count: int = 0
    suspected_disease_cases_count: int = 0
    is_demo: bool = False


class CooperativeMemberLinkRequest(BaseModel):
    """Payload to link a registered farmer to the cooperative."""
    farmer_id: uuid.UUID
    member_no: Optional[str] = None
    joined_on: Optional[date] = None


class CooperativeMemberItem(BaseModel):
    """Linked member farmer item."""
    farmer_id: uuid.UUID
    farmer_code: Optional[str] = None
    full_name_gu: str
    full_name_en: str
    mobile_e164: Optional[str] = None
    village_id: uuid.UUID
    village_name: str
    member_no: Optional[str] = None
    joined_on: Optional[date] = None
    total_animals: int = 0
    vaccinated_animals: int = 0
    coverage_percent: float = 0.0


class CoopAnimalItem(BaseModel):
    """Linked livestock item for Cooperative portal."""
    id: uuid.UUID
    animal_code: Optional[str] = None
    bharat_pashudhan_tag: Optional[str] = None
    species: str
    breed: Optional[str] = None
    sex: str
    age_years: Optional[float] = None
    farmer_id: uuid.UUID
    farmer_name: str
    village_name: str
    vaccination_status: str  # COVERED, PARTIAL, PENDING, OVERDUE
    last_vaccinated_at: Optional[datetime] = None
    next_due_date: Optional[date] = None


class CoopVaccinationItem(BaseModel):
    """Vaccination telemetry item (read-only) for linked animals."""
    id: uuid.UUID
    animal_id: uuid.UUID
    animal_code: Optional[str] = None
    bharat_pashudhan_tag: Optional[str] = None
    species: str
    farmer_name: str
    village_name: str
    vaccine_name: str
    disease_name: str
    dose_number: int
    batch_number: Optional[str] = None
    administered_at: datetime
    vaccinator_designation: str
    status: str


class CoopCampaignItem(BaseModel):
    """Active/scheduled campaign overview for cooperative."""
    id: uuid.UUID
    code: str
    name: str
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    target_animals: int = 0
    vaccinated_animals: int = 0
    progress_percent: float = 0.0


class CoopVillageItem(BaseModel):
    """Operational village status for cooperative."""
    village_id: uuid.UUID
    village_name: str
    taluka_name: str
    total_farmers: int = 0
    member_farmers: int = 0
    total_animals: int = 0
    vaccinated_animals: int = 0
    coverage_percent: float = 0.0


class CoopSurveillanceItem(BaseModel):
    """Disease surveillance report (read-only) in operational villages."""
    id: uuid.UUID
    report_code: Optional[str] = None
    village_name: str
    species: str
    suspected_disease: str
    affected_animals_count: int
    mortality_count: int
    review_status: str
    reported_at: datetime


class CoopDashboardAnalyticsResponse(BaseModel):
    """Complete 10-KPI + 8-Chart analytics response for Cooperative portal."""
    cooperative: Dict[str, Any]
    kpis: Dict[str, Any]
    charts: Dict[str, Any]
