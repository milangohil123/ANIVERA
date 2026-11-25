"""Pydantic schemas for Disease Reporting, Case Assignment, Treatment Verification,
and Dairy Cooperative Recurring Vaccination Schedules.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Part A: Farmer Disease Reporting Schemas
# ---------------------------------------------------------------------------
class FarmerDiseaseReportCreate(BaseModel):
    animal_id: Optional[uuid.UUID] = Field(None, description="Selected animal UUID")
    animal_tag_id: Optional[str] = Field(None, description="Animal 12-digit tag or code")
    is_unknown_disease: bool = Field(False, description="True if farmer does not know disease")
    suspected_disease_code: Optional[str] = Field(None, description="Disease code if suspected (e.g. FMD, HS)")
    custom_disease_name: Optional[str] = Field(None, description="Farmer entered disease name")
    symptoms: List[str] = Field(default_factory=list, description="Observed clinical symptoms")
    symptom_onset_date: Optional[date] = Field(None, description="When symptoms started")
    description: Optional[str] = Field(None, description="Detailed problem description")
    urgency: str = Field("NORMAL", description="NORMAL, URGENT, EMERGENCY")
    village_id: Optional[uuid.UUID] = Field(None, description="Village UUID")
    latitude: Optional[Decimal] = Field(None, description="GPS Latitude")
    longitude: Optional[Decimal] = Field(None, description="GPS Longitude")
    photo_urls: Optional[List[str]] = Field(default_factory=list, description="Uploaded photo file paths")


class FarmerDiseaseReportItem(BaseModel):
    report_id: uuid.UUID
    report_no: Optional[str] = None
    animal_id: Optional[uuid.UUID] = None
    animal_code: Optional[str] = None
    animal_tag_id: Optional[str] = None
    animal_name: Optional[str] = None
    species_code: Optional[str] = None
    farmer_id: Optional[uuid.UUID] = None
    farmer_name: Optional[str] = None
    farmer_mobile: Optional[str] = None
    farmer_address: Optional[str] = None
    village_id: uuid.UUID
    village_name_gu: Optional[str] = None
    village_name_en: Optional[str] = None
    disease_code: str
    is_unknown_disease: bool = False
    custom_disease_name: Optional[str] = None
    symptoms: List[str] = []
    observation_text: Optional[str] = None
    urgency: str = "NORMAL"
    treatment_status: str = "SUBMITTED"
    report_date: date
    received_at: datetime
    assigned_vo_id: Optional[uuid.UUID] = None
    assigned_vo_name: Optional[str] = None
    assigned_fw_name: Optional[str] = None
    assigned_to_role: Optional[str] = "VO"
    assignment_deadline: Optional[datetime] = None
    hours_remaining_for_assignment: Optional[float] = None
    is_assignment_overdue: bool = False
    is_escalated_to_daho: bool = False
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    attachment_count: int = 0
    photo_urls: List[str] = []
    treatment_record: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Part B: TAHO Case Assignment & VO Treatment Schemas
# ---------------------------------------------------------------------------
class CaseAssignmentRequest(BaseModel):
    assigned_to_role: str = Field("VO", description="Exclusively 'VO'")
    assigned_vo_id: uuid.UUID = Field(..., description="Mandatory assigned Veterinary Officer ID")
    assigned_fw_id: Optional[uuid.UUID] = Field(None, description="Unused - FW cannot be assigned")
    priority: str = Field("NORMAL", description="'NORMAL', 'URGENT', 'EMERGENCY'")
    instructions: Optional[str] = Field(None, description="Operational instructions from TAHO")
    planned_visit_date: Optional[date] = Field(None, description="Planned date for clinical visit")


class CaseTreatmentRecordRequest(BaseModel):
    observations: str = Field(..., description="Physical examination observations")
    diagnosis: Optional[str] = Field(None, description="Clinical diagnosis determined by VO")
    treatment_text: str = Field(..., description="Treatment provided and procedure notes")
    medicine_administered: Optional[str] = Field(None, description="Medicine, vaccine, or drugs administered")
    dosage_details: Optional[str] = Field(None, description="Dosage and administration route")
    treatment_notes: Optional[str] = Field(None, description="Additional treatment notes")
    follow_up_instructions: Optional[str] = Field(None, description="Instructions for farmer or staff")
    next_visit_date: Optional[date] = Field(None, description="Next follow-up visit date if needed")
    latitude: Optional[float] = Field(None, description="GPS Latitude of treatment site")
    longitude: Optional[float] = Field(None, description="GPS Longitude of treatment site")
    evidence_photos: Optional[List[str]] = Field(default_factory=list, description="Mandatory treatment evidence photographs")
    before_treatment_photos: Optional[List[str]] = Field(default_factory=list)
    after_treatment_photos: Optional[List[str]] = Field(default_factory=list)


class CaseTreatmentVerificationRequest(BaseModel):
    action: Optional[str] = Field(None, description="'APPROVED', 'REJECTED', or 'FOLLOW_UP_REQUIRED'")
    decision: Optional[str] = Field(None, description="Compatibility alias for action")
    verification_notes: Optional[str] = Field(None, description="Approval or review comments")
    rejection_reason: Optional[str] = Field(None, description="Mandatory reason if rejected or follow-up")
    follow_up_instructions: Optional[str] = Field(None, description="Instructions if follow-up required")

    @model_validator(mode="before")
    @classmethod
    def resolve_action(cls, data: Any) -> Any:
        if isinstance(data, dict):
            act = data.get("action") or data.get("decision") or "APPROVED"
            data["action"] = act
            data["decision"] = act
        return data


class DiseaseClusterAlert(BaseModel):
    cluster_id: str
    disease_code: str
    disease_name: str
    title: str = "Potential Disease Cluster"
    severity: str = "ALERT"  # ALERT, HIGH_RISK, SUSPECTED_OUTBREAK
    case_count: int
    village_ids: List[uuid.UUID]
    village_names: List[str]
    first_report_date: date
    latest_report_date: date
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    radius_km: float = 5.0
    underlying_case_ids: List[uuid.UUID] = []
    cases: List[FarmerDiseaseReportItem] = []


# ---------------------------------------------------------------------------
# Part C: Dairy Cooperative Recurring Vaccination Schedule Schemas
# ---------------------------------------------------------------------------
class RecurringScheduleCreateRequest(BaseModel):
    schedule_name: str = Field(..., description="Name of the recurring vaccination schedule")
    programme_code: str = Field(..., description="Target disease programme e.g. FMD, HS, BQ")
    vaccine_name: str = Field(..., description="Authorized vaccine name")
    disease_prevention_purpose: Optional[str] = Field(None, description="Preventive purpose")
    target_species: List[str] = Field(default_factory=lambda: ["CATTLE", "BUFFALO"])
    target_villages: List[uuid.UUID] = Field(default_factory=list)
    taluka_id: Optional[uuid.UUID] = Field(None, description="Target Taluka")
    start_date: date = Field(..., description="Start date of the vaccination program")
    recurrence_interval_value: int = Field(6, ge=1, description="Interval number e.g. 6, 3, 12")
    recurrence_interval_unit: str = Field("MONTHS", description="'MONTHS', 'WEEKS', or 'DAYS'")
    reminder_days_before: int = Field(15, ge=1, le=30, description="Reminder days before due date")
    execution_instructions: Optional[str] = Field(None)
    enrolled_animal_ids: List[uuid.UUID] = Field(default_factory=list, description="Linked member animals")
    submit_immediately: bool = Field(False, description="Submit to TAHO immediately")


class ScheduleDecisionRequest(BaseModel):
    action: str = Field(..., description="'APPROVE', 'REJECT', or 'REQUEST_CHANGES'")
    review_notes: Optional[str] = Field(None, description="Review commentary from TAHO")
    approved_execution_start: Optional[date] = Field(None)
    approved_execution_end: Optional[date] = Field(None)


class ScheduleEligibilityPreviewResponse(BaseModel):
    total_selected_farmers: int
    total_selected_animals: int
    species_breakdown: Dict[str, int]
    village_breakdown: Dict[str, int]
    already_vaccinated_count: int
    existing_schedule_conflicts_count: int
    eligible_count: int
    preview_animals: List[Dict[str, Any]] = []


class CooperativeScheduleSummary(BaseModel):
    id: uuid.UUID
    cooperative_id: uuid.UUID
    cooperative_name: Optional[str] = None
    schedule_name: str
    programme_code: str
    vaccine_name: str
    disease_prevention_purpose: Optional[str] = None
    target_species: List[str]
    taluka_id: uuid.UUID
    start_date: date
    recurrence_interval_value: int
    recurrence_interval_unit: str
    reminder_days_before: int
    status: str
    enrolled_animals_count: int = 0
    vaccinated_animals_count: int = 0
    due_animals_count: int = 0
    overdue_animals_count: int = 0
    created_at: datetime
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None


class AnimalTimelineEventItem(BaseModel):
    event_id: str
    event_type: str  # REGISTRATION, HEALTH_REPORT, ASSIGNMENT, VISIT, TREATMENT, VERIFICATION, VACCINATION_SCHEDULE, REMINDER, VACCINATION_COMPLETED
    event_date: str
    title: str
    description: str
    performed_by: Optional[str] = None
    badge_color: Optional[str] = None
    status: Optional[str] = None
    metadata: Dict[str, Any] = {}
