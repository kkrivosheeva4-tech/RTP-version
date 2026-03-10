from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128)

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username is required.")
        return username

    def validate_password(self, value):
        if not str(value).strip():
            raise serializers.ValidationError("Password is required.")
        return value


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
