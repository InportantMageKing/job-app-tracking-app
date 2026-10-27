import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from applications.models import (
    Application,
    ApplicationEvent,
    EventType,
    Status,
    stages_at_or_after,
)


@pytest.fixture
def application(db):
    owner = get_user_model().objects.create_user(username="owner", password="test-pass-123")
    return Application.objects.create(user=owner, company="Acme", job_title="Engineer")


def test_stages_at_or_after_returns_the_stage_and_later_stages():
    assert stages_at_or_after(Status.APPLIED) == [
        Status.APPLIED,
        Status.PHONE_SCREEN,
        Status.INTERVIEW,
        Status.OFFER,
    ]
    assert stages_at_or_after(Status.INTERVIEW) == [Status.INTERVIEW, Status.OFFER]
    assert stages_at_or_after(Status.OFFER) == [Status.OFFER]


@pytest.mark.parametrize("outcome", [Status.REJECTED, Status.WITHDRAWN])
def test_stages_at_or_after_rejects_outcomes(outcome):
    with pytest.raises(ValueError):
        stages_at_or_after(outcome)


def test_new_application_defaults(application):
    assert application.current_status == Status.APPLIED
    assert application.date_applied is not None
    assert application.resume_version is None


def test_status_change_event_requires_to_status(application):
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationEvent.objects.create(application=application, event_type=EventType.STATUS_CHANGE)


def test_note_event_requires_text(application):
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note="")


def test_note_event_cannot_carry_a_status(application):
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationEvent.objects.create(
            application=application,
            event_type=EventType.NOTE,
            note="Recruiter called",
            to_status=Status.OFFER,
        )


def test_valid_events_save(application):
    ApplicationEvent.objects.create(
        application=application,
        event_type=EventType.STATUS_CHANGE,
        from_status=None,
        to_status=Status.APPLIED,
    )
    ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note="Recruiter called")
    assert application.events.count() == 2


def test_deleting_an_application_deletes_its_events(application):
    ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note="hello")
    application.delete()
    assert ApplicationEvent.objects.count() == 0
