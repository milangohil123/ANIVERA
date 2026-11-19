"""Schemas for dynamic description translation service (Category C)."""
from typing import Optional
from pydantic import BaseModel, Field


class TranslationRequest(BaseModel):
    """Payload to translate dynamic texts, descriptions or summaries."""
    text: str = Field(..., min_length=1, max_length=5000, description="Source text to translate")
    target_lang: str = Field(..., description="Target language code: 'gu', 'en', or 'hi'")
    source_lang: Optional[str] = Field("auto", description="Source language code or 'auto'")


class TranslationResponse(BaseModel):
    """Result of translated text with caching information."""
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    cached: bool
