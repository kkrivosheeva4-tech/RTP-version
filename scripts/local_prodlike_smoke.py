import argparse
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.cookiejar import CookieJar
from pathlib import Path


def _bootstrap_django() -> None:
    root_dir = Path(__file__).resolve().parents[1]
    backend_dir = root_dir / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()


def _expect(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _json_request(
    opener: urllib.request.OpenerDirector,
    method: str,
    url: str,
    payload: dict | None = None,
    headers: dict | None = None,
    default_headers: dict | None = None,
):
    body = None
    request_headers = {"Accept": "application/json"}
    if default_headers:
        request_headers.update(default_headers)
    if headers:
        request_headers.update(headers)
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method.upper())
    try:
        return opener.open(request, timeout=20)
    except urllib.error.HTTPError as exc:
        return exc


def _read_json(response) -> dict:
    raw = response.read().decode("utf-8", errors="replace")
    if not raw.strip():
        return {}
    return json.loads(raw)


def _header_values(response, name: str) -> list[str]:
    if hasattr(response.headers, "get_all"):
        return response.headers.get_all(name) or []
    value = response.headers.get(name)
    return [value] if value else []


def _cookie_value(cookie_jar: CookieJar, name: str) -> str:
    for cookie in cookie_jar:
        if cookie.name == name:
            return cookie.value
    return ""


def _login(opener, base_url: str, username: str, password: str, default_headers: dict | None = None) -> dict:
    response = _json_request(
        opener,
        "POST",
        f"{base_url}/api/v1/auth/login/",
        {"username": username, "password": password},
        default_headers=default_headers,
    )
    _expect(response.status == 200, f"login failed for {username}: {response.status}")
    return _read_json(response)


def _verify_2fa(
    opener, base_url: str, session_id: str, code: str, default_headers: dict | None = None
) -> tuple[dict, list[str]]:
    response = _json_request(
        opener,
        "POST",
        f"{base_url}/api/v1/auth/2fa/verify/",
        {"session_id": session_id, "code": code},
        default_headers=default_headers,
    )
    _expect(response.status == 200, f"2FA verify failed: {response.status}")
    set_cookie_headers = _header_values(response, "Set-Cookie")
    return _read_json(response), set_cookie_headers


def _refresh(
    opener, base_url: str, csrf_token: str, default_headers: dict | None = None
) -> tuple[dict, list[str]]:
    response = _json_request(
        opener,
        "POST",
        f"{base_url}/api/v1/auth/refresh/",
        {},
        {"X-CSRFToken": csrf_token},
        default_headers=default_headers,
    )
    _expect(response.status == 200, f"refresh failed: {response.status}")
    set_cookie_headers = _header_values(response, "Set-Cookie")
    return _read_json(response), set_cookie_headers


def _logout(opener, base_url: str, csrf_token: str, default_headers: dict | None = None) -> int:
    response = _json_request(
        opener,
        "POST",
        f"{base_url}/api/v1/auth/logout/",
        {},
        {"X-CSRFToken": csrf_token},
        default_headers=default_headers,
    )
    return response.status


