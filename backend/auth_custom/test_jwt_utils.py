from datetime import datetime, timedelta, timezone

from django.test import SimpleTestCase

from auth_custom.jwt_utils import JWTError, decode_jwt, encode_jwt


class TestJwtUtils(SimpleTestCase):
    def setUp(self):
        self.secret = "unit-test-secret"
        now = datetime.now(tz=timezone.utc)
        self.default_payload = {
            "sub": "42",
            "type": "access",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        }

    def test_encode_decode_roundtrip(self):
        token = encode_jwt(self.default_payload, self.secret)
        decoded = decode_jwt(token, self.secret, expected_type="access")
        self.assertEqual(decoded["sub"], "42")
        self.assertEqual(decoded["type"], "access")

    def test_decode_rejects_expired_token(self):
        now = datetime.now(tz=timezone.utc)
        expired_payload = {
            "sub": "42",
            "type": "access",
            "iat": int((now - timedelta(minutes=10)).timestamp()),
            "exp": int((now - timedelta(minutes=1)).timestamp()),
        }
        token = encode_jwt(expired_payload, self.secret)
        with self.assertRaises(JWTError):
            decode_jwt(token, self.secret, expected_type="access")

    def test_decode_rejects_unexpected_token_type(self):
        wrong_type_payload = dict(self.default_payload)
        wrong_type_payload["type"] = "refresh"
        token = encode_jwt(wrong_type_payload, self.secret)
        with self.assertRaises(JWTError):
            decode_jwt(token, self.secret, expected_type="access")
