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
from references.models import Enterprise, EnterpriseBlockMapping, FunctionalBlock
from technologies.models import Technology, TechnologyProposal, ProposalNotification
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


def _create_editor_notification(proposal: TechnologyProposal, decision_type: str, reviewer_user) -> ProposalNotification:
    """
    Создает уведомление для редактора о результате модерации его предложения
    
    Args:
        proposal: объект TechnologyProposal
        decision_type: 'approved', 'rejected', 'postponed'
        reviewer_user: User объект того, кто модерировал
    """
    # Получаем информацию о технологии
    tech_name = None
    if isinstance(proposal.payload, dict):
        tech_name = proposal.payload.get("name", "Без названия")
    
    if not tech_name and proposal.technology:
        tech_name = proposal.technology.name
    
    if not tech_name:
        tech_name = f"Предложение #{proposal.id}"
    
    # Определяем текст решения
    decision_text_map = {
        'approved': 'одобрено',
        'rejected': 'отклонено',
        'postponed': 'отложено',
    }
    decision_text = decision_text_map.get(decision_type, decision_type)
    
    # Определяем тип действия
    action_text_map = {
        TechnologyProposal.ACTION_CREATE: 'создание',
        TechnologyProposal.ACTION_UPDATE: 'обновление',
        TechnologyProposal.ACTION_DELETE: 'удаление',
    }
    action_text = action_text_map.get(proposal.action, proposal.action)
    
    # Создаем заголовок и сообщение
    title = f"Предложение {decision_text}"
    message = (
        f"Ваше предложение на {action_text} '{tech_name}' было {decision_text} "
        f"администратором {reviewer_user.get_full_name() or reviewer_user.username}. "
    )
    
    if proposal.review_comment:
        message += f"Комментарий: {proposal.review_comment}"
    
    # Создаем или обновляем уведомление
    notification, created = ProposalNotification.objects.get_or_create(
        proposal=proposal,
        recipient=proposal.created_by,
        notification_type=decision_type,
        defaults={
            'title': title,
            'message': message,
            'is_read': False,
        }
    )
    
    # Если уведомление уже существовало, обновляем его
    if not created:
        notification.title = title
        notification.message = message
        notification.is_read = False
        notification.save(update_fields=['title', 'message', 'is_read', 'created_at'])
    
    return notification


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


def _is_functional_block_proposal(proposal: TechnologyProposal) -> bool:
    payload = proposal.payload if isinstance(proposal.payload, dict) else {}
    return str(payload.get("referenceType", "")).strip().lower() == "functional_block"


