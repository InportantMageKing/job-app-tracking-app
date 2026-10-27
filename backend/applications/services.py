"""Business rules for applications. Views call these; they never write events directly."""
from django.db import transaction

from .models import Application, ApplicationEvent, EventType, Status


class ApplicationRuleError(Exception):
    """A request broke an application business rule (the API maps this to HTTP 400)."""


@transaction.atomic
def create_application(*, user, **fields):
    """Create an application at `applied` and write its first status event."""
    fields.pop("current_status", None)
    application = Application.objects.create(user=user, current_status=Status.APPLIED, **fields)
    ApplicationEvent.objects.create(
        application=application,
        event_type=EventType.STATUS_CHANGE,
        from_status=None,
        to_status=Status.APPLIED,
    )
    return application


def change_status(*, application, to_status, note=""):
    """Move an application to `to_status`, logging the change in the same transaction."""
    if to_status not in Status.values:
        raise ApplicationRuleError(f"Unknown status: {to_status!r}.")
    with transaction.atomic():
        # Lock the row so two concurrent changes can't both read the same "from" status.
        locked = Application.objects.select_for_update().get(pk=application.pk)
        if locked.current_status == to_status:
            raise ApplicationRuleError(f"Application is already in status {to_status!r}.")
        event = ApplicationEvent.objects.create(
            application=locked,
            event_type=EventType.STATUS_CHANGE,
            from_status=locked.current_status,
            to_status=to_status,
            note=(note or "").strip(),
        )
        locked.current_status = to_status
        locked.save(update_fields=["current_status", "updated_at"])
    application.current_status = to_status
    return event


def add_note(*, application, note):
    """Attach a free-form note to the application's timeline without changing status."""
    note = (note or "").strip()
    if not note:
        raise ApplicationRuleError("Note text is required.")
    return ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note=note)
