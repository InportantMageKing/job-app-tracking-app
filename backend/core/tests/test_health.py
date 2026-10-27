import pytest


@pytest.mark.django_db
def test_health_returns_ok_without_auth(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