def _apply_functional_block_proposal(proposal: TechnologyProposal, request) -> dict:
    payload = proposal.payload if isinstance(proposal.payload, dict) else {}
    block_name = str(payload.get("blockName", "")).strip()
    operation = str(payload.get("operation", "")).strip().lower()
    if not block_name and operation != "map_existing":
        raise ValueError("Block proposal must include blockName.")

    enterprise_ids = []
    for value in payload.get("enterpriseIds", []) or []:
        try:
            enterprise_id = int(value)
        except (TypeError, ValueError):
            continue
        if enterprise_id > 0:
            enterprise_ids.append(enterprise_id)
    enterprise_ids = sorted(set(enterprise_ids))
    known_enterprises = set(Enterprise.objects.filter(id__in=enterprise_ids).values_list("id", flat=True))
    missing_enterprises = sorted(set(enterprise_ids) - known_enterprises)
    if missing_enterprises:
        raise ValueError(f"Unknown enterprise ids: {missing_enterprises}")

    applied_blocks = []
    created_mappings = []

    existing_block_names = [
        str(item).strip() for item in (payload.get("existingBlocks") or []) if str(item).strip()
    ]
    if operation == "map_existing" and not existing_block_names:
        raise ValueError("Block mapping proposal must include existingBlocks.")

    target_blocks = []
    if operation == "map_existing":
        for block_name_item in existing_block_names:
            block = FunctionalBlock.objects.filter(name=block_name_item).first()
            if block is None:
                raise ValueError(f'Functional block "{block_name_item}" not found.')
            target_blocks.append(block)
    else:
        block, created = FunctionalBlock.objects.get_or_create(name=block_name)
        target_blocks.append(block)
        applied_blocks.append(
            {
                "id": block.id,
                "name": block.name,
                "created": created,
            }
        )

    for block in target_blocks:
        if not any(row["id"] == block.id for row in applied_blocks):
            applied_blocks.append({"id": block.id, "name": block.name, "created": False})
        for enterprise_id in enterprise_ids:
            _, created = EnterpriseBlockMapping.objects.get_or_create(
                enterprise_id=enterprise_id,
                block=block,
            )
            if created:
                created_mappings.append({"enterpriseId": enterprise_id, "blockId": block.id})

    audit_log(
        action=AuditLog.ACTION_UPDATE if operation == "map_existing" else AuditLog.ACTION_CREATE,
        entity_type="functional_block_proposal_apply",
        entity_id=proposal.id,
        request=request,
        after_data={
            "blocks": applied_blocks,
            "enterpriseIds": enterprise_ids,
            "createdMappings": created_mappings,
            "operation": operation or "create_block",
        },
        metadata={"source": "proposal_approve", "proposal_id": proposal.id},
    )
    return {
        "blocks": applied_blocks,
        "enterpriseIds": enterprise_ids,
        "createdMappings": created_mappings,
        "operation": operation or "create_block",
    }


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
        ).filter(created_by=request.user, hidden_from_creator_history=False)
        status_filter = str(request.query_params.get("status", "")).strip().lower()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        serializer = TechnologyProposalSerializer(queryset.order_by("-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TechnologyProposalMineHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_CREATE_ROLES
    write_roles = PROPOSAL_CREATE_ROLES

    def get(self, request):
        queryset = TechnologyProposal.objects.select_related(
            "technology",
            "created_by",
            "reviewed_by",
        ).filter(created_by=request.user, hidden_from_creator_history=False).filter(
            status__in=[
                TechnologyProposal.STATUS_APPROVED,
                TechnologyProposal.STATUS_REJECTED,
                TechnologyProposal.STATUS_POSTPONED,
            ]
        )
        serializer = TechnologyProposalSerializer(queryset.order_by("-updated_at", "-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request):
        queryset = TechnologyProposal.objects.filter(
            created_by=request.user,
            hidden_from_creator_history=False,
        ).filter(
            status__in=[
                TechnologyProposal.STATUS_APPROVED,
                TechnologyProposal.STATUS_REJECTED,
                TechnologyProposal.STATUS_POSTPONED,
            ]
        )
        raw_ids = request.data.get("ids") if isinstance(request.data, dict) else None
        if isinstance(raw_ids, list) and raw_ids:
            normalized_ids = []
            for value in raw_ids:
                try:
                    normalized_id = int(value)
                except (TypeError, ValueError):
                    continue
                if normalized_id > 0:
                    normalized_ids.append(normalized_id)
            queryset = queryset.filter(id__in=normalized_ids)
        proposal_ids = list(queryset.values_list("id", flat=True))
        deleted_count = len(proposal_ids)
        if deleted_count:
            queryset.update(hidden_from_creator_history=True)
            audit_log(
                action=AuditLog.ACTION_UPDATE,
                entity_type="technology_proposal_history",
                request=request,
                metadata={
                    "deleted_count": deleted_count,
                    "proposal_ids": proposal_ids,
                    "hidden_from_creator_history": True,
                },
            )
        return Response({"deleted_count": deleted_count}, status=status.HTTP_200_OK)


class TechnologyProposalPendingAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    def get(self, request):
        queryset = TechnologyProposal.objects.select_related(
            "technology",
            "created_by",
            "reviewed_by",
        ).filter(status__in=[TechnologyProposal.STATUS_DRAFT, TechnologyProposal.STATUS_POSTPONED])
        serializer = TechnologyProposalSerializer(queryset.order_by("-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TechnologyProposalReviewHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    def get(self, request):
        queryset = TechnologyProposal.objects.select_related(
            "technology",
            "created_by",
            "reviewed_by",
        ).filter(
            status__in=[
                TechnologyProposal.STATUS_APPROVED,
                TechnologyProposal.STATUS_REJECTED,
                TechnologyProposal.STATUS_POSTPONED,
            ]
        )
        serializer = TechnologyProposalSerializer(queryset.order_by("-updated_at", "-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TechnologyProposalApproveAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    @transaction.atomic
    def post(self, request, pk: int):
        proposal = _get_proposal_or_404(pk)
        if proposal.status not in {
            TechnologyProposal.STATUS_DRAFT,
            TechnologyProposal.STATUS_POSTPONED,
        }:
            return error_response(
                "Only active proposals can be approved.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        review_serializer = TechnologyProposalReviewSerializer(data=request.data)
        review_serializer.is_valid(raise_exception=True)
        review_comment = review_serializer.validated_data.get("review_comment", "")
        previous_status = proposal.status

        applied_technology_id = proposal.target_technology_id or proposal.technology_id
        tech_before = None
        tech_after = None

        if proposal.action == TechnologyProposal.ACTION_CREATE and _is_functional_block_proposal(proposal):
            try:
                block_result = _apply_functional_block_proposal(proposal, request)
            except ValueError as exc:
                return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
            applied_technology_id = None
            tech_after = block_result
        elif proposal.action == TechnologyProposal.ACTION_CREATE:
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
        
        # Отправляем уведомление редактору
        _create_editor_notification(proposal, 'approved', request.user)
        
        payload = TechnologyProposalSerializer(proposal).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology_proposal",
            entity_id=proposal.id,
            request=request,
            before_data={"status": proposal.status},
            after_data=payload,
            metadata={
                "decision": "approve",
                "applied_technology_id": applied_technology_id,
                "reference_type": (
                    proposal.payload.get("referenceType")
                    if isinstance(proposal.payload, dict)
                    else None
                ),
            },
        )
        return Response(payload, status=status.HTTP_200_OK)


class TechnologyProposalRejectAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    @transaction.atomic
    def post(self, request, pk: int):
        proposal = _get_proposal_or_404(pk)
        if proposal.status not in {
            TechnologyProposal.STATUS_DRAFT,
            TechnologyProposal.STATUS_POSTPONED,
        }:
            return error_response(
                "Only active proposals can be rejected.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        review_serializer = TechnologyProposalReviewSerializer(data=request.data)
        review_serializer.is_valid(raise_exception=True)
        review_comment = review_serializer.validated_data.get("review_comment", "")

        previous_status = proposal.status
        proposal.status = TechnologyProposal.STATUS_REJECTED
        proposal.review_comment = review_comment
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.save(
            update_fields=["status", "review_comment", "reviewed_by", "reviewed_at", "updated_at"]
        )

        # Отправляем уведомление редактору
        _create_editor_notification(proposal, 'rejected', request.user)

        payload = TechnologyProposalSerializer(proposal).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology_proposal",
            entity_id=proposal.id,
            request=request,
            before_data={"status": previous_status},
            after_data=payload,
            metadata={"decision": "reject"},
        )
        return Response(payload, status=status.HTTP_200_OK)


class TechnologyProposalPostponeAPIView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_REVIEW_ROLES
    write_roles = PROPOSAL_REVIEW_ROLES

    @transaction.atomic
    def post(self, request, pk: int):
        proposal = _get_proposal_or_404(pk)
        if proposal.status not in {
            TechnologyProposal.STATUS_DRAFT,
            TechnologyProposal.STATUS_POSTPONED,
        }:
            return error_response(
                "Only active proposals can be postponed.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        review_serializer = TechnologyProposalReviewSerializer(data=request.data)
        review_serializer.is_valid(raise_exception=True)
        review_comment = review_serializer.validated_data.get("review_comment", "")
        previous_status = proposal.status

        proposal.status = TechnologyProposal.STATUS_POSTPONED
        proposal.review_comment = review_comment
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.save(
            update_fields=["status", "review_comment", "reviewed_by", "reviewed_at", "updated_at"]
        )

        # Отправляем уведомление редактору
        _create_editor_notification(proposal, 'postponed', request.user)

        payload = TechnologyProposalSerializer(proposal).data
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="technology_proposal",
            entity_id=proposal.id,
            request=request,
            before_data={"status": previous_status},
            after_data=payload,
            metadata={"decision": "postpone"},
        )
        return Response(payload, status=status.HTTP_200_OK)


class EditorProposalNotificationsAPIView(APIView):
    """API view для получения уведомлений редактору о результатах модерации"""
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = PROPOSAL_CREATE_ROLES
    write_roles = PROPOSAL_CREATE_ROLES

    def get(self, request):
        """Получить все уведомления для текущего пользователя (редактора)"""
        notifications = ProposalNotification.objects.filter(
            recipient=request.user
        ).select_related('proposal', 'proposal__created_by', 'proposal__reviewed_by')
        
        # Сортируем по дате создания (новые первыми)
        notifications = notifications.order_by('-created_at')
        
        # Можно добавить фильтр по статусу (read/unread)
        is_read = request.query_params.get('is_read')
        if is_read is not None:
            is_read_bool = is_read.lower() in ('true', '1', 'yes')
            notifications = notifications.filter(is_read=is_read_bool)
        
        from technologies.serializers import ProposalNotificationSerializer
        serializer = ProposalNotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request):
        """Отметить уведомление как прочитанное"""
        notification_id = request.data.get('notification_id')
        mark_as_read = request.data.get('mark_as_read', True)
        
        if not notification_id:
            return error_response(
                'notification_id is required',
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            notification = ProposalNotification.objects.get(
                id=notification_id,
                recipient=request.user
            )
        except ProposalNotification.DoesNotExist:
            return error_response(
                'Notification not found',
                status_code=status.HTTP_404_NOT_FOUND,
            )
        
        if mark_as_read and not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])
        
        from technologies.serializers import ProposalNotificationSerializer
        serializer = ProposalNotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)
