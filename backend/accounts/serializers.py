from django.contrib.auth import authenticate, get_user_model, password_validation
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

User = get_user_model()

USERNAME_TAKEN = "That username is taken."


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, validators=[UnicodeUsernameValidator()])
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(USERNAME_TAKEN)
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(attrs["password"], user=User(username=attrs["username"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        # validate_username can race with a concurrent signup. The database's case-insensitive
        # unique index is the real guard, so report its violation the same way.
        try:
            with transaction.atomic():
                return User.objects.create_user(
                    username=validated_data["username"], password=validated_data["password"]
                )
        except IntegrityError:
            raise serializers.ValidationError({"username": [USERNAME_TAKEN]})


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid username or password.")
        attrs["user"] = user
        return attrs
