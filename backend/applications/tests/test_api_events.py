import pytest

from applications.models import EventType, Status
from core.factories import ApplicationFactory

pytestmark = pytest.mark.django_db


def events_url(application):
    return f"/api/applications/{application.pk}/events/"


@pytest.fixture
def application(user):
    return ApplicationFactory(user=user)


def test_add_note(auth_client, application):
    response = auth_client.post(
        events_url(application),
        {"event_type": "note", "note": "  Got an email from the recruiter  "},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["event_type"] == "note"
    assert body["note"] == "Got an email from the recruiter"
    assert body["to_status"] is None
    application.refresh_from_db()
    assert application.current_status == Status.APPLIED


def test_change_status(auth_client, application):
    response = auth_client.post(
        events_url(application),
        {"event_type": "status_change", "to_status": "interview", "note": "Onsite next week"},
    )
    assert response.status_code == 201
    body = response.json()
    assert (body["from_status"], body["to_status"], body["note"]) == ("applied", "interview", "Onsite next week")
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW


def test_change_status_without_note(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": "rejected"})
    assert response.status_code == 201
    assert response.json()["note"] == ""


def test_change_to_current_status_is_rejected(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": "applied"})
    assert response.status_code == 400
    assert response.json() == {"detail": "Application is already in status 'applied'."}
    assert application.events.count() == 1


def test_status_change_requires_to_status(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change"})
    assert response.status_code == 400
    assert "to_status" in response.json()


def test_unknown_status_is_rejected(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": "hired"})
    assert response.status_code == 400
    assert "to_status" in response.json()


def test_note_requires_text(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "note", "note": "   "})
    assert response.status_code == 400
    assert "note" in response.json()


def test_note_cannot_change_status(auth_client, application):
    response = auth_client.post(
        events_url(application),
        {"event_type": "note", "note": "hi", "to_status": "offer"},
    )
    assert response.status_code == 400
    assert "to_status" in response.json()
    application.refresh_from_db()
    assert application.current_status == Status.APPLIED


def test_unknown_event_type_is_rejected(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "party"})
    assert response.status_code == 400
    assert "event_type" in response.json()


def test_status_always_matches_latest_status_event(auth_client, application):
    for status in ["phone_screen", "interview", "rejected", "interview"]:
        response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": status})
        assert response.status_code == 201
        auth_client.post(events_url(application), {"event_type": "note", "note": f"after {status}"})
    application.refresh_from_db()
    latest = (
        application.events.filter(event_type=EventType.STATUS_CHANGE)
        .order_by("-created_at", "-id")
        .first()
    )
    assert application.current_status == latest.to_status == Status.INTERVIEW


def test_events_on_missing_application_return_404(auth_client):
    response = auth_client.post("/api/applications/999999/events/", {"event_type": "note", "note": "hi"})
    assert response.status_code == 404
