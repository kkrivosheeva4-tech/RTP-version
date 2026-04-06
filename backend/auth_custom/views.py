import os
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth_custom.jwt_utils import (
    JWTError,
    create_2fa_session_token,
    create_access_token,
    create_password_change_session_token,
    create_refresh_token,
    decode_2fa_session_token,
    decode_password_change_session_token,
    decode_refresh_token,
)
from admin_panel.models import AuditLog
from auth_custom.models import RefreshToken, UserPasswordHistory, UserProfile
from auth_custom.security import (
    PASSWORD_HISTORY_LIMIT,
    PASSWORD_MAX_FAILED_ATTEMPTS,
    ensure_password_not_reused,
    is_password_expired,
    normalize_email,
    validate_password_policy,
)
from auth_custom.serializers import (
    LoginSerializer,
    LogoutSerializer,
    PasswordChangeConfirmSerializer,
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
from config.observability import audit_log, log_auth_event

User = get_user_model()

try:
    import qrcode
    from qrcode.image.svg import SvgImage
except Exception:  # pragma: no cover - fallback when dependency missing
    qrcode = None
    SvgImage = None


def _generate_qr_svg(qr_payload: str) -> bytes:
    if qrcode is None or SvgImage is None:
        raise RuntimeError("Python QR SVG generator is unavailable")

    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(qr_payload)
    qr.make(fit=True)
    image = qr.make_image(image_factory=SvgImage)
    return image.to_string(encoding="utf-8")


def _should_use_refresh_cookie() -> bool:
    return True


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    if not _should_use_refresh_cookie():
        return
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.AUTH_REFRESH_COOKIE_MAX_AGE,
        httponly=settings.AUTH_REFRESH_COOKIE_HTTPONLY,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        domain=settings.AUTH_REFRESH_COOKIE_DOMAIN,
    )


def _clear_refresh_cookie(response: Response) -> None:
    if not _should_use_refresh_cookie():
        return
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        domain=settings.AUTH_REFRESH_COOKIE_DOMAIN,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def _should_require_refresh_csrf() -> bool:
    return bool(getattr(settings, "AUTH_REFRESH_REQUIRE_CSRF", False))


def _set_csrf_cookie(response: Response, request) -> None:
    if not _should_use_refresh_cookie():
        return
    csrf_token = get_token(request)
    response.set_cookie(
        key=getattr(settings, "CSRF_COOKIE_NAME", "csrftoken"),
        value=csrf_token,
        max_age=getattr(settings, "CSRF_COOKIE_AGE", 31449600),
        secure=getattr(settings, "CSRF_COOKIE_SECURE", False),
        httponly=getattr(settings, "CSRF_COOKIE_HTTPONLY", False),
        samesite=getattr(settings, "CSRF_COOKIE_SAMESITE", "Lax"),
        path=getattr(settings, "CSRF_COOKIE_PATH", "/"),
        domain=getattr(settings, "CSRF_COOKIE_DOMAIN", None),
    )


def _has_valid_csrf(request) -> bool:
    cookie_name = getattr(settings, "CSRF_COOKIE_NAME", "csrftoken")
    csrf_cookie = str(request.COOKIES.get(cookie_name, "")).strip()
    csrf_header = str(
        request.headers.get("X-CSRFToken", "") or request.headers.get("X-CSRF-Token", "")
    ).strip()
    return bool(csrf_cookie and csrf_header and csrf_cookie == csrf_header)


def _validate_refresh_csrf_or_error(request):
    if not _should_use_refresh_cookie() or not _should_require_refresh_csrf():
        return None
    refresh_cookie = str(request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME, "")).strip()
    if not refresh_cookie:
        return None
    if _has_valid_csrf(request):
        return None
    log_auth_event(
        event="csrf_refresh_guard",
        success=False,
        request=request,
        reason="missing_or_invalid_csrf",
        status_code=status.HTTP_403_FORBIDDEN,
    )
    return error_response(
        "CSRF token missing or invalid for cookie-based refresh/logout.",
        status_code=status.HTTP_403_FORBIDDEN,
    )


