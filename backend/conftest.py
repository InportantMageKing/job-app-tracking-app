import pytest
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    """Send every test's uploads to a throwaway directory."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
    return settings.MEDIA_ROOT


@pytest.fixture
def api_client():
    return APIClient()
