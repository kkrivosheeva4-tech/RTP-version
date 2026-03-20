from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response

STATUS_CODE_TO_ERROR_CODE = {
    status.HTTP_400_BAD_REQUEST: "bad_request",
    status.HTTP_401_UNAUTHORIZED: "unauthorized",
    status.HTTP_403_FORBIDDEN: "forbidden",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
    status.HTTP_429_TOO_MANY_REQUESTS: "too_many_requests",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "internal_error",
    status.HTTP_503_SERVICE_UNAVAILABLE: "service_unavailable",
}

STATUS_CODE_TO_DEFAULT_MESSAGE = {
    status.HTTP_400_BAD_REQUEST: "Bad request.",
    status.HTTP_401_UNAUTHORIZED: "Authentication required.",
    status.HTTP_403_FORBIDDEN: "Permission denied.",
    status.HTTP_404_NOT_FOUND: "Resource not found.",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Method not allowed.",
    status.HTTP_409_CONFLICT: "Conflict.",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "Unsupported media type.",
    status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests.",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "Internal server error.",
    status.HTTP_503_SERVICE_UNAVAILABLE: "Service temporarily unavailable.",
}


def _is_standard_error_payload(data: Any) -> bool:
    return isinstance(data, dict) and data.get("ok") is False and "error" in data and "code" in data


def _first_scalar(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        for item in value:
            found = _first_scalar(item)
            if found:
                return found
        return ""
    if isinstance(value, dict):
        preferred_keys = ("message", "error", "detail", "non_field_errors")
        for key in preferred_keys:
            if key in value:
                found = _first_scalar(value[key])
                if found:
                    return found
        for item in value.values():
            found = _first_scalar(item)
            if found:
                return found
        return ""
    return str(value) if value is not None else ""


def normalize_error_payload(
    data: Any, status_code: int, *, code: str | None = None
) -> dict[str, Any]:
    if _is_standard_error_payload(data):
        return data

    message = _first_scalar(data).strip() or STATUS_CODE_TO_DEFAULT_MESSAGE.get(
        status_code, "Request failed."
    )
    payload: dict[str, Any] = {
        "ok": False,
        "error": message,
        "message": message,
        "code": code or STATUS_CODE_TO_ERROR_CODE.get(status_code, "request_error"),
    }
    if data not in (None, "", {}):
        payload["details"] = data
    return payload


def error_response(
    message: str,
    *,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    code: str | None = None,
    details: Any = None,
) -> Response:
    base_details = details if details is not None else {"detail": message}
    return Response(
        normalize_error_payload(base_details, status_code, code=code),
        status=status_code,
    )
