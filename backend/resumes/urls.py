from rest_framework.routers import SimpleRouter

from .views import ResumeVersionViewSet

router = SimpleRouter()
router.register("resume-versions", ResumeVersionViewSet, basename="resume-version")

urlpatterns = router.urls
