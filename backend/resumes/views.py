from django.db.models import Count
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from core.viewsets import OwnedByUserViewSet

from .models import ResumeVersion
from .serializers import ResumeVersionSerializer


class ResumeVersionViewSet(OwnedByUserViewSet):
    queryset = ResumeVersion.objects.all()
    serializer_class = ResumeVersionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return super().get_queryset().annotate(application_count=Count("applications"))

    @action(detail=True, methods=["get"], url_path="file")
    def download(self, request, pk=None):
        resume = self.get_object()
        if not resume.file or not resume.file.storage.exists(resume.file.name):
            raise NotFound("The file for this resume version is missing.")
        return FileResponse(resume.file.open("rb"), as_attachment=True, filename=resume.original_filename)
