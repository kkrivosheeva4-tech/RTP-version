import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONOpenAPIRenderer
from rest_framework.response import Response
from rest_framework.schemas import get_schema_view
from rest_framework.views import APIView

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
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RTP-3 API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
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


def frontend_dist_view(request, path: str = ""):
    dist_dir = Path(settings.FRONTEND_DIST_DIR).resolve()
    project_root = Path(settings.PROJECT_ROOT).resolve()
    if not dist_dir.exists():
        return HttpResponse(
            "Frontend build not found. Run `npm run build` in the project root.",
            status=503,
        )

    relative_path = (path or "").lstrip("/")
    source_candidate = _resolve_frontend_source_path(relative_path)
    if relative_path.startswith("src/pages/auth") and source_candidate:
        requested = source_candidate
    else:
        requested = dist_dir / (relative_path or "index.html")

    try:
        resolved = requested.resolve(strict=False)
    except OSError as exc:
        raise Http404("Invalid frontend path") from exc

    in_dist_dir = dist_dir in resolved.parents or resolved == dist_dir
    in_project_root = project_root in resolved.parents or resolved == project_root
    if not in_dist_dir and not in_project_root:
        raise Http404("Invalid frontend path")

    if resolved.is_dir():
        resolved = resolved / "index.html"

    if not resolved.exists() or not resolved.is_file():
        if source_candidate and source_candidate.exists() and source_candidate.is_file():
            resolved = source_candidate.resolve()

    if not resolved.exists() or not resolved.is_file():
        # Missing files with an extension should stay 404, not fallback.
        if Path(relative_path).suffix:
            raise Http404("Frontend file not found")
        fallback = dist_dir / "index.html"
        if not fallback.exists():
            raise Http404("Frontend entrypoint not found")
        resolved = fallback

    content_type = _frontend_content_type(resolved)
    if content_type:
        return FileResponse(resolved.open("rb"), content_type=content_type)
    return FileResponse(resolved.open("rb"))


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

    guessed, _ = mimetypes.guess_type(str(file_path), strict=False)
    return guessed


def _resolve_frontend_source_path(relative_path: str) -> Path | None:
    if not relative_path:
        return None

    allowed_prefixes = ("src/", "assets/")
    allowed_files = {"index.html", "favicon.ico"}
    if not relative_path.startswith(allowed_prefixes) and relative_path not in allowed_files:
        return None

    project_root = Path(settings.PROJECT_ROOT).resolve()
    candidate = (project_root / relative_path).resolve(strict=False)
    if project_root not in candidate.parents and candidate != project_root:
        return None
    return candidate
