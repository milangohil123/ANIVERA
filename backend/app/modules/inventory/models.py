"""SQLAlchemy ORM models for Vaccine Inventory domain.

Matches PostgreSQL patch v0.3 tables:
- vaccine_products
- vaccine_stock_lots
- vaccine_stock_transactions
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class VaccineProduct(Base):
    """Vaccine product master catalogue matching 'vaccine_products' table."""
    __tablename__ = "vaccine_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    programme_code: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("programmes.code"),
        nullable=True
    )
    unit_name: Mapped[str] = mapped_column(Text, default="DOSE", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    stock_lots: Mapped[List["VaccineStockLot"]] = relationship("VaccineStockLot", back_populates="product")


class VaccineStockLot(Base):
    """District vaccine stock batches matching 'vaccine_stock_lots' table."""
    __tablename__ = "vaccine_stock_lots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccine_products.id"),
        nullable=False
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("districts.id"),
        nullable=False
    )
    batch_number: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    received_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    storage_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity_received: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    quantity_on_hand: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    status: Mapped[str] = mapped_column(Text, default="AVAILABLE", nullable=False)
    source_reference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    product: Mapped["VaccineProduct"] = relationship("VaccineProduct", back_populates="stock_lots")
    transactions: Mapped[List["VaccineStockTransaction"]] = relationship("VaccineStockTransaction", back_populates="stock_lot")


class VaccineStockTransaction(Base):
    """Vaccine stock movement transactions matching 'vaccine_stock_transactions' table."""
    __tablename__ = "vaccine_stock_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stock_lot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccine_stock_lots.id"),
        nullable=False
    )
    transaction_type: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    from_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    to_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    stock_lot: Mapped["VaccineStockLot"] = relationship("VaccineStockLot", back_populates="transactions")

