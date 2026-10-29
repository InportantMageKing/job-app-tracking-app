from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.viewsets import OwnedByUserViewSet

from .models import Application, EventType, Source, Status
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
        # Filters narrow the list only; a detail URL always finds its own object.
        if self.action == "list":
            queryset = self._filter_list(queryset)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("events")
        return queryset

    def _filter_list(self, queryset):
        for param, field, choices in [("status", "current_status", Status), ("source", "source", Source)]:
            value = self.request.query_params.get(param)
            if not value:
                continue
            # A typo should be an error, not an empty list that looks like "no results".
            if value not in choices.values:
                raise ValidationError({param: [f"{value!r} is not a valid {param}."]})
            queryset = queryset.filter(**{field: value})
        return queryset

    def perform_create(self, serializer):
        # Create through the service so the first status event is written. Setting
        # serializer.instance is what save() would have done, so the response renders it.
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
            # A plain string, like DRF's own {"detail": ...} errors (ValidationError would wrap it in a list).
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ApplicationEventSerializer(event).data, status=status.HTTP_201_CREATED)
