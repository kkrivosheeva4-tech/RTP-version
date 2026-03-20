from django.db import IntegrityError, OperationalError, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.models import AuditLog
from auth_custom.models import UserProfile
from auth_custom.permissions import READ_ROLES, TECH_WRITE_ROLES, RolePermission
from config.api_errors import error_response
from config.observability import audit_log
from technologies.models import Technology, TechnologyProposal
from technologies.serializers import (
    TechnologyProposalCreateSerializer,
    TechnologyProposalReviewSerializer,
    TechnologyProposalSerializer,
    TechnologySerializer,
)

PROPOSAL_CREATE_ROLES = {
    UserProfile.ROLE_ADMIN,
    UserProfile.ROLE_OWNER,
    UserProfile.ROLE_EDITOR,
}
PROPOSAL_REVIEW_ROLES = {
    UserProfile.ROLE_ADMIN,
    UserProfile.ROLE_OWNER,
}


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
    write_roles = TECH_WRITE_ROLES

    def get(self, request):
        queryset = Technology.objects.all().order_by("id")
        enterprise_id = request.query_params.get("enterpriseId")
        if enterprise_id:
            try:
                enterprise_id = int(enterprise_id)
            except (TypeError, ValueError):
                return error_response(
                    "enterpriseId must be integer", status_code=status.HTTP_400_BAD_REQUEST
                )
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
    write_roles = TECH_WRITE_ROLES

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
    write_roles = TECH_WRITE_ROLES

    @transaction.atomic
    def put(self, request):
        payload = request.data
        if not isinstance(payload, list):
            return error_response(
                "Request body must be an array", status_code=status.HTTP_400_BAD_REQUEST
            )

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


def _proposal_not_found() -> Http404:
    raise Http404


def _get_proposal_or_404(pk: int) -> TechnologyProposal:
    proposal = (
        TechnologyProposal.objects.select_related(
            "technology",
            "created_by",
            "reviewed_by",
        )
        .filter(id=pk)
        .first()
    )
    if proposal is None:
        _proposal_not_found()
    return proposal


class TechnologyProposalCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_CREATE_ROLES
    write_roles = PROPOSAL_CREATE_ROLES

    @transaction.atomic
    def post(self, request):
        serializer = TechnologyProposalCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        proposal = serializer.save()
        payload = TechnologyProposalSerializer(proposal).data
        audit_log(
            action=AuditLog.ACTION_CREATE,
            entity_type="technology_proposal",
            entity_id=proposal.id,
            request=request,
            after_data=payload,
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class TechnologyProposalMineAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_CREATE_ROLES
    write_roles = PROPOSAL_CREATE_ROLES

    def get(self, request):
        queryset = TechnologyProposal.objects.select_related(
            "technology",
            "created_by",
            "reviewed_by",
        ).filter(created_by=request.user)
        status_filter = str(request.query_params.get("status", "")).strip().lower()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        serializer = TechnologyProposalSerializer(queryset.order_by("-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TechnologyProposalPendingAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    def get(self, request):
        queryset = TechnologyProposal.objects.select_related(
            "technology",
            "created_by",
            "reviewed_by",
        ).filter(status=TechnologyProposal.STATUS_DRAFT)
        serializer = TechnologyProposalSerializer(queryset.order_by("-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TechnologyProposalApproveAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    @transaction.atomic
    def post(self, request, pk: int):
        proposal = _get_proposal_or_404(pk)
        if proposal.status != TechnologyProposal.STATUS_DRAFT:
            return error_response(
                "Only draft proposals can be approved.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        review_serializer = TechnologyProposalReviewSerializer(data=request.data)
        review_serializer.is_valid(raise_exception=True)
        review_comment = review_serializer.validated_data.get("review_comment", "")

        applied_technology_id = proposal.target_technology_id or proposal.technology_id
        tech_before = None
        tech_after = None

        if proposal.action == TechnologyProposal.ACTION_CREATE:
            tech_serializer = TechnologySerializer(data=proposal.payload)
            tech_serializer.is_valid(raise_exception=True)
            technology = tech_serializer.save()
            proposal.technology = technology
            proposal.target_technology_id = technology.id
            applied_technology_id = technology.id
            tech_after = TechnologySerializer(technology).data
            audit_log(
                action=AuditLog.ACTION_CREATE,
                entity_type="technology",
                entity_id=technology.id,
                request=request,
                after_data=tech_after,
                metadata={"source": "proposal_approve", "proposal_id": proposal.id},
            )

        elif proposal.action == TechnologyProposal.ACTION_UPDATE:
            technology = proposal.technology
            if technology is None:
                return error_response(
                    "Target technology for update proposal not found.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            tech_before = TechnologySerializer(technology).data
            tech_serializer = TechnologySerializer(technology, data=proposal.payload, partial=True)
            tech_serializer.is_valid(raise_exception=True)
            technology = tech_serializer.save()
            tech_after = TechnologySerializer(technology).data
            audit_log(
                action=AuditLog.ACTION_UPDATE,
                entity_type="technology",
                entity_id=technology.id,
                request=request,
                before_data=tech_before,
                after_data=tech_after,
                metadata={"source": "proposal_approve", "proposal_id": proposal.id},
            )

        elif proposal.action == TechnologyProposal.ACTION_DELETE:
            technology = proposal.technology
            if technology is None:
                return error_response(
                    "Target technology for delete proposal not found.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            tech_before = TechnologySerializer(technology).data
            deleted_id = technology.id
            technology.delete()
            proposal.technology = None
            proposal.target_technology_id = deleted_id
            applied_technology_id = deleted_id
            audit_log(
                action=AuditLog.ACTION_DELETE,
                entity_type="technology",
                entity_id=deleted_id,
                request=request,
                before_data=tech_before,
                metadata={"source": "proposal_approve", "proposal_id": proposal.id},
            )

        else:
            return error_response(
                "Unsupported proposal action", status_code=status.HTTP_400_BAD_REQUEST
            )

        proposal.status = TechnologyProposal.STATUS_APPROVED
        proposal.review_comment = review_comment
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.save(
            update_fields=[
                "technology",
                "target_technology_id",
                "status",
                "review_comment",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )
        payload = TechnologyProposalSerializer(proposal).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology_proposal",
            entity_id=proposal.id,
            request=request,
            before_data={"status": TechnologyProposal.STATUS_DRAFT},
            after_data=payload,
            metadata={"decision": "approve", "applied_technology_id": applied_technology_id},
        )
        return Response(payload, status=status.HTTP_200_OK)


class TechnologyProposalRejectAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    @transaction.atomic
    def post(self, request, pk: int):
        proposal = _get_proposal_or_404(pk)
        if proposal.status != TechnologyProposal.STATUS_DRAFT:
            return error_response(
                "Only draft proposals can be rejected.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        review_serializer = TechnologyProposalReviewSerializer(data=request.data)
        review_serializer.is_valid(raise_exception=True)
        review_comment = review_serializer.validated_data.get("review_comment", "")

        proposal.status = TechnologyProposal.STATUS_REJECTED
        proposal.review_comment = review_comment
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.save(
            update_fields=["status", "review_comment", "reviewed_by", "reviewed_at", "updated_at"]
        )

        payload = TechnologyProposalSerializer(proposal).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology_proposal",
            entity_id=proposal.id,
            request=request,
            before_data={"status": TechnologyProposal.STATUS_DRAFT},
            after_data=payload,
            metadata={"decision": "reject"},
        )
        return Response(payload, status=status.HTTP_200_OK)
