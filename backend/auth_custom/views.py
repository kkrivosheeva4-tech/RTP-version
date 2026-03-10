import os

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth_custom.jwt_utils import (
    JWTError,
    create_2fa_session_token,
    create_access_token,
    create_refresh_token,
    decode_2fa_session_token,
    decode_refresh_token,
)
from auth_custom.models import RefreshToken, UserProfile
from auth_custom.serializers import (
    LoginSerializer,
    LogoutSerializer,
    RefreshSerializer,
    TwoFASetupSerializer,
    TwoFAVerifySerializer,
)
from auth_custom.throttling import (
    Auth2FARateThrottle,
    AuthLoginRateThrottle,
    AuthLogoutRateThrottle,
    AuthRefreshRateThrottle,
)
from auth_custom.totp_utils import build_otpauth_uri, generate_totp_secret, verify_totp_token
from config.api_errors import error_response
from config.observability import log_auth_event

User = get_user_model()


def _issue_tokens(user, profile):
    access_token = create_access_token(user_id=user.id, username=user.username, role=profile.role)
    refresh_token, jti, expires_at = create_refresh_token(user_id=user.id)
    RefreshToken.objects.create(user=user, jti=jti, expires_at=expires_at)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def _user_from_2fa_session(session_id: str):
    payload = decode_2fa_session_token(session_id)
    user_id = int(payload.get("sub", 0))
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user:
        raise JWTError("User not found")
    return user, payload


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthLoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = authenticate(request=request, username=username, password=password)
        if user is None or not user.is_active:
            log_auth_event(
                event="login",
                success=False,
                request=request,
                username=username,
                reason="invalid_credentials",
                status_code=status.HTTP_401_UNAUTHORIZED,
                audit_action="login",
            )
            return error_response("Invalid credentials", status_code=status.HTTP_401_UNAUTHORIZED)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        session_id = create_2fa_session_token(user_id=user.id, username=user.username, role=profile.role)
        is_2fa_setup = bool(profile.is_2fa_enabled and profile.totp_secret)
        log_auth_event(
            event="login",
            success=True,
            request=request,
            user=user,
            username=user.username,
            status_code=status.HTTP_200_OK,
            audit_action="login",
        )
        return Response(
            {
                "requires_2fa": True,
                "session_id": session_id,
                "is_2fa_setup": is_2fa_setup,
                "username": user.username,
                "role": profile.role,
            },
            status=status.HTTP_200_OK,
        )


class TwoFASetupAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [Auth2FARateThrottle]

    def post(self, request):
        serializer = TwoFASetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session_id = serializer.validated_data["session_id"]

        try:
            user, _ = _user_from_2fa_session(session_id)
        except JWTError:
            log_auth_event(
                event="2fa_setup",
                success=False,
                request=request,
                reason="invalid_session",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response("Invalid or expired session_id", status_code=status.HTTP_401_UNAUTHORIZED)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.is_2fa_enabled and profile.totp_secret:
            log_auth_event(
                event="2fa_setup",
                success=False,
                request=request,
                user=user,
                username=user.username,
                reason="already_enabled",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
            return error_response("2FA is already enabled", status_code=status.HTTP_400_BAD_REQUEST)

        secret = generate_totp_secret()
        profile.totp_secret = secret
        profile.is_2fa_enabled = False
        profile.save(update_fields=["totp_secret", "is_2fa_enabled", "updated_at"])

        issuer = os.getenv("TOTP_ISSUER", "Radar")
        qr_url = build_otpauth_uri(secret=secret, username=user.username, issuer=issuer)
        log_auth_event(
            event="2fa_setup",
            success=True,
            request=request,
            user=user,
            username=user.username,
            status_code=status.HTTP_200_OK,
        )
        return Response({"secret": secret, "qr_url": qr_url}, status=status.HTTP_200_OK)


class TwoFAVerifyAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [Auth2FARateThrottle]

    def post(self, request):
        serializer = TwoFAVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session_id = serializer.validated_data["session_id"]
        code = serializer.validated_data["code"]

        try:
            user, _ = _user_from_2fa_session(session_id)
        except JWTError:
            log_auth_event(
                event="2fa_verify",
                success=False,
                request=request,
                reason="invalid_session",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response("Invalid or expired session_id", status_code=status.HTTP_401_UNAUTHORIZED)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if not profile.totp_secret:
            log_auth_event(
                event="2fa_verify",
                success=False,
                request=request,
                user=user,
                username=user.username,
                reason="2fa_not_configured",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
            return error_response("2FA is not configured", status_code=status.HTTP_400_BAD_REQUEST)

        if not verify_totp_token(profile.totp_secret, code, window=1):
            log_auth_event(
                event="2fa_verify",
                success=False,
                request=request,
                user=user,
                username=user.username,
                reason="invalid_2fa_code",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response("Invalid 2FA code", status_code=status.HTTP_401_UNAUTHORIZED)

        if not profile.is_2fa_enabled:
            profile.is_2fa_enabled = True
            profile.save(update_fields=["is_2fa_enabled", "updated_at"])

        log_auth_event(
            event="2fa_verify",
            success=True,
            request=request,
            user=user,
            username=user.username,
            status_code=status.HTTP_200_OK,
        )
        return Response(_issue_tokens(user, profile), status=status.HTTP_200_OK)


class RefreshAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRefreshRateThrottle]

    def post(self, request):
        serializer = RefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.get("refresh_token") or self._token_from_header(request)
        if not token:
            log_auth_event(
                event="refresh",
                success=False,
                request=request,
                reason="missing_refresh_token",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
            return error_response("refresh_token is required", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            payload = decode_refresh_token(token)
        except JWTError:
            log_auth_event(
                event="refresh",
                success=False,
                request=request,
                reason="invalid_or_expired_token",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response("Invalid or expired refresh token", status_code=status.HTTP_401_UNAUTHORIZED)

        jti = payload.get("jti")
        user_id = int(payload.get("sub", 0))
        refresh_record = RefreshToken.objects.filter(jti=jti, user_id=user_id).first()
        if not refresh_record or not refresh_record.is_active:
            user = User.objects.filter(id=user_id).first()
            log_auth_event(
                event="refresh",
                success=False,
                request=request,
                user=user,
                username=getattr(user, "username", ""),
                reason="refresh_token_revoked",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response("Refresh token revoked", status_code=status.HTTP_401_UNAUTHORIZED)

        user = User.objects.filter(id=user_id, is_active=True).first()
        if not user:
            log_auth_event(
                event="refresh",
                success=False,
                request=request,
                reason="user_not_found",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response("User not found", status_code=status.HTTP_401_UNAUTHORIZED)

        refresh_record.revoke()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        log_auth_event(
            event="refresh",
            success=True,
            request=request,
            user=user,
            username=user.username,
            status_code=status.HTTP_200_OK,
        )
        return Response(_issue_tokens(user, profile), status=status.HTTP_200_OK)

    @staticmethod
    def _token_from_header(request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return ""
        return auth_header[7:].strip()


class LogoutAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthLogoutRateThrottle]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.get("refresh_token") or RefreshAPIView._token_from_header(request)
        if not token:
            log_auth_event(
                event="logout",
                success=True,
                request=request,
                reason="missing_token_noop",
                status_code=status.HTTP_204_NO_CONTENT,
                audit_action="logout",
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        try:
            payload = decode_refresh_token(token)
        except JWTError:
            log_auth_event(
                event="logout",
                success=False,
                request=request,
                reason="invalid_token",
                status_code=status.HTTP_204_NO_CONTENT,
                audit_action="logout",
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        jti = payload.get("jti")
        user_id = int(payload.get("sub", 0))
        user = User.objects.filter(id=user_id).first()
        RefreshToken.objects.filter(jti=jti, revoked_at__isnull=True).update(revoked_at=timezone.now())
        log_auth_event(
            event="logout",
            success=True,
            request=request,
            user=user,
            username=getattr(user, "username", ""),
            status_code=status.HTTP_204_NO_CONTENT,
            audit_action="logout",
        )
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
