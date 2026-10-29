import pytest
from django.db import OperationalError, connection


@pytest.mark.django_db
def test_health_returns_ok_without_auth(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_health_returns_503_when_the_database_is_unreachable(api_client, monkeypatch):
    def unreachable():
        raise OperationalError("connection refused")

    monkeypatch.setattr(connection, "ensure_connection", unreachable)
    response = api_client.get("/api/health/")
    assert response.status_code == 503
    assert response.json() == {"status": "database unavailable"}
