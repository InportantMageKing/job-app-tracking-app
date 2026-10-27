from rest_framework import serializers

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

    def get_resume_version_name(self, obj):
        return obj.resume_version.name if obj.resume_version else None

    def update(self, instance, validated_data):
        # Save only the edited columns, so a concurrent status change (which locks and
        # writes current_status) is never overwritten by this request's stale copy.
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=[*validated_data, "updated_at"])
        return instance

    def validate_resume_version(self, value):
        if value is not None and value.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("Resume version not found.")
        return value


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
