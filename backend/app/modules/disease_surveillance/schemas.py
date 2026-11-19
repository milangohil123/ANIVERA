"""Pydantic v2 schemas for Disease Surveillance and Reporting domain."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DiseaseReportCreate(BaseModel):
    """Payload to submit a suspected livestock disease incident."""
    animal_id: Optional[Union[uuid.UUID, str]] = Field(None, description="Optional individual animal ID or animal code")
    farmer_id: Optional[Union[uuid.UUID, str]] = Field(None, description="Optional owner farmer identifier or farmer code")
    village_id: Optional[Union[uuid.UUID, str]] = Field(None, description="Village location of suspected disease")
    disease_code: str = Field("UNKNOWN", max_length=50, description="Suspected disease label (e.g. FMD, HS, BQ, PPR, UNKNOWN)")
    report_date: Optional[date] = Field(None, description="Date symptoms were noticed")
    symptoms: List[str] = Field(default_factory=list, description="Observed symptom tags")
    observation_text: Optional[str] = Field(None, max_length=1000, description="Clinical field narrative")
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None

    # Farmer / Mobile App specific field aliases
    primary_symptom: Optional[str] = None
    symptom_onset_date: Optional[date] = None
    notes: Optional[str] = None
    affected_count: Optional[int] = 1
    dead_count: Optional[int] = 0
    report_source: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_disease_report_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Clean string UUID / code fields if empty, null, or undefined
            for id_field in ("animal_id", "farmer_id", "village_id"):
                val = data.get(id_field)
                if val in ("", "null", "undefined", None):
                    data[id_field] = None
                elif isinstance(val, str):
                    clean_str = val.strip()
                    if clean_str in ("", "null", "undefined"):
                        data[id_field] = None
                    else:
                        # If it's a standard 32 or 36 hex UUID string, parse to uuid.UUID
                        try:
                            data[id_field] = uuid.UUID(clean_str)
                        except (ValueError, AttributeError):
                            # Retain as clean string (e.g. 'ANM-BOT-000017' or 'FRM-BOT-000009') for service-level resolution
                            data[id_field] = clean_str

            # Clean date fields if empty
            if data.get("report_date") in ("", "null", "undefined", None):
                data["report_date"] = data.get("symptom_onset_date") or date.today().isoformat()
            if data.get("symptom_onset_date") in ("", "null", "undefined", None):
                data["symptom_onset_date"] = None

            # 2. Derive disease_code if missing or default
            symptom = str(data.get("primary_symptom") or "")
            if not data.get("disease_code") or data.get("disease_code") == "UNKNOWN":
                if "FMD" in symptom or "મોં અને ખરી" in symptom:
                    data["disease_code"] = "FMD"
                elif "Lumpy" in symptom or "ગાંઠો" in symptom:
                    data["disease_code"] = "LSD"
                elif "HS" in symptom or "ગળામાં સોજો" in symptom:
                    data["disease_code"] = "HS"
                elif "તાવ" in symptom or "Fever" in symptom:
                    data["disease_code"] = "FEVER"
                elif "ખોરાક" in symptom or "સુસ્તી" in symptom:
                    data["disease_code"] = "GENERAL_SICKNESS"
                elif "દૂધ" in symptom:
                    data["disease_code"] = "MILK_DROP"
                else:
                    data["disease_code"] = data.get("disease_code") or "OTHER"

            # 3. Add primary_symptom into symptoms list if not already present
            symptoms = list(data.get("symptoms") or [])
            if data.get("primary_symptom") and data.get("primary_symptom") not in symptoms:
                symptoms.append(data.get("primary_symptom"))
            data["symptoms"] = symptoms

            # 4. Fallback observation_text from notes / primary_symptom
            if not data.get("observation_text"):
                parts = []
                if data.get("primary_symptom"):
                    parts.append(f"લક્ષણ: {data['primary_symptom']}")
                if data.get("notes"):
                    parts.append(str(data["notes"]))
                if data.get("affected_count") and int(data.get("affected_count", 1)) > 1:
                    parts.append(f"અસરગ્રસ્ત પશુ: {data['affected_count']}")
                data["observation_text"] = " | ".join(parts) if parts else "પશુ બીમારી અહેવાલ"

        return data


class DiseaseReportReviewCreate(BaseModel):
    """Payload for Veterinary Officer to record a triage review or investigation."""
    review_type: str = Field(..., pattern="^(INITIAL_REVIEW|FIELD_INVESTIGATION|VETERINARY_EXAMINATION|SECOND_OPINION)$")
    assessment: str = Field(..., pattern="^(SUSPECTED|NEEDS_MORE_INFORMATION|INSUFFICIENT_INFORMATION|NO_OPINION)$")
    basis: Optional[str] = Field(None, max_length=1000, description="Clinical / diagnostic basis for review")


class DiseaseReportConfirmRequest(BaseModel):
    """Payload for authorised veterinary authority to confirm or disprove a disease case."""
    action: str = Field(..., pattern="^(CONFIRM|DISPROVE|INSUFFICIENT)$")
    confirmation_basis: Optional[str] = Field(None, max_length=1000, description="Mandatory when confirming disease case")
    not_confirmed_reason: Optional[str] = Field(None, max_length=1000, description="Mandatory when disproving disease case")


class DiseaseReportResponse(BaseModel):
    """Standard disease report response."""
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    report_no: Optional[str] = None
    animal_id: Optional[uuid.UUID] = None
    farmer_id: Optional[uuid.UUID] = None
    village_id: uuid.UUID
    disease_code: str
    report_source: str
    report_date: date
    symptoms: List[str]
    observation_text: Optional[str] = None
    status: str
    reported_by: uuid.UUID
    received_at: datetime
    confirmed_by: Optional[uuid.UUID] = None
    confirmed_at: Optional[datetime] = None
    confirmation_basis: Optional[str] = None
    not_confirmed_reason: Optional[str] = None


class DiseaseReviewResponse(BaseModel):
    """Review log response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewer_role: str
    review_type: str
    assessment: str
    basis: Optional[str] = None
    authorised_to_confirm: bool
    at: datetime


class SurveillanceSummaryResponse(BaseModel):
    """Surveillance village level aggregation."""
    village_id: uuid.UUID
    disease_code: str
    suspected_count: int
    confirmed_count: int
    not_confirmed_count: int
    insufficient_count: int
    last_report_at: Optional[datetime] = None


class DiseaseReportAttachmentResponse(BaseModel):
    """Attachment metadata response matching disease_report_attachments without internal file paths."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    report_id: uuid.UUID = Field(..., alias="reportId")
    sha256: str
    mime_type: str = Field(..., alias="mimeType")
    size_bytes: int = Field(..., alias="sizeBytes")
    uploaded_by: uuid.UUID = Field(..., alias="uploadedBy")
    uploaded_at: datetime = Field(..., alias="uploadedAt")
    is_duplicate: bool = Field(False, alias="isDuplicate", description="True if identical attachment already existed on report")

