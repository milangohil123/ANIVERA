"""Pydantic v2 schemas for Animal Events, Vaccinations, Treatments, and Corrections."""
import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class VaccinationRecordCreate(BaseModel):
    """Payload to record an animal vaccination event."""
    event_id: Optional[uuid.UUID] = Field(None, description="Client-generated idempotency key (UUID)")
    animal_id: uuid.UUID = Field(..., description="Target animal identifier")
    village_id: uuid.UUID = Field(..., description="Village where vaccination was administered")
    programme_code: str = Field(..., description="Vaccination programme (e.g. FMD, HS, BQ, BRUCELLOSIS, PPR)")
    event_date: date = Field(..., description="Date of vaccine administration")
    batch_number: Optional[str] = Field(None, max_length=100, description="Manufacturer vaccine batch (OPTIONAL per DEC-018)")
    dose_note: Optional[str] = Field(None, max_length=200, description="Dose notation or serial as recorded")
    campaign_id: Optional[uuid.UUID] = Field(None, description="Associated campaign identifier")
    camp_id: Optional[uuid.UUID] = Field(None, description="Associated veterinary camp identifier")
    administered_by_user_id: Optional[uuid.UUID] = Field(None, description="User who administered vaccine")
    administered_by_name: Optional[str] = Field(None, max_length=150, description="Vaccinator name if uncredentialed")
    remarks: Optional[str] = Field(None, max_length=500)


class VaccinationResponse(BaseModel):
    """Standard vaccination response schema."""
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    animal_id: uuid.UUID
    village_id: uuid.UUID
    programme_code: str
    event_date: date
    batch_number: Optional[str] = None
    dose_note: Optional[str] = None
    campaign_id: Optional[uuid.UUID] = None
    camp_id: Optional[uuid.UUID] = None
    administered_by_user_id: Optional[uuid.UUID] = None
    administered_by_name: Optional[str] = None
    authorization_check: str
    performed_by: uuid.UUID
    next_due_date: Optional[date] = None
    received_at: datetime
    review_status: str
    remarks: Optional[str] = None


class TreatmentRecordCreate(BaseModel):
    """Payload to record an animal veterinary treatment consultation."""
    event_id: Optional[uuid.UUID] = Field(None, description="Client-generated idempotency key")
    animal_id: uuid.UUID = Field(..., description="Target animal identifier")
    village_id: uuid.UUID = Field(..., description="Village of consultation")
    event_date: date = Field(..., description="Date of clinical consultation")
    treatment_text: str = Field(..., min_length=2, max_length=1000, description="Clinical treatment administered")
    diagnosis_text: Optional[str] = Field(None, max_length=500, description="Provisional diagnosis")
    medicine_text: Optional[str] = Field(None, max_length=500, description="Prescribed medicine notation")
    follow_up_date: Optional[date] = Field(None, description="Planned follow-up examination date")
    remarks: Optional[str] = Field(None, max_length=500)


class TreatmentResponse(BaseModel):
    """Treatment response schema."""
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    animal_id: uuid.UUID
    village_id: uuid.UUID
    event_date: date
    treatment_text: str
    diagnosis_text: Optional[str] = None
    medicine_text: Optional[str] = None
    follow_up_date: Optional[date] = None
    performed_by: uuid.UUID
    received_at: datetime
    review_status: str
    remarks: Optional[str] = None


class ObservationRecordCreate(BaseModel):
    """Payload to record animal physical health observations."""
    event_id: Optional[uuid.UUID] = Field(None, description="Client idempotency key")
    animal_id: uuid.UUID = Field(..., description="Target animal identifier")
    village_id: uuid.UUID = Field(..., description="Village of observation")
    event_date: date = Field(..., description="Date of observation")
    symptoms: List[str] = Field(default_factory=list, description="Observed symptom tags")
    notes: Optional[str] = Field(None, max_length=500)
    remarks: Optional[str] = Field(None, max_length=500)


class ObservationResponse(BaseModel):
    """Observation response schema."""
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    animal_id: uuid.UUID
    village_id: uuid.UUID
    event_date: date
    symptoms: List[str]
    notes: Optional[str] = None
    performed_by: uuid.UUID
    received_at: datetime
    remarks: Optional[str] = None


class EventReviewRequest(BaseModel):
    """Payload for VO to review or flag an event record."""
    review_status: str = Field(..., pattern="^(REVIEWED|FLAGGED)$")
    review_note: Optional[str] = Field(None, max_length=500)


class EventCorrectionRequest(BaseModel):
    """Payload to amend or void an event record with mandatory reason."""
    action: str = Field(..., pattern="^(AMEND|VOID)$")
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory documented reason for correction")
    replacement_event_id: Optional[uuid.UUID] = Field(None, description="Required for AMEND actions; NULL for VOID")


class EventCorrectionResponse(BaseModel):
    """Response representing an immutable event correction."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_event_id: uuid.UUID
    action: str
    replacement_event_id: Optional[uuid.UUID] = None
    reason: str
    corrected_by: uuid.UUID
    corrected_at: datetime

