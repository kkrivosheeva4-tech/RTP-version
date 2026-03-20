import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path


def _bootstrap_django() -> None:
    root_dir = Path(__file__).resolve().parents[1]
    backend_dir = root_dir / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()


def _percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(round((len(ordered) - 1) * ratio))))
    return ordered[index]


def _as_json(response):
    try:
        return json.loads(response.content.decode("utf-8"))
    except Exception:
        return {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Lightweight load smoke for core RTP-3 endpoints.")
    parser.add_argument("--iterations", type=int, default=10, help="Requests per endpoint.")
    parser.add_argument(
        "--p95-threshold-ms",
        type=float,
        default=1500.0,
        help="Fail when p95 for any endpoint exceeds this threshold.",
    )
    args = parser.parse_args()

    _bootstrap_django()

    from django.contrib.auth import get_user_model
    from django.db import connection
    from django.test import Client

    from auth_custom.models import UserProfile
    from auth_custom.totp_utils import generate_totp_secret, generate_totp_token

    engine = connection.settings_dict.get("ENGINE", "")
    if "postgresql" not in engine:
        raise RuntimeError(f"Expected PostgreSQL engine, got: {engine}")

    client = Client(
        HTTP_HOST="localhost",
        HTTP_X_FORWARDED_PROTO="https",
        SERVER_PORT="443",
    )

    def request(method: str, path: str, *, payload=None, headers=None):
        request_headers = {
            "secure": True,
            "HTTP_X_FORWARDED_PROTO": "https",
            "SERVER_PORT": "443",
        }
        if headers:
            request_headers.update(headers)

        started = time.perf_counter()
        handler = getattr(client, method.lower())
        if payload is None:
            response = handler(path, **request_headers)
        else:
            response = handler(
                path,
                data=json.dumps(payload),
                content_type="application/json",
                **request_headers,
            )
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return response, elapsed_ms

    User = get_user_model()
    username = f"load_smoke_{uuid.uuid4().hex[:8]}"
    password = "LoadSmokePass123!"
    user = User.objects.create_user(username=username, password=password, is_active=True)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.role = UserProfile.ROLE_ADMIN
    profile.totp_secret = generate_totp_secret()
    profile.is_2fa_enabled = True
    profile.save(update_fields=["role", "totp_secret", "is_2fa_enabled", "updated_at"])

    try:
        login_response, _ = request(
            "POST",
            "/api/v1/auth/login/",
            payload={"username": username, "password": password},
        )
        if login_response.status_code != 200:
            raise RuntimeError("Load smoke login failed")
        session_id = str(_as_json(login_response).get("session_id", "")).strip()
        if not session_id:
            raise RuntimeError("Load smoke login did not return session_id")

        verify_response, _ = request(
            "POST",
            "/api/v1/auth/2fa/verify/",
            payload={"session_id": session_id, "code": generate_totp_token(profile.totp_secret)},
        )
        if verify_response.status_code != 200:
            raise RuntimeError("Load smoke 2FA verify failed")
        access_token = str(_as_json(verify_response).get("access_token", "")).strip()
        if not access_token:
            raise RuntimeError("Load smoke verify did not return access_token")

        auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
        scenarios = [
            ("GET", "/api/v1/health", None, None, 200),
            ("GET", "/api/v1/openapi.json", None, None, 200),
            ("GET", "/api/v1/docs", None, None, 200),
            ("GET", "/api/v1/users/me/", None, auth_headers, 200),
            ("GET", "/api/v1/technologies/", None, auth_headers, 200),
        ]

        report: dict[str, list[float]] = {}
        for method, path, payload, headers, expected_status in scenarios:
            key = f"{method} {path}"
            report[key] = []
            for _ in range(max(1, args.iterations)):
                response, elapsed_ms = request(method, path, payload=payload, headers=headers)
                if response.status_code != expected_status:
                    raise RuntimeError(
                        f"{key} returned {response.status_code}, expected {expected_status}"
                    )
                report[key].append(elapsed_ms)

        print("==> Load smoke summary")
        failed = False
        for key, values in report.items():
            avg_ms = sum(values) / len(values)
            p95_ms = _percentile(values, 0.95)
            max_ms = max(values)
            print(
                f"{key}: count={len(values)} avg={avg_ms:.1f}ms p95={p95_ms:.1f}ms max={max_ms:.1f}ms"
            )
            if p95_ms > args.p95_threshold_ms:
                failed = True

        if failed:
            raise RuntimeError(
                f"Load smoke exceeded p95 threshold of {args.p95_threshold_ms:.1f}ms"
            )

        print("Load smoke passed.")
        return 0
    finally:
        user.delete()


if __name__ == "__main__":
    raise SystemExit(main())
