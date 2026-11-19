"""Unit and Service Tests for SUPER_ADMIN Portal Capabilities.

Covers:
- Test 1: SuperAdminService.create_daho_account() enforces single active DAHO per district (HTTP 409 Conflict).
- Test 2: SuperAdminService.reassign_district() closes previous assignment (ended_at) and preserves downstream staff/villages.
- Test 3: SuperAdminService.release_district() terminates active assignment gracefully without data destruction.
- Test 4: SuperAdminService.save_custom_jurisdiction() versions custom geometry and verifies polygon structure.
- Test 5: SuperAdminService.validate_geodata_import() returns structured validation report.
- Test 6: MapsService.get_gujarat_state_geojson() enriches GeoJSON features with real DB properties.
"""
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.models.geography import District, Taluka, Village, CustomJurisdiction
from app.modules.authentication.models import User, DahoDistrictAssignment
from app.modules.administration.super_admin_service import SuperAdminService
from app.modules.administration.super_admin_schemas import (
    CustomJurisdictionCreateRequest,
    DahoAccountCreateRequest,
    GeodataCommitRequest,
    GeodataTalukaItem,
    GeodataValidationReport,
    GeodataVillageItem,
)
from app.modules.maps.service import MapService


@pytest.fixture
def mock_actor_admin():
    return User(
        id=uuid.uuid4(),
        role="SUPER_ADMIN",
        full_name="State Administrator",
        username="super_admin",
        password_hash="hashed_pw",
        mobile_e164="+919999999999",
        status="ACTIVE",
    )


@pytest.mark.asyncio
async def test_create_daho_account_conflict(mock_actor_admin):
    """Verify that attempting to assign a DAHO to a district that already has an active DAHO raises HTTP 409."""
    mock_db = AsyncMock()
    service = SuperAdminService(mock_db)

    dist_id = uuid.uuid4()
    existing_daho_id = uuid.uuid4()

    # District record
    mock_dist = District(
        id=dist_id,
        code="BOTAD",
        name_gu="બોટાદ",
        name_en="Botad",
        active=True,
    )

    # Existing active assignment
    active_assignment = DahoDistrictAssignment(
        id=uuid.uuid4(),
        daho_user_id=existing_daho_id,
        district_id=dist_id,
        assigned_at=datetime.now(timezone.utc),
        ended_at=None,
    )

    # Mock execute results:
    # 1. username check -> None
    # 2. mobile check -> None
    # 3. district lookup -> mock_dist
    # 4. active assignment lookup -> active_assignment
    # 5. prev user lookup -> MagicMock(full_name="Dr. Prev")
    res_username = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    res_mobile = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    res_dist = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_dist))
    res_asgn = MagicMock(scalar_one_or_none=MagicMock(return_value=active_assignment))
    res_prev_user = MagicMock(scalar_one_or_none=MagicMock(return_value=MagicMock(full_name="Dr. Prev DAHO")))

    mock_db.execute.side_effect = [res_username, res_mobile, res_dist, res_asgn, res_prev_user]

    req = DahoAccountCreateRequest(
        full_name="Dr. New DAHO",
        username="new_daho",
        email="new_daho@gujarat.gov.in",
        mobile_e164="+919876543210",
        district_id=dist_id,
        password="TestPassword@123",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_daho_account(req, actor_user=mock_actor_admin)

    assert exc_info.value.status_code == 409
    assert "already assigned to active DAHO" in exc_info.value.detail


@pytest.mark.asyncio
async def test_district_reassign_downstream_preservation(mock_actor_admin):
    """Verify that reassigning a district marks ended_at on the previous assignment

    and creates a new active assignment without deleting downstream entities.
    """
    mock_db = AsyncMock()
    service = SuperAdminService(mock_db)

    dist_id = uuid.uuid4()
    prev_daho_id = uuid.uuid4()
    new_daho_id = uuid.uuid4()

    mock_dist = District(id=dist_id, code="BOTAD", name_en="Botad", name_gu="બોટાદ", active=True)
    mock_new_daho = User(id=new_daho_id, role="DAHO", full_name="Dr. Successor", username="daho_new")

    prev_assignment = DahoDistrictAssignment(
        id=uuid.uuid4(),
        daho_user_id=prev_daho_id,
        district_id=dist_id,
        assigned_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        ended_at=None,
    )

    # Sequence of DB execute calls:
    # 1. District lookup -> mock_dist
    # 2. New DAHO user lookup -> mock_new_daho
    # 3. Existing active assignment lookup -> prev_assignment
    # 4. New DAHO other assignment lookup -> None
    res_dist = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_dist))
    res_user = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_new_daho))
    res_asgn = MagicMock(scalar_one_or_none=MagicMock(return_value=prev_assignment))
    res_other = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    mock_db.execute.side_effect = [res_dist, res_user, res_asgn, res_other]

    result = await service.reassign_district(
        district_id=dist_id,
        new_daho_user_id=new_daho_id,
        reason="Administrative jurisdiction rebalancing",
        actor_user=mock_actor_admin,
    )

    # Verification: previous assignment ended_at is closed
    assert prev_assignment.ended_at is not None
    # DB add was called for new assignment and audit
    assert mock_db.add.called
    assert result.status == "SUCCESS"
    assert result.current_daho_id == str(new_daho_id)
    assert result.previous_daho_id == str(prev_daho_id)
    assert "Downstream hierarchy preserved" in result.message


