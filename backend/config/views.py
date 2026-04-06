from pathlib import Path

from django.shortcuts import render
from django.http import FileResponse, Http404, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import JSONOpenAPIRenderer
from rest_framework.response import Response
from rest_framework.schemas import get_schema_view
from rest_framework.views import APIView
from swagger_ui_bundle import swagger_ui_path

from auth_custom.models import UserProfile
from auth_custom.permissions import RolePermission
from config.observability import get_metrics_snapshot


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "service": "rtp-3-backend",
            "version": "v1",
        }
    )


class MetricsAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = {UserProfile.ROLE_ADMIN}
    write_roles = {UserProfile.ROLE_ADMIN}

    def get(self, request):
        return Response({"counters": get_metrics_snapshot()})


openapi_schema_view = get_schema_view(
    title="RTP-3 API",
    description="OpenAPI schema for frontend/backend integration",
    version="1.0.0",
    public=True,
    permission_classes=[AllowAny],
    renderer_classes=[JSONOpenAPIRenderer],
)


def swagger_ui_view(request):
    schema_url = "/api/v1/openapi.json"
    css_url = "/api/v1/docs/assets/swagger-ui.css"
    bundle_url = "/api/v1/docs/assets/swagger-ui-bundle.js"
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RTP-3 API Docs</title>
  <link rel="stylesheet" href="{css_url}" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="{bundle_url}"></script>
  <script>
    SwaggerUIBundle({{
      url: "{schema_url}",
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis]
    }});
  </script>
</body>
</html>"""
    return HttpResponse(html)


def swagger_ui_asset_view(request, asset_path: str):
    asset_root = Path(swagger_ui_path).resolve()
    requested = (asset_root / asset_path).resolve(strict=False)
    if asset_root not in requested.parents or not requested.exists() or not requested.is_file():
        raise Http404("Swagger UI asset not found")

    content_type = _frontend_content_type(requested)
    if content_type:
        return FileResponse(requested.open("rb"), content_type=content_type)
    return FileResponse(requested.open("rb"))


def ui_home_view(request):
    return render(request, "pages/home.html")


def ui_radar_view(request):
    return render(request, "pages/radar.html")


def ui_admin_panel_view(request):
    return render(request, "pages/admin.html")


def ui_help_view(request):
    return render(request, "pages/help.html")


def ui_auth_login_view(request):
    return render(request, "pages/auth/login.html")


def ui_auth_change_password_view(request):
    return render(request, "pages/auth/change_password.html")


def ui_auth_2fa_setup_view(request):
    return render(request, "pages/auth/2fa_setup.html")


def ui_auth_2fa_verify_view(request):
    return render(request, "pages/auth/2fa_verify.html")


def _frontend_content_type(file_path: Path) -> str | None:
    suffix = file_path.suffix.lower()
    explicit_types = {
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json",
        ".map": "application/json",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
    }
    if suffix in explicit_types:
        return explicit_types[suffix]

    import mimetypes

    guessed, _ = mimetypes.guess_type(str(file_path), strict=False)
    return guessed
