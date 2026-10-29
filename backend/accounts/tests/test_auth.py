import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from accounts.serializers import SignupSerializer
from conftest import make_token_client
from core.factories import TEST_PASSWORD

pytestmark = pytest.mark.django_db

SIGNUP = "/api/auth/signup/"
LOGIN = "/api/auth/login/"
LOGOUT = "/api/auth/logout/"


def test_signup_creates_user_and_returns_token(api_client):
    response = api_client.post(SIGNUP, {"username": "newbie", "password": "long-enough-pass"})
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "newbie"
    assert "password" not in body
    user = get_user_model().objects.get(username="newbie")
    assert Token.objects.get(user=user).key == body["token"]


def test_signup_rejects_taken_username_case_insensitively(api_client, user):
    response = api_client.post(SIGNUP, {"username": user.username.upper(), "password": "long-enough-pass"})
    assert response.status_code == 400
    assert "username" in response.json()


def test_signup_rejects_weak_password(api_client):
    response = api_client.post(SIGNUP, {"username": "newbie", "password": "123"})
    assert response.status_code == 400
    assert "password" in response.json()
    assert not get_user_model().objects.filter(username="newbie").exists()


def test_login_returns_the_same_token_each_time(api_client, user):
    first = api_client.post(LOGIN, {"username": user.username, "password": TEST_PASSWORD})
    second = api_client.post(LOGIN, {"username": user.username, "password": TEST_PASSWORD})
    assert first.status_code == second.status_code == 200
    assert first.json()["token"] == second.json()["token"]
    assert first.json()["username"] == user.username


def test_login_rejects_bad_password(api_client, user):
    response = api_client.post(LOGIN, {"username": user.username, "password": "wrong-password"})
    assert response.status_code == 400
    assert "token" not in response.json()


def test_logout_deletes_the_token(user):
    client = make_token_client(user)
    assert client.post(LOGOUT).status_code == 204
    assert not Token.objects.filter(user=user).exists()
    assert client.post(LOGOUT).status_code == 401


def test_logout_requires_a_token(api_client):
    assert api_client.post(LOGOUT).status_code == 401


def test_signup_race_on_the_same_username_returns_400_not_500(api_client, user, monkeypatch):
    # Simulate a concurrent signup that passed the serializer check: only the database catches it.
    monkeypatch.setattr(SignupSerializer, "validate_username", lambda self, value: value)
    response = api_client.post(SIGNUP, {"username": user.username.upper(), "password": "long-enough-pass"})
    assert response.status_code == 400
    assert response.json() == {"username": ["That username is taken."]}


def test_login_is_rate_limited(api_client, user):
    statuses = [
        api_client.post(LOGIN, {"username": user.username, "password": "wrong-password"}).status_code
        for _ in range(11)
    ]
    assert statuses[:10] == [400] * 10
    assert statuses[10] == 429


def test_signup_is_rate_limited(api_client):
    statuses = [
        api_client.post(SIGNUP, {"username": f"rate{n}", "password": "long-enough-pass"}).status_code
        for n in range(11)
    ]
    assert statuses[:10] == [201] * 10
    assert statuses[10] == 429


def test_logout_without_a_token_object_does_not_crash(api_client, user):
    api_client.force_authenticate(user=user)  # authenticated, but request.auth is None
    assert api_client.post(LOGOUT).status_code == 204
