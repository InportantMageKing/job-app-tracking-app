from types import SimpleNamespace

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from applications.admin import ApplicationAdmin, ApplicationEventInline
from applications.models import Application, Status
from core.factories import ApplicationFactory, ResumeVersionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_request(django_user_model):
    request = RequestFactory().get("/admin/")
    request.user = django_user_model.objects.create_superuser(username="admin", password="admin-pass-123")
    return request


@pytest.fixture
def model_admin():
    return ApplicationAdmin(Application, AdminSite())


def test_event_inline_cannot_add_rows(admin_request):
    inline = ApplicationEventInline(Application, AdminSite())
    assert inline.has_add_permission(admin_request, obj=None) is False


def test_resume_choices_are_limited_to_the_applications_owner(admin_request, model_admin, user, other_user):
    own = ResumeVersionFactory(user=user)
    ResumeVersionFactory(user=other_user)
    application = ApplicationFactory(user=user)

    form = model_admin.get_form(admin_request, application)
    assert list(form.base_fields["resume_version"].queryset) == [own]


def test_save_only_writes_changed_fields(admin_request, model_admin, user):
    application = ApplicationFactory(user=user, company="Before")
    stale = Application.objects.get(pk=application.pk)
    # A status change lands after the admin page loaded.
    Application.objects.filter(pk=application.pk).update(current_status=Status.OFFER)

    stale.company = "After"
    model_admin.save_model(admin_request, stale, SimpleNamespace(changed_data=["company"]), change=True)

    application.refresh_from_db()
    assert application.company == "After"
    assert application.current_status == Status.OFFER
