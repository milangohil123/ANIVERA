"""Animals domain module."""
from app.modules.animals.models import (
    Animal,
    AnimalExternalIdentifier,
    AnimalExternalId,
    AnimalOwnershipHistory,
    AnimalQRToken,
    AnimalVerification,
    OwnershipTransfer,
)

__all__ = [
    "Animal",
    "AnimalExternalIdentifier",
    "AnimalExternalId",
    "AnimalQRToken",
    "AnimalOwnershipHistory",
    "OwnershipTransfer",
    "AnimalVerification",
]


