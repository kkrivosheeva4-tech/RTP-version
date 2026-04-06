from rest_framework import serializers

from auth_custom.security import (
    validate_login_email,
    validate_password_format,
    validate_password_policy,
)


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254, trim_whitespace=False)
    password = serializers.CharField(max_length=128, trim_whitespace=False)

    def validate_email(self, value):
        return validate_login_email(value)

    def validate_password(self, value):
        return validate_password_format(value)


class RefreshSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=False, allow_blank=True)

    def validate_refresh_token(self, value):
        token = value.strip()
        if value and not token:
            raise serializers.ValidationError("refresh_token must not be blank.")
        return token


class LogoutSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=False, allow_blank=True)

    def validate_refresh_token(self, value):
        token = value.strip()
        if value and not token:
            raise serializers.ValidationError("refresh_token must not be blank.")
        return token


class TwoFASetupSerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=2048)

    def validate_session_id(self, value):
        session_id = value.strip()
        if not session_id:
            raise serializers.ValidationError("session_id is required.")
        return session_id


class TwoFAVerifySerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=2048)
    code = serializers.RegexField(regex=r"^\d{6}$")

    def validate_session_id(self, value):
        session_id = value.strip()
        if not session_id:
            raise serializers.ValidationError("session_id is required.")
        return session_id


class PasswordChangeConfirmSerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=2048)
    new_password = serializers.CharField(
        max_length=128,
        trim_whitespace=False,
    )
    new_password_confirm = serializers.CharField(
        max_length=128,
        trim_whitespace=False,
    )

    def validate_session_id(self, value):
        session_id = value.strip()
        if not session_id:
            raise serializers.ValidationError("session_id is required.")
        return session_id

    def validate(self, attrs):
        new_password = attrs["new_password"]
        new_password_confirm = attrs["new_password_confirm"]
        validate_password_policy(new_password)
        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        return attrs
