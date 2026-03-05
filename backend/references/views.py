from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from references.models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
    Integrator,
    Vendor,
)


SUPPORTED_REFERENCE_NAMES = {
    "blocks",
    "functions",
    "functionToBlock",
    "digitalDirections",
    "directionToQuadrant",
    "vendors",
    "integrators",
    "enterprises",
    "enterprisesBlocksMapping",
}


class ReferenceAPIView(APIView):
    # Temporary open access until JWT/role permissions are implemented.
    permission_classes = [AllowAny]

    def get(self, request, name: str):
        if name not in SUPPORTED_REFERENCE_NAMES:
            return Response({"error": f"Unsupported reference: {name}"}, status=status.HTTP_404_NOT_FOUND)

        return Response(self._serialize_reference(name), status=status.HTTP_200_OK)

    @transaction.atomic
    def put(self, request, name: str):
        if name not in SUPPORTED_REFERENCE_NAMES:
            return Response({"error": f"Unsupported reference: {name}"}, status=status.HTTP_404_NOT_FOUND)

        try:
            self._save_reference(name, request.data)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _serialize_reference(self, name: str):
        if name == "blocks":
            return list(FunctionalBlock.objects.order_by("id").values("id", "name"))

        if name == "functions":
            return list(FunctionReference.objects.order_by("name").values_list("name", flat=True))

        if name == "functionToBlock":
            rows = FunctionReference.objects.select_related("block").all().order_by("name")
            return {row.name: row.block_id for row in rows if row.block_id is not None}

        if name == "digitalDirections":
            return list(DigitalDirection.objects.order_by("id").values("id", "name"))

        if name == "directionToQuadrant":
            rows = DigitalDirection.objects.order_by("id").values("name", "quadrant")
            result = {}
            for row in rows:
                if row["quadrant"] is None:
                    continue
                result[row["name"]] = [row["quadrant"]]
            return result

        if name == "vendors":
            return list(Vendor.objects.order_by("name").values_list("name", flat=True))

        if name == "integrators":
            return list(Integrator.objects.order_by("name").values_list("name", flat=True))

        if name == "enterprises":
            return list(Enterprise.objects.order_by("id").values("id", "name", "code", "description"))

        if name == "enterprisesBlocksMapping":
            by_enterprise = {}
            mappings = (
                EnterpriseBlockMapping.objects.select_related("enterprise", "block")
                .order_by("enterprise_id", "block_id")
            )
            for mapping in mappings:
                current = by_enterprise.setdefault(
                    mapping.enterprise_id,
                    {
                        "enterprise_id": mapping.enterprise_id,
                        "enterprise_name": mapping.enterprise.name,
                        "functional_blocks": [],
                    },
                )
                current["functional_blocks"].append(mapping.block_id)
            return {"enterprises_blocks_mapping": list(by_enterprise.values())}

        return []

    def _save_reference(self, name: str, payload):
        if name == "blocks":
            if not isinstance(payload, list):
                raise ValueError("blocks payload must be a list")
            keep_ids = []
            for item in payload:
                block_id = item.get("id")
                block_name = str(item.get("name", "")).strip()
                if block_id is None or not block_name:
                    continue
                FunctionalBlock.objects.update_or_create(id=block_id, defaults={"name": block_name})
                keep_ids.append(block_id)
            if keep_ids:
                FunctionalBlock.objects.exclude(id__in=keep_ids).delete()
            return

        if name == "functions":
            if not isinstance(payload, list):
                raise ValueError("functions payload must be a list")
            keep_names = []
            for item in payload:
                function_name = str(item).strip()
                if not function_name:
                    continue
                FunctionReference.objects.get_or_create(name=function_name)
                keep_names.append(function_name)
            if keep_names:
                FunctionReference.objects.exclude(name__in=keep_names).delete()
            return

        if name == "functionToBlock":
            if not isinstance(payload, dict):
                raise ValueError("functionToBlock payload must be an object")
            for function_name, block_value in payload.items():
                block_id = block_value[0] if isinstance(block_value, list) and block_value else block_value
                block = FunctionalBlock.objects.filter(id=block_id).first()
                function, _ = FunctionReference.objects.get_or_create(name=str(function_name).strip())
                function.block = block
                function.save(update_fields=["block"])
            return

        if name == "digitalDirections":
            if not isinstance(payload, list):
                raise ValueError("digitalDirections payload must be a list")
            keep_ids = []
            for item in payload:
                if isinstance(item, dict):
                    direction_id = item.get("id")
                    direction_name = str(item.get("name", "")).strip()
                else:
                    direction_id = None
                    direction_name = str(item).strip()
                if not direction_name:
                    continue
                if direction_id is None:
                    direction, _ = DigitalDirection.objects.get_or_create(name=direction_name)
                    keep_ids.append(direction.id)
                else:
                    DigitalDirection.objects.update_or_create(
                        id=direction_id,
                        defaults={"name": direction_name},
                    )
                    keep_ids.append(direction_id)
            if keep_ids:
                DigitalDirection.objects.exclude(id__in=keep_ids).delete()
            return

        if name == "directionToQuadrant":
            if not isinstance(payload, dict):
                raise ValueError("directionToQuadrant payload must be an object")
            for direction_name, value in payload.items():
                quadrant = value[0] if isinstance(value, list) and value else value
                direction, _ = DigitalDirection.objects.get_or_create(name=str(direction_name).strip())
                direction.quadrant = quadrant if isinstance(quadrant, int) else None
                direction.save(update_fields=["quadrant"])
            return

        if name == "vendors":
            if not isinstance(payload, list):
                raise ValueError("vendors payload must be a list")
            keep_names = []
            for item in payload:
                vendor_name = str(item).strip()
                if not vendor_name:
                    continue
                Vendor.objects.get_or_create(name=vendor_name)
                keep_names.append(vendor_name)
            if keep_names:
                Vendor.objects.exclude(name__in=keep_names).delete()
            return

        if name == "integrators":
            if not isinstance(payload, list):
                raise ValueError("integrators payload must be a list")
            keep_names = []
            for item in payload:
                integrator_name = str(item).strip()
                if not integrator_name:
                    continue
                Integrator.objects.get_or_create(name=integrator_name)
                keep_names.append(integrator_name)
            if keep_names:
                Integrator.objects.exclude(name__in=keep_names).delete()
            return

        if name == "enterprises":
            if not isinstance(payload, list):
                raise ValueError("enterprises payload must be a list")
            keep_ids = []
            for item in payload:
                enterprise_id = item.get("id")
                enterprise_name = str(item.get("name", "")).strip()
                if enterprise_id is None or not enterprise_name:
                    continue
                Enterprise.objects.update_or_create(
                    id=enterprise_id,
                    defaults={
                        "name": enterprise_name,
                        "code": item.get("code") or None,
                        "description": item.get("description", "") or "",
                    },
                )
                keep_ids.append(enterprise_id)
            if keep_ids:
                Enterprise.objects.exclude(id__in=keep_ids).delete()
            return

        if name == "enterprisesBlocksMapping":
            if not isinstance(payload, dict):
                raise ValueError("enterprisesBlocksMapping payload must be an object")
            rows = payload.get("enterprises_blocks_mapping", [])
            EnterpriseBlockMapping.objects.all().delete()
            for row in rows:
                enterprise_id = row.get("enterprise_id")
                block_ids = row.get("functional_blocks", []) or []
                if enterprise_id is None:
                    continue
                enterprise = Enterprise.objects.filter(id=enterprise_id).first()
                if not enterprise:
                    continue
                for block_id in block_ids:
                    if not FunctionalBlock.objects.filter(id=block_id).exists():
                        continue
                    EnterpriseBlockMapping.objects.get_or_create(enterprise=enterprise, block_id=block_id)
