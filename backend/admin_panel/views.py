import hashlib
import json
import re
from datetime import datetime, time, timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.models import AuditLog, BackupSnapshot
from admin_panel.serializers import (
    AdminUserSerializer,
    AdminUserWriteSerializer,
    AuditLogSerializer,
    BackupSnapshotSerializer,
    EnterpriseSerializer,
    EnterpriseWriteSerializer,
)
from auth_custom.models import UserProfile
from auth_custom.permissions import RolePermission
from config.api_errors import error_response
from config.observability import audit_log
from references.models import Enterprise

User = get_user_model()
ADMIN_ONLY = {UserProfile.ROLE_ADMIN}


def _parse_dt(value: str, *, end_of_day: bool = False):
    dt = parse_datetime(value)
    if dt is None:
        parsed_date = parse_date(value)
        if parsed_date is None:
            return None
        dt = datetime.combine(parsed_date, time.max if end_of_day else time.min)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _bool_from_query(value):
    if value is None:
        return None
    lowered = str(value).strip().lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False
    return None


def _safe_backup_file_name(name: str):
    cleaned = re.sub(r"[^0-9A-Za-z_.-]+", "_", str(name).strip())
    return cleaned.strip("._") or "backup"


def _build_backup_payload():
    users = []
    for user in User.objects.select_related("profile").order_by("id"):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        users.append(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "is_active": user.is_active,
                "role": profile.role,
                "is_2fa_enabled": profile.is_2fa_enabled,
            }
        )

    audits = list(
        AuditLog.objects.select_related("actor")
        .order_by("-created_at")
        .values(
            "id",
            "actor_id",
            "action",
            "entity_type",
            "entity_id",
            "before_data",
            "after_data",
            "metadata",
            "ip_address",
            "user_agent",
            "created_at",
        )
    )

    enterprises = []
    for enterprise in Enterprise.objects.order_by("id"):
        block_ids = list(enterprise.block_mappings.order_by("block_id").values_list("block_id", flat=True))
        enterprises.append(
            {
                "id": enterprise.id,
                "name": enterprise.name,
                "code": enterprise.code or "",
                "description": enterprise.description or "",
                "block_ids": block_ids,
            }
        )

    return {
        "created_at": timezone.now().isoformat(),
        "users": users,
        "audit_logs": audits,
        "enterprises": enterprises,
    }


def _log_audit(
    request,
    action: str,
    entity_type: str,
    entity_id="",
    *,
    before_data=None,
    after_data=None,
    metadata=None,
):
    audit_log(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        request=request,
        before_data=before_data,
        after_data=after_data,
        metadata=metadata,
    )


class UserListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    def get(self, request):
        queryset = User.objects.select_related("profile").order_by("id")

        search = (request.query_params.get("search") or request.query_params.get("q") or "").strip()
        if search:
            queryset = queryset.filter(Q(username__icontains=search) | Q(email__icontains=search))

        role = (request.query_params.get("role") or "").strip()
        if role:
            queryset = queryset.filter(profile__role=role)

        is_active = _bool_from_query(request.query_params.get("is_active"))
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active)

        return Response(AdminUserSerializer(queryset.order_by("id"), many=True).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        serializer = AdminUserWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = AdminUserSerializer(user).data
        _log_audit(
            request,
            action=AuditLog.ACTION_CREATE,
            entity_type="user",
            entity_id=user.id,
            after_data=payload,
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class UserDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    @staticmethod
    def _get_object(pk: int):
        user = User.objects.filter(id=pk).first()
        if not user:
            raise Http404
        return user

    def get(self, request, pk: int):
        user = self._get_object(pk)
        return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def put(self, request, pk: int):
        user = self._get_object(pk)
        before_payload = AdminUserSerializer(user).data
        serializer = AdminUserWriteSerializer(instance=user, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        after_payload = AdminUserSerializer(user).data
        _log_audit(
            request,
            action=AuditLog.ACTION_UPDATE,
            entity_type="user",
            entity_id=user.id,
            before_data=before_payload,
            after_data=after_payload,
        )
        return Response(after_payload, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request, pk: int):
        user = self._get_object(pk)
        before_payload = AdminUserSerializer(user).data
        serializer = AdminUserWriteSerializer(instance=user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        after_payload = AdminUserSerializer(user).data
        _log_audit(
            request,
            action=AuditLog.ACTION_UPDATE,
            entity_type="user",
            entity_id=user.id,
            before_data=before_payload,
            after_data=after_payload,
        )
        return Response(after_payload, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, pk: int):
        user = self._get_object(pk)
        if request.user.id == user.id:
            return error_response("You cannot delete yourself.", status_code=status.HTTP_400_BAD_REQUEST)

        before_payload = AdminUserSerializer(user).data
        deleted_id = user.id
        user.delete()
        _log_audit(
            request,
            action=AuditLog.ACTION_DELETE,
            entity_type="user",
            entity_id=deleted_id,
            before_data=before_payload,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditListCleanupAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    def get(self, request):
        queryset = AuditLog.objects.select_related("actor").all()
        queryset, errors = self._apply_filters(queryset, request.query_params)
        if errors:
            return error_response("; ".join(errors), status_code=status.HTTP_400_BAD_REQUEST)

        try:
            limit = max(1, min(500, int(request.query_params.get("limit", "100"))))
            offset = max(0, int(request.query_params.get("offset", "0")))
        except ValueError:
            return error_response("limit and offset must be integers", status_code=status.HTTP_400_BAD_REQUEST)

        count = queryset.count()
        logs = queryset.order_by("-created_at")[offset : offset + limit]
        return Response(
            {
                "count": count,
                "results": AuditLogSerializer(logs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    @transaction.atomic
    def delete(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        queryset = AuditLog.objects.all()

        action = str(payload.get("action", "")).strip()
        entity_type = str(payload.get("entity_type", "")).strip()
        before_raw = str(payload.get("before", "")).strip()
        older_than_days = payload.get("older_than_days")
        dry_run = bool(payload.get("dry_run", False))

        if action:
            queryset = queryset.filter(action=action)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)

        rule_used = False
        if older_than_days is not None:
            try:
                days = int(older_than_days)
            except (TypeError, ValueError):
                return error_response("older_than_days must be integer", status_code=status.HTTP_400_BAD_REQUEST)
            if days <= 0:
                return error_response("older_than_days must be > 0", status_code=status.HTTP_400_BAD_REQUEST)
            cutoff = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(created_at__lt=cutoff)
            rule_used = True

        if before_raw:
            before_dt = _parse_dt(before_raw, end_of_day=True)
            if before_dt is None:
                return error_response("Invalid before datetime/date", status_code=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(created_at__lt=before_dt)
            rule_used = True

        if not rule_used:
            return error_response(
                "Provide cleanup rule: older_than_days or before",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count = queryset.count()
        if not dry_run:
            queryset.delete()
            _log_audit(
                request,
                action=AuditLog.ACTION_DELETE,
                entity_type="audit_log",
                metadata={
                    "deleted_count": deleted_count,
                    "filters": {
                        "action": action,
                        "entity_type": entity_type,
                        "before": before_raw,
                        "older_than_days": older_than_days,
                    },
                },
            )

        return Response(
            {"deleted": deleted_count, "dry_run": dry_run},
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _apply_filters(queryset, params):
        errors = []

        action = (params.get("action") or "").strip()
        if action:
            queryset = queryset.filter(action=action)

        entity_type = (params.get("entity_type") or "").strip()
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)

        entity_id = (params.get("entity_id") or "").strip()
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)

        actor_id = params.get("actor_id")
        if actor_id not in (None, ""):
            try:
                queryset = queryset.filter(actor_id=int(actor_id))
            except ValueError:
                errors.append("actor_id must be integer")

        date_from = (params.get("date_from") or "").strip()
        if date_from:
            dt_from = _parse_dt(date_from)
            if dt_from is None:
                errors.append("Invalid date_from datetime/date")
            else:
                queryset = queryset.filter(created_at__gte=dt_from)

        date_to = (params.get("date_to") or "").strip()
        if date_to:
            dt_to = _parse_dt(date_to, end_of_day=True)
            if dt_to is None:
                errors.append("Invalid date_to datetime/date")
            else:
                queryset = queryset.filter(created_at__lte=dt_to)

        return queryset, errors


class BackupListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    def get(self, request):
        backups = BackupSnapshot.objects.select_related("created_by").order_by("-created_at")
        return Response(BackupSnapshotSerializer(backups, many=True).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        if not name:
            name = f"backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}"

        if BackupSnapshot.objects.filter(name=name).exists():
            return error_response("Backup with this name already exists.", status_code=status.HTTP_400_BAD_REQUEST)

        description = str(request.data.get("description", "")).strip()
        payload = _build_backup_payload()
        payload_bytes = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8")

        backup_dir = Path(settings.BASE_DIR) / "storage" / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        file_name = _safe_backup_file_name(name)
        storage_path = backup_dir / f"{file_name}.json"
        if storage_path.exists():
            suffix = timezone.now().strftime("%H%M%S")
            storage_path = backup_dir / f"{file_name}_{suffix}.json"

        storage_path.write_bytes(payload_bytes)
        checksum = hashlib.sha256(payload_bytes).hexdigest()

        backup = BackupSnapshot.objects.create(
            name=name,
            description=description,
            storage_path=str(storage_path),
            checksum=checksum,
            size_bytes=len(payload_bytes),
            metadata={
                "counts": {
                    "users": len(payload.get("users", [])),
                    "audit_logs": len(payload.get("audit_logs", [])),
                    "enterprises": len(payload.get("enterprises", [])),
                }
            },
            created_by=request.user,
            is_restorable=True,
        )

        _log_audit(
            request,
            action=AuditLog.ACTION_BACKUP,
            entity_type="backup_snapshot",
            entity_id=backup.id,
            after_data={"name": backup.name, "size_bytes": backup.size_bytes},
        )

        return Response(BackupSnapshotSerializer(backup).data, status=status.HTTP_201_CREATED)


class BackupDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    @staticmethod
    def _get_object(pk: int):
        backup = BackupSnapshot.objects.filter(id=pk).first()
        if not backup:
            raise Http404
        return backup

    def get(self, request, pk: int):
        backup = self._get_object(pk)
        return Response(BackupSnapshotSerializer(backup).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, pk: int):
        backup = self._get_object(pk)
        before_payload = BackupSnapshotSerializer(backup).data
        backup_id = backup.id
        path = Path(backup.storage_path)
        if path.exists():
            try:
                path.unlink()
            except OSError:
                return error_response(
                    "Cannot delete backup file because it is in use.",
                    status_code=status.HTTP_409_CONFLICT,
                )
        backup.delete()

        _log_audit(
            request,
            action=AuditLog.ACTION_DELETE,
            entity_type="backup_snapshot",
            entity_id=backup_id,
            before_data=before_payload,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class BackupDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    def get(self, request, pk: int):
        backup = BackupSnapshot.objects.filter(id=pk).first()
        if not backup:
            raise Http404
        file_path = Path(backup.storage_path)
        if not file_path.exists():
            return error_response("Backup file not found", status_code=status.HTTP_404_NOT_FOUND)

        _log_audit(
            request,
            action=AuditLog.ACTION_EXPORT,
            entity_type="backup_snapshot",
            entity_id=backup.id,
            metadata={"downloaded": True},
        )

        return FileResponse(
            open(file_path, "rb"),
            as_attachment=True,
            filename=f"{_safe_backup_file_name(backup.name)}.json",
            content_type="application/json",
        )


class EnterpriseListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    def get(self, request):
        queryset = Enterprise.objects.prefetch_related("block_mappings").order_by("id")
        search = (request.query_params.get("search") or request.query_params.get("q") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search) | Q(description__icontains=search)
            )
        serializer = EnterpriseSerializer(queryset.order_by("id"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        serializer = EnterpriseWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enterprise = serializer.save()
        payload = EnterpriseSerializer(enterprise).data
        _log_audit(
            request,
            action=AuditLog.ACTION_CREATE,
            entity_type="enterprise",
            entity_id=enterprise.id,
            after_data=payload,
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class EnterpriseDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    @staticmethod
    def _get_object(pk: int):
        enterprise = Enterprise.objects.filter(id=pk).first()
        if not enterprise:
            raise Http404
        return enterprise

    def get(self, request, pk: int):
        enterprise = self._get_object(pk)
        return Response(EnterpriseSerializer(enterprise).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def put(self, request, pk: int):
        enterprise = self._get_object(pk)
        before_payload = EnterpriseSerializer(enterprise).data
        serializer = EnterpriseWriteSerializer(instance=enterprise, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        enterprise = serializer.save()
        after_payload = EnterpriseSerializer(enterprise).data
        _log_audit(
            request,
            action=AuditLog.ACTION_UPDATE,
            entity_type="enterprise",
            entity_id=enterprise.id,
            before_data=before_payload,
            after_data=after_payload,
        )
        return Response(after_payload, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request, pk: int):
        enterprise = self._get_object(pk)
        before_payload = EnterpriseSerializer(enterprise).data
        serializer = EnterpriseWriteSerializer(instance=enterprise, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        enterprise = serializer.save()
        after_payload = EnterpriseSerializer(enterprise).data
        _log_audit(
            request,
            action=AuditLog.ACTION_UPDATE,
            entity_type="enterprise",
            entity_id=enterprise.id,
            before_data=before_payload,
            after_data=after_payload,
        )
        return Response(after_payload, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, pk: int):
        enterprise = self._get_object(pk)
        before_payload = EnterpriseSerializer(enterprise).data
        enterprise_id = enterprise.id
        enterprise.delete()
        _log_audit(
            request,
            action=AuditLog.ACTION_DELETE,
            entity_type="enterprise",
            entity_id=enterprise_id,
            before_data=before_payload,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
