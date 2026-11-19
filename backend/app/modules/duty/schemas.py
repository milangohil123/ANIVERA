"""Pydantic schemas for Field Worker Duty Management, Live Location Tracking & Smart Assignments."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ------------------------------------------------------------------------------
# 1. Duty Sessions & Location Schemas
# ------------------------------------------------------------------------------

class DutyStartRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Initial GPS latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Initial GPS longitude")
    accuracy: Optional[float] = Field(None, ge=0.0, description="GPS accuracy in meters")
    device_status: Optional[str] = Field("ONLINE", description="Device status e.g. ONLINE, BATTERY_OK")


class DutyStartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    session_id: uuid.UUID
    fw_user_id: uuid.UUID
    status: str
    start_time: datetime
    last_known_latitude: Optional[float] = None
    last_known_longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    message: str = "ડ્યૂટી સફળતાપૂર્વક શરૂ થઈ ગઈ છે."


class DutyEndRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Optional completion or shift end note")


class DutyEndResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    session_id: uuid.UUID
    fw_user_id: uuid.UUID
    status: str
    end_time: datetime
    message: str = "ડ્યૂટી સફળતાપૂર્વક પૂર્ણ થઈ ગઈ છે."


class LocationUpdateRequest(BaseModel):
    session_id: Optional[uuid.UUID] = Field(None, description="Active duty session ID if known")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy: Optional[float] = Field(None, ge=0.0)
    source: str = Field("GPS", description="Location source: GPS, BROWSER, NETWORK")
    recorded_at: Optional[datetime] = Field(None, description="Device timestamp")


class LocationUpdateResponse(BaseModel):
    success: bool = True
    session_id: uuid.UUID
    recorded_at: datetime
    message: str = "સ્થાન સફળતાપૂર્વક અપડેટ થયું."


class DutyStatusResponse(BaseModel):
    is_on_duty: bool
    session_id: Optional[uuid.UUID] = None
    start_time: Optional[datetime] = None
    last_known_latitude: Optional[float] = None
    last_known_longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    location_accuracy: Optional[float] = None
    freshness: str  # 'FRESH', 'STALE', 'UNAVAILABLE', 'INACTIVE'
    minutes_since_update: Optional[int] = None


# ------------------------------------------------------------------------------
# 2. VO Live Field Worker Tracking Map Schemas
# ------------------------------------------------------------------------------

class LiveFieldWorkerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    fw_user_id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    mobile_e164: Optional[str] = None
    designation: Optional[str] = None
    duty_status: str  # 'ACTIVE', 'INACTIVE'
    freshness: str    # 'FRESH', 'STALE', 'UNAVAILABLE', 'INACTIVE'
    last_known_latitude: Optional[float] = None
    last_known_longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    last_location_update: Optional[datetime] = None
    minutes_since_update: Optional[int] = None
    nearest_village_name_gu: Optional[str] = None
    assigned_villages_count: int = 0
    assigned_villages_gu: List[str] = []
    active_assignments_count: int = 0
    pending_complaints_count: int = 0
    availability_status: str  # 'AVAILABLE', 'BUSY', 'OFF_DUTY'


class VoLiveFieldWorkersResponse(BaseModel):
    total_field_workers: int
    active_on_duty: int
    fresh_location_count: int
    stale_location_count: int
    field_workers: List[LiveFieldWorkerItem]


# ------------------------------------------------------------------------------
# 3. Complaint & Assignment Group Schemas
# ------------------------------------------------------------------------------

class ComplaintItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    reference_no: str
    requester_name: str
    contact_number: Optional[str] = None
    village_id: uuid.UUID
    village_name_gu: str
    village_name_en: str
    farmer_id: Optional[uuid.UUID] = None
    farmer_name: Optional[str] = None
    animal_id: Optional[uuid.UUID] = None
    animal_code: Optional[str] = None
    animal_description: Optional[str] = None
    problem_text: str
    source: str
    status: str
    created_at: datetime
    priority: str = "NORMAL"


class ComplaintGroupItemDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    complaint_id: uuid.UUID
    complaint_type: str
    village_id: uuid.UUID
    village_name_gu: str
    village_code: str
    requester_name: Optional[str] = None
    contact_number: Optional[str] = None
    problem_text: Optional[str] = None
    animal_code: Optional[str] = None
    status: str
    outcome_note: Optional[str] = None
    visited_at: Optional[datetime] = None


class ComplaintGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    group_code: str
    district_id: uuid.UUID
    taluka_id: Optional[uuid.UUID] = None
    taluka_name_gu: Optional[str] = None
    status: str
    priority: str
    total_complaints: int
    villages_count: int
    villages_summary_gu: List[str]
    centroid_latitude: Optional[float] = None
    centroid_longitude: Optional[float] = None
    assigned_fw_id: Optional[uuid.UUID] = None
    assigned_fw_name: Optional[str] = None
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assignment_reason: Optional[str] = None
    created_at: datetime
    items: List[ComplaintGroupItemDetail] = []


# ------------------------------------------------------------------------------
# 4. Field Worker Recommendation Schemas
# ------------------------------------------------------------------------------

class FwRecommendationItem(BaseModel):
    fw_user_id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    mobile_e164: Optional[str] = None
    distance_km: float
    freshness: str  # 'FRESH', 'STALE', 'UNAVAILABLE', 'INACTIVE'
    duty_status: str
    last_known_latitude: Optional[float] = None
    last_known_longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    active_assignments_count: int
    pending_complaints_count: int
    assigned_villages_count: int
    is_village_assigned: bool
    score: float
    rank: int
    recommendation_reason: str


class GroupRecommendationsResponse(BaseModel):
    group_id: uuid.UUID
    group_code: str
    centroid_lat: Optional[float] = None
    centroid_lng: Optional[float] = None
    suggestion_radius_km: float = 80.0
    has_eligible_recommendations: bool
    notice_gu: Optional[str] = None
    recommendations: List[FwRecommendationItem]


# ------------------------------------------------------------------------------
# 5. VO Assignment Requests
# ------------------------------------------------------------------------------

class AssignFwRequest(BaseModel):
    fw_user_id: uuid.UUID
    reason: Optional[str] = Field(None, description="Mandatory if manual/outside 80km or stale")


class AssignmentActionResponse(BaseModel):
    success: bool
    group_id: uuid.UUID
    assigned_fw_id: uuid.UUID
    assigned_fw_name: str
    status: str
    message: str


class FwStatusUpdateRequest(BaseModel):
    action: str = Field(..., description="'ACCEPT', 'START_VISIT', 'COMPLETE'")
    complaint_id: Optional[uuid.UUID] = Field(None, description="Optional specific complaint item id")
    outcome_note: Optional[str] = Field(None, description="Outcome note on visit completion")


# ------------------------------------------------------------------------------
# 6. Manual Complaint Registration by VO / Farmer Request Creation
# ------------------------------------------------------------------------------

class CreateHelpRequestPayload(BaseModel):
    requester_name: str
    contact_number: Optional[str] = None
    village_id: uuid.UUID
    farmer_id: Optional[uuid.UUID] = None
    animal_id: Optional[uuid.UUID] = None
    animal_description: Optional[str] = None
    problem_text: str
    priority: str = "NORMAL"

