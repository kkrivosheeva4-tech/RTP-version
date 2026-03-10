from rest_framework.views import exception_handler as drf_exception_handler

from config.api_errors import normalize_error_payload


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    response.data = normalize_error_payload(response.data, response.status_code)
    return response
