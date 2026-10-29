from datetime import timedelta
from io import StringIO
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from applications.models import Application, EventType

pytestmark = pytest.mark.django_db

SEED_USERS = ["tester1", "tester2"]


def seed(applications=10):
    out = StringIO()
    call_command("seed_testing", applications=applications, stdout=out)
    return out.getvalue()


def test_creates_two_users_with_resumes_and_applications():
    output = seed()
    for username in SEED_USERS:
        user = get_user_model().objects.get(username=username)
        assert user.check_password("testing-pass-123")
        assert user.applications.count() == 10
        assert user.resume_versions.count() == 3
        assert f"{username} / testing-pass-123" in output


def test_is_idempotent():
    seed()
    seed()
    assert get_user_model().objects.filter(username__in=SEED_USERS).count() == 2
    for username in SEED_USERS:
        user = get_user_model().objects.get(username=username)
        assert user.applications.count() == 10
        assert user.resume_versions.count() == 3


def test_rerun_cleans_up_old_resume_files(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        seed()
        seed()
    stored = list((Path(settings.MEDIA_ROOT) / "resumes").iterdir())
    assert len(stored) == 6  # 3 resume versions x 2 users, nothing left over from the first run


def test_current_status_matches_latest_status_event():
    seed()
    for application in Application.objects.filter(user__username__in=SEED_USERS):
        latest = (
            application.events.filter(event_type=EventType.STATUS_CHANGE)
            .order_by("-created_at", "-id")
            .first()
        )
        assert application.current_status == latest.to_status


def test_history_is_backdated_and_consistent_with_date_applied():
    seed()
    now = timezone.now()
    applications = Application.objects.filter(user__username__in=SEED_USERS)
    all_event_times = []
    for application in applications:
        first = application.events.get(event_type=EventType.STATUS_CHANGE, from_status__isnull=True)
        assert timezone.localdate(first.created_at) == application.date_applied
        all_event_times.extend(application.events.values_list("created_at", flat=True))
    assert all(now - timedelta(days=61) <= moment <= now for moment in all_event_times)
    assert any(moment < now - timedelta(days=7) for moment in all_event_times)


def test_seeded_user_can_log_in_and_load_the_dashboard(api_client):
    seed()
    login = api_client.post("/api/auth/login/", {"username": "tester1", "password": "testing-pass-123"})
    assert login.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {login.json()['token']}")
    stats = api_client.get("/api/dashboard/stats/")
    assert stats.status_code == 200
    assert stats.json()["funnel"]["total"] == 10


def snapshot():
    """What a seeded dataset looks like, independent of database IDs and the exact run time."""
    rows = []
    for application in Application.objects.filter(user__username__in=SEED_USERS).order_by("user__username", "pk"):
        rows.append(
            (
                application.user.username,
                application.company,
                application.job_title,
                application.source,
                application.resume_version.name if application.resume_version else None,
                application.current_status,
                (timezone.localdate() - application.date_applied).days,
                application.events.count(),
            )
        )
    return rows


def test_the_same_seed_produces_the_same_data():
    call_command("seed_testing", applications=10, seed=7, stdout=StringIO())
    first = snapshot()
    call_command("seed_testing", applications=10, seed=7, stdout=StringIO())
    assert snapshot() == first


def test_a_different_seed_produces_different_data():
    call_command("seed_testing", applications=10, seed=7, stdout=StringIO())
    first = snapshot()
    call_command("seed_testing", applications=10, seed=8, stdout=StringIO())
    assert snapshot() != first


def test_updated_at_matches_the_latest_event():
    seed()
    for application in Application.objects.filter(user__username__in=SEED_USERS):
        latest = application.events.order_by("-created_at").first()
        assert application.updated_at == max(latest.created_at, application.created_at)


def test_creates_a_superuser_for_the_django_admin(client):
    output = seed()
    admin = get_user_model().objects.get(username="qa-admin")
    assert admin.is_superuser and admin.is_staff
    assert "qa-admin / testing-pass-123" in output
    assert client.login(username="qa-admin", password="testing-pass-123")
    assert client.get("/admin/applications/application/").status_code == 200


def test_rerun_keeps_a_single_superuser_and_leaves_other_admins_alone():
    get_user_model().objects.create_superuser(username="admin", password="my-own-pass-123")
    seed()
    seed()
    assert get_user_model().objects.filter(username="qa-admin").count() == 1
    assert get_user_model().objects.get(username="admin").check_password("my-own-pass-123")
