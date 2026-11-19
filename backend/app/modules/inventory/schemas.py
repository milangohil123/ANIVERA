"""Pydantic v2 schemas for Vaccine Inventory domain."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class VaccineProductCreate(BaseModel):
    """Payload to register a new vaccine product in the catalogue."""
    code: str = Field(..., min_length=2, max_length=50, description="Product code (e.g. VACC-FMD-OIL)")
    name: str = Field(..., min_length=2, max_length=150, description="Product commercial name")
    programme_code: Optional[str] = Field(None, description="Linked programme code (e.g. FMD, HS, BQ)")
    unit_name: str = Field("DOSE", max_length=20, description="Dispensing unit name")


class VaccineProductResponse(BaseModel):
    """Vaccine product response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    programme_code: Optional[str] = None
    unit_name: str
    active: bool
    created_at: datetime


class VaccineStockLotCreate(BaseModel):
    """Payload to receive and register a new vaccine batch stock lot."""
    product_id: uuid.UUID = Field(..., description="Vaccine product identifier")
    district_id: uuid.UUID = Field(..., description="Target district for the inventory")
    batch_number: Optional[str] = Field(None, max_length=100, description="Manufacturer batch number")
    expiry_date: Optional[date] = Field(None, description="Manufacturer batch expiry date")
    received_date: Optional[date] = Field(None, description="Delivery receipt date")
    storage_location: Optional[str] = Field(None, max_length=200, description="Cold chain / storage facility name")
    quantity_received: Decimal = Field(..., gt=0, description="Received quantity in doses")
    source_reference: Optional[str] = Field(None, max_length=150, description="Challan or purchase order reference")
    notes: Optional[str] = Field(None, max_length=500)


class VaccineStockIssueRequest(BaseModel):
    """Payload to issue vaccine stock to a field location, camp, or health center."""
    quantity: Decimal = Field(..., gt=0, description="Quantity to issue")
    to_location: Optional[str] = Field(None, max_length=200, description="Destination clinic, camp, or field center")
    reference_type: Optional[str] = Field(None, max_length=50, description="e.g. CAMP, CAMPAIGN")
    reference_id: Optional[uuid.UUID] = Field(None, description="Linked entity ID")
    reason: Optional[str] = Field(None, max_length=500)


class VaccineStockAdjustRequest(BaseModel):
    """Payload to record stock adjustments, returns, or wastage."""
    transaction_type: str = Field(..., pattern="^(ADJUSTMENT_IN|ADJUSTMENT_OUT|RETURN|WASTAGE)$")
    quantity: Decimal = Field(..., gt=0, description="Adjustment quantity")
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory documented reason")


class VaccineStockLotResponse(BaseModel):
    """Response representing a vaccine stock lot and balance."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    district_id: uuid.UUID
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    received_date: Optional[date] = None
    storage_location: Optional[str] = None
    quantity_received: Decimal
    quantity_on_hand: Decimal
    status: str
    source_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VaccineStockTransactionResponse(BaseModel):
    """Response representing an inventory transaction record."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stock_lot_id: uuid.UUID
    transaction_type: str
    quantity: Decimal
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[uuid.UUID] = None
    reason: Optional[str] = None
    recorded_by: uuid.UUID
    recorded_at: datetime

