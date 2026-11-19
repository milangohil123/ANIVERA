"""Campaigns domain module."""
from app.modules.campaigns.models import (
    Campaign,
    CampaignAnimalTarget,
    CampaignAssignment,
    CampaignProgramme,
    CampaignVillage,
    ScheduleVersion,
)

__all__ = [
    "Campaign",
    "CampaignAnimalTarget",
    "CampaignAssignment",
    "CampaignProgramme",
    "CampaignVillage",
    "ScheduleVersion",
]
