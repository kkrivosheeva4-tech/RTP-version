from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class _BaseAuthRateThrottle(SimpleRateThrottle):
    setting_name = ""

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }

    def get_rate(self):
        return getattr(settings, self.setting_name)


class AuthLoginRateThrottle(_BaseAuthRateThrottle):
    scope = "auth_login"
    setting_name = "AUTH_LOGIN_RATE"


class Auth2FARateThrottle(_BaseAuthRateThrottle):
    scope = "auth_2fa"
    setting_name = "AUTH_2FA_RATE"


class AuthRefreshRateThrottle(_BaseAuthRateThrottle):
    scope = "auth_refresh"
    setting_name = "AUTH_REFRESH_RATE"


class AuthLogoutRateThrottle(_BaseAuthRateThrottle):
    scope = "auth_logout"
    setting_name = "AUTH_LOGOUT_RATE"
