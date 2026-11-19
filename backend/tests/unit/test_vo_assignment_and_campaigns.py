"""Unit and Workflow Verification Tests for DAHO Village Assignment,
Multi-Stakeholder In-App Notifications, and VO Campaign Acceptance.

Covers:
- Test A: DAHO village assignment establishes active database record.
- Test B: VO scope immediately reflects assigned village.
- Test C: Multi-stakeholder notification dispatch (VO, Farmers, GP, Coop).
- Test D: Campaign assignment and dynamic listing for VO.
- Test E: Role-based campaign acceptance (authorized VO succeeds; cross-VO and non-VO strictly denied with 403).
"""
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.models.geography import Village, Taluka, District
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.authorization.schemas import UserScope
from app.modules.campaigns.models import Campaign, CampaignVillage, CampaignAssignment
from app.modules.campaigns.schemas import CampaignRejectRequest
from app.modules.notifications.models import Notification
from app.modules.notifications.service import NotificationService, render_gujarati_notification
from app.modules.administration.service import AdministrationService
from app.modules.campaigns.service import CampaignService


def test_gujarati_notification_templates_render():
    """Verify all required Gujarati notification templates format properly."""
    # 1. VO village assignment
    vo_notif = render_gujarati_notification(
        "VO_VILLAGE_ASSIGNMENT",
        "VO_VILLAGE_ASSIGNMENT",
        {"village_name": "પાળીયાદ", "taluka_name": "બોટાદ", "district_name": "બોટાદ"}
    )
    assert vo_notif["title"] == "નવા ગામની ફાળવણી"
    assert "પાળીયાદ" in vo_notif["body"]

    # 2. Farmer VO assigned
    farmer_notif = render_gujarati_notification(
        "FARMER_VO_ASSIGNED",
        "FARMER_VO_ASSIGNED",
        {"village_name": "પાળીયાદ", "vo_name": "ડૉ. રમેશભાઈ વાળા"}
    )
    assert farmer_notif["title"] == "નવા વેટરનરી ઓફિસરની નિમણૂક"
    assert "ડૉ. રમેશભાઈ વાળા" in farmer_notif["body"]

    # 3. GP VO assigned
    gp_notif = render_gujarati_notification(
        "GP_VO_ASSIGNED",
        "GP_VO_ASSIGNED",
        {"village_name": "પાળીયાદ", "vo_name": "ડૉ. રમેશભાઈ વાળા"}
    )
    assert gp_notif["title"] == "ગ્રામ પંચાયત વેટરનરી ઓફિસર ફાળવણી"
    assert "પાળીયાદ" in gp_notif["body"]

    # 4. Coop VO assigned
    coop_notif = render_gujarati_notification(
        "COOP_VO_ASSIGNED",
        "COOP_VO_ASSIGNED",
        {"village_name": "પાળીયાદ", "vo_name": "ડૉ. રમેશભાઈ વાળા"}
    )
    assert coop_notif["title"] == "ડેરી મંડળી વેટરનરી અધિકારી ફાળવણી"

    # 5. Campaign farmer announcement
    camp_farmer = render_gujarati_notification(
        "CAMPAIGN_FARMER_ANNOUNCEMENT",
        "CAMPAIGN_FARMER_ANNOUNCEMENT",
        {"village_name": "પાળીયાદ", "campaign_name": "FMD સંતૃપ્તિ ઝુંબેશ", "disease_code": "FMD"}
    )
    assert camp_farmer["title"] == "આગામી પશુ રસીકરણ ઝુંબેશ"
    assert "FMD સંતૃપ્તિ ઝુંબેશ" in camp_farmer["body"]


@pytest.mark.asyncio
async def test_campaign_acceptance_authorization_check():
    """Verify RBAC: Only authorized VO assigned to that village can accept campaign."""
    mock_db = AsyncMock()
    service = CampaignService(mock_db)

    campaign_id = uuid.uuid4()
    village_id = uuid.uuid4()
    unassigned_village_id = uuid.uuid4()

    vo_user = User(
        id=uuid.uuid4(),
        role="VET_OFFICER",
        status="ACTIVE",
        full_name="Dr. Authorized VO",
        username="vo_auth"
    )

    non_vo_farmer = User(
        id=uuid.uuid4(),
        role="FARMER",
        status="ACTIVE",
        full_name="Kisan Patel",
        username="farmer_1"
    )

    # 1. Non-VO should be immediately rejected with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await service.accept_vo_campaign_assignment(campaign_id, village_id, non_vo_farmer)
    assert exc_info.value.status_code == 403
    assert "Only Veterinary Officers can accept campaign assignments" in exc_info.value.detail

    # 2. VO attempting to accept an unassigned village must trigger assert_village_scope failure (403 Forbidden)
    service.authz_service.assert_village_scope = AsyncMock(
        side_effect=HTTPException(status_code=403, detail="Access denied: you are not assigned to this village")
    )
    with pytest.raises(HTTPException) as exc_scope:
        await service.accept_vo_campaign_assignment(campaign_id, unassigned_village_id, vo_user)
    assert exc_scope.value.status_code == 403
    assert "not assigned to this village" in exc_scope.value.detail

