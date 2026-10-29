from datetime import date, timedelta

import pytest
from django.utils import timezone

from applications.models import Application, ApplicationEvent, EventType, Source, Status
from applications.serializers import ApplicationSerializer
from applications.services import add_note
from core.factories import ApplicationFactory, ResumeVersionFactory, apply_status_path

pytestmark = pytest.mark.django_db

URL = "/api/applications/"

NEW_APPLICATION = {
    "company": "Acme",
    "job_title": "Backend Engineer",
    "source": "linkedin",
    "link": "https://example.com/jobs/1",
    "date_applied": "2026-10-20",
    "location": "Remote",
    "salary_range": "$90k-$110k",
    "contact_person": "Jo Recruiter",
}


def detail_url(application):
    return f"{URL}{application.pk}/"


def ids(response):
    return [row["id"] for row in response.json()]


def test_requires_authentication(api_client):
    assert api_client.get(URL).status_code == 401


def test_create_application(auth_client, user):
    response = auth_client.post(URL, NEW_APPLICATION)
    assert response.status_code == 201
    body = response.json()
    assert body["current_status"] == "applied"
    assert body["resume_version"] is None
    assert body["resume_version_name"] is None
    application = Application.objects.get(pk=body["id"])
    assert application.user == user
    event = application.events.get()
    assert (event.event_type, event.from_status, event.to_status) == (
        EventType.STATUS_CHANGE,
        None,
        Status.APPLIED,
    )


def test_create_ignores_current_status_in_payload(auth_client):
    response = auth_client.post(URL, {**NEW_APPLICATION, "current_status": "offer"})
    assert response.status_code == 201
    assert response.json()["current_status"] == "applied"


def test_create_requires_company_and_job_title(auth_client):
    response = auth_client.post(URL, {"source": "linkedin"})
    assert response.status_code == 400
    assert {"company", "job_title"} <= set(response.json())


def test_create_with_own_resume_version(auth_client, user):
    resume = ResumeVersionFactory(user=user, name="Backend v1")
    response = auth_client.post(URL, {**NEW_APPLICATION, "resume_version": resume.pk})
    assert response.status_code == 201
    assert response.json()["resume_version"] == resume.pk
    assert response.json()["resume_version_name"] == "Backend v1"


def test_create_with_another_users_resume_version_is_rejected(auth_client, other_user):
    resume = ResumeVersionFactory(user=other_user)
    response = auth_client.post(URL, {**NEW_APPLICATION, "resume_version": resume.pk})
    assert response.status_code == 400
    assert "resume_version" in response.json()
    assert not Application.objects.exists()


def test_list_returns_only_own_applications_newest_first(auth_client, user, other_user):
    older = ApplicationFactory(user=user, date_applied=date(2026, 10, 1))
    newer = ApplicationFactory(user=user, date_applied=date(2026, 10, 15))
    ApplicationFactory(user=other_user)
    response = auth_client.get(URL)
    assert response.status_code == 200
    assert ids(response) == [newer.pk, older.pk]


def test_list_filters_by_status(auth_client, user):
    moved = ApplicationFactory(user=user)
    apply_status_path(moved, [Status.INTERVIEW])
    ApplicationFactory(user=user)
    assert ids(auth_client.get(URL, {"status": "interview"})) == [moved.pk]


def test_list_filters_by_source(auth_client, user):
    referral = ApplicationFactory(user=user, source=Source.REFERRAL)
    ApplicationFactory(user=user, source=Source.INDEED)
    assert ids(auth_client.get(URL, {"source": "referral"})) == [referral.pk]


def test_list_search_matches_company_or_title(auth_client, user):
    by_company = ApplicationFactory(user=user, company="Globex", job_title="Engineer")
    by_title = ApplicationFactory(user=user, company="Initech", job_title="Globetrotter Analyst")
    ApplicationFactory(user=user, company="Umbrella", job_title="Analyst")
    assert set(ids(auth_client.get(URL, {"search": "glob"}))) == {by_company.pk, by_title.pk}


