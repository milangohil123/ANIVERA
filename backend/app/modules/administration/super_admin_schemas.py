"""Pydantic schemas for SUPER_ADMIN State-Level Administration Module."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SuperAdminGeographicKPIs(BaseModel):
    total_districts: int = 0
    districts_assigned: int = 0
    districts_unassigned: int = 0
    districts_pending_setup: int = 0
    total_talukas: int = 0
    talukas_assigned: int = 0
    talukas_unassigned: int = 0
    total_villages: int = 0
    villages_verified_geo: int = 0
    villages_missing_geo: int = 0
    geodata_import_status: str = "CONFIGURED"
    validation_issues_count: int = 0


class SuperAdminAccountKPIs(BaseModel):
    total_daho: int = 0
    active_daho: int = 0
    inactive_daho: int = 0
    suspended_daho: int = 0
    districts_without_daho: int = 0
    total_taho: int = 0
    total_vo: int = 0
    total_fw: int = 0
    total_farmers: int = 0
    total_cooperatives: int = 0
    total_gram_panchayats: int = 0
    pending_activations: int = 0
    incomplete_jurisdictions: int = 0


class DistrictVaccinationProgress(BaseModel):
    district_id: str
    district_name: str
    district_code: str
    target_animals: int = 0
    vaccinated_animals: int = 0
    coverage_pct: float = 0.0


class SuperAdminOperationalKPIs(BaseModel):
    active_campaigns: int = 0
    completed_campaigns: int = 0
    pending_campaigns: int = 0
    total_animals: int = 0
    total_farmers: int = 0
    total_vaccinations: int = 0
    district_vaccination_progress: List[DistrictVaccinationProgress] = Field(default_factory=list)
    total_disease_reports: int = 0
    suspected_cases: int = 0
    confirmed_cases: int = 0
    active_outbreak_alerts: int = 0
    districts_with_alerts: int = 0
    data_freshness: str = "LIVE"


class AssignedDahoInfo(BaseModel):
    user_id: str
    username: str
    full_name: str
    status: str
    mobile_e164: Optional[str] = None
    assigned_at: str


class DistrictSummaryItem(BaseModel):
    district_id: str
    code: str
    name_en: str
    name_gu: str
    name_hi: Optional[str] = None
    status: str  # ASSIGNED, UNASSIGNED, PENDING, CONFLICT
    assigned_daho: Optional[AssignedDahoInfo] = None
    taluka_count: int = 0
    village_count: int = 0
    total_animals: int = 0
    vaccinated_count: int = 0
    vaccination_coverage_pct: float = 0.0
    active_alerts_count: int = 0
    has_custom_boundary: bool = False
    custom_boundary_version: Optional[int] = None


class SuperAdminOverviewResponse(BaseModel):
    geographic_kpis: SuperAdminGeographicKPIs
    account_kpis: SuperAdminAccountKPIs
    operational_kpis: SuperAdminOperationalKPIs
    districts: List[DistrictSummaryItem]
    recent_audits: List[Dict[str, Any]] = Field(default_factory=list)


# ------------------------------------------------------------------------------
# DAHO Account Creation & Assignment Schemas
# ------------------------------------------------------------------------------
class DahoAccountCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    username: str = Field(..., min_length=3, max_length=64)
    email: Optional[str] = None
    mobile_e164: str = Field(..., min_length=10, max_length=20)
    designation: Optional[str] = "જિલ્લા પશુપાલન અધિકારી (DAHO)"
    organisation: Optional[str] = "જિલ્લા પંચાયત પશુપાલન શાખા"
    district_id: Optional[uuid.UUID] = None
    district_ids: Optional[List[uuid.UUID]] = None
    password: Optional[str] = None  # If omitted, a secure activation token is generated


class DahoAccountResponse(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: str
    status: str
    mobile_e164: Optional[str]
    email: Optional[str] = None
    assigned_district_id: Optional[str] = None
    assigned_district_name: Optional[str] = None
    assigned_district_ids: List[str] = Field(default_factory=list)
    assigned_district_names: List[str] = Field(default_factory=list)
    notification_status: str  # SENT, SIMULATED, FAILED, PENDING
    email_delivery_status: Optional[str] = None
    email_delivery_error: Optional[str] = None
    activation_token: Optional[str] = None
    created_at: str


# ------------------------------------------------------------------------------
# District Assignment & Reassignment Schemas
# ------------------------------------------------------------------------------
class DistrictReassignRequest(BaseModel):
    new_daho_user_id: uuid.UUID
    reason: str = Field(..., min_length=3, max_length=1000)


class DistrictReleaseRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


class AssignmentActionResponse(BaseModel):
    status: str
    district_id: str
    district_code: str
    district_name: str
    previous_daho_id: Optional[str] = None
    current_daho_id: Optional[str] = None
    current_daho_name: Optional[str] = None
    message: str
    timestamp: str


# ------------------------------------------------------------------------------
# Hierarchy & Jurisdiction Schemas
# ------------------------------------------------------------------------------
class VillageHierarchyItem(BaseModel):
    id: str
    code: str
    name_gu: str
    name_en: str
    census_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coord_status: str
    has_boundary: bool = False
    assigned_vo_name: Optional[str] = None
    assigned_fw_name: Optional[str] = None


class TalukaHierarchyItem(BaseModel):
    id: str
    code: str
    name_gu: str
    name_en: str
    village_count: int
    villages: List[VillageHierarchyItem] = Field(default_factory=list)


class DistrictHierarchyResponse(BaseModel):
    district_id: str
    code: str
    name_en: str
    name_gu: str
    name_hi: Optional[str] = None
    active: bool
    current_daho: Optional[AssignedDahoInfo] = None
    assignment_history: List[Dict[str, Any]] = Field(default_factory=list)
    talukas: List[TalukaHierarchyItem] = Field(default_factory=list)
    total_talukas: int
    total_villages: int
    total_animals: int
    total_vaccinations: int
    active_campaigns: int
    custom_boundary: Optional[Dict[str, Any]] = None


# ------------------------------------------------------------------------------
# Custom Jurisdiction Schemas
# ------------------------------------------------------------------------------
class CustomJurisdictionCreateRequest(BaseModel):
    boundary_geojson: Dict[str, Any]
    reason: str = Field(..., min_length=3, max_length=1000)


class CustomJurisdictionResponse(BaseModel):
    id: str
    district_id: str
    version: int
    boundary_geojson: Dict[str, Any]
    reason: str
    status: str
    affected_taluka_ids: List[str] = Field(default_factory=list)
    affected_village_ids: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: str


# ------------------------------------------------------------------------------
# Geographic Data Import Schemas
# ------------------------------------------------------------------------------
class GeodataValidationReport(BaseModel):
    source_name: str
    dataset_version: Optional[str]
    total_features_detected: int
    valid_features: int
    invalid_features: int
    duplicate_features: int
    hierarchy_complete: bool
    warnings: List[str] = Field(default_factory=list)
    preview_records: List[Dict[str, Any]] = Field(default_factory=list)


class GeodataVillageItem(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)
    name_gu: str = Field(..., min_length=1, max_length=255)
    name_en: str = Field(..., min_length=1, max_length=255)
    census_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coord_status: Optional[str] = "UNAVAILABLE"  # VERIFIED, APPROXIMATE, UNAVAILABLE


class GeodataTalukaItem(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)
    name_gu: str = Field(..., min_length=1, max_length=255)
    name_en: str = Field(..., min_length=1, max_length=255)
    census_code: Optional[str] = None
    villages: List[GeodataVillageItem] = Field(default_factory=list)


class GeodataCommitRequest(BaseModel):
    district_id: uuid.UUID
    source_name: Optional[str] = "Official Administrative Source"
    dataset_version: Optional[str] = "1.0"
    talukas: List[GeodataTalukaItem] = Field(default_factory=list)
    relink_existing_names: bool = True
    features: Optional[List[Dict[str, Any]]] = None


class GeodataImportResult(BaseModel):
    import_id: str
    source_name: str
    dataset_version: Optional[str]
    districts_applied: int
    talukas_applied: int
    villages_applied: int
    total_rows_applied: int
    timestamp: str
    notes: Optional[str] = None


# ------------------------------------------------------------------------------
# Geographic Data Quality & Audit Schemas (Section 11 & 12)
# ------------------------------------------------------------------------------
class StatewideQualitySummary(BaseModel):
    total_districts: int
    verified_districts: int
    total_talukas: int
    verified_talukas: int
    talukas_with_polygons: int
    total_villages: int
    official_gis_villages: int
    villages_with_polygons: int
    villages_missing_polygons: int
    villages_verified_coords: int
    invalid_geometries: int
    duplicate_name_candidates: int
    orphan_records: int
    source_dataset: str
    dataset_version: str
    last_import_at: Optional[str] = None


class JamnagarAuditTaluka(BaseModel):
    name_en: str
    code: str
    total_villages: int
    polygon_count: int
    has_taluka_boundary: bool


class JamnagarManualVillage(BaseModel):
    code: str
    name_en: str
    taluka_name: str
    farmers_count: int
    animals_count: int
    canonical_match_name: Optional[str] = None
    canonical_match_code: Optional[str] = None


class JamnagarAuditDetail(BaseModel):
    district_code: str
    district_name: str
    total_talukas: int
    total_villages: int
    official_gis_villages: int
    pre_existing_manual_villages: int
    polygon_coverage_pct: float
    duplicate_candidates_count: int
    operational_farmers: int
    operational_animals: int
    assigned_daho: Optional[str] = None
    talukas: List[JamnagarAuditTaluka] = Field(default_factory=list)
    manual_villages: List[JamnagarManualVillage] = Field(default_factory=list)


class GeographicQualityAuditResponse(BaseModel):
    statewide_summary: StatewideQualitySummary
    jamnagar_audit: JamnagarAuditDetail
    district_breakdown: List[DistrictSummaryItem] = Field(default_factory=list)


# ------------------------------------------------------------------------------
# Email Logs Schemas
# ------------------------------------------------------------------------------
class EmailLogResponse(BaseModel):
    id: str
    recipient_email: str
    recipient_user_id: Optional[str] = None
    subject: str
    body_preview: Optional[str] = None
    status: str
    provider: str
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: str
    updated_at: str


class EmailLogsListResponse(BaseModel):
    total: int
    items: List[EmailLogResponse] = Field(default_factory=list)


# ------------------------------------------------------------------------------
# TAHO Administrative Workflows & Taluka Jurisdiction Schemas
# ------------------------------------------------------------------------------
class TahoAccountCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    username: str = Field(..., min_length=3, max_length=64)
    email: Optional[str] = None
    mobile_e164: str = Field(..., min_length=10, max_length=20)
    designation: Optional[str] = "તાલુકા પશુપાલન અધિકારી (TAHO)"
    organisation: Optional[str] = "તાલુકા પંચાયત પશુપાલન શાખા"
    taluka_id: Optional[uuid.UUID] = None
    password: Optional[str] = None


class TahoAccountResponse(BaseModel):
    user_id: str
    username: str
    full_name: str
    email: Optional[str] = None
    mobile_e164: str
    role: str = "TAHO"
    status: str
    assigned_taluka_id: Optional[str] = None
    assigned_taluka_name: Optional[str] = None
    email_status: str
    email_error: Optional[str] = None
    activation_token: Optional[str] = None
    created_at: str


class TalukaAssignTahoRequest(BaseModel):
    taho_user_id: uuid.UUID
    reason: Optional[str] = "Administrative Taluka Assignment"


class TalukaReleaseTahoRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


class TahoSearchItem(BaseModel):
    user_id: str
    username: str
    full_name: str
    email: Optional[str] = None
    mobile_e164: str
    status: str
    assigned_taluka_id: Optional[str] = None
    assigned_taluka_name: Optional[str] = None
    assigned_district_name: Optional[str] = None


class DahoTalukaWithTaho(BaseModel):
    taluka_id: str
    district_id: str
    district_name: str
    code: str
    name_en: str
    name_gu: str
    village_count: int
    assigned_taho: Optional[Dict[str, Any]] = None

