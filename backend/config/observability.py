import json
import logging
from collections import Counter
from threading import Lock
from typing import Any

from admin_panel.models import AuditLog

APP_LOGGER = logging.getLogger("rtp3.app")
AUTH_LOGGER = logging.getLogger("rtp3.auth")

_METRICS_LOCK = Lock()
_METRICS = Counter()


def increment_metric(name: str, value: int = 1) -> None:
    if not name:
        return
    with _METRICS_LOCK:
        _METRICS[name] += int(value)


def get_metrics_snapshot() -> dict[str, int]:
    with _METRICS_LOCK:
        return dict(_METRICS)


def reset_metrics() -> None:
    with _METRICS_LOCK:
        _METRICS.clear()


def _json_safe(value: Any):
    if value is None:
        return {}
    return json.loads(json.dumps(value, default=str, ensure_ascii=False))


def get_request_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    remote = (request.META.get("REMOTE_ADDR") or "").strip()
    return remote or None


def get_user_agent(request) -> str:
    if request is None:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:1000]


def audit_log(
    *,
    action: str,
    entity_type: str,
    entity_id: str | int = "",
    request=None,
    actor=None,
    before_data=None,
    after_data=None,
    metadata=None,
) -> AuditLog:
    if actor is None and request is not None:
        req_user = getattr(request, "user", None)
        if req_user is not None and req_user.is_authenticated:
            actor = req_user

    entry = AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ""),
        before_data=_json_safe(before_data),
        after_data=_json_safe(after_data),
        metadata=_json_safe(metadata),
        ip_address=get_request_ip(request),
        user_agent=get_user_agent(request),
    )

    increment_metric(f"audit.{action}.total")
    APP_LOGGER.info(
        "audit action=%s entity=%s entity_id=%s actor_id=%s",
        action,
        entity_type,
        entity_id,
        getattr(actor, "id", None),
    )
    return entry


def log_auth_event(
    *,
    event: str,
    success: bool,
    request=None,
    user=None,
    username: str = "",
    reason: str = "",
    status_code: int | None = None,
    audit_action: str | None = None,
) -> None:
    outcome = "success" if success else "failure"
    username_value = (username or getattr(user, "username", "") or "").strip() or "unknown"
    metric_base = f"auth.{event}.{outcome}"
    increment_metric(metric_base)

    log_message = (
        "auth event=%s outcome=%s username=%s user_id=%s status_code=%s reason=%s"
        % (
            event,
            outcome,
            username_value,
            getattr(user, "id", None),
            status_code if status_code is not None else "",
            reason or "",
        )
    )
    if success:
        AUTH_LOGGER.info(log_message)
    else:
        AUTH_LOGGER.warning(log_message)

    if audit_action in {AuditLog.ACTION_LOGIN, AuditLog.ACTION_LOGOUT}:
        audit_log(
            action=audit_action,
            entity_type="auth",
            entity_id=getattr(user, "id", ""),
            request=request,
            actor=user if getattr(user, "is_authenticated", False) else None,
            metadata={
                "event": event,
                "outcome": outcome,
                "username": username_value,
                "reason": reason or "",
                "status_code": status_code,
            },
        )