def _build_auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Runtime smoke for the local production-like contour.")
    parser.add_argument(
        "--base-url",
        default=os.getenv("LOCAL_PRODLIKE_ORIGIN", "https://rtp3.localhost").rstrip("/"),
        help="Public HTTPS origin exposed by the reverse proxy.",
    )
    parser.add_argument(
        "--verify-tls",
        action="store_true",
        help="Verify the HTTPS certificate chain. Disabled by default for local internal CA flows.",
    )
    args = parser.parse_args()

    _bootstrap_django()

    from django.contrib.auth import get_user_model

    from auth_custom.models import UserProfile
    from auth_custom.totp_utils import generate_totp_secret, generate_totp_token
    from references.models import FunctionalBlock
    from technologies.models import Technology

    base_url = args.base_url.rstrip("/")
    parsed_base = urllib.parse.urlparse(base_url)
    request_base_url = base_url
    request_default_headers: dict[str, str] = {}
    hostname = parsed_base.hostname or ""
    port = parsed_base.port or (443 if parsed_base.scheme == "https" else 80)
    try:
        socket.getaddrinfo(hostname, port)
    except OSError:
        if hostname.endswith(".localhost"):
            request_base_url = base_url.replace(hostname, "127.0.0.1", 1)

    ssl_context = ssl.create_default_context() if args.verify_tls else ssl._create_unverified_context()
    cookie_jar = CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=ssl_context),
        urllib.request.HTTPCookieProcessor(cookie_jar),
    )

    User = get_user_model()
    suffix = uuid.uuid4().hex[:8]
    admin_username = f"prodlike_admin_{suffix}"
    owner_username = f"prodlike_owner_{suffix}"
    editor_username = f"prodlike_editor_{suffix}"
    password = "ProdlikeSmoke123!"
    created_block = None
    created_tech_ids: list[int] = []
    created_user_ids: list[int] = []

    def create_user(username: str, role: str):
        user = User.objects.create_user(username=username, password=password, is_active=True)
        created_user_ids.append(user.id)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.legacy_role = ""
        profile.is_2fa_enabled = True
        profile.totp_secret = generate_totp_secret()
        profile.save(update_fields=["role", "legacy_role", "is_2fa_enabled", "totp_secret", "updated_at"])
        return user, profile

    admin_user, admin_profile = create_user(admin_username, UserProfile.ROLE_ADMIN)
    owner_user, owner_profile = create_user(owner_username, UserProfile.ROLE_OWNER)
    editor_user, editor_profile = create_user(editor_username, UserProfile.ROLE_EDITOR)

    try:
        print("==> Smoke: public HTTPS endpoints")
        health_response = _json_request(
            opener,
            "GET",
            f"{request_base_url}/api/v1/health",
            headers={"Accept": "*/*"},
            default_headers=request_default_headers,
        )
        _expect(health_response.status == 200, f"health failed: {health_response.status}")
        health_data = _read_json(health_response)
        _expect(health_data.get("status") == "ok", "health payload must contain status=ok")

        openapi_response = _json_request(
            opener,
            "GET",
            f"{request_base_url}/api/v1/openapi.json",
            headers={"Accept": "*/*"},
            default_headers=request_default_headers,
        )
        _expect(openapi_response.status == 200, f"openapi failed: {openapi_response.status}")
        openapi_data = _read_json(openapi_response)
        _expect(isinstance(openapi_data.get("paths"), dict), "OpenAPI payload must contain paths")

        docs_response = _json_request(
            opener,
            "GET",
            f"{request_base_url}/api/v1/docs",
            headers={"Accept": "*/*"},
            default_headers=request_default_headers,
        )
        _expect(docs_response.status == 200, f"docs failed: {docs_response.status}")

        print("==> Smoke: cookie auth and secure cookies")
        login_data = _login(
            opener, request_base_url, admin_username, password, default_headers=request_default_headers
        )
        session_id = str(login_data.get("session_id", "")).strip()
        _expect(session_id, "login must return session_id")

        verify_data, verify_cookies = _verify_2fa(
            opener,
            request_base_url,
            session_id,
            generate_totp_token(admin_profile.totp_secret),
            default_headers=request_default_headers,
        )
        access_token = str(verify_data.get("access_token", "")).strip()
        _expect(access_token, "2FA verify must return access_token")
        _expect("refresh_token" not in verify_data, "refresh token must stay in cookie mode")
        _expect(any("Secure" in header for header in verify_cookies), "verify response must set Secure cookies")

        csrf_token = _cookie_value(cookie_jar, "csrftoken")
        _expect(csrf_token, "csrf cookie must be present after 2FA verify")

        me_response = _json_request(
            opener,
            "GET",
            f"{request_base_url}/api/v1/users/me/",
            None,
            {**request_default_headers, **_build_auth_headers(access_token)},
        )
        _expect(me_response.status == 200, f"users/me failed: {me_response.status}")
        me_data = _read_json(me_response)
        _expect(me_data.get("username") == admin_username, "users/me returned unexpected username")

        refresh_data, refresh_cookies = _refresh(
            opener, request_base_url, csrf_token, default_headers=request_default_headers
        )
        _expect(str(refresh_data.get("access_token", "")).strip(), "refresh must return new access token")
        _expect(any("Secure" in header for header in refresh_cookies), "refresh response must keep Secure cookies")

        logout_status = _logout(
            opener, request_base_url, csrf_token, default_headers=request_default_headers
        )
        _expect(logout_status == 204, f"logout failed: {logout_status}")

        print("==> Smoke: admin path over HTTPS")
        cookie_jar.clear()
        admin_login = _login(
            opener, request_base_url, admin_username, password, default_headers=request_default_headers
        )
        admin_verify, _ = _verify_2fa(
            opener,
            request_base_url,
            str(admin_login.get("session_id", "")).strip(),
            generate_totp_token(admin_profile.totp_secret),
            default_headers=request_default_headers,
        )
        admin_access = str(admin_verify.get("access_token", "")).strip()
        admin_headers = {**request_default_headers, **_build_auth_headers(admin_access)}

        metrics_response = _json_request(
            opener, "GET", f"{request_base_url}/api/v1/metrics", None, admin_headers
        )
        _expect(metrics_response.status == 200, f"metrics failed: {metrics_response.status}")

        create_user_response = _json_request(
            opener,
            "POST",
            f"{request_base_url}/api/v1/admin-panel/users",
            {
                "username": f"prodlike_guest_{suffix}",
                "password": password,
                "role": "guest",
                "is_active": True,
                "email": "",
            },
            admin_headers,
        )
        _expect(create_user_response.status == 201, f"admin user create failed: {create_user_response.status}")
        created_user_payload = _read_json(create_user_response)
        temp_guest_id = int(created_user_payload["id"])
        created_user_ids.append(temp_guest_id)

        delete_user_response = _json_request(
            opener,
            "DELETE",
            f"{request_base_url}/api/v1/admin-panel/users/{temp_guest_id}",
            None,
            admin_headers,
        )
        _expect(delete_user_response.status == 204, f"admin user delete failed: {delete_user_response.status}")
        created_user_ids.remove(temp_guest_id)

        print("==> Smoke: moderation path over HTTPS")
        block = FunctionalBlock.objects.order_by("id").first()
        if block is None:
            created_block = FunctionalBlock.objects.create(name=f"Prodlike Block {suffix}")
            block = created_block

        owner_login = _login(
            opener, request_base_url, owner_username, password, default_headers=request_default_headers
        )
        owner_verify, _ = _verify_2fa(
            opener,
            request_base_url,
            str(owner_login.get("session_id", "")).strip(),
            generate_totp_token(owner_profile.totp_secret),
            default_headers=request_default_headers,
        )
        owner_access = str(owner_verify.get("access_token", "")).strip()
        owner_headers = {**request_default_headers, **_build_auth_headers(owner_access)}

        editor_login = _login(
            opener, request_base_url, editor_username, password, default_headers=request_default_headers
        )
        editor_verify, _ = _verify_2fa(
            opener,
            request_base_url,
            str(editor_login.get("session_id", "")).strip(),
            generate_totp_token(editor_profile.totp_secret),
            default_headers=request_default_headers,
        )
        editor_access = str(editor_verify.get("access_token", "")).strip()
        editor_headers = {**request_default_headers, **_build_auth_headers(editor_access)}

        proposal_name = f"Prodlike Tech {suffix}"
        create_proposal_response = _json_request(
            opener,
            "POST",
            f"{request_base_url}/api/v1/technology-proposals",
            {
                "action": "create",
                "payload": {
                    "name": proposal_name,
                    "description": "Created by local production-like smoke.",
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
                },
            },
            editor_headers,
        )
        _expect(
            create_proposal_response.status == 201,
            f"proposal create failed: {create_proposal_response.status}",
        )
        proposal_payload = _read_json(create_proposal_response)
        proposal_id = int(proposal_payload["id"])

        pending_response = _json_request(
            opener,
            "GET",
            f"{request_base_url}/api/v1/technology-proposals/pending",
            None,
            owner_headers,
        )
        _expect(pending_response.status == 200, f"pending proposals failed: {pending_response.status}")
        pending_payload = _read_json(pending_response)
        _expect(any(int(item["id"]) == proposal_id for item in pending_payload), "proposal not found in pending list")

        approve_response = _json_request(
            opener,
            "POST",
            f"{request_base_url}/api/v1/technology-proposals/{proposal_id}/approve",
            {"review_comment": "local prodlike smoke"},
            owner_headers,
        )
        _expect(approve_response.status == 200, f"proposal approve failed: {approve_response.status}")
        approved_payload = _read_json(approve_response)
        _expect(approved_payload.get("status") == "approved", "proposal status must become approved")

        for _ in range(10):
            tech = Technology.objects.filter(name=proposal_name).first()
            if tech is not None:
                created_tech_ids.append(tech.id)
                break
            time.sleep(0.2)
        _expect(created_tech_ids, "approved proposal did not create technology in database")

        print("Local production-like smoke passed.")
        return 0
    finally:
        if created_tech_ids:
            Technology.objects.filter(id__in=created_tech_ids).delete()
        if created_block is not None:
            created_block.delete()
        if created_user_ids:
            User.objects.filter(id__in=created_user_ids).delete()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Smoke checks failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
