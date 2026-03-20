import json
import os
import sys
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


def _fail(message: str) -> None:
    raise RuntimeError(message)


def _expect(condition: bool, message: str) -> None:
    if not condition:
        _fail(message)


def _as_json(response):
    try:
        return json.loads(response.content.decode("utf-8"))
    except Exception:
        return {}


def main() -> int:
    _bootstrap_django()

    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.db import connection
    from django.db.models import Max
    from django.test import Client

    from auth_custom.models import UserProfile
    from auth_custom.totp_utils import generate_totp_secret, generate_totp_token
    from references.models import FunctionalBlock
    from technologies.models import Technology

    engine = connection.settings_dict.get("ENGINE", "")
    _expect(
        "postgresql" in engine,
        f"Expected PostgreSQL engine, got: {engine}",
    )

    client = Client(
        HTTP_HOST="localhost",
        HTTP_X_FORWARDED_PROTO="https",
        SERVER_PORT="443",
    )

    def _request(method: str, path: str, *, payload=None, headers=None):
        request_headers = {
            "secure": True,
            "HTTP_X_FORWARDED_PROTO": "https",
            "SERVER_PORT": "443",
        }
        if headers:
            request_headers.update(headers)

        client_method = getattr(client, method.lower())
        if payload is None:
            return client_method(path, **request_headers)
        return client_method(
            path,
            data=json.dumps(payload),
            content_type="application/json",
            **request_headers,
        )

    print("==> Smoke: health endpoint")
    health_response = _request("GET", "/api/v1/health")
    _expect(health_response.status_code == 200, "GET /api/v1/health must return 200")
    health_data = _as_json(health_response)
    _expect(health_data.get("status") == "ok", "Health response must contain status=ok")

    print("==> Smoke: OpenAPI endpoint")
    openapi_response = _request("GET", "/api/v1/openapi.json")
    _expect(openapi_response.status_code == 200, "GET /api/v1/openapi.json must return 200")
    openapi_data = _as_json(openapi_response)
    _expect(
        isinstance(openapi_data.get("paths"), dict),
        "OpenAPI response must contain paths object",
    )

    User = get_user_model()
    username = f"stage42_smoke_{uuid.uuid4().hex[:10]}"
    password = "Stage42SmokePass123!"
    smoke_user = User.objects.create_user(username=username, password=password, is_active=True)
    profile, _ = UserProfile.objects.get_or_create(user=smoke_user)
    profile.role = UserProfile.ROLE_ADMIN
    profile.legacy_role = ""
    profile.totp_secret = generate_totp_secret()
    profile.is_2fa_enabled = True
    profile.save(
        update_fields=[
            "role",
            "legacy_role",
            "totp_secret",
            "is_2fa_enabled",
            "updated_at",
        ]
    )

    created_block = None
    created_technology_id = None

    try:
        print("==> Smoke: auth login + 2FA + me + refresh + logout")
        login_response = _request(
            "POST",
            "/api/v1/auth/login/",
            payload={"username": username, "password": password},
        )
        _expect(login_response.status_code == 200, "POST /api/v1/auth/login/ must return 200")
        login_data = _as_json(login_response)
        session_id = str(login_data.get("session_id", "")).strip()
        _expect(session_id, "Login response must include session_id")
        _expect(login_data.get("requires_2fa") is True, "Login must require 2FA")

        two_fa_code = generate_totp_token(profile.totp_secret)
        verify_response = _request(
            "POST",
            "/api/v1/auth/2fa/verify/",
            payload={"session_id": session_id, "code": two_fa_code},
        )
        _expect(
            verify_response.status_code == 200,
            "POST /api/v1/auth/2fa/verify/ must return 200",
        )
        verify_data = _as_json(verify_response)
        access_token = str(verify_data.get("access_token", "")).strip()
        refresh_token = str(verify_data.get("refresh_token", "")).strip()
        _expect(access_token, "2FA verify response must include access_token")

        auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
        me_response = _request("GET", "/api/v1/users/me/", headers=auth_headers)
        _expect(me_response.status_code == 200, "GET /api/v1/users/me/ must return 200")
        me_data = _as_json(me_response)
        _expect(me_data.get("username") == username, "users/me must return smoke username")

        csrf_cookie_name = getattr(settings, "CSRF_COOKIE_NAME", "csrftoken")
        csrf_cookie = client.cookies.get(csrf_cookie_name)
        csrf_token = csrf_cookie.value if csrf_cookie is not None else ""
        refresh_headers = {}
        if csrf_token:
            refresh_headers["HTTP_X_CSRFTOKEN"] = csrf_token

        refresh_payload = {"refresh_token": refresh_token} if refresh_token else {}
        refresh_response = _request(
            "POST",
            "/api/v1/auth/refresh/",
            payload=refresh_payload,
            headers=refresh_headers,
        )
        _expect(refresh_response.status_code == 200, "POST /api/v1/auth/refresh/ must return 200")
        refresh_data = _as_json(refresh_response)
        rotated_refresh = str(refresh_data.get("refresh_token", "")).strip()

        logout_payload = {"refresh_token": rotated_refresh} if rotated_refresh else {}
        logout_response = _request(
            "POST",
            "/api/v1/auth/logout/",
            payload=logout_payload,
            headers=refresh_headers,
        )
        _expect(logout_response.status_code == 204, "POST /api/v1/auth/logout/ must return 204")

        print("==> Smoke: technologies CRUD + sequence sanity")
        block = FunctionalBlock.objects.order_by("id").first()
        if block is None:
            created_block = FunctionalBlock.objects.create(name=f"Stage42 Block {uuid.uuid4().hex[:8]}")
            block = created_block

        max_before = Technology.objects.aggregate(max_id=Max("id")).get("max_id") or 0
        tech_name = f"Stage42 Smoke Tech {uuid.uuid4().hex[:8]}"
        create_payload = {
            "name": tech_name,
            "description": "PostgreSQL staging dry-run smoke entity.",
            "block": block.id,
            "blocks": [block.id],
            "function": "",
            "functionCoverage": [],
            "enterprises": [],
            "directions": [],
            "trlStage": 1,
            "status": "planned",
            "vendors": [],
            "marketExamples": [],
            "documentationFiles": [],
        }
        create_response = _request(
            "POST",
            "/api/v1/technologies/",
            payload=create_payload,
            headers=auth_headers,
        )
        _expect(create_response.status_code == 201, "POST /api/v1/technologies/ must return 201")
        create_data = _as_json(create_response)
        technology_id = int(create_data.get("id", 0))
        _expect(technology_id > 0, "Created technology must have positive id")
        _expect(
            technology_id > max_before,
            f"Sequence sanity failed: created id={technology_id}, max_before={max_before}",
        )
        created_technology_id = technology_id

        patch_response = _request(
            "PATCH",
            f"/api/v1/technologies/{technology_id}",
            payload={"status": "pilot"},
            headers=auth_headers,
        )
        _expect(
            patch_response.status_code == 200,
            "PATCH /api/v1/technologies/<id> must return 200",
        )

        delete_response = _request(
            "DELETE",
            f"/api/v1/technologies/{technology_id}",
            headers=auth_headers,
        )
        _expect(
            delete_response.status_code == 204,
            "DELETE /api/v1/technologies/<id> must return 204",
        )
        created_technology_id = None

        print("Smoke checks passed.")
    finally:
        if created_technology_id is not None:
            Technology.objects.filter(id=created_technology_id).delete()
        if created_block is not None:
            created_block.delete()
        smoke_user.delete()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Smoke checks failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
