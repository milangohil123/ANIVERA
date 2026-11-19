"""API Router for Category C Dynamic Content Translation."""
from fastapi import APIRouter, HTTPException, status
from app.modules.translation.schemas import TranslationRequest, TranslationResponse
from app.modules.translation.service import translation_service

router = APIRouter()


@router.post(
    "/translate",
    response_model=TranslationResponse,
    summary="Translate dynamic text / descriptions with caching"
)
async def translate_text(payload: TranslationRequest):
    """Translate dynamic descriptions, reasons, or summaries to target language."""
    try:
        translated_text, is_cached = translation_service.translate(
            text=payload.text,
            target_lang=payload.target_lang,
            source_lang=payload.source_lang,
        )
        return TranslationResponse(
            original_text=payload.text,
            translated_text=translated_text,
            source_lang=payload.source_lang or "auto",
            target_lang=payload.target_lang,
            cached=is_cached,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Translation failed: {str(exc)}"
        )
