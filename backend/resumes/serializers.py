from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from .models import ResumeVersion

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}


class ResumeVersionSerializer(serializers.ModelSerializer):
    # Write-only: the stored file is never exposed by URL, only via the download endpoint.
    file = serializers.FileField(write_only=True, required=False)
    application_count = serializers.SerializerMethodField()

    class Meta:
        model = ResumeVersion
        fields = ["id", "name", "description", "file", "original_filename", "application_count", "created_at"]
        read_only_fields = ["original_filename", "created_at"]

    def get_application_count(self, obj):
        annotated = getattr(obj, "application_count", None)
        return annotated if annotated is not None else obj.applications.count()

    def validate_name(self, value):
        existing = ResumeVersion.objects.filter(user=self.context["request"].user, name__iexact=value)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("You already have a resume version with this name.")
        return value

    def validate_file(self, value):
        if Path(value.name).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Upload a PDF, DOC, or DOCX file.")
        if value.size > settings.RESUME_MAX_UPLOAD_BYTES:
            raise serializers.ValidationError("File must be 5 MB or smaller.")
        return value

    def validate(self, attrs):
        if self.instance is None and "file" not in attrs:
            raise serializers.ValidationError({"file": "A file is required."})
        if self.instance is not None and "file" in attrs:
            raise serializers.ValidationError(
                {"file": "A version's file can't be replaced; upload a new version instead."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["original_filename"] = validated_data["file"].name
        return super().create(validated_data)
