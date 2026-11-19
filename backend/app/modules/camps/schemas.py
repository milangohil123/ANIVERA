"""Pydantic v2 schemas for Veterinary Camps domain."""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CampCreate(BaseModel):
    """Payload to propose or schedule a veterinary camp or doorstep round."""
    campaign_id: uuid.UUID = Field(..., description="Active campaign reference")
    village_id: uuid.UUID = Field(..., description="Village location for the camp")
    organizer_type: str = Field("GOVERNMENT", pattern="^(GOVERNMENT|COOPERATIVE|JOINT|DOORSTEP)$")
    cooperative_id: Optional[uuid.UUID] = Field(None, description="Required for COOPERATIVE and JOINT camps")
    planned_start: datetime = Field(..., description="Camp start timestamp")
    planned_end: datetime = Field(..., description="Camp end timestamp (must be after start)")
    location_text: Optional[str] = Field(None, max_length=300)
    vaccine_availability: str = Field("UNKNOWN", pattern="^(UNKNOWN|AVAILABLE|UNAVAILABLE)$")
    vaccine_note: Optional[str] = Field(None, max_length=500)
    expected_farmers: Optional[int] = Field(None, ge=0)


class CampConfirmRequest(BaseModel):
    """Payload for VO to confirm a proposed camp."""
    vaccine_availability: Optional[str] = Field(None, pattern="^(UNKNOWN|AVAILABLE|UNAVAILABLE)$")
    vaccine_note: Optional[str] = Field(None, max_length=500)


class CampCancelRequest(BaseModel):
    """Payload to cancel a camp with mandatory reason."""
    cancelled_reason: str = Field(..., min_length=3, max_length=500, description="Mandatory documented cancellation reason")


class CampRescheduleRequest(BaseModel):
    """Payload to reschedule a camp to new planned dates."""
    new_planned_start: datetime = Field(..., description="Rescheduled start timestamp")
    new_planned_end: datetime = Field(..., description="Rescheduled end timestamp")
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for rescheduling")


class CampCompleteRequest(BaseModel):
    """Payload to mark camp completed."""
    notes: Optional[str] = Field(None, max_length=500)


class CampStaffCreate(BaseModel):
    """Payload to assign staff attendees to a camp."""
    user_id: uuid.UUID = Field(..., description="User to attend camp")
    camp_role: str = Field(..., pattern="^(VETERINARY_OFFICER|FIELD_WORKER|VACCINATOR|COOPERATIVE_COORDINATOR)$")


class CampStaffResponse(BaseModel):
    """Response representing assigned camp staff."""
    model_config = ConfigDict(from_attributes=True)

    camp_id: uuid.UUID
    user_id: uuid.UUID
    camp_role: str
    assigned_by: uuid.UUID
    assigned_at: datetime
    ended_at: Optional[datetime] = None


class CampResponse(BaseModel):
    """Standard camp response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    camp_code: Optional[str] = None
    campaign_id: uuid.UUID
    village_id: uuid.UUID
    organizer_type: str
    cooperative_id: Optional[uuid.UUID] = None
    planned_start: datetime
    planned_end: datetime
    location_text: Optional[str] = None
    status: str
    vaccine_availability: str
    vaccine_note: Optional[str] = None
    expected_farmers: Optional[int] = None
    proposed_by: uuid.UUID
    confirmed_by: Optional[uuid.UUID] = None
    confirmed_at: Optional[datetime] = None
    cancelled_reason: Optional[str] = None
    rescheduled_from: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

