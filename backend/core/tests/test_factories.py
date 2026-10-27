import re

import pytest

from applications.models import EventType, Status
from core.factories import (
    MINIMAL_PDF,
    TEST_PASSWORD,
    ApplicationFactory,
    ResumeVersionFactory,
    UserFactory,
    apply_status_path,
)

pytestmark = pytest.mark.django_db


def test_user_factory_sets_a_usable_password():
    user = UserFactory()
    assert user.check_password(TEST_PASSWORD)


def test_application_factory_goes_through_the_service():
    application = ApplicationFactory()
    assert application.current_status == Status.APPLIED
    assert application.events.get().event_type == EventType.STATUS_CHANGE


def test_resume_factory_stores_a_real_file():
    resume = ResumeVersionFactory()
    assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", resume.file.name)
    with resume.file.open("rb") as handle:
        assert handle.read() == MINIMAL_PDF


def test_apply_status_path_logs_each_move():
    application = ApplicationFactory()
    apply_status_path(application, [Status.PHONE_SCREEN, Status.INTERVIEW])
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW
    assert application.events.filter(event_type=EventType.STATUS_CHANGE).count() == 3
