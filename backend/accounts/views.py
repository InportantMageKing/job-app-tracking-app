from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import LoginSerializer, SignupSerializer


def _token_response(user, http_status):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username}, status=http_status)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def signup_view(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return _token_response(user, status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    return _token_response(serializer.validated_data["user"], status.HTTP_200_OK)


@api_view(["POST"])
def logout_view(request):
    request.auth.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
