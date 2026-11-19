"""Pydantic v2 schemas for Maps and Geospatial Services domain."""
import uuid
from datetime import date
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class VillageMapPoint(BaseModel):
    """Village geographic data point with official boundary and metadata."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    village_id: uuid.UUID = Field(..., alias="villageId")
    code: str
    name_gu: str = Field(..., alias="nameGu")
    name_en: Optional[str] = Field(None, alias="nameEn")
    taluka_id: Optional[uuid.UUID] = Field(None, alias="talukaId")
    taluka_name_gu: Optional[str] = Field(None, alias="talukaNameGu")
    district_name_gu: Optional[str] = Field(None, alias="districtNameGu")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coord_status: str = Field("UNAVAILABLE", alias="coordStatus")
    is_pilot: bool = Field(False, alias="isPilot")
    assigned_vo_name: Optional[str] = Field(None, alias="assignedVoName")
    google_place_id: Optional[str] = Field(None, alias="googlePlaceId")
    formatted_address: Optional[str] = Field(None, alias="formattedAddress")
    boundary_geojson: Optional[Dict] = Field(None, alias="boundaryGeojson")


class VillageSurveillanceMapItem(BaseModel):
    """Surveillance layer metrics per village."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    village_id: uuid.UUID = Field(..., alias="villageId")
    suspected_count: int = Field(0, alias="suspectedCount")
    confirmed_count: int = Field(0, alias="confirmedCount")
    not_confirmed_count: int = Field(0, alias="notConfirmedCount")
    insufficient_count: int = Field(0, alias="insufficientCount")
    latest_report_date: Optional[date] = Field(None, alias="latestReportDate")
    status_label_gu: str = Field(..., alias="statusLabelGu")


class VillageVaccinationMapItem(BaseModel):
    """Vaccination coverage layer metrics per village."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    village_id: uuid.UUID = Field(..., alias="villageId")
    total_vaccinated_count: int = Field(0, alias="totalVaccinatedCount")
    total_registered_animals: int = Field(0, alias="totalRegisteredAnimals")
    coverage_percentage: float = Field(0.0, alias="coveragePercentage")
    pending_vaccinations: int = Field(0, alias="pendingVaccinations")
    threshold_configured: bool = Field(False, alias="thresholdConfigured")
    status_label_gu: str = Field("માહિતી ઉપલબ્ધ નથી", alias="statusLabelGu")


class MapLayersResponse(BaseModel):
    """Consolidated geospatial layers response strictly scope-enforced."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    mapped_villages: List[VillageMapPoint] = Field(..., alias="mappedVillages", description="Only VERIFIED coordinates")
    unmapped_villages: List[VillageMapPoint] = Field(..., alias="unmappedVillages", description="સ્થાન ઉપલબ્ધ નથી list")
    surveillance_layer: Dict[str, VillageSurveillanceMapItem] = Field(..., alias="surveillanceLayer")
    vaccination_layer: Dict[str, VillageVaccinationMapItem] = Field(..., alias="vaccinationLayer")

