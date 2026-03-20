from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from config.seed_utils import get_default_data_dir, load_json
from references.models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
    Integrator,
    Vendor,
)


class Command(BaseCommand):
    help = "Import reference dictionaries from src/data/ru/*.json."

    def add_arguments(self, parser):
        parser.add_argument(
            "--data-dir",
            type=str,
            default=None,
            help="Directory with JSON source files (default: repo/src/data/ru).",
        )
        parser.add_argument(
            "--clear-mappings",
            action="store_true",
            help="Clear enterprise-block mappings before import.",
        )

    def handle(self, *args, **options):
        data_dir = Path(options["data_dir"]) if options["data_dir"] else get_default_data_dir()
        if not data_dir.exists():
            raise CommandError(f"Data directory does not exist: {data_dir}")

        file_map = {
            "blocks": data_dir / "blocks.json",
            "functions": data_dir / "functions.json",
            "function_to_block": data_dir / "functionToBlock.json",
            "directions": data_dir / "digitalDirections.json",
            "direction_to_quadrant": data_dir / "directionToQuadrant.json",
            "vendors": data_dir / "vendors.json",
            "integrators": data_dir / "integrators.json",
            "enterprises": data_dir / "enterprises.json",
            "enterprise_mapping": data_dir / "enterprises-blocks-mapping.json",
        }
        missing = [name for name, path in file_map.items() if not path.exists()]
        if missing:
            raise CommandError(f"Missing source files: {', '.join(missing)}")

        blocks_data = load_json(file_map["blocks"])
        functions_data = load_json(file_map["functions"])
        function_to_block_data = load_json(file_map["function_to_block"])
        directions_data = load_json(file_map["directions"])
        direction_to_quadrant_data = load_json(file_map["direction_to_quadrant"])
        vendors_data = load_json(file_map["vendors"])
        integrators_data = load_json(file_map["integrators"])
        enterprises_data = load_json(file_map["enterprises"])
        enterprise_mapping_data = load_json(file_map["enterprise_mapping"])

        created = 0
        updated = 0

        with transaction.atomic():
            if options["clear_mappings"]:
                EnterpriseBlockMapping.objects.all().delete()

            c, u = self._import_blocks(blocks_data)
            created += c
            updated += u

            c, u = self._import_directions(directions_data, direction_to_quadrant_data)
            created += c
            updated += u

            c, u = self._import_vendors(vendors_data)
            created += c
            updated += u

            c, u = self._import_integrators(integrators_data)
            created += c
            updated += u

            c, u = self._import_enterprises(enterprises_data)
            created += c
            updated += u

            c, u = self._import_functions(functions_data, function_to_block_data)
            created += c
            updated += u

            c, u = self._import_enterprise_mapping(enterprise_mapping_data)
            created += c
            updated += u

        self.stdout.write(self.style.SUCCESS("Reference import completed."))
        self.stdout.write(f"Created: {created}")
        self.stdout.write(f"Updated: {updated}")

    def _import_blocks(self, rows):
        created = 0
        updated = 0
        for item in rows:
            if not isinstance(item, dict):
                continue
            block_id = item.get("id")
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            obj, is_created = FunctionalBlock.objects.update_or_create(
                id=block_id,
                defaults={"name": name},
            )
            created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    def _import_directions(self, rows, direction_to_quadrant):
        created = 0
        updated = 0
        for item in rows:
            direction_id = None
            name = ""
            quadrant = None

            if isinstance(item, dict):
                direction_id = item.get("id")
                name = str(item.get("name", "")).strip()
                quadrant = item.get("quadrant")
            elif isinstance(item, str):
                name = item.strip()

            if not name:
                continue

            mapped_quadrant = direction_to_quadrant.get(name)
            if quadrant is None and mapped_quadrant is not None:
                if isinstance(mapped_quadrant, list):
                    quadrant = mapped_quadrant[0] if mapped_quadrant else None
                else:
                    quadrant = mapped_quadrant

            defaults = {"name": name, "quadrant": quadrant}
            if direction_id is not None:
                _, is_created = DigitalDirection.objects.update_or_create(
                    id=direction_id,
                    defaults=defaults,
                )
            else:
                _, is_created = DigitalDirection.objects.update_or_create(
                    name=name,
                    defaults=defaults,
                )
            created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    def _import_vendors(self, rows):
        created = 0
        updated = 0
        for item in rows:
            name = self._extract_name(item)
            if not name:
                continue

            item_id = item.get("id") if isinstance(item, dict) else None
            if item_id is not None:
                _, is_created = Vendor.objects.update_or_create(
                    id=item_id,
                    defaults={"name": name},
                )
            else:
                _, is_created = Vendor.objects.update_or_create(name=name)
            created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    def _import_integrators(self, rows):
        created = 0
        updated = 0
        for item in rows:
            name = self._extract_name(item)
            if not name:
                continue

            item_id = item.get("id") if isinstance(item, dict) else None
            if item_id is not None:
                _, is_created = Integrator.objects.update_or_create(
                    id=item_id,
                    defaults={"name": name},
                )
            else:
                _, is_created = Integrator.objects.update_or_create(name=name)
            created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    def _import_enterprises(self, rows):
        created = 0
        updated = 0
        for item in rows:
            if not isinstance(item, dict):
                continue
            enterprise_id = item.get("id")
            name = str(item.get("name", "")).strip()
            if not name:
                continue

            defaults = {
                "name": name,
                "code": item.get("code") or None,
                "description": item.get("description", "") or "",
            }
            _, is_created = Enterprise.objects.update_or_create(
                id=enterprise_id,
                defaults=defaults,
            )
            created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    def _import_functions(self, rows, function_to_block):
        created = 0
        updated = 0
        for item in rows:
            name = self._extract_name(item)
            if not name:
                continue

            mapping_value = function_to_block.get(name)
            block = None
            if isinstance(mapping_value, list):
                block_id = mapping_value[0] if mapping_value else None
                if block_id:
                    block = FunctionalBlock.objects.filter(id=block_id).first()
            elif isinstance(mapping_value, int):
                block = FunctionalBlock.objects.filter(id=mapping_value).first()

            _, is_created = FunctionReference.objects.update_or_create(
                name=name,
                defaults={"block": block},
            )
            created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    def _import_enterprise_mapping(self, payload):
        created = 0
        updated = 0
        rows = payload.get("enterprises_blocks_mapping", []) if isinstance(payload, dict) else []

        for item in rows:
            if not isinstance(item, dict):
                continue
            enterprise_id = item.get("enterprise_id")
            block_ids = item.get("functional_blocks", []) or []

            enterprise = Enterprise.objects.filter(id=enterprise_id).first()
            if not enterprise:
                enterprise_name = item.get("enterprise_name")
                if enterprise_name:
                    enterprise = Enterprise.objects.filter(name=enterprise_name).first()
            if not enterprise:
                self.stdout.write(
                    self.style.WARNING(f"Skip mapping: unknown enterprise {enterprise_id}")
                )
                continue

            EnterpriseBlockMapping.objects.filter(enterprise=enterprise).exclude(
                block_id__in=block_ids
            ).delete()

            for block_id in block_ids:
                block = FunctionalBlock.objects.filter(id=block_id).first()
                if not block:
                    self.stdout.write(self.style.WARNING(f"Skip mapping: unknown block {block_id}"))
                    continue
                _, is_created = EnterpriseBlockMapping.objects.get_or_create(
                    enterprise=enterprise,
                    block=block,
                )
                created, updated = self._accumulate(created, updated, is_created)
        return created, updated

    @staticmethod
    def _extract_name(value):
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            return str(value.get("name", "")).strip()
        return ""

    @staticmethod
    def _accumulate(created, updated, is_created):
        if is_created:
            created += 1
        else:
            updated += 1
        return created, updated
