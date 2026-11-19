/**
 * PashuRakshak / ANIVERA — Master Data & Dynamic Entity Localization Utilities.
 *
 * Implements deterministic multilingual resolution for:
 * - Gujarat Administrative Districts (Official 34 districts in GU, EN, HI)
 * - Species, Disease, and Status dictionaries
 * - Locale-aware date and numeric formatting
 */
import { SupportedLanguage } from './types';

// Complete Official Gujarat 34-District Multilingual Master Mapping
export const GUJARAT_DISTRICTS_MULTILINGUAL: Record<
  string,
  { en: string; gu: string; hi: string; code: string }
> = {
  Ahmedabad: { en: 'Ahmedabad', gu: 'અમદાવાદ', hi: 'अहमदाबाद', code: 'AHMEDABAD' },
  Amreli: { en: 'Amreli', gu: 'અમરેલી', hi: 'अमरेली', code: 'AMRELI' },
  Anand: { en: 'Anand', gu: 'આણંદ', hi: 'आणंद', code: 'ANAND' },
  Aravalli: { en: 'Aravalli', gu: 'અરવલ્લી', hi: 'अरवल्ली', code: 'ARAVALLI' },
  Banaskantha: { en: 'Banaskantha', gu: 'બનાસકાંઠા', hi: 'बनासकांठा', code: 'BANASKANTHA' },
  Bharuch: { en: 'Bharuch', gu: 'ભરૂચ', hi: 'भरूच', code: 'BHARUCH' },
  Bhavnagar: { en: 'Bhavnagar', gu: 'ભાવનગર', hi: 'भावनगर', code: 'BHAVNAGAR' },
  Botad: { en: 'Botad', gu: 'બોટાદ', hi: 'बोटाद', code: 'BOTAD' },
  'Chhota Udaipur': { en: 'Chhota Udaipur', gu: 'છોટા ઉદેપુર', hi: 'छोटा उदेपुर', code: 'CHHOTA_UDAIPUR' },
  Dahod: { en: 'Dahod', gu: 'દાહોદ', hi: 'दाहोद', code: 'DAHOD' },
  Dang: { en: 'Dang', gu: 'ડાંગ', hi: 'डांग', code: 'DANG' },
  'Devbhumi Dwarka': { en: 'Devbhumi Dwarka', gu: 'દેવભૂમિ દ્વારકા', hi: 'देवभूमि द्वारका', code: 'DEVBHUMI_DWARKA' },
  Gandhinagar: { en: 'Gandhinagar', gu: 'ગાંધીનગર', hi: 'गांधीनगर', code: 'GANDHINAGAR' },
  'Gir Somnath': { en: 'Gir Somnath', gu: 'ગીર સોમનાથ', hi: 'गिर सोमनाथ', code: 'GIR_SOMNATH' },
  Jamnagar: { en: 'Jamnagar', gu: 'જામનગર', hi: 'जामनगर', code: 'JAMNAGAR' },
  Junagadh: { en: 'Junagadh', gu: 'જૂનાગઢ', hi: 'जूनागढ़', code: 'JUNAGADH' },
  Kheda: { en: 'Kheda', gu: 'ખેડા', hi: 'खेड़ा', code: 'KHEDA' },
  Kutch: { en: 'Kutch', gu: 'કચ્છ', hi: 'कच्छ', code: 'KUTCH' },
  Mahisagar: { en: 'Mahisagar', gu: 'મહીસાગર', hi: 'महीसागर', code: 'MAHISAGAR' },
  Mehsana: { en: 'Mehsana', gu: 'મહેસાણા', hi: 'मेहसाणा', code: 'MEHSANA' },
  Morbi: { en: 'Morbi', gu: 'મોરબી', hi: 'मोरबी', code: 'MORBI' },
  Narmada: { en: 'Narmada', gu: 'નર્મદા', hi: 'नर्मदा', code: 'NARMADA' },
  Navsari: { en: 'Navsari', gu: 'નવસારી', hi: 'नवसारी', code: 'NAVSARI' },
  Panchmahal: { en: 'Panchmahal', gu: 'પંચમહાલ', hi: 'पंचमहाल', code: 'PANCHMAHAL' },
  Patan: { en: 'Patan', gu: 'પાટણ', hi: 'पाटण', code: 'PATAN' },
  Porbandar: { en: 'Porbandar', gu: 'પોરબંદર', hi: 'पोरबंदर', code: 'PORBANDAR' },
  Rajkot: { en: 'Rajkot', gu: 'રાજકોટ', hi: 'राजकोट', code: 'RAJKOT' },
  Sabarkantha: { en: 'Sabarkantha', gu: 'સાબરકાંઠા', hi: 'साबरकांठा', code: 'SABARKANTHA' },
  Surat: { en: 'Surat', gu: 'સુરત', hi: 'सूरत', code: 'SURAT' },
  Surendranagar: { en: 'Surendranagar', gu: 'સુરેન્દ્રનગર', hi: 'सुरेंद्रनगर', code: 'SURENDRANAGAR' },
  Tapi: { en: 'Tapi', gu: 'તાપી', hi: 'तापी', code: 'TAPI' },
  Vadodara: { en: 'Vadodara', gu: 'વડોદરા', hi: 'वडोदरा', code: 'VADODARA' },
  Valsad: { en: 'Valsad', gu: 'વલસાડ', hi: 'वलसाड', code: 'VALSAD' },
  'Vav-Tharad': { en: 'Vav-Tharad', gu: 'વાવ-થરાદ', hi: 'वाव-थराद', code: 'VAV_THARAD' },
};

