from django.utils import timezone
from rest_framework import serializers

from resumes.models import ResumeVersion

from .models import Application, ApplicationEvent, EventType, Status


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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only the caller's resumes are valid choices, so a foreign ID is indistinguishable
        # from one that doesn't exist (same error either way). Without a request there is no
        # caller to scope to, so fail closed and accept no resume IDs at all.
        if "resume_version" in self.fields:
            request = self.context.get("request")
            owner_resumes = (
                ResumeVersion.objects.filter(user=request.user) if request is not None else ResumeVersion.objects.none()
            )
            self.fields["resume_version"].queryset = owner_resumes

    def get_resume_version_name(self, obj):
        return obj.resume_version.name if obj.resume_version else None

    def validate_date_applied(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("The application date can't be in the future.")
        return value

    def update(self, instance, validated_data):
        # Save only the edited columns, so a concurrent status change (which locks and
        # writes current_status) is never overwritten by this request's stale copy.
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=[*validated_data, "updated_at"])
        # The in-memory status may predate a concurrent change; respond with the stored one.
        instance.refresh_from_db(fields=["current_status"])
        return instance


class ApplicationDetailSerializer(ApplicationSerializer):
    events = ApplicationEventSerializer(many=True, read_only=True)

    class Meta(ApplicationSerializer.Meta):
        fields = ApplicationSerializer.Meta.fields + ["events"]


class EventCreateSerializer(serializers.Serializer):
    """Input for POST /applications/{id}/events/ — either a note or a status change."""

    event_type = serializers.ChoiceField(choices=EventType.choices)
    to_status = serializers.ChoiceField(choices=Status.choices, required=False, allow_null=True)
    note = serializers.CharField(allow_blank=True, default="")

    def validate(self, attrs):
        to_status = attrs.get("to_status")
        if attrs["event_type"] == EventType.STATUS_CHANGE:
            if not to_status:
                raise serializers.ValidationError({"to_status": "This field is required for a status change."})
        else:
            if to_status:
                raise serializers.ValidationError({"to_status": "Notes cannot change status."})
            if not attrs["note"].strip():
                raise serializers.ValidationError({"note": "Note text is required."})
        return attrs
