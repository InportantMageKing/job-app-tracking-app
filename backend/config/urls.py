from django.contrib import admin
from django.urls import include, path

from core.views import health
from dashboard.views import stats_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("applications.urls")),
    path("api/", include("resumes.urls")),
    path("api/dashboard/stats/", stats_view),
]