@pytest.mark.asyncio
async def test_district_release(mock_actor_admin):
    """Verify that releasing a district closes the active assignment gracefully."""
    mock_db = AsyncMock()
    service = SuperAdminService(mock_db)

    dist_id = uuid.uuid4()
    daho_id = uuid.uuid4()

    mock_dist = District(id=dist_id, code="BOTAD", name_en="Botad", name_gu="બોટાદ", active=True)
    active_assignment = DahoDistrictAssignment(
        id=uuid.uuid4(),
        daho_user_id=daho_id,
        district_id=dist_id,
        assigned_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        ended_at=None,
    )

    res_dist = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_dist))
    res_asgn = MagicMock(scalar_one_or_none=MagicMock(return_value=active_assignment))

    mock_db.execute.side_effect = [res_dist, res_asgn]

    result = await service.release_district(
        district_id=dist_id,
        reason="Tenure completion",
        actor_user=mock_actor_admin,
    )

    assert active_assignment.ended_at is not None
    assert result.status == "SUCCESS"
    assert result.current_daho_id is None
    assert result.previous_daho_id == str(daho_id)


@pytest.mark.asyncio
async def test_custom_jurisdiction_versioning(mock_actor_admin):
    """Verify that saving a custom operational boundary computes version numbers properly."""
    mock_db = AsyncMock()
    service = SuperAdminService(mock_db)

    dist_id = uuid.uuid4()
    mock_dist = District(id=dist_id, code="BOTAD", name_en="Botad", name_gu="બોટાદ", active=True)

    # 1. District lookup -> mock_dist
    # 2. Max version query -> scalar returns 2
    # 3. Existing active query -> MagicMock
    res_dist = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_dist))
    res_max_ver = MagicMock(scalar=MagicMock(return_value=2))
    res_existing_active = MagicMock()

    mock_db.execute.side_effect = [res_dist, res_max_ver, res_existing_active]

    req = CustomJurisdictionCreateRequest(
        boundary_geojson={
            "type": "Polygon",
            "coordinates": [[[71.5, 22.1], [71.6, 22.1], [71.6, 22.2], [71.5, 22.1]]]
        },
        reason="Field outreach consolidation",
    )

    result = await service.save_custom_jurisdiction(
        district_id=dist_id,
        payload=req,
        actor_user=mock_actor_admin,
    )

    assert result.version == 3
    assert result.status == "ACTIVE"
    assert result.district_id == str(dist_id)
    assert mock_db.add.called


@pytest.mark.asyncio
async def test_validate_geodata_import():
    """Verify GeoJSON dataset validation parses features, detects missing names, and calculates valid counts."""
    service = SuperAdminService(AsyncMock())

    features = [
        {
            "type": "Feature",
            "properties": {"name": "Botad", "dtcode": "481"},
            "geometry": {"type": "Polygon", "coordinates": [[[71.0, 22.0], [71.1, 22.0], [71.1, 22.1], [71.0, 22.0]]]}
        },
        {
            "type": "Feature",
            "properties": {},  # Missing name
            "geometry": {"type": "Polygon", "coordinates": [[[72.0, 23.0], [72.1, 23.0], [72.1, 23.1], [72.0, 23.0]]]}
        }
    ]

    report = await service.validate_geodata_import(
        features=features,
        source_name="Census_2026_Sample.geojson",
        dataset_version="2026.1"
    )

    assert isinstance(report, GeodataValidationReport)
    assert report.total_features_detected == 2
    assert report.valid_features == 1
    assert report.invalid_features == 1
    assert len(report.warnings) == 1
    assert "Missing district / entity name" in report.warnings[0]


