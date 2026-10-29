from datetime import date

import pytest

from applications.models import Application, Status
from core.factories import ApplicationFactory, ResumeVersionFactory, apply_status_path
from dashboard.services import applications_per_week, dashboard_stats, funnel, pipeline_counts

pytestmark = pytest.mark.django_db


@pytest.fixture
def dataset(user, other_user):
    """Four applications for `user` with known histories, plus noise owned by `other_user`.

    A: applied -> interview -> rejected   (reached phone screen and interview; now rejected)
    B: applied -> offer                   (skipped stages but still reached all of them)
    C: applied                            (no movement)
    D: applied -> phone_screen -> withdrawn
    A and B used resume "Backend v1"; C and D used no resume.
    """
    resume = ResumeVersionFactory(user=user, name="Backend v1")
    apply_status_path(ApplicationFactory(user=user, resume_version=resume), [Status.INTERVIEW, Status.REJECTED])
    apply_status_path(ApplicationFactory(user=user, resume_version=resume), [Status.OFFER])
    ApplicationFactory(user=user)
    apply_status_path(ApplicationFactory(user=user), [Status.PHONE_SCREEN, Status.WITHDRAWN])
    apply_status_path(ApplicationFactory(user=other_user), [Status.OFFER])


def stage_counts(result):
    return {row["stage"]: (row["count"], row["percent"]) for row in result["stages"]}


def test_funnel_counts_from_event_history(user, dataset):
    result = funnel(Application.objects.filter(user=user))
    assert result["total"] == 4
    assert stage_counts(result) == {
        "applied": (4, 100.0),
        "phone_screen": (3, 75.0),
        "interview": (2, 50.0),
        "offer": (1, 25.0),
    }


def test_funnel_with_no_applications(user):
    result = funnel(Application.objects.filter(user=user))
    assert result["total"] == 0
    assert all(row["count"] == 0 and row["percent"] == 0.0 for row in result["stages"])


def test_pipeline_counts_use_current_status(user, dataset):
    rows = pipeline_counts(Application.objects.filter(user=user))
    assert [row["status"] for row in rows] == [
        "applied",
        "phone_screen",
        "interview",
        "offer",
        "rejected",
        "withdrawn",
    ]
    assert {row["status"]: row["count"] for row in rows} == {
        "applied": 1,
        "phone_screen": 0,
        "interview": 0,
        "offer": 1,
        "rejected": 1,
        "withdrawn": 1,
    }


def test_applications_per_week_zero_fills_the_last_12_weeks(user):
    # 2026-10-27 is a Tuesday, so the current week starts Monday 2026-10-26.
    for day in [date(2026, 10, 27), date(2026, 10, 26), date(2026, 10, 21), date(2026, 8, 9)]:
        ApplicationFactory(user=user, date_applied=day)
    weeks = applications_per_week(Application.objects.filter(user=user), today=date(2026, 10, 27))
    assert len(weeks) == 12
    assert weeks[0] == {"week_start": "2026-08-10", "count": 0}
    assert weeks[-2] == {"week_start": "2026-10-19", "count": 1}
    assert weeks[-1] == {"week_start": "2026-10-26", "count": 2}
    assert sum(week["count"] for week in weeks) == 3  # 2026-08-09 falls before the window


def test_resume_performance_groups_by_version(user, dataset):
    rows = {row["name"]: row for row in dashboard_stats(user)["resume_performance"]}
    assert set(rows) == {"Backend v1", "None"}
    assert rows["Backend v1"]["total"] == 2
    assert stage_counts(rows["Backend v1"])["interview"] == (2, 100.0)
    assert stage_counts(rows["Backend v1"])["offer"] == (1, 50.0)
    assert rows["None"]["resume_version_id"] is None
    assert rows["None"]["total"] == 2
    assert stage_counts(rows["None"])["phone_screen"] == (1, 50.0)


def test_resume_performance_omits_none_row_when_every_application_has_a_resume(user):
    resume = ResumeVersionFactory(user=user, name="Only")
    ApplicationFactory(user=user, resume_version=resume)
    assert [row["name"] for row in dashboard_stats(user)["resume_performance"]] == ["Only"]


def test_stats_endpoint_returns_only_the_callers_data(auth_client, dataset):
    response = auth_client.get("/api/dashboard/stats/")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"pipeline", "funnel", "per_week", "resume_performance"}
    assert body["funnel"]["total"] == 4  # the other user's application is excluded


def test_stats_endpoint_requires_authentication(api_client):
    assert api_client.get("/api/dashboard/stats/").status_code == 401
