"""Reset and load a realistic QA dataset for manually exercising the app."""
import random
from datetime import timedelta

import factory.random
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from applications.models import Application, ApplicationEvent, Source, Status
from applications.services import add_note, change_status
from core.factories import ApplicationFactory, ResumeVersionFactory
from resumes.models import ResumeVersion

SEED_USERS = ["tester1", "tester2"]
SEED_PASSWORD = "testing-pass-123"
HISTORY_DAYS = 60

RESUME_VERSIONS = [
    ("Backend v1", "Python/Django focus"),
    ("Cloud v2", "Infrastructure and deployment focus"),
    ("Generalist v3", "Full-stack, one page"),
]

# Possible journeys after "applied", with relative weights.
PATHS = [
    ([], 40),
    ([Status.REJECTED], 20),
    ([Status.PHONE_SCREEN, Status.REJECTED], 12),
    ([Status.PHONE_SCREEN], 6),
    ([Status.PHONE_SCREEN, Status.INTERVIEW], 6),
    ([Status.PHONE_SCREEN, Status.INTERVIEW, Status.REJECTED], 8),
    ([Status.PHONE_SCREEN, Status.INTERVIEW, Status.OFFER], 3),
    ([Status.INTERVIEW, Status.OFFER], 1),
    ([Status.WITHDRAWN], 4),
]

NOTES = [
    "Recruiter emailed to schedule a call.",
    "Sent a thank-you email.",
    "Followed up, no response yet.",
    "Asked about team size and on-call rotation.",
    "Take-home assignment received.",
]


class Command(BaseCommand):
    help = "Delete and recreate the QA users tester1 and tester2 with realistic, backdated data."

    def add_arguments(self, parser):
        parser.add_argument("--applications", type=int, default=40, help="Applications per user (default 40).")
        parser.add_argument("--seed", type=int, default=42, help="Random seed for repeatable data.")

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        factory.random.reseed_random(options["seed"])
        now = timezone.now()

        for username in SEED_USERS:
            self._delete_user(username)
            with transaction.atomic():
                user = get_user_model().objects.create_user(username=username, password=SEED_PASSWORD)
                resumes = [ResumeVersionFactory(user=user, name=name, description=desc) for name, desc in RESUME_VERSIONS]
                for _ in range(options["applications"]):
                    self._create_application(user, resumes, rng, now)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(SEED_USERS)} users with {options['applications']} applications each."
            )
        )
        for username in SEED_USERS:
            self.stdout.write(f"  login: {username} / {SEED_PASSWORD}")

    def _delete_user(self, username):
        user = get_user_model().objects.filter(username=username).first()
        if user is None:
            return
        # Row deletes don't remove files from storage, so clean those up first.
        for resume in ResumeVersion.objects.filter(user=user):
            resume.file.delete(save=False)
        user.delete()

    def _create_application(self, user, resumes, rng, now):
        applied_at = now - timedelta(days=rng.randint(0, HISTORY_DAYS), hours=rng.randint(0, 23))
        application = ApplicationFactory(
            user=user,
            date_applied=timezone.localdate(applied_at),
            source=rng.choice(Source.values),
            resume_version=rng.choice(resumes + [None]),
        )
        Application.objects.filter(pk=application.pk).update(created_at=applied_at)
        self._backdate(application.events.get(), applied_at)

        path = rng.choices([steps for steps, _ in PATHS], weights=[weight for _, weight in PATHS])[0]
        moment = applied_at
        for status in path:
            moment = min(moment + timedelta(days=rng.randint(2, 10)), now)
            if rng.random() < 0.5:
                note = add_note(application=application, note=rng.choice(NOTES))
                # Never earlier than the application itself, even for very recent ones.
                self._backdate(note, max(applied_at, moment - timedelta(hours=rng.randint(1, 24))))
            self._backdate(change_status(application=application, to_status=status), moment)

    @staticmethod
    def _backdate(event, moment):
        ApplicationEvent.objects.filter(pk=event.pk).update(created_at=moment)
