import hashlib
import json
import re
from datetime import datetime, time, timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import Http404, HttpResponse
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
from references.models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
    Integrator,
    Vendor,
)
from technologies.models import (
    Technology,
    TechnologyBlock,
    TechnologyDirection,
    TechnologyEnterpriseReadiness,
    TechnologyFunctionCoverage,
    TechnologyProposal,
    TechnologyVendor,
    TechnologyVendorIntegrator,
)

User = get_user_model()
ADMIN_ONLY = {UserProfile.ROLE_ADMIN}
BACKUP_SCHEMA_VERSION = 2


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


def _values_list(queryset, *fields):
    return list(queryset.order_by("id").values(*fields))


def _build_backup_payload():
    users = []
    for user in User.objects.select_related("profile").order_by("id"):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        users.append(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "password": user.password,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "role": profile.role,
                "legacy_role": profile.legacy_role or "",
                "is_2fa_enabled": profile.is_2fa_enabled,
                "must_setup_2fa": profile.must_setup_2fa,
                "must_change_password": profile.must_change_password,
                "password_changed_at": profile.password_changed_at.isoformat()
                if profile.password_changed_at
                else "",
                "failed_login_attempts": profile.failed_login_attempts,
                "locked_at": profile.locked_at.isoformat() if profile.locked_at else "",
                "totp_secret": profile.totp_secret or "",
                "password_history": list(
                    user.password_history.order_by("-created_at").values(
                        "password_hash", "created_at"
                    )
                ),
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

    references = {
        "functional_blocks": _values_list(FunctionalBlock.objects, "id", "name"),
        "functions": _values_list(FunctionReference.objects, "id", "name", "block_id"),
        "digital_directions": _values_list(DigitalDirection.objects, "id", "name", "quadrant"),
        "vendors": _values_list(Vendor.objects, "id", "name"),
        "integrators": _values_list(Integrator.objects, "id", "name"),
        "enterprises": _values_list(
            Enterprise.objects, "id", "name", "code", "description"
        ),
        "enterprise_block_mappings": _values_list(
            EnterpriseBlockMapping.objects, "id", "enterprise_id", "block_id"
        ),
    }

    technologies = {
        "technologies": _values_list(
            Technology.objects,
            "id",
            "name",
            "description",
            "primary_block_id",
            "legacy_function",
            "trl_stage",
            "status",
            "market_examples",
            "documentation_files",
        ),
        "technology_blocks": _values_list(TechnologyBlock.objects, "id", "technology_id", "block_id"),
        "technology_function_coverage": _values_list(
            TechnologyFunctionCoverage.objects, "id", "technology_id", "function_id"
        ),
        "technology_directions": _values_list(
            TechnologyDirection.objects, "id", "technology_id", "direction_id"
        ),
        "technology_vendors": _values_list(
            TechnologyVendor.objects, "id", "technology_id", "vendor_id"
        ),
        "technology_vendor_integrators": _values_list(
            TechnologyVendorIntegrator.objects, "id", "technology_vendor_id", "integrator_id"
        ),
        "technology_enterprise_readiness": _values_list(
            TechnologyEnterpriseReadiness.objects,
            "id",
            "technology_id",
            "enterprise_id",
            "technological_readiness",
            "organizational_readiness",
            "status",
        ),
        "technology_proposals": _values_list(
            TechnologyProposal.objects,
            "id",
            "technology_id",
            "target_technology_id",
            "action",
            "status",
            "payload",
            "comment",
            "review_comment",
            "hidden_from_creator_history",
            "created_by_id",
            "reviewed_by_id",
            "reviewed_at",
        ),
    }

    return {
        "schema_version": BACKUP_SCHEMA_VERSION,
        "created_at": timezone.now().isoformat(),
        "users": users,
        "references": references,
        "technologies": technologies,
        "audit_logs": audits,
    }


def _load_backup_payload(backup) -> dict:
    file_path = Path(backup.storage_path)
    if not file_path.exists():
        raise Http404("Backup file not found")
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Backup payload must be an object")
    return payload


def _backup_counts(payload: dict) -> dict[str, int]:
    references = payload.get("references") or {}
    legacy_enterprises = payload.get("enterprises") or []
    technologies = payload.get("technologies") or {}
    return {
        "users": len(payload.get("users", []) or []),
        "functional_blocks": len(references.get("functional_blocks", []) or []),
        "functions": len(references.get("functions", []) or []),
        "digital_directions": len(references.get("digital_directions", []) or []),
        "vendors": len(references.get("vendors", []) or []),
        "integrators": len(references.get("integrators", []) or []),
        "enterprises": len((references.get("enterprises", []) or legacy_enterprises) or []),
        "enterprise_block_mappings": len(references.get("enterprise_block_mappings", []) or []),
        "technologies": len(technologies.get("technologies", []) or []),
        "technology_blocks": len(technologies.get("technology_blocks", []) or []),
        "technology_function_coverage": len(
            technologies.get("technology_function_coverage", []) or []
        ),
        "technology_directions": len(technologies.get("technology_directions", []) or []),
        "technology_vendors": len(technologies.get("technology_vendors", []) or []),
        "technology_vendor_integrators": len(
            technologies.get("technology_vendor_integrators", []) or []
        ),
        "technology_enterprise_readiness": len(
            technologies.get("technology_enterprise_readiness", []) or []
        ),
        "technology_proposals": len(technologies.get("technology_proposals", []) or []),
        "audit_logs": len(payload.get("audit_logs", []) or []),
    }


def _restore_backup_payload(payload: dict) -> dict[str, int]:
    restored_users = 0
    restored_references = 0
    restored_technologies = 0
    restored_audits = 0
    user_id_map: dict[int, int] = {}
    references_payload = payload.get("references") or {}
    if not references_payload and payload.get("enterprises"):
        legacy_mappings = []
        mapping_id = 1
        for row in payload.get("enterprises") or []:
            enterprise_id = row.get("id")
            if enterprise_id in (None, ""):
                continue
            for block_id in row.get("block_ids", []) or []:
                legacy_mappings.append(
                    {
                        "id": mapping_id,
                        "enterprise_id": enterprise_id,
                        "block_id": block_id,
                    }
                )
                mapping_id += 1
        references_payload = {
            "enterprises": payload.get("enterprises") or [],
            "enterprise_block_mappings": legacy_mappings,
        }
    technologies_payload = payload.get("technologies") or {}

    for raw_user in payload.get("users", []) or []:
        username = str(raw_user.get("username", "")).strip()
        if not username:
            continue

        user = None
        source_user_id = raw_user.get("id")
        if source_user_id:
            user = User.objects.filter(id=source_user_id).first()
        if user is None:
            user = User.objects.filter(username=username).first()
        if user is None:
            user = User(id=source_user_id or None, username=username)
            user.set_unusable_password()

        user.email = str(raw_user.get("email", "") or "").strip()
        password_hash = str(raw_user.get("password", "") or "").strip()
        if password_hash:
            user.password = password_hash
        user.is_active = bool(raw_user.get("is_active", True))
        user.is_staff = bool(raw_user.get("is_staff", False))
        user.is_superuser = bool(raw_user.get("is_superuser", False))
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = str(raw_user.get("role") or UserProfile.ROLE_GUEST).strip() or UserProfile.ROLE_GUEST
        profile.legacy_role = str(raw_user.get("legacy_role") or "").strip()
        profile.is_2fa_enabled = bool(raw_user.get("is_2fa_enabled", False))
        profile.must_setup_2fa = bool(raw_user.get("must_setup_2fa", False))
        profile.must_change_password = bool(raw_user.get("must_change_password", False))
        profile.password_changed_at = _parse_dt(
            str(raw_user.get("password_changed_at") or "")
        ) or timezone.now()
        profile.failed_login_attempts = int(raw_user.get("failed_login_attempts", 0) or 0)
        profile.locked_at = _parse_dt(str(raw_user.get("locked_at") or ""))
        profile.totp_secret = str(raw_user.get("totp_secret") or "").strip()
        if not profile.is_2fa_enabled:
            profile.totp_secret = ""
        profile.save(
            update_fields=[
                "role",
                "legacy_role",
                "is_2fa_enabled",
                "must_setup_2fa",
                "must_change_password",
                "password_changed_at",
                "failed_login_attempts",
                "locked_at",
                "totp_secret",
                "updated_at",
            ]
        )
        user.password_history.all().delete()
        for history_row in raw_user.get("password_history", []) or []:
            user.password_history.create(
                password_hash=str(history_row.get("password_hash") or ""),
            )

        if source_user_id:
            user_id_map[int(source_user_id)] = user.id
        restored_users += 1

    TechnologyProposal.objects.all().delete()
    Technology.objects.all().delete()
    EnterpriseBlockMapping.objects.all().delete()
    FunctionReference.objects.all().delete()
    DigitalDirection.objects.all().delete()
    Vendor.objects.all().delete()
    Integrator.objects.all().delete()
    Enterprise.objects.all().delete()
    FunctionalBlock.objects.all().delete()

    for row in references_payload.get("functional_blocks", []) or []:
        FunctionalBlock.objects.create(id=row["id"], name=str(row.get("name") or "").strip())
        restored_references += 1

    for row in references_payload.get("functions", []) or []:
        FunctionReference.objects.create(
            id=row["id"],
            name=str(row.get("name") or "").strip(),
            block_id=row.get("block_id"),
        )
        restored_references += 1

    for row in references_payload.get("digital_directions", []) or []:
        DigitalDirection.objects.create(
            id=row["id"],
            name=str(row.get("name") or "").strip(),
            quadrant=row.get("quadrant"),
        )
        restored_references += 1

    for row in references_payload.get("vendors", []) or []:
        Vendor.objects.create(id=row["id"], name=str(row.get("name") or "").strip())
        restored_references += 1

    for row in references_payload.get("integrators", []) or []:
        Integrator.objects.create(id=row["id"], name=str(row.get("name") or "").strip())
        restored_references += 1

    for row in references_payload.get("enterprises", []) or []:
        Enterprise.objects.create(
            id=row["id"],
            name=str(row.get("name") or "").strip(),
            code=str(row.get("code") or "").strip() or None,
            description=str(row.get("description") or "").strip(),
        )
        restored_references += 1

    for row in references_payload.get("enterprise_block_mappings", []) or []:
        EnterpriseBlockMapping.objects.create(
            id=row["id"],
            enterprise_id=row["enterprise_id"],
            block_id=row["block_id"],
        )
        restored_references += 1

    for row in technologies_payload.get("technologies", []) or []:
        Technology.objects.create(
            id=row["id"],
            name=str(row.get("name") or "").strip(),
            description=str(row.get("description") or ""),
            primary_block_id=row.get("primary_block_id"),
            legacy_function=str(row.get("legacy_function") or ""),
            trl_stage=row.get("trl_stage") or 1,
            status=str(row.get("status") or "planned"),
            market_examples=row.get("market_examples") or [],
            documentation_files=row.get("documentation_files") or [],
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_blocks", []) or []:
        TechnologyBlock.objects.create(
            id=row["id"], technology_id=row["technology_id"], block_id=row["block_id"]
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_function_coverage", []) or []:
        TechnologyFunctionCoverage.objects.create(
            id=row["id"],
            technology_id=row["technology_id"],
            function_id=row["function_id"],
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_directions", []) or []:
        TechnologyDirection.objects.create(
            id=row["id"],
            technology_id=row["technology_id"],
            direction_id=row["direction_id"],
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_vendors", []) or []:
        TechnologyVendor.objects.create(
            id=row["id"],
            technology_id=row["technology_id"],
            vendor_id=row["vendor_id"],
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_vendor_integrators", []) or []:
        TechnologyVendorIntegrator.objects.create(
            id=row["id"],
            technology_vendor_id=row["technology_vendor_id"],
            integrator_id=row["integrator_id"],
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_enterprise_readiness", []) or []:
        TechnologyEnterpriseReadiness.objects.create(
            id=row["id"],
            technology_id=row["technology_id"],
            enterprise_id=row["enterprise_id"],
            technological_readiness=row.get("technological_readiness"),
            organizational_readiness=row.get("organizational_readiness"),
            status=str(row.get("status") or "planned"),
        )
        restored_technologies += 1

    for row in technologies_payload.get("technology_proposals", []) or []:
        created_by_id = row.get("created_by_id")
        reviewed_by_id = row.get("reviewed_by_id")
        TechnologyProposal.objects.create(
            id=row["id"],
            technology_id=row.get("technology_id"),
            target_technology_id=row.get("target_technology_id"),
            action=str(row.get("action") or TechnologyProposal.ACTION_UPDATE),
            status=str(row.get("status") or TechnologyProposal.STATUS_DRAFT),
            payload=row.get("payload") or {},
            comment=str(row.get("comment") or ""),
            review_comment=str(row.get("review_comment") or ""),
            hidden_from_creator_history=bool(row.get("hidden_from_creator_history", False)),
            created_by_id=user_id_map.get(int(created_by_id), int(created_by_id))
            if created_by_id not in (None, "")
            else None,
            reviewed_by_id=user_id_map.get(int(reviewed_by_id), int(reviewed_by_id))
            if reviewed_by_id not in (None, "")
            else None,
            reviewed_at=_parse_dt(str(row.get("reviewed_at")), end_of_day=False)
            if row.get("reviewed_at")
            else None,
        )
        restored_technologies += 1

    for raw_audit in payload.get("audit_logs", []) or []:
        source_audit_id = raw_audit.get("id")
        if source_audit_id and AuditLog.objects.filter(id=source_audit_id).exists():
            continue

        actor = None
        actor_id = raw_audit.get("actor_id")
        if actor_id not in (None, ""):
            actor = User.objects.filter(id=user_id_map.get(int(actor_id), int(actor_id))).first()

        audit = AuditLog(
            id=source_audit_id or None,
            actor=actor,
            action=str(raw_audit.get("action") or AuditLog.ACTION_UPDATE).strip(),
            entity_type=str(raw_audit.get("entity_type") or "backup_restore").strip(),
            entity_id=str(raw_audit.get("entity_id") or "").strip(),
            before_data=raw_audit.get("before_data") or {},
            after_data=raw_audit.get("after_data") or {},
            metadata=raw_audit.get("metadata") or {},
            ip_address=raw_audit.get("ip_address") or None,
            user_agent=str(raw_audit.get("user_agent") or ""),
        )
        audit.save(force_insert=True)

        created_at = raw_audit.get("created_at")
        parsed_created_at = _parse_dt(str(created_at), end_of_day=False) if created_at else None
        if parsed_created_at is not None:
            AuditLog.objects.filter(id=audit.id).update(created_at=parsed_created_at)

        restored_audits += 1

    return {
        "users": restored_users,
        "references": restored_references,
        "technologies": restored_technologies,
        "audit_logs": restored_audits,
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
            role_key = role.lower()
            mapped_role = UserProfile.LEGACY_TO_V2.get(role_key, role_key)
            queryset = queryset.filter(profile__role=mapped_role)

        is_active = _bool_from_query(request.query_params.get("is_active"))
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active)

        return Response(
            AdminUserSerializer(queryset.order_by("id"), many=True).data, status=status.HTTP_200_OK
        )

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
            return error_response(
                "You cannot delete yourself.", status_code=status.HTTP_400_BAD_REQUEST
            )

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
            return error_response(
                "limit and offset must be integers", status_code=status.HTTP_400_BAD_REQUEST
            )

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
                return error_response(
                    "older_than_days must be integer", status_code=status.HTTP_400_BAD_REQUEST
                )
            if days <= 0:
                return error_response(
                    "older_than_days must be > 0", status_code=status.HTTP_400_BAD_REQUEST
                )
            cutoff = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(created_at__lt=cutoff)
            rule_used = True

        if before_raw:
            before_dt = _parse_dt(before_raw, end_of_day=True)
            if before_dt is None:
                return error_response(
                    "Invalid before datetime/date", status_code=status.HTTP_400_BAD_REQUEST
                )
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
        return Response(
            BackupSnapshotSerializer(backups, many=True).data, status=status.HTTP_200_OK
        )

    @transaction.atomic
    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        if not name:
            name = f"backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}"

        if BackupSnapshot.objects.filter(name=name).exists():
            return error_response(
                "Backup with this name already exists.", status_code=status.HTTP_400_BAD_REQUEST
            )

        description = str(request.data.get("description", "")).strip()
        payload = _build_backup_payload()
        payload_bytes = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode(
            "utf-8"
        )

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
            metadata={"schema_version": payload.get("schema_version"), "counts": _backup_counts(payload)},
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

        response = HttpResponse(file_path.read_bytes(), content_type="application/json")
        response["Content-Disposition"] = (
            f'attachment; filename="{_safe_backup_file_name(backup.name)}.json"'
        )
        return response


class BackupRestoreAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = ADMIN_ONLY
    write_roles = ADMIN_ONLY

    @transaction.atomic
    def post(self, request, pk: int):
        backup = BackupSnapshot.objects.filter(id=pk).first()
        if not backup:
            raise Http404
        if not backup.is_restorable:
            return error_response(
                "Backup is marked as non-restorable.",
                status_code=status.HTTP_409_CONFLICT,
            )

        payload = _load_backup_payload(backup)
        counts = _backup_counts(payload)
        dry_run = bool(request.data.get("dry_run", False))
        if dry_run:
            return Response({"dry_run": True, "counts": counts}, status=status.HTTP_200_OK)

        restored = _restore_backup_payload(payload)
        _log_audit(
            request,
            action=AuditLog.ACTION_RESTORE,
            entity_type="backup_snapshot",
            entity_id=backup.id,
            metadata={"restored_counts": restored, "source_backup": backup.name},
        )
        return Response(
            {
                "ok": True,
                "backup_id": backup.id,
                "backup_name": backup.name,
                "restored_counts": restored,
            },
            status=status.HTTP_200_OK,
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
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(description__icontains=search)
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
        serializer = EnterpriseWriteSerializer(
            instance=enterprise, data=request.data, partial=False
        )
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
