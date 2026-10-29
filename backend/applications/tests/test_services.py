import pytest
from django.contrib.auth import get_user_model

from applications.models import ApplicationEvent, EventType, Status
from applications.services import (
    ApplicationRuleError,
    add_note,
    change_status,
    create_application,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return get_user_model().objects.create_user(username="owner", password="test-pass-123")


@pytest.fixture
def application(owner):
    return create_application(user=owner, company="Acme", job_title="Engineer")


def latest_status_event(application):
    return (
        application.events.filter(event_type=EventType.STATUS_CHANGE)
        .order_by("-created_at", "-id")
        .first()
    )


def test_create_writes_the_first_event(application):
    assert application.current_status == Status.APPLIED
    event = application.events.get()
    assert event.event_type == EventType.STATUS_CHANGE
    assert event.from_status is None
    assert event.to_status == Status.APPLIED


def test_create_ignores_a_requested_status(owner):
    application = create_application(
        user=owner, company="Acme", job_title="Engineer", current_status=Status.OFFER
    )
    assert application.current_status == Status.APPLIED


def test_change_status_updates_field_and_log(application):
    event = change_status(application=application, to_status=Status.INTERVIEW, note="  Onsite Friday  ")
    assert (event.from_status, event.to_status, event.note) == (
        Status.APPLIED,
        Status.INTERVIEW,
        "Onsite Friday",
    )
    assert application.current_status == Status.INTERVIEW
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW


def test_change_status_allows_any_transition(application):
    change_status(application=application, to_status=Status.REJECTED)
    change_status(application=application, to_status=Status.INTERVIEW)
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW


def test_change_to_the_current_status_is_rejected(application):
    with pytest.raises(ApplicationRuleError, match="already"):
        change_status(application=application, to_status=Status.APPLIED)
    assert application.events.count() == 1


def test_change_to_an_unknown_status_is_rejected(application):
    with pytest.raises(ApplicationRuleError, match="Unknown status"):
        change_status(application=application, to_status="hired")
    assert application.events.count() == 1


def test_current_status_always_matches_the_latest_status_event(application):
    for status in [Status.PHONE_SCREEN, Status.INTERVIEW, Status.REJECTED, Status.INTERVIEW]:
        change_status(application=application, to_status=status)
        add_note(application=application, note=f"after {status}")
    application.refresh_from_db()
    assert application.current_status == latest_status_event(application).to_status == Status.INTERVIEW


def test_add_note_keeps_the_status(application):
    event = add_note(application=application, note="  Recruiter emailed  ")
    assert (event.event_type, event.note, event.to_status) == (EventType.NOTE, "Recruiter emailed", None)
    application.refresh_from_db()
    assert application.current_status == Status.APPLIED


def test_add_note_rejects_blank_text(application):
    with pytest.raises(ApplicationRuleError, match="required"):
        add_note(application=application, note="   ")
    assert ApplicationEvent.objects.filter(event_type=EventType.NOTE).count() == 0
