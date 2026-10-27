"""User B must never be able to read, change, or delete user A's data."""
import pytest

from core.factories import ApplicationFactory, ResumeVersionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def owned(user):
    """Objects owned by `user` (A). Tests act as `other_client` (B)."""
    resume = ResumeVersionFactory(user=user, name="Original")
    application = ApplicationFactory(user=user, company="Original Co", resume_version=resume)
    return {"application": application, "resume": resume}


@pytest.mark.parametrize(
    "method, url_template, payload",
    [
        ("get", "/api/applications/{application}/", None),
        ("patch", "/api/applications/{application}/", {"company": "Hijacked"}),
        ("delete", "/api/applications/{application}/", None),
        ("post", "/api/applications/{application}/events/", {"event_type": "note", "note": "hi"}),
        ("get", "/api/resume-versions/{resume}/", None),
        ("patch", "/api/resume-versions/{resume}/", {"name": "Hijacked"}),
        ("delete", "/api/resume-versions/{resume}/", None),
        ("get", "/api/resume-versions/{resume}/file/", None),
    ],
)
def test_other_users_objects_look_like_they_do_not_exist(other_client, owned, method, url_template, payload):
    url = url_template.format(application=owned["application"].pk, resume=owned["resume"].pk)
    send = getattr(other_client, method)
    response = send(url, payload) if payload is not None else send(url)

    assert response.status_code == 404

    # Nothing changed (refresh_from_db raises if the row was deleted).
    owned["application"].refresh_from_db()
    owned["resume"].refresh_from_db()
    assert owned["application"].company == "Original Co"
    assert owned["resume"].name == "Original"
    assert owned["application"].events.count() == 1


def test_lists_never_include_other_users_rows(other_client, owned):
    assert other_client.get("/api/applications/").json() == []
    assert other_client.get("/api/resume-versions/").json() == []


def test_cannot_attach_another_users_resume_on_create(other_client, owned):
    response = other_client.post(
        "/api/applications/",
        {"company": "B Co", "job_title": "Engineer", "resume_version": owned["resume"].pk},
    )
    assert response.status_code == 400
    assert "resume_version" in response.json()


def test_cannot_attach_another_users_resume_on_update(other_client, other_user, owned):
    mine = ApplicationFactory(user=other_user)
    response = other_client.patch(f"/api/applications/{mine.pk}/", {"resume_version": owned["resume"].pk})
    assert response.status_code == 400
    mine.refresh_from_db()
    assert mine.resume_version is None


def test_foreign_and_missing_resume_ids_give_identical_errors(other_client, owned):
    def error_for(pk):
        response = other_client.post(
            "/api/applications/",
            {"company": "B Co", "job_title": "Engineer", "resume_version": pk},
        )
        assert response.status_code == 400
        # DRF puts the submitted ID in the message; remove it so only the wording is compared.
        return [message.replace(f'"{pk}"', '"<id>"') for message in response.json()["resume_version"]]

    assert error_for(owned["resume"].pk) == error_for(999999)
