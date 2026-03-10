from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.models import AuditLog
from auth_custom.models import UserProfile
from auth_custom.permissions import READ_ROLES, RolePermission
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
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = READ_ROLES
    write_roles = {UserProfile.ROLE_ADMIN}

    def get(self, request, name: str):
        if name not in SUPPORTED_REFERENCE_NAMES:
            return error_response(
                f"Unsupported reference: {name}",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        return Response(self._serialize_reference(name), status=status.HTTP_200_OK)

    @transaction.atomic
    def put(self, request, name: str):
        if name not in SUPPORTED_REFERENCE_NAMES:
            return error_response(
                f"Unsupported reference: {name}",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        before_payload = self._serialize_reference(name)
        try:
            self._save_reference(name, request.data)
        except ValueError as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        after_payload = self._serialize_reference(name)
        audit_log(
            action=AuditLog.ACTION_UPDATE,
            entity_type="reference",
            entity_id=name,
            request=request,
            before_data=before_payload,
            after_data=after_payload,
        )
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
            normalized = self._validate_blocks_payload(payload)
            keep_ids = [item["id"] for item in normalized]
            for item in normalized:
                FunctionalBlock.objects.update_or_create(id=item["id"], defaults={"name": item["name"]})
            FunctionalBlock.objects.exclude(id__in=keep_ids).delete()
            return

        if name == "functions":
            normalized = self._validate_functions_payload(payload)
            keep_names = []
            for function_name in normalized:
                FunctionReference.objects.get_or_create(name=function_name)
                keep_names.append(function_name)
            FunctionReference.objects.exclude(name__in=keep_names).delete()
            return

        if name == "functionToBlock":
            normalized = self._validate_function_to_block_payload(payload)
            for function_name, block_id in normalized.items():
                block = FunctionalBlock.objects.get(id=block_id)
                function, _ = FunctionReference.objects.get_or_create(name=function_name)
                function.block = block
                function.save(update_fields=["block"])
            return

        if name == "digitalDirections":
            normalized = self._validate_digital_directions_payload(payload)
            keep_ids = []
            for item in normalized:
                direction_id = item.get("id")
                direction_name = item["name"]
                if direction_id is None:
                    direction, _ = DigitalDirection.objects.get_or_create(name=direction_name)
                    keep_ids.append(direction.id)
                else:
                    DigitalDirection.objects.update_or_create(
                        id=direction_id,
                        defaults={"name": direction_name},
                    )
                    keep_ids.append(direction_id)
            DigitalDirection.objects.exclude(id__in=keep_ids).delete()
            return

        if name == "directionToQuadrant":
            normalized = self._validate_direction_to_quadrant_payload(payload)
            for direction_name, quadrant in normalized.items():
                direction, _ = DigitalDirection.objects.get_or_create(name=direction_name)
                direction.quadrant = quadrant
                direction.save(update_fields=["quadrant"])
            return

        if name == "vendors":
            normalized = self._validate_string_list_payload(payload, "vendors")
            keep_names = []
            for vendor_name in normalized:
                Vendor.objects.get_or_create(name=vendor_name)
                keep_names.append(vendor_name)
            Vendor.objects.exclude(name__in=keep_names).delete()
            return

        if name == "integrators":
            normalized = self._validate_string_list_payload(payload, "integrators")
            keep_names = []
            for integrator_name in normalized:
                Integrator.objects.get_or_create(name=integrator_name)
                keep_names.append(integrator_name)
            Integrator.objects.exclude(name__in=keep_names).delete()
            return

        if name == "enterprises":
            normalized = self._validate_enterprises_payload(payload)
            keep_ids = []
            for item in normalized:
                enterprise_id = item["id"]
                enterprise_name = item["name"]
                Enterprise.objects.update_or_create(
                    id=enterprise_id,
                    defaults={
                        "name": enterprise_name,
                        "code": item.get("code") or None,
                        "description": item.get("description", "") or "",
                    },
                )
                keep_ids.append(enterprise_id)
            Enterprise.objects.exclude(id__in=keep_ids).delete()
            return

        if name == "enterprisesBlocksMapping":
            rows = self._validate_enterprises_blocks_mapping_payload(payload)
            EnterpriseBlockMapping.objects.all().delete()
            for row in rows:
                enterprise_id = row["enterprise_id"]
                block_ids = row["functional_blocks"]
                enterprise = Enterprise.objects.get(id=enterprise_id)
                for block_id in block_ids:
                    FunctionalBlock.objects.get(id=block_id)
                    EnterpriseBlockMapping.objects.get_or_create(enterprise=enterprise, block_id=block_id)
            return

        raise ValueError(f"Unsupported reference: {name}")

    @staticmethod
    def _validate_string_list_payload(payload, name: str):
        if not isinstance(payload, list):
            raise ValueError(f"{name} payload must be a list")

        values = []
        seen = set()
        for idx, item in enumerate(payload):
            value = str(item).strip()
            if not value:
                raise ValueError(f"{name}[{idx}] must be a non-empty string")
            key = value.lower()
            if key in seen:
                raise ValueError(f"{name} contains duplicate value: {value}")
            seen.add(key)
            values.append(value)
        return values

    @staticmethod
    def _validate_blocks_payload(payload):
        if not isinstance(payload, list):
            raise ValueError("blocks payload must be a list")

        normalized = []
        seen_ids = set()
        for idx, item in enumerate(payload):
            if not isinstance(item, dict):
                raise ValueError(f"blocks[{idx}] must be an object")
            block_id = item.get("id")
            block_name = str(item.get("name", "")).strip()
            if not isinstance(block_id, int):
                raise ValueError(f"blocks[{idx}].id must be integer")
            if not block_name:
                raise ValueError(f"blocks[{idx}].name is required")
            if block_id in seen_ids:
                raise ValueError(f"blocks contains duplicate id: {block_id}")
            seen_ids.add(block_id)
            normalized.append({"id": block_id, "name": block_name})
        return normalized

    @staticmethod
    def _validate_functions_payload(payload):
        if not isinstance(payload, list):
            raise ValueError("functions payload must be a list")

        normalized = []
        seen = set()
        for idx, item in enumerate(payload):
            value = str(item).strip()
            if not value:
                raise ValueError(f"functions[{idx}] must be non-empty string")
            key = value.lower()
            if key in seen:
                raise ValueError(f"functions contains duplicate value: {value}")
            seen.add(key)
            normalized.append(value)
        return normalized

    @staticmethod
    def _validate_function_to_block_payload(payload):
        if not isinstance(payload, dict):
            raise ValueError("functionToBlock payload must be an object")

        normalized = {}
        known_block_ids = set(FunctionalBlock.objects.values_list("id", flat=True))
        for function_name, block_value in payload.items():
            func = str(function_name).strip()
            if not func:
                raise ValueError("functionToBlock key must be non-empty")

            if isinstance(block_value, list):
                if not block_value:
                    raise ValueError(f"functionToBlock[{func}] list cannot be empty")
                block_id = block_value[0]
            else:
                block_id = block_value

            if not isinstance(block_id, int):
                raise ValueError(f"functionToBlock[{func}] must map to integer block id")
            if block_id not in known_block_ids:
                raise ValueError(f"functionToBlock[{func}] references unknown block id {block_id}")
            normalized[func] = block_id
        return normalized

    @staticmethod
    def _validate_digital_directions_payload(payload):
        if not isinstance(payload, list):
            raise ValueError("digitalDirections payload must be a list")

        normalized = []
        seen_ids = set()
        seen_names = set()
        for idx, item in enumerate(payload):
            if isinstance(item, dict):
                direction_id = item.get("id")
                direction_name = str(item.get("name", "")).strip()
            else:
                direction_id = None
                direction_name = str(item).strip()

            if not direction_name:
                raise ValueError(f"digitalDirections[{idx}].name is required")
            if direction_id is not None and not isinstance(direction_id, int):
                raise ValueError(f"digitalDirections[{idx}].id must be integer or null")
            if direction_id in seen_ids and direction_id is not None:
                raise ValueError(f"digitalDirections contains duplicate id {direction_id}")
            if direction_name.lower() in seen_names:
                raise ValueError(f"digitalDirections contains duplicate name {direction_name}")

            if direction_id is not None:
                seen_ids.add(direction_id)
            seen_names.add(direction_name.lower())
            normalized.append({"id": direction_id, "name": direction_name})
        return normalized

    @staticmethod
    def _validate_direction_to_quadrant_payload(payload):
        if not isinstance(payload, dict):
            raise ValueError("directionToQuadrant payload must be an object")

        normalized = {}
        for direction_name, value in payload.items():
            key = str(direction_name).strip()
            if not key:
                raise ValueError("directionToQuadrant key must be non-empty")
            if isinstance(value, list):
                if len(value) != 1:
                    raise ValueError(f"directionToQuadrant[{key}] list must contain exactly one item")
                quadrant = value[0]
            else:
                quadrant = value

            if not isinstance(quadrant, int):
                raise ValueError(f"directionToQuadrant[{key}] must be integer")
            if quadrant < 1 or quadrant > 4:
                raise ValueError(f"directionToQuadrant[{key}] must be in range 1..4")
            normalized[key] = quadrant
        return normalized

    @staticmethod
    def _validate_enterprises_payload(payload):
        if not isinstance(payload, list):
            raise ValueError("enterprises payload must be a list")

        normalized = []
        seen_ids = set()
        seen_names = set()
        for idx, item in enumerate(payload):
            if not isinstance(item, dict):
                raise ValueError(f"enterprises[{idx}] must be an object")
            enterprise_id = item.get("id")
            enterprise_name = str(item.get("name", "")).strip()
            code = item.get("code")
            description = item.get("description", "")

            if not isinstance(enterprise_id, int):
                raise ValueError(f"enterprises[{idx}].id must be integer")
            if not enterprise_name:
                raise ValueError(f"enterprises[{idx}].name is required")
            if code is not None and not isinstance(code, str):
                raise ValueError(f"enterprises[{idx}].code must be string or null")
            if description is not None and not isinstance(description, str):
                raise ValueError(f"enterprises[{idx}].description must be string")

            if enterprise_id in seen_ids:
                raise ValueError(f"enterprises contains duplicate id {enterprise_id}")
            if enterprise_name.lower() in seen_names:
                raise ValueError(f"enterprises contains duplicate name {enterprise_name}")

            seen_ids.add(enterprise_id)
            seen_names.add(enterprise_name.lower())
            normalized.append(
                {
                    "id": enterprise_id,
                    "name": enterprise_name,
                    "code": code,
                    "description": description or "",
                }
            )
        return normalized

    @staticmethod
    def _validate_enterprises_blocks_mapping_payload(payload):
        if not isinstance(payload, dict):
            raise ValueError("enterprisesBlocksMapping payload must be an object")
        rows = payload.get("enterprises_blocks_mapping")
        if not isinstance(rows, list):
            raise ValueError("enterprisesBlocksMapping.enterprises_blocks_mapping must be a list")

        known_enterprises = set(Enterprise.objects.values_list("id", flat=True))
        known_blocks = set(FunctionalBlock.objects.values_list("id", flat=True))
        normalized = []
        seen_enterprises = set()

        for idx, row in enumerate(rows):
            if not isinstance(row, dict):
                raise ValueError(f"enterprises_blocks_mapping[{idx}] must be an object")
            enterprise_id = row.get("enterprise_id")
            block_ids = row.get("functional_blocks")
            if not isinstance(enterprise_id, int):
                raise ValueError(f"enterprises_blocks_mapping[{idx}].enterprise_id must be integer")
            if not isinstance(block_ids, list):
                raise ValueError(f"enterprises_blocks_mapping[{idx}].functional_blocks must be a list")
            if enterprise_id not in known_enterprises:
                raise ValueError(f"Unknown enterprise_id {enterprise_id} in enterprises_blocks_mapping[{idx}]")
            if enterprise_id in seen_enterprises:
                raise ValueError(f"Duplicate enterprise_id {enterprise_id} in enterprises_blocks_mapping")
            seen_enterprises.add(enterprise_id)

            unique_blocks = []
            seen_blocks = set()
            for bidx, block_id in enumerate(block_ids):
                if not isinstance(block_id, int):
                    raise ValueError(
                        f"enterprises_blocks_mapping[{idx}].functional_blocks[{bidx}] must be integer"
                    )
                if block_id not in known_blocks:
                    raise ValueError(
                        f"Unknown block id {block_id} in enterprises_blocks_mapping[{idx}].functional_blocks"
                    )
                if block_id in seen_blocks:
                    continue
                seen_blocks.add(block_id)
                unique_blocks.append(block_id)

            normalized.append({"enterprise_id": enterprise_id, "functional_blocks": unique_blocks})
        return normalized
