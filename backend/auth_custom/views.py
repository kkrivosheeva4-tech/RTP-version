from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth_custom.jwt_utils import JWTError, create_access_token, create_refresh_token, decode_refresh_token
from auth_custom.models import RefreshToken, UserProfile
from auth_custom.serializers import LoginSerializer, LogoutSerializer, RefreshSerializer

User = get_user_model()


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = authenticate(request=request, username=username, password=password)
        if user is None or not user.is_active:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.is_2fa_enabled:
            # 2FA flow is optional in stage 3; session_id placeholder is returned for frontend compatibility.
            session_id = create_access_token(user_id=user.id, username=user.username, role=profile.role)
            return Response({"requires_2fa": True, "session_id": session_id}, status=status.HTTP_200_OK)

        access_token = create_access_token(user_id=user.id, username=user.username, role=profile.role)
        refresh_token, jti, expires_at = create_refresh_token(user_id=user.id)
        RefreshToken.objects.create(user=user, jti=jti, expires_at=expires_at)
        return Response(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
            },
            status=status.HTTP_200_OK,
        )


class RefreshAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.get("refresh_token") or self._token_from_header(request)
        if not token:
            return Response({"error": "refresh_token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = decode_refresh_token(token)
        except JWTError:
            return Response({"error": "Invalid or expired refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

        jti = payload.get("jti")
        user_id = int(payload.get("sub", 0))
        refresh_record = RefreshToken.objects.filter(jti=jti, user_id=user_id).first()
        if not refresh_record or not refresh_record.is_active:
            return Response({"error": "Refresh token revoked"}, status=status.HTTP_401_UNAUTHORIZED)

        user = User.objects.filter(id=user_id, is_active=True).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh_record.revoke()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        new_access_token = create_access_token(user_id=user.id, username=user.username, role=profile.role)
        new_refresh_token, new_jti, new_expires_at = create_refresh_token(user_id=user.id)
        RefreshToken.objects.create(user=user, jti=new_jti, expires_at=new_expires_at)

        return Response(
            {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
            },
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _token_from_header(request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return ""
        return auth_header[7:].strip()


class LogoutAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.get("refresh_token") or RefreshAPIView._token_from_header(request)
        if not token:
            return Response(status=status.HTTP_204_NO_CONTENT)

        try:
            payload = decode_refresh_token(token)
        except JWTError:
            return Response(status=status.HTTP_204_NO_CONTENT)

        jti = payload.get("jti")
        RefreshToken.objects.filter(jti=jti, revoked_at__isnull=True).update(revoked_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "role": profile.role,
                "is_2fa_enabled": profile.is_2fa_enabled,
            },
            status=status.HTTP_200_OK,
        )
