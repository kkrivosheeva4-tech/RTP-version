import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from rest_framework.schemas.openapi import SchemaGenerator


class Command(BaseCommand):
    help = "Export OpenAPI schema to a JSON file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="docs/openapi.json",
            help="Output file path for generated OpenAPI schema.",
        )
        parser.add_argument(
            "--title",
            default="RTP-3 API",
            help="OpenAPI title.",
        )

    def handle(self, *args, **options):
        output_path = Path(options["output"])
        title = options["title"]

        schema = SchemaGenerator(title=title).get_schema(request=None, public=True)
        if schema is None:
            raise CommandError("Failed to generate OpenAPI schema.")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"OpenAPI schema exported to {output_path}"))