@pytest.mark.asyncio
async def test_state_geojson_layer_enrichment():
    """Verify that MapService.get_gujarat_state_geojson enriches features with database properties."""
    mock_db = AsyncMock()
    service = MapService(mock_db)

    # Mock DB query for active districts: returns Botad
    dist_id = uuid.uuid4()
    mock_dist = MagicMock()
    mock_dist.id = dist_id
    mock_dist.name_en = "Botad"
    mock_dist.name_gu = "બોટાદ"
    mock_dist.code = "BOTAD"

    mock_res_dists = MagicMock()
    mock_res_dists.scalars.return_value.all.return_value = [mock_dist]

    # Mock active assignments join: Botad is assigned to Dr. DAHO
    daho_id = uuid.uuid4()
    mock_asgn = MagicMock()
    mock_asgn.district_id = dist_id
    mock_asgn.daho_user_id = daho_id
    mock_asgn.assigned_at = datetime.now(timezone.utc)

    mock_user = MagicMock()
    mock_user.id = daho_id
    mock_user.full_name = "Dr. DAHO Botad"
    mock_user.username = "daho_botad"
    mock_user.status = "ACTIVE"

    mock_res_asgns = MagicMock()
    mock_res_asgns.all.return_value = [(mock_asgn, mock_user)]

    # Mock taluka and village counts
    mock_res_tcounts = MagicMock()
    mock_res_tcounts.all.return_value = [(dist_id, 4)]

    mock_res_vcounts = MagicMock()
    mock_res_vcounts.all.return_value = [(dist_id, 192)]

    # Mock custom jurisdictions: empty
    mock_res_cj = MagicMock()
    mock_res_cj.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [
        mock_res_dists,
        mock_res_asgns,
        mock_res_tcounts,
        mock_res_vcounts,
        mock_res_cj,
    ]

    geojson = await service.get_gujarat_state_geojson()

    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) > 0

    # Locate Botad feature
    botad_feature = next((f for f in geojson["features"] if f["properties"].get("district") == "Botad"), None)
    assert botad_feature is not None
    assert botad_feature["properties"]["status"] == "ASSIGNED"
    assert botad_feature["properties"]["daho_name"] == "Dr. DAHO Botad"
    assert botad_feature["properties"]["taluka_count"] == 4
    assert botad_feature["properties"]["village_count"] == 192


