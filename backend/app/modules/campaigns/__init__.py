"""Campaigns domain module."""
from app.modules.campaigns.models import (
    Campaign,
    CampaignAnimalTarget,
    CampaignAssignment,
    CampaignProgramme,
    CampaignVillage,
    CampaignVillageVerification,
    ScheduleVersion,
)

__all__ = [
    "Campaign",
    "CampaignAnimalTarget",
    "CampaignAssignment",
    "CampaignProgramme",
    "CampaignVillage",
    "CampaignVillageVerification",
    "ScheduleVersion",
]
