"""Dashboard metrics. Every function takes data already scoped to one user."""
from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone

from applications.models import (
    PIPELINE_STAGES,
    Application,
    ApplicationEvent,
    EventType,
    Status,
    stages_at_or_after,
)
from resumes.models import ResumeVersion


def _percent(part, total):
    return round(100 * part / total, 1) if total else 0.0


def pipeline_counts(applications):
    """How many applications currently sit in each status."""
    rows = applications.order_by().values("current_status").annotate(count=Count("pk"))
    counts = {row["current_status"]: row["count"] for row in rows}
    return [{"status": value, "label": label, "count": counts.get(value, 0)} for value, label in Status.choices]


def _reached(stage):
    """True when the application ever moved to `stage` or any later pipeline stage."""
    return Exists(
        ApplicationEvent.objects.filter(
            application=OuterRef("pk"),
            event_type=EventType.STATUS_CHANGE,
            to_status__in=stages_at_or_after(stage),
        )
    )


def funnel(applications):
    """Share of applications that ever reached each pipeline stage.

    Uses the event log, not current_status: an application that went
    Interview -> Rejected still counts as having reached Interview.
    """
    annotated = applications.order_by().annotate(
        **{f"reached_{stage.value}": _reached(stage) for stage in PIPELINE_STAGES}
    )
    counts = annotated.aggregate(
        total=Count("pk"),
        **{
            f"n_{stage.value}": Count("pk", filter=Q(**{f"reached_{stage.value}": True}))
            for stage in PIPELINE_STAGES
        },
    )
    total = counts["total"]
    return {
        "total": total,
        "stages": [
            {
                "stage": stage.value,
                "label": stage.label,
                "count": counts[f"n_{stage.value}"],
                "percent": _percent(counts[f"n_{stage.value}"], total),
            }
            for stage in PIPELINE_STAGES
        ],
    }


def applications_per_week(applications, *, weeks=12, today=None):
    """Applications per calendar week (Monday start) for the last `weeks` weeks, gaps filled with 0."""
    today = today or timezone.localdate()
    current_monday = today - timedelta(days=today.weekday())
    first_monday = current_monday - timedelta(weeks=weeks - 1)
    rows = (
        applications.filter(date_applied__gte=first_monday, date_applied__lte=today)
        .order_by()
        .annotate(week=TruncWeek("date_applied"))
        .values("week")
        .annotate(count=Count("pk"))
    )
    counts = {}
    for row in rows:
        week = row["week"]
        if hasattr(week, "date"):  # a datetime from some backends; normalise to a date
            week = week.date()
        counts[week] = row["count"]
    result = []
    for offset in range(weeks):
        week_start = first_monday + timedelta(weeks=offset)
        result.append({"week_start": week_start.isoformat(), "count": counts.get(week_start, 0)})
    return result


def resume_performance(user):
    """Funnel metrics per resume version, plus a "None" row for applications without one."""
    applications = Application.objects.filter(user=user)
    rows = [
        {"resume_version_id": resume.pk, "name": resume.name, **funnel(applications.filter(resume_version=resume))}
        for resume in ResumeVersion.objects.filter(user=user).order_by("name")
    ]
    unassigned = applications.filter(resume_version__isnull=True)
    if unassigned.exists():
        rows.append({"resume_version_id": None, "name": "None", **funnel(unassigned)})
    return rows


def dashboard_stats(user, *, today=None):
    applications = Application.objects.filter(user=user)
    return {
        "pipeline": pipeline_counts(applications),
        "funnel": funnel(applications),
        "per_week": applications_per_week(applications, today=today),
        "resume_performance": resume_performance(user),
    }
