"""Translation module package."""
from app.modules.translation.endpoints import router
from app.modules.translation.service import translation_service

__all__ = ["router", "translation_service"]
