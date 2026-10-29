import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


def resume_upload_to(instance, filename):
    """Store uploads under a random name so paths reveal nothing and never collide."""
    extension = Path(filename).suffix.lower()
    return f"resumes/{uuid.uuid4().hex}{extension}"


class ResumeVersion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resume_versions",
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=resume_upload_to, max_length=255)
    original_filename = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            # Case-insensitive, matching the API check, so "Cloud v2" and "cloud V2" can't both exist.
            models.UniqueConstraint("user", Lower("name"), name="unique_resume_name_per_user_ci"),
        ]

    def __str__(self):
        return self.name
