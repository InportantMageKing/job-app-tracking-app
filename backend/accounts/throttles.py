from rest_framework.throttling import AnonRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    """Per-IP limit on login and signup to slow down password guessing and signup spam."""

    scope = "auth"