/**
 * Deterministically resolve a district name in the active language.
 */
export function getLocalizedDistrictName(
  districtInput: any,
  language: SupportedLanguage
): string {
  if (!districtInput) return '';

  let nameEn = '';
  let nameGu = '';
  let nameHi = '';

  if (typeof districtInput === 'string') {
    const trimmed = districtInput.trim();
    // Check lookup
    const lookup = GUJARAT_DISTRICTS_MULTILINGUAL[trimmed];
    if (lookup) {
      return lookup[language] || lookup.en;
    }
    // Try finding by Gujarati or code
    const byGu = Object.values(GUJARAT_DISTRICTS_MULTILINGUAL).find(
      (d) => d.gu === trimmed || d.code === trimmed.toUpperCase() || d.en.toLowerCase() === trimmed.toLowerCase()
    );
    if (byGu) {
      return byGu[language] || byGu.en;
    }
    nameEn = trimmed;
  } else if (typeof districtInput === 'object') {
    nameEn = districtInput.name_en || districtInput.district || districtInput.name || '';
    nameGu = districtInput.name_gu || '';
    nameHi = districtInput.name_hi || '';

    // Check if in master dictionary
    const lookup = GUJARAT_DISTRICTS_MULTILINGUAL[nameEn];
    if (lookup) {
      return lookup[language] || lookup.en;
    }
  }

  if (language === 'hi') {
    return nameHi || nameEn;
  }
  if (language === 'gu') {
    return nameGu || nameEn;
  }
  return nameEn || nameGu || nameHi || '';
}

/**
 * Format a Date string or Date object according to the active locale.
 */
export function formatLocalizedDate(
  dateInput: string | Date | null | undefined,
  language: SupportedLanguage,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const localeMap: Record<SupportedLanguage, string> = {
    gu: 'gu-IN',
    en: 'en-IN',
    hi: 'hi-IN',
  };

  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  try {
    return new Intl.DateTimeFormat(localeMap[language] || 'en-IN', defaultOptions).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format numeric values with proper grouping and format.
 */
export function formatLocalizedNumber(
  num: number | null | undefined,
  language: SupportedLanguage
): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const localeMap: Record<SupportedLanguage, string> = {
    gu: 'gu-IN',
    en: 'en-IN',
    hi: 'hi-IN',
  };
  return new Intl.NumberFormat(localeMap[language] || 'en-IN').format(num);
}
