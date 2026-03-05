from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from auth_custom.jwt_utils import JWTError, decode_access_token

User = get_user_model()


class JWTAuthentication(BaseAuthentication):
    keyword = b"bearer"

    def authenticate(self, request):
        auth_header = get_authorization_header(request).split()
        if not auth_header:
            return None

        if auth_header[0].lower() != self.keyword:
            return None

        if len(auth_header) != 2:
            raise AuthenticationFailed("Invalid authorization header")

        try:
            token = auth_header[1].decode("utf-8")
            payload = decode_access_token(token)
            user_id = int(payload.get("sub"))
        except (UnicodeDecodeError, ValueError, JWTError) as exc:
            raise AuthenticationFailed("Invalid or expired access token") from exc

        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed("User not found") from exc

        return user, payload

    def authenticate_header(self, request):
        return "Bearer"
