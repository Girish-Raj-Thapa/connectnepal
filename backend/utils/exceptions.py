from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses.

    Response format:
    {
        "detail": "Human readable message",
        "code": "error_code",
        "status_code": 400
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_code = None

        if hasattr(exc, 'get_codes'):
            error_code = exc.get_codes()

        if isinstance(error_code, (list, dict)):
            error_code = None

        if not error_code and hasattr(exc, 'code'):
            error_code = exc.code

        if not error_code and hasattr(exc, 'default_code'):
            error_code = exc.default_code

        response.data['status_code'] = response.status_code
        response.data['code'] = error_code or 'error'

    if response and response.status_code >= 500:
        logger.error(
            f"Server error: {exc}",
            exc_info=True,
            extra={'request': context.get('request')}
        )

    return response


class ServiceError(APIException):
    """
    Base exception for service layer errors.
    """
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'A service error occurred.'
    default_code = 'service_error'

    def __init__(self, detail=None, code=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail=detail, code=code)


class AuthenticationError(ServiceError):
    """
    Authentication-related errors.
    """
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Authentication failed.'
    default_code = 'auth_error'


class ValidationError(ServiceError):
    """
    Validation errors from service layer.
    """
    default_detail = 'Validation failed.'
    default_code = 'validation_error'
