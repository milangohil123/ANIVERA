/**
 * Category C: Dynamic Content Translation Client Service
 *
 * Provides translation for dynamic descriptions, campaign summaries,
 * and audit notes with memory/session caching and safe offline fallback.
 */

const memoryCache = new Map<string, string>();

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  targetLang: string;
  cached: boolean;
}

export const translationService = {
  /**
   * Translates dynamic description or long-form text with caching and offline fallback.
   */
  async translateText(
    apiBaseUrl: string,
    text: string,
    targetLang: 'en' | 'gu' | 'hi',
    sourceLang: string = 'auto'
  ): Promise<string> {
    const trimmed = text?.trim();
    if (!trimmed) return '';

    const cacheKey = `${trimmed}___${targetLang}___${sourceLang}`;
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
    }

    // Try session storage cache
    try {
      const stored = sessionStorage.getItem(`trans_${cacheKey}`);
      if (stored) {
        memoryCache.set(cacheKey, stored);
        return stored;
      }
    } catch {
      // sessionStorage unavailable
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/translation/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmed,
          target_lang: targetLang,
          source_lang: sourceLang,
        }),
      });

      if (!response.ok) {
        return trimmed; // Offline / error fallback to original text
      }

      const data = await response.json();
      const resultText = data.translated_text || trimmed;

      memoryCache.set(cacheKey, resultText);
      try {
        sessionStorage.setItem(`trans_${cacheKey}`, resultText);
      } catch {
        // quota exceeded / sessionStorage disabled
      }

      return resultText;
    } catch {
      // Offline fallback: returns original text without breaking UI
      return trimmed;
    }
  },
};
