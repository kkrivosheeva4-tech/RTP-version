from time import perf_counter

from django.http import JsonResponse

from config.api_errors import normalize_error_payload
from config.observability import APP_LOGGER, increment_metric


class ObservabilityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = perf_counter()
        increment_metric("http.requests.total")

        try:
            response = self.get_response(request)
        except Exception:
            increment_metric("http.responses.500.total")
            increment_metric("http.errors.5xx.total")
            APP_LOGGER.exception("unhandled_exception path=%s method=%s", request.path, request.method)
            if request.path.startswith("/api/"):
                payload = normalize_error_payload(
                    {"detail": "Internal server error."},
                    500,
                )
                return JsonResponse(payload, status=500)
            raise

        elapsed_ms = int((perf_counter() - started_at) * 1000)
        status_code = int(getattr(response, "status_code", 0) or 0)
        increment_metric(f"http.responses.{status_code}.total")

        if status_code >= 500:
            increment_metric("http.errors.5xx.total")
        elif status_code >= 400:
            increment_metric("http.errors.4xx.total")

        APP_LOGGER.info(
            "http_request method=%s path=%s status=%s duration_ms=%s",
            request.method,
            request.path,
            status_code,
            elapsed_ms,
        )
        return response
