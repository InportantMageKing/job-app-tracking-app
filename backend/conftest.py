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


def make_token_client(user):
    """An API client that authenticates the real way: with the user's DRF token."""
    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.fixture
def user(db):
    from core.factories import UserFactory

    return UserFactory()


@pytest.fixture
def other_user(db):
    from core.factories import UserFactory

    return UserFactory()


@pytest.fixture
def auth_client(user):
    return make_token_client(user)


@pytest.fixture
def other_client(other_user):
    return make_token_client(other_user)