def test_list_ordering_by_company(auth_client, user):
    beta = ApplicationFactory(user=user, company="Beta")
    alpha = ApplicationFactory(user=user, company="Alpha")
    assert ids(auth_client.get(URL, {"ordering": "company"})) == [alpha.pk, beta.pk]


def test_retrieve_includes_events_newest_first(auth_client, user):
    application = ApplicationFactory(user=user)
    add_note(application=application, note="Recruiter emailed")
    response = auth_client.get(detail_url(application))
    assert response.status_code == 200
    assert [event["event_type"] for event in response.json()["events"]] == ["note", "status_change"]


def test_patch_updates_fields_but_never_status(auth_client, user):
    application = ApplicationFactory(user=user, company="Old Name")
    response = auth_client.patch(detail_url(application), {"company": "New Name", "current_status": "offer"})
    assert response.status_code == 200
    application.refresh_from_db()
    assert application.company == "New Name"
    assert application.current_status == Status.APPLIED


def test_put_is_not_allowed(auth_client, user):
    application = ApplicationFactory(user=user)
    assert auth_client.put(detail_url(application), NEW_APPLICATION).status_code == 405


def test_delete_removes_application_and_events(auth_client, user):
    application = ApplicationFactory(user=user)
    assert auth_client.delete(detail_url(application)).status_code == 204
    assert not Application.objects.exists()
    assert not ApplicationEvent.objects.exists()


def test_patch_never_overwrites_a_concurrent_status_change(user):
    """A PATCH that loaded the row before a status change must not write the old status back."""
    from rest_framework.test import APIRequestFactory

    from applications.serializers import ApplicationSerializer
    from applications.services import change_status

    application = ApplicationFactory(user=user, company="Old Name")
    stale = Application.objects.get(pk=application.pk)  # what a PATCH's get_object() would have loaded
    change_status(application=application, to_status=Status.INTERVIEW)  # commits in between

    request = APIRequestFactory().patch("/")
    request.user = user
    serializer = ApplicationSerializer(stale, data={"company": "New Name"}, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()

    application.refresh_from_db()
    assert application.company == "New Name"
    assert application.current_status == Status.INTERVIEW


def test_list_rejects_an_unknown_status_filter(auth_client):
    response = auth_client.get(URL, {"status": "hired"})
    assert response.status_code == 400
    assert response.json() == {"status": ["'hired' is not a valid status."]}


def test_list_rejects_an_unknown_source_filter(auth_client):
    response = auth_client.get(URL, {"source": "monster"})
    assert response.status_code == 400
    assert "source" in response.json()


def test_filters_do_not_apply_to_detail_routes(auth_client, user):
    application = ApplicationFactory(user=user)  # status "applied"
    assert auth_client.get(detail_url(application), {"status": "offer"}).status_code == 200


def test_date_applied_cannot_be_in_the_future(auth_client):
    tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
    response = auth_client.post(URL, {**NEW_APPLICATION, "date_applied": tomorrow})
    assert response.status_code == 400
    assert response.json() == {"date_applied": ["The application date can't be in the future."]}


def test_patch_response_shows_the_stored_status_not_a_stale_copy(user):
    application = ApplicationFactory(user=user)
    stale = Application.objects.get(pk=application.pk)
    # A concurrent request changes the status after this request loaded its copy.
    Application.objects.filter(pk=application.pk).update(current_status=Status.INTERVIEW)

    serializer = ApplicationSerializer(stale, data={"company": "Renamed"}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    assert serializer.data["current_status"] == Status.INTERVIEW


def test_serializer_without_a_request_accepts_no_resume_ids(user):
    resume = ResumeVersionFactory(user=user)
    serializer = ApplicationSerializer(data={**NEW_APPLICATION, "resume_version": resume.pk})
    assert not serializer.is_valid()
    assert "resume_version" in serializer.errors
