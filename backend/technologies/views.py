from django.db import transaction
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from auth_custom.permissions import READ_ROLES, RolePermission, WRITE_ROLES
from technologies.models import Technology
from technologies.serializers import TechnologySerializer


class TechnologyListCreateAPIView(APIView):
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES

    def get(self, request):
        queryset = Technology.objects.all().order_by("id")
        enterprise_id = request.query_params.get("enterpriseId")
        if enterprise_id:
            try:
                enterprise_id = int(enterprise_id)
            except (TypeError, ValueError):
                return Response({"error": "enterpriseId must be integer"}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(enterprise_readiness__enterprise_id=enterprise_id).distinct()
        serializer = TechnologySerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TechnologySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        technology = serializer.save()
        return Response(TechnologySerializer(technology).data, status=status.HTTP_201_CREATED)


class TechnologyDetailAPIView(APIView):
    permission_classes = [RolePermission]
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
        serializer = TechnologySerializer(technology, data=request.data)
        serializer.is_valid(raise_exception=True)
        technology = serializer.save()
        return Response(TechnologySerializer(technology).data)

    def patch(self, request, pk: int):
        technology = self.get_object(pk)
        serializer = TechnologySerializer(technology, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        technology = serializer.save()
        return Response(TechnologySerializer(technology).data)

    def delete(self, request, pk: int):
        technology = self.get_object(pk)
        technology.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TechnologyBulkAPIView(APIView):
    permission_classes = [RolePermission]
    read_roles = READ_ROLES
    write_roles = WRITE_ROLES

    @transaction.atomic
    def put(self, request):
        payload = request.data
        if not isinstance(payload, list):
            return Response({"error": "Request body must be an array"}, status=status.HTTP_400_BAD_REQUEST)

        for item in payload:
            if not isinstance(item, dict):
                return Response({"error": "Every item in array must be an object"}, status=status.HTTP_400_BAD_REQUEST)

            instance = None
            item_id = item.get("id")
            if item_id is not None:
                instance = Technology.objects.filter(id=item_id).first()

            if instance is not None:
                serializer = TechnologySerializer(instance, data=item, partial=True)
            else:
                serializer = TechnologySerializer(data=item)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(status=status.HTTP_204_NO_CONTENT)
