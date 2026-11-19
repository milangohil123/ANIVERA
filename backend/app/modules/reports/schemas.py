"""Pydantic v2 schemas for Reports and Analytics domain."""
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CampaignCoverageReportItem(BaseModel):
    """Campaign vaccination coverage metrics per village."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    campaign_id: uuid.UUID = Field(..., alias="campaignId")
    campaign_name: str = Field(..., alias="campaignName")
    village_id: uuid.UUID = Field(..., alias="villageId")
    village_name_gu: str = Field(..., alias="villageNameGu")
    programme_code: str = Field(..., alias="programmeCode")
    eligible_count: int = Field(0, alias="eligibleCount")
    covered_count: int = Field(0, alias="coveredCount")
    target_configured: bool = Field(False, alias="targetConfigured")
    note: str = Field("વિભાગીય લક્ષ્યાંક રૂપરેખાંકિત નથી", alias="note")


class InventoryReportItem(BaseModel):
    """District vaccine inventory and lot transaction movement metrics."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    lot_id: uuid.UUID = Field(..., alias="lotId")
    product_code: str = Field(..., alias="productCode")
    product_name: str = Field(..., alias="productName")
    programme_code: Optional[str] = Field(None, alias="programmeCode")
    batch_number: str = Field(..., alias="batchNumber")
    received_doses: int = Field(0, alias="receivedDoses")
    issued_doses: int = Field(0, alias="issuedDoses")
    adjusted_doses: int = Field(0, alias="adjustedDoses")
    current_balance: int = Field(0, alias="currentBalance")
    expiry_date: Optional[date] = Field(None, alias="expiryDate")


class SurveillanceReportItem(BaseModel):
    """Village-level disease surveillance report keeping suspected and confirmed counts strictly separate."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    village_id: uuid.UUID = Field(..., alias="villageId")
    village_name_gu: str = Field(..., alias="villageNameGu")
    disease_code: str = Field(..., alias="diseaseCode")
    suspected_count: int = Field(0, alias="suspectedCount", description="Includes SUBMITTED, UNDER_REVIEW, SUSPECTED, NEEDS_MORE_INFORMATION")
    confirmed_count: int = Field(0, alias="confirmedCount", description="CONFIRMED cases only")
    not_confirmed_count: int = Field(0, alias="notConfirmedCount", description="NOT_CONFIRMED cases")
    insufficient_count: int = Field(0, alias="insufficientCount", description="INSUFFICIENT_INFORMATION cases")
    latest_report_date: Optional[date] = Field(None, alias="latestReportDate")
    data_freshness_status: str = Field("ડેટા ઉપલબ્ધ", alias="dataFreshnessStatus")


class RegistryCountsReportItem(BaseModel):
    """Village-level livestock registry counts."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    village_id: uuid.UUID = Field(..., alias="villageId")
    village_name_gu: str = Field(..., alias="villageNameGu")
    farmer_count: int = Field(0, alias="farmerCount")
    cattle_count: int = Field(0, alias="cattleCount")
    buffalo_count: int = Field(0, alias="buffaloCount")
    goat_count: int = Field(0, alias="goatCount")
    sheep_count: int = Field(0, alias="sheepCount")
    total_animals: int = Field(0, alias="totalAnimals")
    verified_animals: int = Field(0, alias="verifiedAnimals")


class StaffActivityReportItem(BaseModel):
    """Operational activity metrics for Field Workers and Veterinary Officers."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    staff_user_id: uuid.UUID = Field(..., alias="staffUserId")
    staff_name: str = Field(..., alias="staffName")
    role: str = Field(..., alias="role")
    registrations_count: int = Field(0, alias="registrationsCount")
    vaccinations_count: int = Field(0, alias="vaccinationsCount")
    disease_reports_count: int = Field(0, alias="diseaseReportsCount")


class CoopProgressReportItem(BaseModel):
    """Aggregate-only vaccination progress metrics for Dairy Cooperative coverage."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    village_id: uuid.UUID = Field(..., alias="villageId")
    village_name_gu: str = Field(..., alias="villageNameGu")
    total_animals: int = Field(0, alias="totalAnimals")
    vaccinated_count: int = Field(0, alias="vaccinatedCount")
    pending_count: int = Field(0, alias="pendingCount")


class ExportLogItem(BaseModel):
    """Export history audit record."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    export_type: str = Field(..., alias="exportType")
    filters: Optional[Dict[str, Any]] = None
    purpose: str
    row_count: Optional[int] = Field(None, alias="rowCount")
    formula_safe: bool = Field(True, alias="formulaSafe")
    created_at: datetime = Field(..., alias="createdAt")