def _issue_tokens(user, profile):
    role = profile.get_effective_role()
    access_token = create_access_token(user_id=user.id, username=user.username, role=role)
    refresh_token, jti, expires_at = create_refresh_token(user_id=user.id)
    RefreshToken.objects.create(user=user, jti=jti, expires_at=expires_at)
    payload = {
        "access_token": access_token,
        "token_type": "bearer",
    }
    return payload, refresh_token


def _revoke_active_refresh_tokens(user) -> None:
    RefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )


def _user_from_2fa_session(session_id: str):
    payload = decode_2fa_session_token(session_id)
    user_id = int(payload.get("sub", 0))
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user:
        raise JWTError("User not found")
    return user, payload


def _user_from_password_change_session(session_id: str):
    payload = decode_password_change_session_token(session_id)
    user_id = int(payload.get("sub", 0))
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user:
        raise JWTError("User not found")
    return user, payload


def _complete_login_response(request, user, profile):
    role = profile.get_effective_role()
    if not profile.is_2fa_enabled:
        payload, refresh_token = _issue_tokens(user, profile)
        response = Response(payload, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, refresh_token)
        _set_csrf_cookie(response, request)
        return response

    session_id = create_2fa_session_token(
        user_id=user.id,
        username=user.username,
        role=role,
    )
    is_2fa_setup = bool(profile.totp_secret)
    return Response(
        {
            "requires_2fa": True,
            "session_id": session_id,
            "is_2fa_setup": is_2fa_setup,
            "username": user.username,
            "role": role,
        },
        status=status.HTTP_200_OK,
    )


def _trim_password_history(user) -> None:
    stale_ids = list(
        user.password_history.order_by("-created_at").values_list("id", flat=True)[
            PASSWORD_HISTORY_LIMIT:
        ]
    )
    if stale_ids:
        user.password_history.filter(id__in=stale_ids).delete()


def _store_password_history(user) -> None:
    UserPasswordHistory.objects.create(user=user, password_hash=user.password)
    _trim_password_history(user)


def _set_user_password(user, profile, new_password: str, *, require_change: bool) -> None:
    validate_password_policy(new_password, user=user)
    ensure_password_not_reused(user, new_password)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    _store_password_history(user)
    profile.must_change_password = require_change
    profile.password_changed_at = timezone.now()
    profile.failed_login_attempts = 0
    profile.locked_at = None
    profile.save(
        update_fields=[
            "must_change_password",
            "password_changed_at",
            "failed_login_attempts",
            "locked_at",
            "updated_at",
        ]
    )


def _mark_user_locked(request, user, profile, *, reason: str) -> None:
    audit_log(
        action=AuditLog.ACTION_UPDATE,
        entity_type="user",
        entity_id=user.id,
        request=request,
        actor=None,
        metadata={"event": "account_locked", "reason": reason},
    )


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthLoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        user = User.objects.filter(email__iexact=normalize_email(email)).first()
        if user is None:
            log_auth_event(
                event="login",
                success=False,
                request=request,
                username=email,
                reason="invalid_credentials",
                status_code=status.HTTP_401_UNAUTHORIZED,
                audit_action="login",
            )
            return error_response("Invalid credentials", status_code=status.HTTP_401_UNAUTHORIZED)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.is_locked:
            log_auth_event(
                event="login",
                success=False,
                request=request,
                user=user,
                username=email,
                reason="account_locked",
                status_code=status.HTTP_423_LOCKED,
            )
            return error_response("Account is locked.", status_code=status.HTTP_423_LOCKED)

        if not user.is_active or not user.check_password(password):
            is_now_locked = profile.register_failed_login(
                max_attempts=PASSWORD_MAX_FAILED_ATTEMPTS
            )
            reason = "account_locked" if is_now_locked else "invalid_credentials"
            if is_now_locked:
                _mark_user_locked(request, user, profile, reason=reason)
            log_auth_event(
                event="login",
                success=False,
                request=request,
                user=user,
                username=email,
                reason=reason,
                status_code=status.HTTP_423_LOCKED
                if is_now_locked
                else status.HTTP_401_UNAUTHORIZED,
                audit_action="login",
            )
            return error_response(
                "Account is locked." if is_now_locked else "Invalid credentials",
                status_code=status.HTTP_423_LOCKED
                if is_now_locked
                else status.HTTP_401_UNAUTHORIZED,
            )

        if profile.failed_login_attempts:
            profile.reset_login_attempts()
        role = profile.get_effective_role()
        if is_password_expired(profile.password_changed_at) and not profile.must_change_password:
            profile.must_change_password = True
            profile.save(update_fields=["must_change_password", "updated_at"])
        if profile.must_change_password:
            session_id = create_password_change_session_token(
                user_id=user.id,
                username=user.username,
                role=role,
            )
            log_auth_event(
                event="login",
                success=True,
                request=request,
                user=user,
                username=email,
                reason="password_change_required",
                status_code=status.HTTP_200_OK,
            )
            return Response(
                {
                    "requires_password_change": True,
                    "session_id": session_id,
                    "username": user.username,
                    "email": user.email,
                    "role": role,
                },
                status=status.HTTP_200_OK,
            )
        log_auth_event(
            event="login",
            success=True,
            request=request,
            user=user,
            username=email,
            status_code=status.HTTP_200_OK,
            audit_action="login",
        )
        return _complete_login_response(request, user, profile)


class PasswordChangeConfirmAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthLoginRateThrottle]

    def post(self, request):
        serializer = PasswordChangeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session_id = serializer.validated_data["session_id"]
        new_password = serializer.validated_data["new_password"]

        try:
            user, _ = _user_from_password_change_session(session_id)
        except JWTError:
            log_auth_event(
                event="password_change",
                success=False,
                request=request,
                reason="invalid_session",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            return error_response(
                "Invalid or expired session_id",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if not profile.must_change_password:
            return error_response(
                "Password change is not required for this user.",
                status_code=status.HTTP_409_CONFLICT,
            )

        _set_user_password(user, profile, new_password, require_change=False)
        _revoke_active_refresh_tokens(user)
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="user",
            entity_id=user.id,
            request=request,
            actor=user,
            metadata={"event": "password_change", "reason": "first_login_required"},
        )
        log_auth_event(
            event="password_change",
            success=True,
            request=request,
            user=user,
            username=user.username,
            status_code=status.HTTP_200_OK,
        )
        # Check if user must set up 2FA (for newly created users)
        if profile.must_setup_2fa:
            role = profile.get_effective_role()
            session_id = create_2fa_session_token(
                user_id=user.id,
                username=user.username,
                role=role,
            )
            is_2fa_setup = bool(profile.totp_secret)
            return Response(
                {
                    "requires_2fa": True,
                    "session_id": session_id,
                    "is_2fa_setup": is_2fa_setup,
                    "username": user.username,
                    "role": role,
                },
                status=status.HTTP_200_OK,
            )
        return _complete_login_response(request, user, profile)


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
            return error_response(
                "Invalid or expired session_id", status_code=status.HTTP_401_UNAUTHORIZED
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.is_2fa_enabled and profile.totp_secret:
            issuer = os.getenv("TOTP_ISSUER", "Radar")
            qr_url = build_otpauth_uri(
                secret=profile.totp_secret,
                username=user.username,
                issuer=issuer,
            )
            log_auth_event(
                event="2fa_setup",
                success=True,
                request=request,
                user=user,
                username=user.username,
                reason="already_enabled_return_existing_secret",
                status_code=status.HTTP_200_OK,
            )
            return Response(
                {
                    "secret": profile.totp_secret,
                    "qr_url": qr_url,
                    "qr_svg_url": f"/api/v1/auth/2fa/qr?session_id={quote(session_id)}",
                    "already_enabled": True,
                },
                status=status.HTTP_200_OK,
            )

        secret = generate_totp_secret()
        profile.totp_secret = secret
        profile.save(update_fields=["totp_secret", "updated_at"])

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
        return Response(
            {
                "secret": secret,
                "qr_url": qr_url,
                "qr_svg_url": f"/api/v1/auth/2fa/qr?session_id={quote(session_id)}",
            },
            status=status.HTTP_200_OK,
        )


class TwoFAQrAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [Auth2FARateThrottle]

    def get(self, request):
        session_id = str(request.query_params.get("session_id", "")).strip()
        if not session_id:
            return error_response("session_id is required", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            user, _ = _user_from_2fa_session(session_id)
        except JWTError:
            return error_response(
                "Invalid or expired session_id",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if not profile.totp_secret:
            return error_response("2FA is not configured", status_code=status.HTTP_400_BAD_REQUEST)

        issuer = os.getenv("TOTP_ISSUER", "Radar")
        qr_payload = build_otpauth_uri(
            secret=profile.totp_secret, username=user.username, issuer=issuer
        )
        try:
            svg_bytes = _generate_qr_svg(qr_payload)
            return HttpResponse(svg_bytes, content_type="image/svg+xml; charset=utf-8")
        except RuntimeError:
            return error_response(
                "QR SVG generator is unavailable.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


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
            return error_response(
                "Invalid or expired session_id", status_code=status.HTTP_401_UNAUTHORIZED
            )

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
            profile.must_setup_2fa = False
            profile.save(update_fields=["is_2fa_enabled", "must_setup_2fa", "updated_at"])
        elif profile.must_setup_2fa:
            # In case 2FA was already enabled but must_setup_2fa flag exists
            profile.must_setup_2fa = False
            profile.save(update_fields=["must_setup_2fa", "updated_at"])

        log_auth_event(
            event="2fa_verify",
            success=True,
            request=request,
            user=user,
            username=user.username,
            status_code=status.HTTP_200_OK,
        )
        payload, refresh_token = _issue_tokens(user, profile)
        response = Response(payload, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, refresh_token)
        _set_csrf_cookie(response, request)
        return response


class RefreshAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRefreshRateThrottle]

    def post(self, request):
        csrf_error = _validate_refresh_csrf_or_error(request)
        if csrf_error is not None:
            return csrf_error

        serializer = RefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = self._token_from_cookie(request)
        if not token:
            log_auth_event(
                event="refresh",
                success=False,
                request=request,
                reason="missing_refresh_token",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
            return error_response(
                "refresh cookie is required", status_code=status.HTTP_400_BAD_REQUEST
            )

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
            return error_response(
                "Invalid or expired refresh token", status_code=status.HTTP_401_UNAUTHORIZED
            )

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
        payload, refresh_token = _issue_tokens(user, profile)
        response = Response(payload, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, refresh_token)
        _set_csrf_cookie(response, request)
        return response

    @staticmethod
    def _token_from_cookie(request):
        return str(request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME, "")).strip()


class LogoutAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthLogoutRateThrottle]

    def post(self, request):
        csrf_error = _validate_refresh_csrf_or_error(request)
        if csrf_error is not None:
            return csrf_error

        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = RefreshAPIView._token_from_cookie(request)
        if not token:
            log_auth_event(
                event="logout",
                success=True,
                request=request,
                reason="missing_token_noop",
                status_code=status.HTTP_204_NO_CONTENT,
                audit_action="logout",
            )
            response = Response(status=status.HTTP_204_NO_CONTENT)
            _clear_refresh_cookie(response)
            return response

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
            response = Response(status=status.HTTP_204_NO_CONTENT)
            _clear_refresh_cookie(response)
            return response

        jti = payload.get("jti")
        user_id = int(payload.get("sub", 0))
        user = User.objects.filter(id=user_id).first()
        RefreshToken.objects.filter(jti=jti, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )
        log_auth_event(
            event="logout",
            success=True,
            request=request,
            user=user,
            username=getattr(user, "username", ""),
            status_code=status.HTTP_204_NO_CONTENT,
            audit_action="logout",
        )
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        # Django superusers (createsuperuser, admin) должны получать роль admin
        # даже если UserProfile.role по умолчанию guest
        role = (
            UserProfile.ROLE_ADMIN
            if request.user.is_superuser
            else profile.get_effective_role()
        )
        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email or "",
                "role": role,
                "is_2fa_enabled": profile.is_2fa_enabled,
                "must_change_password": profile.must_change_password,
                "is_locked": profile.is_locked,
                "failed_login_attempts": profile.failed_login_attempts,
            },
            status=status.HTTP_200_OK,
        )
