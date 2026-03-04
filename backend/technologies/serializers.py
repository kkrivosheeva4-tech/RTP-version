from django.db import transaction
from rest_framework import serializers

from references.models import (
    DigitalDirection,
    Enterprise,
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
    TechnologyVendor,
    TechnologyVendorIntegrator,
)


class EnterpriseReadinessSerializer(serializers.Serializer):
    enterpriseId = serializers.IntegerField()
    technologicalReadiness = serializers.IntegerField(min_value=1, max_value=9, required=False, default=1)
    organizationalReadiness = serializers.IntegerField(min_value=1, max_value=9, required=False, default=1)
    status = serializers.CharField(required=False, allow_blank=True, default="planned")


class VendorSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    integrators = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )


class TechnologySerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    block = serializers.IntegerField(required=False, allow_null=True)
    blocks = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    function = serializers.CharField(required=False, allow_blank=True, default="")
    functionCoverage = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )
    enterprises = EnterpriseReadinessSerializer(many=True, required=False, default=list)
    directions = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    trlStage = serializers.IntegerField(min_value=1, max_value=9, required=False, default=1)
    status = serializers.CharField(required=False, allow_blank=True, default="planned")
    vendors = VendorSerializer(many=True, required=False, default=list)
    marketExamples = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    documentationFiles = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )

    def validate(self, attrs):
        block_ids = self._collect_block_ids(attrs)
        existing_block_ids = set(FunctionalBlock.objects.filter(id__in=block_ids).values_list("id", flat=True))
        missing_blocks = sorted(set(block_ids) - existing_block_ids)
        if missing_blocks:
            raise serializers.ValidationError({"blocks": f"Unknown block ids: {missing_blocks}"})

        direction_ids = attrs.get("directions", []) or []
        existing_directions = set(DigitalDirection.objects.filter(id__in=direction_ids).values_list("id", flat=True))
        missing_directions = sorted(set(direction_ids) - existing_directions)
        if missing_directions:
            raise serializers.ValidationError({"directions": f"Unknown direction ids: {missing_directions}"})

        enterprise_ids = [row.get("enterpriseId") for row in attrs.get("enterprises", [])]
        existing_enterprises = set(Enterprise.objects.filter(id__in=enterprise_ids).values_list("id", flat=True))
        missing_enterprises = sorted(set(enterprise_ids) - existing_enterprises)
        if missing_enterprises:
            raise serializers.ValidationError({"enterprises": f"Unknown enterprise ids: {missing_enterprises}"})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        block_ids = self._collect_block_ids(validated_data)
        technology = Technology.objects.create(
            name=validated_data["name"],
            description=validated_data.get("description", ""),
            primary_block_id=validated_data.get("block") or (block_ids[0] if block_ids else None),
            legacy_function=validated_data.get("function", ""),
            trl_stage=validated_data.get("trlStage", 1),
            status=validated_data.get("status", "planned") or "planned",
            market_examples=validated_data.get("marketExamples", []),
            documentation_files=validated_data.get("documentationFiles", []),
        )
        self._sync_relations(technology, validated_data)
        return technology

    @transaction.atomic
    def update(self, instance, validated_data):
        block_ids = self._collect_block_ids(validated_data)
        instance.name = validated_data.get("name", instance.name)
        instance.description = validated_data.get("description", instance.description)
        if "block" in validated_data:
            instance.primary_block_id = validated_data.get("block")
        elif block_ids:
            instance.primary_block_id = block_ids[0]
        instance.legacy_function = validated_data.get("function", instance.legacy_function)
        instance.trl_stage = validated_data.get("trlStage", instance.trl_stage)
        instance.status = validated_data.get("status", instance.status)
        instance.market_examples = validated_data.get("marketExamples", instance.market_examples)
        instance.documentation_files = validated_data.get("documentationFiles", instance.documentation_files)
        instance.save()

        relation_fields = {"blocks", "block", "functionCoverage", "enterprises", "directions", "vendors"}
        if relation_fields.intersection(validated_data.keys()):
            self._sync_relations(instance, validated_data)
        return instance

    def to_representation(self, instance):
        block_ids = list(
            TechnologyBlock.objects.filter(technology=instance).values_list("block_id", flat=True).order_by("block_id")
        )
        direction_ids = list(
            TechnologyDirection.objects.filter(technology=instance)
            .values_list("direction_id", flat=True)
            .order_by("direction_id")
        )
        function_names = list(
            TechnologyFunctionCoverage.objects.filter(technology=instance)
            .select_related("function")
            .values_list("function__name", flat=True)
            .order_by("function__name")
        )
        enterprises = list(
            TechnologyEnterpriseReadiness.objects.filter(technology=instance)
            .values(
                "enterprise_id",
                "technological_readiness",
                "organizational_readiness",
                "status",
            )
            .order_by("enterprise_id")
        )

        vendors = []
        vendor_links = TechnologyVendor.objects.filter(technology=instance).select_related("vendor").order_by("vendor__name")
        for vendor_link in vendor_links:
            integrator_names = list(
                TechnologyVendorIntegrator.objects.filter(technology_vendor=vendor_link)
                .select_related("integrator")
                .values_list("integrator__name", flat=True)
                .order_by("integrator__name")
            )
            vendors.append(
                {
                    "name": vendor_link.vendor.name,
                    "integrators": integrator_names,
                }
            )

        return {
            "id": instance.id,
            "name": instance.name,
            "description": instance.description,
            "block": instance.primary_block_id or (block_ids[0] if block_ids else None),
            "blocks": block_ids,
            "function": instance.legacy_function,
            "functionCoverage": function_names,
            "enterprises": [
                {
                    "enterpriseId": row["enterprise_id"],
                    "technologicalReadiness": row["technological_readiness"],
                    "organizationalReadiness": row["organizational_readiness"],
                    "status": row["status"],
                }
                for row in enterprises
            ],
            "directions": direction_ids,
            "trlStage": instance.trl_stage,
            "status": instance.status,
            "vendors": vendors,
            "marketExamples": instance.market_examples or [],
            "documentationFiles": instance.documentation_files or [],
        }

    @staticmethod
    def _collect_block_ids(validated_data):
        block_ids = []
        if isinstance(validated_data.get("blocks"), list):
            block_ids.extend(validated_data.get("blocks", []))
        primary = validated_data.get("block")
        if primary and primary not in block_ids:
            block_ids.append(primary)
        return [block_id for block_id in block_ids if isinstance(block_id, int)]

    @transaction.atomic
    def _sync_relations(self, technology, validated_data):
        block_ids = self._collect_block_ids(validated_data)
        function_names = validated_data.get("functionCoverage", [])
        directions = validated_data.get("directions", [])
        enterprises = validated_data.get("enterprises", [])
        vendors = validated_data.get("vendors", [])

        TechnologyBlock.objects.filter(technology=technology).delete()
        TechnologyFunctionCoverage.objects.filter(technology=technology).delete()
        TechnologyDirection.objects.filter(technology=technology).delete()
        TechnologyEnterpriseReadiness.objects.filter(technology=technology).delete()
        TechnologyVendor.objects.filter(technology=technology).delete()

        for block_id in block_ids:
            TechnologyBlock.objects.create(technology=technology, block_id=block_id)

        for function_name in function_names:
            cleaned = str(function_name).strip()
            if not cleaned:
                continue
            function_obj, _ = FunctionReference.objects.get_or_create(name=cleaned)
            TechnologyFunctionCoverage.objects.create(technology=technology, function=function_obj)

        for direction_id in directions:
            TechnologyDirection.objects.create(technology=technology, direction_id=direction_id)

        for enterprise_row in enterprises:
            TechnologyEnterpriseReadiness.objects.create(
                technology=technology,
                enterprise_id=enterprise_row["enterpriseId"],
                technological_readiness=enterprise_row.get("technologicalReadiness", 1),
                organizational_readiness=enterprise_row.get("organizationalReadiness", 1),
                status=enterprise_row.get("status", "planned") or "planned",
            )

        for vendor_row in vendors:
            vendor_name = str(vendor_row.get("name", "")).strip()
            if not vendor_name:
                continue
            vendor, _ = Vendor.objects.get_or_create(name=vendor_name)
            vendor_link = TechnologyVendor.objects.create(technology=technology, vendor=vendor)
            for integrator_name in vendor_row.get("integrators", []):
                cleaned = str(integrator_name).strip()
                if not cleaned:
                    continue
                integrator, _ = Integrator.objects.get_or_create(name=cleaned)
                TechnologyVendorIntegrator.objects.create(
                    technology_vendor=vendor_link,
                    integrator=integrator,
                )
