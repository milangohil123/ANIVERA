"""Pydantic v2 schemas for Offline Synchronisation domain."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SyncEventItem(BaseModel):
    """Single queued event submitted from offline client."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    event_id: uuid.UUID = Field(..., alias="eventId", description="Client-generated stable UUID")
    type: str = Field(..., description="Domain event type: FARMER_REGISTRATION, ANIMAL_REGISTRATION, VACCINATION, TREATMENT, OBSERVATION, DISEASE_REPORT")
    client_created_at: datetime = Field(..., alias="clientCreatedAt", description="Device timestamp when record was created")
    schema_version: int = Field(1, alias="schemaVersion")
    payload: Dict[str, Any] = Field(..., description="Domain-specific record payload")


class SyncPushRequest(BaseModel):
    """Batch synchronisation push request (max 50 events per batch)."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    device_id: uuid.UUID = Field(..., alias="deviceId")
    client_time: Optional[datetime] = Field(None, alias="clientTime")
    offline_grant: Optional[str] = Field(None, alias="offlineGrant", description="Cryptographically signed offline authorization grant token")
    events: List[SyncEventItem] = Field(default_factory=list, max_length=50)


class SyncEventAck(BaseModel):
    """Per-record synchronisation outcome acknowledgement."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    event_id: uuid.UUID = Field(..., alias="eventId")
    status: str = Field(..., description="PostgreSQL permitted outcome: ACCEPTED, ALREADY_ACCEPTED, REJECTED, NEEDS_REVIEW, HELD_FOR_REVIEW")
    code: Optional[str] = None
    errors: Optional[List[Dict[str, Any]]] = None
    conflict_id: Optional[uuid.UUID] = Field(None, alias="conflictId")
    server_event_seq: Optional[int] = Field(None, alias="serverEventSeq")


class SyncPushResponse(BaseModel):
    """Batch synchronisation response containing per-record acknowledgements."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    batch_id: uuid.UUID = Field(..., alias="batchId")
    server_time: datetime = Field(..., alias="serverTime")
    total_received: int = Field(..., alias="totalReceived")
    accepted_count: int = Field(..., alias="acceptedCount")
    already_accepted_count: int = Field(..., alias="alreadyAcceptedCount")
    rejected_count: int = Field(..., alias="rejectedCount")
    needs_review_count: int = Field(..., alias="needsReviewCount")
    results: List[SyncEventAck]


class ConflictResolveRequest(BaseModel):
    """Authorised resolution of an open sync conflict."""
    resolution: str = Field(..., description="Decision summary: ACCEPT_CLIENT, KEEP_SERVER, DISCARD, MERGE")
    notes: Optional[str] = Field(None, description="Clinical or administrative notes justifying the resolution")


class SyncConflictItem(BaseModel):
    """Sync conflict record detail."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    event_id: Optional[uuid.UUID] = Field(None, alias="eventId")
    entity_type: str = Field(..., alias="entityType")
    entity_id: Optional[uuid.UUID] = Field(None, alias="entityId")
    conflict_type: str = Field(..., alias="conflictType")
    details: Dict[str, Any]
    status: str
    created_at: datetime = Field(..., alias="createdAt")
    resolved_at: Optional[datetime] = Field(None, alias="resolvedAt")
    resolved_by: Optional[uuid.UUID] = Field(None, alias="resolvedBy")
    resolution: Optional[str] = None


