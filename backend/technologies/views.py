from django.db import IntegrityError, OperationalError, transaction
from django.http import Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.models import AuditLog
from auth_custom.permissions import READ_ROLES, RolePermission, WRITE_ROLES
from config.api_errors import error_response
from config.observability import audit_log
from technologies.models import Technology
from technologies.serializers import TechnologySerializer


def _database_error_response(exc: Exception) -> Response:
    message = str(exc)
    lowered = message.lower()
    if "database is locked" in lowered:
        return error_response(
            "Database is locked. Retry the request in a moment.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if "unique constraint failed" in lowered and "technologies_technology.name" in lowered:
        return error_response(
            "Technology with this name already exists.",
            status_code=status.HTTP_409_CONFLICT,
        )
    return error_response(
        "Database write failed.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class TechnologyListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES

    def get(self, request):
        queryset = Technology.objects.all().order_by("id")
        enterprise_id = request.query_params.get("enterpriseId")
        if enterprise_id:
            try:
                enterprise_id = int(enterprise_id)
            except (TypeError, ValueError):
                return error_response("enterpriseId must be integer", status_code=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(enterprise_readiness__enterprise_id=enterprise_id).distinct()
        serializer = TechnologySerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TechnologySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            technology = serializer.save()
        except (IntegrityError, OperationalError) as exc:
            return _database_error_response(exc)
        payload = TechnologySerializer(technology).data
        audit_log(
            action=AuditLog.ACTION_CREATE,
            entity_type="technology",
            entity_id=technology.id,
            request=request,
            after_data=payload,
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class TechnologyDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES

    def get_object(self, pk: int) -> Technology:
        try:
            return Technology.objects.get(pk=pk)
        except Technology.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, pk: int):
        technology = self.get_object(pk)
        return Response(TechnologySerializer(technology).data)

    def put(self, request, pk: int):
        technology = self.get_object(pk)
        before_payload = TechnologySerializer(technology).data
        serializer = TechnologySerializer(technology, data=request.data)
        serializer.is_valid(raise_exception=True)
        technology = serializer.save()
        after_payload = TechnologySerializer(technology).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology",
            entity_id=technology.id,
            request=request,
            before_data=before_payload,
            after_data=after_payload,
        )
        return Response(after_payload)

    def patch(self, request, pk: int):
        technology = self.get_object(pk)
        before_payload = TechnologySerializer(technology).data
        serializer = TechnologySerializer(technology, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        technology = serializer.save()
        after_payload = TechnologySerializer(technology).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology",
            entity_id=technology.id,
            request=request,
            before_data=before_payload,
            after_data=after_payload,
        )
        return Response(after_payload)

    def delete(self, request, pk: int):
        technology = self.get_object(pk)
        before_payload = TechnologySerializer(technology).data
        deleted_id = technology.id
        technology.delete()
        audit_log(
            action=AuditLog.ACTION_DELETE,
            entity_type="technology",
            entity_id=deleted_id,
            request=request,
            before_data=before_payload,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TechnologyBulkAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES

    @transaction.atomic
    def put(self, request):
        payload = request.data
        if not isinstance(payload, list):
            return error_response("Request body must be an array", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            created_ids = []
            updated_ids = []
            for item in payload:
                if not isinstance(item, dict):
                    return error_response(
                        "Every item in array must be an object",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )

                mutable_item = dict(item)
                item_name = mutable_item.get("name")
                if isinstance(item_name, str):
                    mutable_item["name"] = item_name.strip()

                instance = None
                item_id = mutable_item.get("id")
                if item_id is not None:
                    instance = Technology.objects.filter(id=item_id).first()

                if instance is None and mutable_item.get("name"):
                    instance = Technology.objects.filter(name=mutable_item["name"]).first()

                if instance is not None:
                    serializer = TechnologySerializer(instance, data=mutable_item, partial=True)
                else:
                    mutable_item.pop("id", None)
                    serializer = TechnologySerializer(data=mutable_item)
                serializer.is_valid(raise_exception=True)
                saved = serializer.save()
                if instance is not None:
                    updated_ids.append(saved.id)
                else:
                    created_ids.append(saved.id)
        except (IntegrityError, OperationalError) as exc:
            return _database_error_response(exc)

        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology_bulk",
            request=request,
            metadata={
                "created_ids": created_ids,
                "updated_ids": updated_ids,
                "payload_count": len(payload),
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
