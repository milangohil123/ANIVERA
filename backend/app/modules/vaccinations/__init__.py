"""Vaccinations domain module."""
from app.modules.vaccinations.models import (
    AnimalEvent,
    EventCorrection,
    ObservationDetail,
    TreatmentDetail,
    VaccinationDetail,
    VaccinatorAuthorization,
)
from app.modules.vaccinations.repository import VaccinationRepository, VaccinationsRepository
from app.modules.vaccinations.endpoints import router

__all__ = [
    "AnimalEvent",
    "VaccinationDetail",
    "TreatmentDetail",
    "ObservationDetail",
    "EventCorrection",
    "VaccinatorAuthorization",
    "VaccinationRepository",
    "VaccinationsRepository",
    "router",
]