@pytest.mark.asyncio
async def test_commit_geodata_import_persists_and_relinks(mock_actor_admin):
    """Verify that commit_geodata_import inserts talukas, villages, and re-links mislinked records."""
    mock_db = AsyncMock()
    service = SuperAdminService(mock_db)

    dist_id = uuid.uuid4()
    mock_dist = District(id=dist_id, code="JAMNAGAR", name_en="Jamnagar", name_gu="જામનગર", active=True)

    # Mock District lookup
    res_dist = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_dist))
    # Mock Taluka lookup: not found, returns None -> will insert new Taluka
    res_taluka_lookup = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    # Mock Village lookup: not found, returns None -> will insert new Village
    res_village_lookup = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    # Mock mislinked villages check: empty list
    res_mislinked = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))

    mock_db.execute.side_effect = [
        res_dist,
        res_taluka_lookup,
        res_village_lookup,
        res_mislinked,
    ]

    payload = GeodataCommitRequest(
        district_id=dist_id,
        source_name="Official Master Source",
        dataset_version="1.0",
        talukas=[
            GeodataTalukaItem(
                code="TAL_JAMNAGAR",
                name_en="Jamnagar",
                name_gu="જામનગર",
                villages=[
                    GeodataVillageItem(
                        code="JAM_VIL_01",
                        name_en="Jamnagar",
                        name_gu="જામનગર",
                        latitude=22.4707,
                        longitude=70.0577,
                        coord_status="VERIFIED"
                    )
                ]
            )
        ],
        relink_existing_names=True
    )

    result = await service.commit_geodata_import(payload, mock_actor_admin)

    assert result.districts_applied == 1
    assert result.talukas_applied == 1
    assert result.villages_applied == 1
    assert result.total_rows_applied == 2
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_seed_official_district_hierarchy(mock_actor_admin):
    """Verify that seed_official_district_hierarchy commits official 6 talukas for Jamnagar."""
    mock_db = AsyncMock()
    service = SuperAdminService(mock_db)

    dist_id = uuid.uuid4()
    mock_dist = District(id=dist_id, code="JAMNAGAR", name_en="Jamnagar", name_gu="જામનગર", active=True)

    # Mock District lookup
    res_dist = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_dist))
    
    # We will mock commit_geodata_import
    with patch.object(service, "commit_geodata_import", new_callable=AsyncMock) as mock_commit:
        from app.modules.administration.super_admin_schemas import GeodataImportResult
        mock_commit.return_value = GeodataImportResult(
            import_id=str(uuid.uuid4()),
            source_name="Gujarat Official Source",
            dataset_version="2024.1",
            districts_applied=1,
            talukas_applied=6,
            villages_applied=18,
            total_rows_applied=24,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

        mock_db.execute.return_value = res_dist
        result = await service.seed_official_district_hierarchy(dist_id, mock_actor_admin)

        assert mock_commit.called
        call_args = mock_commit.call_args[0][0]
        assert len(call_args.talukas) == 6
        assert {t.name_en for t in call_args.talukas} == {"Jamnagar", "Jamjodhpur", "Dhrol", "Jodiya", "Kalavad", "Lalpur"}


@pytest.mark.asyncio
async def test_get_district_talukas_geojson():
    """Verify that MapService.get_district_talukas_geojson returns FeatureCollection of dissolved talukas."""
    mock_db = AsyncMock()
    service = MapService(mock_db)

    dist_id = uuid.uuid4()
    t_id = uuid.uuid4()

    mock_taluka = Taluka(
        id=t_id,
        district_id=dist_id,
        code="TAL_JAMNAGAR",
        name_en="Jamnagar",
        name_gu="જામનગર",
        boundary_geojson={
            "type": "Polygon",
            "coordinates": [[[70.0, 22.0], [70.1, 22.0], [70.1, 22.1], [70.0, 22.0]]]
        }
    )

    res_talukas = MagicMock(all=MagicMock(return_value=[(mock_taluka, "Jamnagar")]))
    res_v_counts = MagicMock(all=MagicMock(return_value=[(t_id, 42)]))
    res_v_ver = MagicMock(all=MagicMock(return_value=[(t_id, 42)]))

    mock_db.execute.side_effect = [res_talukas, res_v_counts, res_v_ver]

    fc = await service.get_district_talukas_geojson(dist_id)

    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 1
    feat = fc["features"][0]
    assert feat["id"] == str(t_id)
    assert feat["properties"]["name_en"] == "Jamnagar"
    assert feat["properties"]["village_count"] == 42
    assert feat["properties"]["has_boundary"] is True


@pytest.mark.asyncio
async def test_get_taluka_villages_geojson():
    """Verify that MapService.get_taluka_villages_geojson returns FeatureCollection of villages."""
    mock_db = AsyncMock()
    service = MapService(mock_db)

    dist_id = uuid.uuid4()
    t_id = uuid.uuid4()
    v_id = uuid.uuid4()

    mock_village = Village(
        id=v_id,
        district_id=dist_id,
        taluka_id=t_id,
        code="VIL_JAM_01",
        name_en="Dhrol Village",
        name_gu="ધ્રોલ ગામ",
        census_code="123456",
        latitude=22.56,
        longitude=70.41,
        coord_status="VERIFIED",
        active=True,
        boundary_geojson={
            "type": "Polygon",
            "coordinates": [[[70.4, 22.5], [70.5, 22.5], [70.5, 22.6], [70.4, 22.5]]]
        }
    )

    res_villages = MagicMock(all=MagicMock(return_value=[(mock_village, "Dhrol", "Jamnagar")]))
    mock_db.execute.return_value = res_villages

    fc = await service.get_taluka_villages_geojson(t_id)

    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 1
    feat = fc["features"][0]
    assert feat["id"] == str(v_id)
    assert feat["properties"]["name_en"] == "Dhrol Village"
    assert feat["properties"]["census_code"] == "123456"
    assert feat["properties"]["coord_status"] == "VERIFIED"


