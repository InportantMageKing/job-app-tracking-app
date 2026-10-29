"""factory_boy factories shared by the test suite and the seed_testing command."""
import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from applications.models import Application, Source
from applications.services import change_status, create_application
from resumes.models import ResumeVersion

TEST_PASSWORD = "test-pass-123"

# A tiny file with a PDF header and trailer. Not a fully valid PDF (no xref table), but the
# app only checks the extension, so it is enough for upload and download tests.
MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
    b"%%EOF\n"
)


class UserFactory(DjangoModelFactory):
    class Meta:
        model = get_user_model()

    username = factory.Sequence(lambda n: f"user{n}")
    password = TEST_PASSWORD

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        return model_class.objects.create_user(*args, **kwargs)


class ResumeVersionFactory(DjangoModelFactory):
    class Meta:
        model = ResumeVersion

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Resume v{n}")
    description = "General software engineering resume"
    original_filename = factory.LazyAttribute(lambda o: f"{o.name.lower().replace(' ', '-')}.pdf")
    file = factory.django.FileField(filename="resume.pdf", data=MINIMAL_PDF)


class ApplicationFactory(DjangoModelFactory):
    class Meta:
        model = Application

    user = factory.SubFactory(UserFactory)
    company = factory.Faker("company")
    job_title = factory.Faker("job")
    source = Source.LINKEDIN
    link = factory.Faker("url")
    location = factory.Faker("city")
    salary_range = "$80k-$100k"
    contact_person = factory.Faker("name")
    resume_version = None

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        # Go through the service so every factory-made application has its first event.
        return create_application(**kwargs)


def apply_status_path(application, statuses, note=""):
    """Move an application through each status in order, logging one event per move."""
    for status in statuses:
        change_status(application=application, to_status=status, note=note)
    return application
