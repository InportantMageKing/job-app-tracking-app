from rest_framework import serializers

from .models import Application, ApplicationEvent


class ApplicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationEvent
        fields = ["id", "event_type", "from_status", "to_status", "note", "created_at"]
        read_only_fields = fields


class ApplicationSerializer(serializers.ModelSerializer):
    resume_version_name = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "company",
            "job_title",
            "source",
            "link",
            "date_applied",
            "location",
            "salary_range",
            "contact_person",
            "resume_version",
            "resume_version_name",
            "current_status",
            "created_at",
            "updated_at",
        ]
        # Status only changes through the events endpoint, so the event log stays complete.
        read_only_fields = ["current_status", "created_at", "updated_at"]

    def get_resume_version_name(self, obj):
        return obj.resume_version.name if obj.resume_version else None

    def validate_resume_version(self, value):
        if value is not None and value.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("Resume version not found.")
        return value


class ApplicationDetailSerializer(ApplicationSerializer):
    events = ApplicationEventSerializer(many=True, read_only=True)

    class Meta(ApplicationSerializer.Meta):
        fields = ApplicationSerializer.Meta.fields + ["events"]
