from django.conf import settings
from django.db import models
from django.utils import timezone


class Status(models.TextChoices):
    APPLIED = "applied", "Applied"
    PHONE_SCREEN = "phone_screen", "Phone Screen"
    INTERVIEW = "interview", "Interview"
    OFFER = "offer", "Offer"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn"


# Ordered progress stages. Rejected and Withdrawn are outcomes, not progress.
PIPELINE_STAGES = [Status.APPLIED, Status.PHONE_SCREEN, Status.INTERVIEW, Status.OFFER]


def stages_at_or_after(stage):
    """Return `stage` and every later pipeline stage (used for "ever reached X" metrics)."""
    if stage not in PIPELINE_STAGES:
        raise ValueError(f"{stage!r} is not a pipeline stage")
    return PIPELINE_STAGES[PIPELINE_STAGES.index(stage):]


class Source(models.TextChoices):
    LINKEDIN = "linkedin", "LinkedIn"
    INDEED = "indeed", "Indeed"
    COMPANY_SITE = "company_site", "Company Site"
    REFERRAL = "referral", "Referral"
    OTHER = "other", "Other"


class EventType(models.TextChoices):
    STATUS_CHANGE = "status_change", "Status change"
    NOTE = "note", "Note"


class Application(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    company = models.CharField(max_length=200)
    job_title = models.CharField(max_length=200)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER)
    link = models.URLField(max_length=500, blank=True)
    date_applied = models.DateField(default=timezone.localdate)
    location = models.CharField(max_length=200, blank=True)
    salary_range = models.CharField(max_length=100, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    resume_version = models.ForeignKey(
        "resumes.ResumeVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
    )
    # Denormalized from the event log for cheap list/dashboard queries.
    # Only applications.services may change it.
    current_status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPLIED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_applied", "-created_at"]
        indexes = [models.Index(fields=["user", "current_status"])]

    def __str__(self):
        return f"{self.job_title} at {self.company}"


class ApplicationEvent(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    from_status = models.CharField(max_length=20, choices=Status.choices, null=True, blank=True)
    to_status = models.CharField(max_length=20, choices=Status.choices, null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["application", "created_at"])]
        constraints = [
            # A status change always has a target; a note has text and never touches status.
            models.CheckConstraint(
                condition=(
                    models.Q(event_type="status_change", to_status__isnull=False)
                    | (
                        models.Q(event_type="note", from_status__isnull=True, to_status__isnull=True)
                        & ~models.Q(note="")
                    )
                ),
                name="application_event_shape_valid",
            ),
        ]

    def __str__(self):
        return f"{self.event_type} on {self.application_id}"
