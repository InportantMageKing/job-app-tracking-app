import re

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.factories import MINIMAL_PDF, ApplicationFactory, ResumeVersionFactory
from resumes.models import ResumeVersion

pytestmark = pytest.mark.django_db

URL = "/api/resume-versions/"


def detail_url(resume):
    return f"{URL}{resume.pk}/"


def file_url(resume):
    return f"{URL}{resume.pk}/file/"


def pdf(name="resume.pdf", content=MINIMAL_PDF):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


def test_upload_resume_version(auth_client, user):
    response = auth_client.post(
        URL,
        {"name": "Backend v1", "description": "Django focus", "file": pdf("Atlas Resume.pdf")},
        format="multipart",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Backend v1"
    assert body["original_filename"] == "Atlas Resume.pdf"
    assert body["application_count"] == 0
    assert "file" not in body
    resume = ResumeVersion.objects.get(pk=body["id"])
    assert resume.user == user
    assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", resume.file.name)
    assert resume.file.storage.exists(resume.file.name)


def test_upload_rejects_disallowed_file_type(auth_client):
    upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
    response = auth_client.post(URL, {"name": "Notes", "file": upload}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_upload_rejects_oversized_file(auth_client, settings):
    settings.RESUME_MAX_UPLOAD_BYTES = 10
    response = auth_client.post(URL, {"name": "Big", "file": pdf()}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_upload_requires_a_file(auth_client):
    response = auth_client.post(URL, {"name": "No file"}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_names_are_unique_per_user_case_insensitively(auth_client, user):
    ResumeVersionFactory(user=user, name="Backend v1")
    response = auth_client.post(URL, {"name": "backend V1", "file": pdf()}, format="multipart")
    assert response.status_code == 400
    assert "name" in response.json()


def test_same_name_is_fine_for_different_users(auth_client, other_user):
    ResumeVersionFactory(user=other_user, name="Backend v1")
    response = auth_client.post(URL, {"name": "Backend v1", "file": pdf()}, format="multipart")
    assert response.status_code == 201


def test_list_includes_application_counts(auth_client, user):
    used = ResumeVersionFactory(user=user, name="Used")
    ResumeVersionFactory(user=user, name="Unused")
    ApplicationFactory(user=user, resume_version=used)
    ApplicationFactory(user=user, resume_version=used)
    counts = {row["name"]: row["application_count"] for row in auth_client.get(URL).json()}
    assert counts == {"Used": 2, "Unused": 0}


def test_patch_name_and_description(auth_client, user):
    resume = ResumeVersionFactory(user=user, name="Old")
    response = auth_client.patch(detail_url(resume), {"name": "New", "description": "Updated"})
    assert response.status_code == 200
    resume.refresh_from_db()
    assert (resume.name, resume.description) == ("New", "Updated")


def test_patch_cannot_replace_the_file(auth_client, user):
    resume = ResumeVersionFactory(user=user)
    response = auth_client.patch(detail_url(resume), {"file": pdf("other.pdf")}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_download_returns_file_under_original_name(auth_client, user):
    resume = ResumeVersionFactory(user=user, original_filename="Atlas Resume.pdf")
    response = auth_client.get(file_url(resume))
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == MINIMAL_PDF
    assert "attachment" in response["Content-Disposition"]
    assert "Atlas Resume.pdf" in response["Content-Disposition"]


def test_download_requires_authentication(api_client, user):
    resume = ResumeVersionFactory(user=user)
    assert api_client.get(file_url(resume)).status_code == 401


def test_download_of_missing_file_returns_404(auth_client, user):
    resume = ResumeVersionFactory(user=user)
    resume.file.storage.delete(resume.file.name)
    assert auth_client.get(file_url(resume)).status_code == 404


def test_delete_removes_row_and_file_and_unlinks_applications(auth_client, user):
    resume = ResumeVersionFactory(user=user)
    application = ApplicationFactory(user=user, resume_version=resume)
    storage, name = resume.file.storage, resume.file.name
    assert auth_client.delete(detail_url(resume)).status_code == 204
    assert not ResumeVersion.objects.filter(pk=resume.pk).exists()
    assert not storage.exists(name)
    application.refresh_from_db()
    assert application.resume_version is None
