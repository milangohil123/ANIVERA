"""Inventory domain module."""
from app.modules.inventory.models import (
    VaccineProduct,
    VaccineStockLot,
    VaccineStockTransaction,
)
from app.modules.inventory.endpoints import router

__all__ = [
    "VaccineProduct",
    "VaccineStockLot",
    "VaccineStockTransaction",
    "router",
]
