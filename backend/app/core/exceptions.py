"""Domain and HTTP exception classes."""
from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class PashuRakshakException(Exception):
    """Base exception for PashuRakshak application."""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class PermissionDeniedException(HTTPException):
    """Raised when an actor lacks authority for a scoped operation."""
    def __init__(self, detail: str = "Permission denied for this operation or village scope"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERMISSION_DENIED", "message": detail}
        )


class ResourceNotFoundException(HTTPException):
    """Raised when a requested resource does not exist."""
    def __init__(self, resource_name: str, identifier: Any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESOURCE_NOT_FOUND", "message": f"{resource_name} '{identifier}' not found"}
        )


class ConflictException(HTTPException):
    """Raised on concurrency or duplicate record conflict."""
    def __init__(self, detail: str, code: str = "CONFLICT"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": code, "message": detail}
        )


class BusinessRuleViolationException(HTTPException):
    """Raised when an operation violates a business rule."""
    def __init__(self, detail: str, code: str = "BUSINESS_RULE_VIOLATION"):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": code, "message": detail}
        )

