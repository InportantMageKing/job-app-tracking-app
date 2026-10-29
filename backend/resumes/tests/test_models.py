import re

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction

from resumes.models import ResumeVersion, resume_upload_to


def test_upload_to_uses_uuid_and_lowercase_extension():
    path = resume_upload_to(None, "My Resume.PDF")
    assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", path)


def test_upload_to_never_reuses_a_name():
    assert resume_upload_to(None, "cv.pdf") != resume_upload_to(None, "cv.pdf")


@pytest.mark.django_db
def test_resume_names_are_unique_per_user():
    User = get_user_model()
    alice = User.objects.create_user(username="alice", password="test-pass-123")
    bob = User.objects.create_user(username="bob", password="test-pass-123")

    def make(owner):
        return ResumeVersion.objects.create(
            user=owner,
            name="Backend v1",
            original_filename="cv.pdf",
            file=ContentFile(b"%PDF-1.4", name="cv.pdf"),
        )

    make(alice)
    make(bob)  # same name, different user: allowed
    with pytest.raises(IntegrityError), transaction.atomic():
        make(alice)


@pytest.mark.django_db
def test_resume_names_are_unique_per_user_ignoring_case():
    owner = get_user_model().objects.create_user(username="carol", password="test-pass-123")

    def make(name):
        return ResumeVersion.objects.create(
            user=owner, name=name, original_filename="cv.pdf", file=ContentFile(b"%PDF-1.4", name="cv.pdf")
        )

    make("Backend v1")
    with pytest.raises(IntegrityError), transaction.atomic():
        make("BACKEND V1")
