"""Translation Service for Category C dynamic content.

Provides in-memory caching and dictionary-based offline fallbacks.
Designed for UI descriptions, campaign goals, reasons, and guidance text.
Strictly safeguards sensitive personal records (no external third-party leaks).
"""
import logging
from typing import Dict, Tuple, Optional

logger = logging.getLogger(__name__)

# Pre-seeded common domain translations for offline and zero-latency retrieval
COMMON_PHRASE_DICTIONARY: Dict[str, Dict[str, str]] = {
    "Official administrative change": {
        "en": "Official administrative change",
        "gu": "સત્તાવાર વહીવટી ફેરફાર",
        "hi": "आधिकारिक प्रशासनिक परिवर्तन",
    },
    "District jurisdiction reassigned safely": {
        "en": "District jurisdiction reassigned safely",
        "gu": "જિલ્લા કાર્યક્ષેત્ર સલામત રીતે પુનઃસોંપાયું",
        "hi": "जिला अधिकार क्षेत्र सुरक्षित रूप से पुन: सौंप दिया गया",
    },
    "FMD National Vaccination Campaign": {
        "en": "FMD National Vaccination Campaign",
        "gu": "FMD રાષ્ટ્રીય રસીકરણ અભિયાન",
        "hi": "एफएमडी राष्ट्रीय टीकाकरण अभियान",
    },
    "Target: 100% vaccination of bovine species across Gujarat": {
        "en": "Target: 100% vaccination of bovine species across Gujarat",
        "gu": "લક્ષ્ય: ગુજરાતભરના તમામ બોવાઇન પશુઓનું શત-પ્રતિશત રસીકરણ",
        "hi": "लक्ष्य: पूरे गुजरात में बोवाइन मवेशियों का 100% टीकाकरण",
    },
    "Active jurisdiction verified with Geo-coordinates": {
        "en": "Active jurisdiction verified with Geo-coordinates",
        "gu": "જીઓ-કોઓર્ડિનેટ્સ સાથે ચકાસાયેલ સક્રિય કાર્યક્ષેત્ર",
        "hi": "जियो-निर्देशांक के साथ सत्यापित सक्रिय अधिकार क्षेत्र",
    },
    "Routine administrative transfer and assignment": {
        "en": "Routine administrative transfer and assignment",
        "gu": "નિયમિત વહીવટી બદલી અને સોંપણી",
        "hi": "નિયમિત વહીવટી બદલી અને સોંપણી",
    },
    "Official jurisdictional boundary modification": {
        "en": "Official jurisdictional boundary modification",
        "gu": "સત્તાવાર કાર્યક્ષેત્ર સીમા સુધારણા",
        "hi": "आधिकारिक क्षेत्राधिकार सीमा संशोधन",
    },
}


class TranslationService:
    """Manages text translation with caching and safe offline fallbacks."""

    def __init__(self):
        # Cache key: (text_hash_or_stripped_text, target_lang, source_lang)
        self._cache: Dict[Tuple[str, str, str], str] = {}

    def translate(
        self,
        text: str,
        target_lang: str,
        source_lang: Optional[str] = "auto"
    ) -> Tuple[str, bool]:
        """Translate given text to target_lang ('en', 'gu', 'hi').

        Returns (translated_text, is_cached).
        """
        cleaned_text = text.strip()
        if not cleaned_text:
            return "", False

        target_lang = target_lang.lower()
        if target_lang not in ("en", "gu", "hi"):
            target_lang = "gu"

        source_lang = (source_lang or "auto").lower()

        # Check cache
        cache_key = (cleaned_text, target_lang, source_lang)
        if cache_key in self._cache:
            return self._cache[cache_key], True

        # Check common seeded phrases
        for phrase, translations in COMMON_PHRASE_DICTIONARY.items():
            if cleaned_text.lower() == phrase.lower():
                if target_lang in translations:
                    res = translations[target_lang]
                    self._cache[cache_key] = res
                    return res, False
            # Check if cleaned_text matches one of the translations
            for lang, trans_val in translations.items():
                if cleaned_text == trans_val and target_lang in translations:
                    res = translations[target_lang]
                    self._cache[cache_key] = res
                    return res, False

        # Fallback: If no external translator configured or offline, preserve original text safely
        translated = cleaned_text
        self._cache[cache_key] = translated
        return translated, False


translation_service = TranslationService()
