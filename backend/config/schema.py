import re

from rest_framework.schemas.openapi import AutoSchema


class RTPAutoSchema(AutoSchema):
    def get_operation_id(self, path, method):
        method_name = method.lower()
        has_trailing_slash = path.endswith("/")
        normalized_path = path.strip("/").replace("/", "_").replace("-", "_")
        normalized_path = normalized_path.replace("{", "").replace("}", "")
        normalized_path = re.sub(r"[^0-9a-zA-Z_]", "_", normalized_path)
        normalized_path = re.sub(r"_+", "_", normalized_path).strip("_")
        if not normalized_path:
            normalized_path = "root"
        suffix = "slash" if has_trailing_slash else "noslash"
        return f"{method_name}_{normalized_path}_{suffix}"

    def get_path_parameters(self, path, method):
        parameters = []
        for variable in re.findall(r"{([a-zA-Z0-9_]+)}", path):
            parameters.append(
                {
                    "name": variable,
                    "in": "path",
                    "required": True,
                    "description": "",
                    "schema": {"type": "string"},
                }
            )
        return parameters
