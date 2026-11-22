"""Unit tests for TAHO GIS Analytics service layer."""
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import User, TahoTalukaAssignment
from app.modules.administration.taho_service import TahoService


@pytest.fixture
def mock_taho_user():
    return User(
        id=uuid.uuid4(),
        role="TAHO",
        full_name="Taluka Officer",
        username="taho_test",
        password_hash="hashed_pw",
        mobile_e164="+919800000001",
        status="ACTIVE",
    )


@pytest.mark.asyncio
async def test_get_gis_analytics_structure(mock_taho_user):
    """Test get_gis_analytics returns summary, legend, villages, charts and filter options."""
    mock_db = AsyncMock()
    service = TahoService(mock_db)

    taluka_id = uuid.uuid4()
    district_id = uuid.uuid4()
    mock_taluka = Taluka(id=taluka_id, code="TAL-001", name_en="Test Taluka", name_gu="ટેસ્ટ તાલુકો", district_id=district_id)
    mock_district = District(id=district_id, code="DIST-001", name_en="Test District", name_gu="ટેસ્ટ જિલ્લો")

    service.get_taho_taluka = AsyncMock(return_value=(mock_taluka, mock_district))

    v1 = Village(id=uuid.uuid4(), taluka_id=taluka_id, code="VIL-001", name_en="Village 1", name_gu="ગામ ૧")
    v2 = Village(id=uuid.uuid4(), taluka_id=taluka_id, code="VIL-002", name_en="Village 2", name_gu="ગામ ૨")

    mock_db.execute = AsyncMock()
    
    # Mock executions
    mock_villages_res = MagicMock()
    mock_villages_res.scalars.return_value.all.return_value = [v1, v2]

    mock_empty_res = MagicMock()
    mock_empty_res.fetchall.return_value = []

    # Sequence of execute returns
    mock_db.execute.side_effect = [
        mock_villages_res,  # villages query
        mock_empty_res,     # animals query
        mock_empty_res,     # farmers query
        mock_empty_res,     # vaccinations query
        mock_empty_res,     # disease reports query
        mock_empty_res,     # staff query
        mock_empty_res,     # campaigns query
    ]

    res = await service.get_gis_analytics(mock_taho_user, layer_mode="coverage")

    assert res["taluka_id"] == str(taluka_id)
    assert res["layer_mode"] == "coverage"
    assert "summary" in res
    assert "legend" in res
    assert len(res["legend"]) > 0
    assert "villages" in res
    assert len(res["villages"]) == 2
    assert "charts" in res
    assert "filter_options" in res
