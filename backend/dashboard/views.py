from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import dashboard_stats


@api_view(["GET"])
def stats_view(request):
    return Response(dashboard_stats(request.user))
