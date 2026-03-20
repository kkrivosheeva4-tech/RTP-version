from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from config.seed_utils import get_default_data_dir, load_json
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


class Command(BaseCommand):
    help = "Import technologies from src/data/ru/technologies.json."

    def add_arguments(self, parser):
        parser.add_argument(
            "--data-dir",
            type=str,
            default=None,
            help="Directory with JSON source files (default: repo/src/data/ru).",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing technologies before import.",
        )

    def handle(self, *args, **options):
        data_dir = Path(options["data_dir"]) if options["data_dir"] else get_default_data_dir()
        tech_path = data_dir / "technologies.json"
        if not tech_path.exists():
            raise CommandError(f"Source file does not exist: {tech_path}")

        rows = load_json(tech_path)
        if not isinstance(rows, list):
            raise CommandError("technologies.json must contain an array")

        created = 0
        updated = 0

        with transaction.atomic():
            if options["clear"]:
                Technology.objects.all().delete()

            for item in rows:
                if not isinstance(item, dict):
                    continue
                tech, is_created = self._upsert_technology(item)
                created, updated = self._accumulate(created, updated, is_created)
                self._sync_relations(tech, item)

        self.stdout.write(self.style.SUCCESS("Technology import completed."))
        self.stdout.write(f"Created: {created}")
        self.stdout.write(f"Updated: {updated}")

    def _upsert_technology(self, payload):
        technology_id = payload.get("id")
        name = str(payload.get("name", "")).strip()
        if not name:
            raise CommandError("Technology record without name")

        block_ids = self._collect_block_ids(payload)
        primary_block = None
        if payload.get("block"):
            primary_block = FunctionalBlock.objects.filter(id=payload.get("block")).first()
        if not primary_block and block_ids:
            primary_block = FunctionalBlock.objects.filter(id=block_ids[0]).first()

        defaults = {
            "name": name,
            "description": payload.get("description", "") or "",
            "primary_block": primary_block,
            "legacy_function": payload.get("function", "") or "",
            "trl_stage": self._clamp(payload.get("trlStage", 1), minimum=1, maximum=9, default=1),
            "status": payload.get("status", "planned") or "planned",
            "market_examples": payload.get("marketExamples", []) or [],
            "documentation_files": payload.get("documentationFiles", []) or [],
        }

        if technology_id is not None:
            return Technology.objects.update_or_create(id=technology_id, defaults=defaults)
        return Technology.objects.update_or_create(name=name, defaults=defaults)

    def _sync_relations(self, technology, payload):
        TechnologyBlock.objects.filter(technology=technology).delete()
        TechnologyFunctionCoverage.objects.filter(technology=technology).delete()
        TechnologyDirection.objects.filter(technology=technology).delete()
        TechnologyVendor.objects.filter(technology=technology).delete()
        TechnologyEnterpriseReadiness.objects.filter(technology=technology).delete()

        for block_id in self._collect_block_ids(payload):
            block = FunctionalBlock.objects.filter(id=block_id).first()
            if not block:
                self.stdout.write(
                    self.style.WARNING(f"Technology {technology.id}: unknown block {block_id}")
                )
                continue
            TechnologyBlock.objects.create(technology=technology, block=block)

        for function_name in payload.get("functionCoverage", []) or []:
            function_name = str(function_name).strip()
            if not function_name:
                continue
            function_obj, _ = FunctionReference.objects.get_or_create(name=function_name)
            TechnologyFunctionCoverage.objects.create(technology=technology, function=function_obj)

        for direction_id in payload.get("directions", []) or []:
            direction = DigitalDirection.objects.filter(id=direction_id).first()
            if not direction:
                self.stdout.write(
                    self.style.WARNING(
                        f"Technology {technology.id}: unknown direction {direction_id}"
                    )
                )
                continue
            TechnologyDirection.objects.create(technology=technology, direction=direction)

        for enterprise_row in payload.get("enterprises", []) or []:
            if not isinstance(enterprise_row, dict):
                continue
            enterprise_id = enterprise_row.get("enterpriseId")
            enterprise = Enterprise.objects.filter(id=enterprise_id).first()
            if not enterprise:
                self.stdout.write(
                    self.style.WARNING(
                        f"Technology {technology.id}: unknown enterprise {enterprise_id}"
                    )
                )
                continue
            TechnologyEnterpriseReadiness.objects.create(
                technology=technology,
                enterprise=enterprise,
                technological_readiness=self._clamp(
                    enterprise_row.get("technologicalReadiness", 1),
                    minimum=1,
                    maximum=9,
                    default=1,
                ),
                organizational_readiness=self._clamp(
                    enterprise_row.get("organizationalReadiness", 1),
                    minimum=1,
                    maximum=9,
                    default=1,
                ),
                status=enterprise_row.get("status", "planned") or "planned",
            )

        for vendor_row in payload.get("vendors", []) or []:
            if isinstance(vendor_row, dict):
                vendor_name = str(vendor_row.get("name", "")).strip()
                integrators = vendor_row.get("integrators", []) or []
            else:
                vendor_name = str(vendor_row).strip()
                integrators = []

            if not vendor_name:
                continue

            vendor, _ = Vendor.objects.get_or_create(name=vendor_name)
            technology_vendor = TechnologyVendor.objects.create(
                technology=technology, vendor=vendor
            )

            for integrator_name in integrators:
                integrator_name = str(integrator_name).strip()
                if not integrator_name:
                    continue
                integrator, _ = Integrator.objects.get_or_create(name=integrator_name)
                TechnologyVendorIntegrator.objects.create(
                    technology_vendor=technology_vendor,
                    integrator=integrator,
                )

    @staticmethod
    def _collect_block_ids(payload):
        blocks = []
        if isinstance(payload.get("blocks"), list):
            blocks.extend(payload.get("blocks"))
        if payload.get("block") and payload.get("block") not in blocks:
            blocks.append(payload.get("block"))
        return [block_id for block_id in blocks if isinstance(block_id, int)]

    @staticmethod
    def _clamp(value, minimum, maximum, default):
        if value is None:
            return default
        try:
            normalized = int(value)
        except (TypeError, ValueError):
            return default
        return max(minimum, min(maximum, normalized))

    @staticmethod
    def _accumulate(created, updated, is_created):
        if is_created:
            created += 1
        else:
            updated += 1
        return created, updated
