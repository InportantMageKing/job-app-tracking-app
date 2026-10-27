from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.viewsets import OwnedByUserViewSet

from .models import Application, EventType
from .serializers import (
    ApplicationDetailSerializer,
    ApplicationEventSerializer,
    ApplicationSerializer,
    EventCreateSerializer,
)
from .services import ApplicationRuleError, add_note, change_status, create_application


class ApplicationViewSet(OwnedByUserViewSet):
    queryset = Application.objects.select_related("resume_version")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["company", "job_title"]
    ordering_fields = ["date_applied", "company", "created_at"]
    ordering = ["-date_applied", "-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ApplicationDetailSerializer
        return ApplicationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        source_filter = self.request.query_params.get("source")
        if status_filter:
            queryset = queryset.filter(current_status=status_filter)
        if source_filter:
            queryset = queryset.filter(source=source_filter)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("events")
        return queryset

    def perform_create(self, serializer):
        serializer.instance = create_application(user=self.request.user, **serializer.validated_data)

    @action(detail=True, methods=["post"], url_path="events")
    def events(self, request, pk=None):
        # get_object() goes through the owner-scoped queryset, so other users' IDs 404.
        application = self.get_object()
        serializer = EventCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            if data["event_type"] == EventType.STATUS_CHANGE:
                event = change_status(application=application, to_status=data["to_status"], note=data["note"])
            else:
                event = add_note(application=application, note=data["note"])
        except ApplicationRuleError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(ApplicationEventSerializer(event).data, status=status.HTTP_201_CREATED)
