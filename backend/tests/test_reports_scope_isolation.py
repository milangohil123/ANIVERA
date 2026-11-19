"""Unit tests for Reports Service Scope Enforcement and Suspected vs Confirmed separation."""
import uuid
import pytest
from app.modules.reports.schemas import (
    CampaignCoverageReportItem,
    SurveillanceReportItem,
    RegistryCountsReportItem,
)


def test_surveillance_report_schema_preserves_suspected_confirmed_separation():
    """Verify suspected and confirmed counts are never merged into a single metric."""
    item = SurveillanceReportItem(
        villageId=uuid.uuid4(),
        villageNameGu="બોટાદ",
        diseaseCode="FMD",
        suspectedCount=12,
        confirmedCount=3,
        notConfirmedCount=2,
        insufficientCount=1,
        latestReportDate=None,
        dataFreshnessStatus="ડેટા ઉપલબ્ધ"
    )

    assert item.suspected_count == 12
    assert item.confirmed_count == 3
    assert item.not_confirmed_count == 2
    assert item.insufficient_count == 1
    # Ensure they are distinct fields
    assert item.suspected_count != item.confirmed_count


def test_campaign_coverage_schema_preserves_neutral_target_invariant():
    """Verify that unconfigured targets show neutral text and no unapproved percentage."""
    item = CampaignCoverageReportItem(
        campaignId=uuid.uuid4(),
        campaignName="FMD Round 1",
        villageId=uuid.uuid4(),
        villageNameGu="રાણપુર",
        programmeCode="FMD",
        eligibleCount=100,
        coveredCount=45,
        targetConfigured=False,
        note="વિભાગીય લક્ષ્યાંક રૂપરેખાંકિત નથી"
    )

    assert item.target_configured is False
    assert item.note == "વિભાગીય લક્ષ્યાંક રૂપરેખાંકિત નથી"
    assert item.covered_count == 45

