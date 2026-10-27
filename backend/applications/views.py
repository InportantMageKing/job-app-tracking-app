from rest_framework import filters

from core.viewsets import OwnedByUserViewSet

from .models import Application
from .serializers import ApplicationDetailSerializer, ApplicationSerializer
from .services import create_application


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