class SyncStatusSummary(BaseModel):
    """Device synchronization health and open conflict telemetry."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    device_id: uuid.UUID = Field(..., alias="deviceId")
    device_status: str = Field(..., alias="deviceStatus")
    last_sync_at: Optional[datetime] = Field(None, alias="lastSyncAt")
    open_conflicts_count: int = Field(..., alias="openConflictsCount")
    total_batches_synced: int = Field(..., alias="totalBatchesSynced")


class OfflineGrantIssueRequest(BaseModel):
    """Request to issue or renew a server offline authorization grant."""
    model_config = ConfigDict(populate_by_name=True)

    device_id: uuid.UUID = Field(..., alias="deviceId", description="Client device UUID")
    label: Optional[str] = Field(None, description="Client device label or model")


class OfflineGrantIssueResponse(BaseModel):
    """Server-issued offline authorization grant response (up to 7 days validity)."""
    model_config = ConfigDict(populate_by_name=True)

    offline_grant: str = Field(..., alias="offlineGrant", description="HS256 signed offline authorization grant token")
    token_type: str = Field("Bearer", alias="tokenType")
    expires_at: datetime = Field(..., alias="expiresAt")
    device_id: uuid.UUID = Field(..., alias="deviceId")
    user_id: uuid.UUID = Field(..., alias="userId")
    validity_days: int = Field(..., alias="validityDays")


class ReferenceDataVillage(BaseModel):
    """Scoped assigned village item."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    code: str
    name_gu: str = Field(..., alias="nameGu")
    name_en: str = Field(..., alias="nameEn")
    taluka_id: uuid.UUID = Field(..., alias="talukaId")
    district_id: Optional[uuid.UUID] = Field(None, alias="districtId")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    active: bool = True


class ReferenceDataFarmer(BaseModel):
    """Scoped farmer in assigned village."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    farmer_code: Optional[str] = Field(None, alias="farmerCode")
    full_name: str = Field(..., alias="fullName")
    name_norm: str = Field(..., alias="nameNorm")
    mobile_e164: Optional[str] = Field(None, alias="mobileE164")
    mobile_status: str = Field(..., alias="mobileStatus")
    village_id: uuid.UUID = Field(..., alias="villageId")
    address_text: Optional[str] = Field(None, alias="addressText")
    registration_status: str = Field(..., alias="registrationStatus")
    active: bool = True
    updated_at: datetime = Field(..., alias="updatedAt")


class ReferenceDataAnimal(BaseModel):
    """Scoped animal in assigned village."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    animal_code: Optional[str] = Field(None, alias="animalCode")
    species_code: str = Field(..., alias="speciesCode")
    breed_id: Optional[uuid.UUID] = Field(None, alias="breedId")
    sex: str = "UNKNOWN"
    birth_date: Optional[str] = Field(None, alias="birthDate")
    age_months_estimate: Optional[int] = Field(None, alias="ageMonthsEstimate")
    farmer_id: uuid.UUID = Field(..., alias="farmerId")
    village_id: uuid.UUID = Field(..., alias="villageId")
    registration_status: str = Field(..., alias="registrationStatus")
    status: str = "ACTIVE"
    tag12: Optional[str] = None
    updated_at: datetime = Field(..., alias="updatedAt")


class ReferenceDataQrToken(BaseModel):
    """Active cryptographic physical QR token."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    token: str
    animal_id: uuid.UUID = Field(..., alias="animalId")
    status: str = "ACTIVE"


class ReferenceDataSpecies(BaseModel):
    """Species master list item."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    code: str
    name_gu: str = Field(..., alias="nameGu")
    name_en: str = Field(..., alias="nameEn")


class ReferenceDataProgramme(BaseModel):
    """Vaccination programme item."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    code: str
    name_en: str = Field(..., alias="nameEn")


class ReferenceDataResponse(BaseModel):
    """Scoped reference-data response for authorized offline FW/VO usage."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    server_time: datetime = Field(..., alias="serverTime")
    since: Optional[datetime] = None
    offline_valid_days: int = Field(7, alias="offlineValidDays")
    permissions: List[str] = Field(default_factory=list)
    villages: List[ReferenceDataVillage] = Field(default_factory=list)
    farmers: List[ReferenceDataFarmer] = Field(default_factory=list)
    animals: List[ReferenceDataAnimal] = Field(default_factory=list)
    qr_tokens: List[ReferenceDataQrToken] = Field(default_factory=list, alias="qrTokens")
    species: List[ReferenceDataSpecies] = Field(default_factory=list)
    programmes: List[ReferenceDataProgramme] = Field(default_factory=list)



