/**
 * PashuRakshak Botad — Universal Ear Tag Classifier & Data Extractor.
 *
 * Supports scanning and decoding physical ear tags across Gujarat:
 * - Format 1: Unique Identifier / Plain String (e.g., 202412000005, 123456789100, GJ-BTD-2025-001245)
 * - Format 2: URL / Website / App Link (e.g., https://pashurakshak.gujarat.gov.in/animal/123, https://dahd.nic.in/tag?id=...)
 * - Format 3: Structured Animal Data (JSON, XML, Key-Value pairs with species, breed, sex, age, vaccinations)
 * - Format 4: Unknown / Non-standard content
 *
 * All user-facing labels and descriptions are in Gujarati.
 */

export type TagFormatType =
  | 'FORMAT_1_PLAIN'
  | 'FORMAT_2_URL'
  | 'FORMAT_3_STRUCTURED'
  | 'FORMAT_4_UNKNOWN';

export type IdentificationMethod =
  | 'EXISTING_QR'
  | 'EXISTING_BARCODE'
  | 'INTERNAL_QR'
  | 'INTERNAL_BARCODE';

export interface ExtractedVaccination {
  disease: string;
  programmeCode: string;
  date?: string;
  batch?: string;
  source: 'TAG_EXTRACTED';
}

export interface ExtractedAnimalData {
  tagValue?: string;
  speciesCode?: 'CATTLE' | 'BUFFALO' | 'GOAT' | 'SHEEP';
  sex?: 'F' | 'M' | 'UNKNOWN';
  ageMonths?: number;
  birthDate?: string;
  breedName?: string;
  ownerName?: string;
  ownerMobile?: string;
  villageName?: string;
  vaccinations: ExtractedVaccination[];
  extraFields: Record<string, string>;
}

export interface ClassifiedTagResult {
  format: TagFormatType;
  formatNameGu: string;
  formatDescriptionGu: string;
  rawPayload: string;
  candidateTagValue: string;
  isUrl: boolean;
  url?: string;
  domain?: string;
  isOfficialDomain?: boolean;
  domainSecurityNoteGu?: string;
  extractedData?: ExtractedAnimalData;
  detectedBarcodeType?: 'QR_CODE' | 'BARCODE_1D' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Known official government / cooperative domains in India & Gujarat
const OFFICIAL_DOMAINS = [
  'gov.in',
  'nic.in',
  'gujarat.gov.in',
  'botad.nic.in',
  'dahd.nic.in',
  'nddb.coop',
  'amul.com',
  'inaph.nddb.coop',
  'pashurakshak.gujarat.gov.in',
  'pashudhan.gov.in',
];

/**
 * Normalizes species aliases from various systems to PashuRakshak standard species codes.
 */
function normalizeSpecies(raw?: string): 'CATTLE' | 'BUFFALO' | 'GOAT' | 'SHEEP' | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toUpperCase();
  if (['COW', 'CATTLE', 'BOVINE', 'ગાય', 'પશુ', 'GAI'].includes(s)) return 'CATTLE';
  if (['BUFFALO', 'MURRAH', 'JAFFRABADI', 'ભેંસ', 'BHENS'].includes(s)) return 'BUFFALO';
  if (['GOAT', 'CAPRINE', 'બકરી', 'BAKRI'].includes(s)) return 'GOAT';
  if (['SHEEP', 'OVINE', 'ઘેટું', 'ઘેટા', 'GHETU'].includes(s)) return 'SHEEP';
  return undefined;
}

/**
 * Normalizes sex indicators to standard 'F' | 'M' | 'UNKNOWN'.
 */
function normalizeSex(raw?: string): 'F' | 'M' | 'UNKNOWN' {
  if (!raw) return 'UNKNOWN';
  const s = raw.trim().toUpperCase();
  if (['F', 'FEMALE', 'માદા', 'સ્ત્રી'].includes(s)) return 'F';
  if (['M', 'MALE', 'નર', 'પુરુષ'].includes(s)) return 'M';
  return 'UNKNOWN';
}

/**
 * Maps disease names or codes from external tags to standard programme codes.
 */
function normalizeDiseaseCode(raw?: string): string {
  if (!raw) return 'FMD';
  const s = raw.trim().toUpperCase();
  if (s.includes('FMD') || s.includes('ખરવા')) return 'FMD';
  if (s.includes('HS') || s.includes('ગળસૂંઠો') || s.includes('HAEMORRHAGIC')) return 'HS';
  if (s.includes('BQ') || s.includes('ગાઠીયો') || s.includes('BLACK')) return 'BQ';
  if (s.includes('BRUCELL') || s.includes('બ્રુસેલા')) return 'BRUCELLOSIS';
  if (s.includes('PPR') || s.includes('પીપીઆર')) return 'PPR';
  if (s.includes('LSD') || s.includes('LUMPY') || s.includes('લમ્પી')) return 'LSD';
  if (s.includes('RABIES') || s.includes('હડકવા')) return 'RABIES';
  return s;
}

/**
 * Safely parses JSON strings.
 */
function tryParseJson(text: string): Record<string, any> | null {
  try {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Parses key-value structured text lines (e.g. "TAG: 202412000005\nSPECIES: COW").
 */
function parseKeyValueText(text: string): Record<string, string> | null {
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const result: Record<string, string> = {};
  let matchCount = 0;

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    const eqIdx = line.indexOf('=');
    const separatorIdx = colonIdx !== -1 ? colonIdx : eqIdx;

    if (separatorIdx > 0 && separatorIdx < line.length - 1) {
      const key = line.substring(0, separatorIdx).trim().toUpperCase();
      const value = line.substring(separatorIdx + 1).trim();
      if (key.length <= 30 && value.length > 0) {
        result[key] = value;
        matchCount++;
      }
    }
  }

  return matchCount >= 2 ? result : null;
}

/**
 * Extracts candidate tag identifier from a URL path or query parameters.
 */
function extractCandidateIdFromUrl(urlStr: string): { candidateId: string; domain: string; isOfficial: boolean } {
  let domain = '';
  let isOfficial = false;
  let candidateId = '';

  try {
    const urlObj = new URL(urlStr);
    domain = urlObj.hostname.toLowerCase();
    isOfficial = OFFICIAL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));

    // 1. Try URL Query parameters first
    const queryKeys = ['tag', 'id', 'tag_id', 'tagId', 'animal_id', 'animalId', 'code', 'token', 'ref', 'pashu'];
    for (const k of queryKeys) {
      const val = urlObj.searchParams.get(k);
      if (val && val.trim().length >= 4) {
        candidateId = val.trim();
        break;
      }
    }

    // 2. If no query param found, try the last pathname segment
    if (!candidateId) {
      const segments = urlObj.pathname.split('/').map((s) => s.trim()).filter(Boolean);
      if (segments.length > 0) {
        let lastSegment = segments[segments.length - 1];
        // Strip file extensions like .html, .php, .jsp, .json
        lastSegment = lastSegment.replace(/\.(html|htm|php|jsp|json|xml)$/i, '');
        if (lastSegment.length >= 4) {
          candidateId = decodeURIComponent(lastSegment);
        }
      }
    }
  } catch {
    // If not standard URL parser, fallback regex
    const domainMatch = urlStr.match(/https?:\/\/([^\/?#]+)/i);
    if (domainMatch) {
      domain = domainMatch[1].toLowerCase();
      isOfficial = OFFICIAL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
    }
    const idMatch = urlStr.match(/([A-Z0-9_-]{5,32})(?:[?#]|$)/i);
    if (idMatch) {
      candidateId = idMatch[1];
    }
  }

  return { candidateId, domain, isOfficial };
}

/**
 * Universal Classifier Function.
 * Accepts raw text from physical QR, Barcode, Image Scan, or Manual Input.
 */
export function classifyScannedTag(rawInput: string, hintBarcodeType?: 'QR_CODE' | 'BARCODE_1D'): ClassifiedTagResult {
  const trimmed = (rawInput || '').trim();

  if (!trimmed) {
    return {
      format: 'FORMAT_4_UNKNOWN',
      formatNameGu: 'ખાલી ઇનપુટ',
      formatDescriptionGu: 'કોઈ ડેટા મળ્યો નથી',
      rawPayload: '',
      candidateTagValue: '',
      isUrl: false,
      confidence: 'LOW',
    };
  }

  // ---------------------------------------------------------
  // FORMAT 2: URL / Website Link
  // ---------------------------------------------------------
  const isUrlPattern = /^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,}\/)/i.test(trimmed);
  if (isUrlPattern || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const { candidateId, domain, isOfficial } = extractCandidateIdFromUrl(fullUrl);

    return {
      format: 'FORMAT_2_URL',
      formatNameGu: 'વેબ લિંક / પોર્ટલ URL',
      formatDescriptionGu: isOfficial
        ? 'અધિકૃત સરકારી / પશુપાલન પોર્ટલ લિંક'
        : 'બાહ્ય વેબસાઇટ લિંક',
      rawPayload: trimmed,
      candidateTagValue: candidateId || trimmed,
      isUrl: true,
      url: fullUrl,
      domain,
      isOfficialDomain: isOfficial,
      domainSecurityNoteGu: isOfficial
        ? 'અધિકૃત સંસ્થાકીય લિંક ઓળખાઈ છે. નીચે આપેલી "Link ખોલો" બટન દ્વારા ચકાસી શકો છો.'
        : 'આ અજાણી બાહ્ય વેબસાઇટ લિંક છે. કૃપા કરીને ટેગ નંબર ધ્યાનપૂર્વક ચકાસો.',
      detectedBarcodeType: hintBarcodeType || 'QR_CODE',
      confidence: candidateId ? 'HIGH' : 'MEDIUM',
    };
  }

  // ---------------------------------------------------------
  // FORMAT 3: Structured Data (JSON or Key-Value text)
  // ---------------------------------------------------------
  const jsonObj = tryParseJson(trimmed);
  const kvObj = !jsonObj ? parseKeyValueText(trimmed) : null;

  if (jsonObj || kvObj) {
    const dataObj = jsonObj || kvObj || {};
    const extracted: ExtractedAnimalData = {
      vaccinations: [],
      extraFields: {},
    };

    // Extract tag ID from various possible property names
    const tagKeys = [
      'tag',
      'tag_id',
      'tagId',
      'tag_number',
      'tagNumber',
      'tag_no',
      'tagno',
      'animal_id',
      'animalId',
      'id',
      'code',
      'ear_tag',
      'eartag',
      'earTag',
      'rfid',
      'uid',
      'barcode',
      'qr',
      'token',
    ];
    for (const k of tagKeys) {
      for (const objKey of Object.keys(dataObj)) {
        if (objKey.toLowerCase() === k.toLowerCase() && dataObj[objKey]) {
          extracted.tagValue = String(dataObj[objKey]).trim();
          break;
        }
      }
      if (extracted.tagValue) break;
    }

    // Extract species
    const speciesKeys = ['species', 'species_code', 'animal_type', 'type', 'જાતિ'];
    for (const k of speciesKeys) {
      for (const objKey of Object.keys(dataObj)) {
        if (objKey.toLowerCase() === k.toLowerCase() && dataObj[objKey]) {
          extracted.speciesCode = normalizeSpecies(String(dataObj[objKey]));
          break;
        }
      }
      if (extracted.speciesCode) break;
    }

    // Extract sex
    const sexKeys = ['sex', 'gender', 'લિંગ'];
    for (const k of sexKeys) {
      for (const objKey of Object.keys(dataObj)) {
        if (objKey.toLowerCase() === k.toLowerCase() && dataObj[objKey]) {
          extracted.sex = normalizeSex(String(dataObj[objKey]));
          break;
        }
      }
      if (extracted.sex && extracted.sex !== 'UNKNOWN') break;
    }

    // Extract age / DOB
    const ageKeys = ['age', 'age_months', 'age_months_estimate', 'months', 'ઉંમર'];
    for (const k of ageKeys) {
      for (const objKey of Object.keys(dataObj)) {
        if (objKey.toLowerCase() === k.toLowerCase() && dataObj[objKey] != null) {
          const num = parseInt(String(dataObj[objKey]).replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > 0) {
            extracted.ageMonths = num;
            break;
          }
        }
      }
      if (extracted.ageMonths) break;
    }

    // Extract breed
    const breedKeys = ['breed', 'breed_name', 'નસલ'];
    for (const k of breedKeys) {
      for (const objKey of Object.keys(dataObj)) {
        if (objKey.toLowerCase() === k.toLowerCase() && dataObj[objKey]) {
          extracted.breedName = String(dataObj[objKey]).trim();
          break;
        }
      }
      if (extracted.breedName) break;
    }

    // Extract owner
    const ownerKeys = ['owner', 'farmer', 'farmer_name', 'owner_name', 'ખેડૂત'];
    for (const k of ownerKeys) {
      for (const objKey of Object.keys(dataObj)) {
        if (objKey.toLowerCase() === k.toLowerCase() && dataObj[objKey]) {
          extracted.ownerName = String(dataObj[objKey]).trim();
          break;
        }
      }
      if (extracted.ownerName) break;
    }

    // Extract vaccines if array present in JSON
    if (jsonObj && Array.isArray(jsonObj.vaccines || jsonObj.vaccinations || jsonObj.history)) {
      const list = jsonObj.vaccines || jsonObj.vaccinations || jsonObj.history;
      for (const item of list) {
        if (item && typeof item === 'object') {
          const diseaseName = item.disease || item.name || item.programme || 'FMD';
          extracted.vaccinations.push({
            disease: diseaseName,
            programmeCode: normalizeDiseaseCode(diseaseName),
            date: item.date || item.vaccinated_on || undefined,
            batch: item.batch || item.batch_number || undefined,
            source: 'TAG_EXTRACTED',
          });
        }
      }
    }

    // Store remaining fields for inspection
    for (const [key, val] of Object.entries(dataObj)) {
      if (val != null && typeof val !== 'object') {
        extracted.extraFields[key] = String(val);
      }
    }

    return {
      format: 'FORMAT_3_STRUCTURED',
      formatNameGu: 'સંરચિત પશુ માહિતી (JSON/Key-Value)',
      formatDescriptionGu: 'ટેગમાં પશુની જાતિ, લિંગ અથવા રસીકરણ જેવી વિગતો સમાવિષ્ટ છે.',
      rawPayload: trimmed,
      candidateTagValue: extracted.tagValue || trimmed,
      isUrl: false,
      extractedData: extracted,
      detectedBarcodeType: hintBarcodeType || 'QR_CODE',
      confidence: extracted.tagValue ? 'HIGH' : 'MEDIUM',
    };
  }

  // ---------------------------------------------------------
  // FORMAT 1: Plain Identifier / Alphanumeric String
  // (e.g. 202412000005, 123456789100, GJ-BTD-001245, ANM-BOT-000004)
  // ---------------------------------------------------------
  // Match clean ID string: numbers, letters, dashes, underscores, length 4 to 36
  const isPlainIdentifier = /^[A-Za-z0-9\-_]{4,36}$/.test(trimmed);
  if (isPlainIdentifier) {
    const isPureDigits = /^\d+$/.test(trimmed);
    const isBarcode1D = hintBarcodeType === 'BARCODE_1D' || (isPureDigits && trimmed.length >= 8 && trimmed.length <= 16);

    return {
      format: 'FORMAT_1_PLAIN',
      formatNameGu: isBarcode1D ? 'ભૌતિક ટેગ બારકોડ નંબર' : 'સરળ ઓળખ નંબર / યુનિક આઈડી',
      formatDescriptionGu: isPureDigits
        ? `અંક આધારિત ભૌતિક ટેગ નંબર (${trimmed.length} અંક)`
        : 'આલ્ફાન્યૂમેરિક ઓળખ ક્રમાંક',
      rawPayload: trimmed,
      candidateTagValue: trimmed,
      isUrl: false,
      detectedBarcodeType: isBarcode1D ? 'BARCODE_1D' : (hintBarcodeType || 'QR_CODE'),
      confidence: 'HIGH',
    };
  }

  // ---------------------------------------------------------
  // FORMAT 4: Unknown / Non-standard content
  // ---------------------------------------------------------
  // Look for any continuous alphanumeric sequence that might be a tag ID
  const candidateMatch = trimmed.match(/[A-Za-z0-9\-_]{6,26}/);
  const guessedId = candidateMatch ? candidateMatch[0] : '';

  return {
    format: 'FORMAT_4_UNKNOWN',
    formatNameGu: 'બિન-પ્રમાણભૂત લખાણ / અન્ય ટેક્સ્ટ',
    formatDescriptionGu: 'ટેગમાં મુક્ત લખાણ અથવા વિશિષ્ટ ફોર્મેટ સમાવિષ્ટ છે.',
    rawPayload: trimmed,
    candidateTagValue: guessedId,
    isUrl: false,
    detectedBarcodeType: hintBarcodeType || 'UNKNOWN',
    confidence: guessedId ? 'MEDIUM' : 'LOW',
  };
}

/**
 * Standard Gujarat animal breeds mapped by species for convenient selection.
 */
export const GUJARAT_BREEDS_BY_SPECIES: Record<string, Array<{ code: string; nameGu: string; nameEn: string }>> = {
  CATTLE: [
    { code: 'GIR', nameGu: 'ગીર (Gir)', nameEn: 'Gir' },
    { code: 'KANKREJ', nameGu: 'કાંકરેજ (Kankrej)', nameEn: 'Kankrej' },
    { code: 'DANGI', nameGu: 'ડાંગી (Dangi)', nameEn: 'Dangi' },
    { code: 'CROSSBREED_HF', nameGu: 'ક્રોસબ્રીડ એચ.એફ. (HF Cross)', nameEn: 'Crossbreed HF' },
    { code: 'CROSSBREED_JERSEY', nameGu: 'ક્રોસબ્રીડ જર્સી (Jersey Cross)', nameEn: 'Crossbreed Jersey' },
    { code: 'NON_DESCRIPT', nameGu: 'દેશી / બિન-વર્ણવેલ (Non-Descript)', nameEn: 'Non-Descript' },
  ],
  BUFFALO: [
    { code: 'JAFFRABADI', nameGu: 'જાફરાબાદી (Jaffrabadi)', nameEn: 'Jaffrabadi' },
    { code: 'BANNI', nameGu: 'બન્ની / કચ્છી (Banni)', nameEn: 'Banni' },
    { code: 'MEHSANA', nameGu: 'મહેસાણી (Mehsana)', nameEn: 'Mehsana' },
    { code: 'SURTI', nameGu: 'સુરતી (Surti)', nameEn: 'Surti' },
    { code: 'MURRAH', nameGu: 'મુર્રાહ (Murrah)', nameEn: 'Murrah' },
    { code: 'NON_DESCRIPT', nameGu: 'દેશી / સ્થાનિક (Local)', nameEn: 'Non-Descript' },
  ],
  GOAT: [
    { code: 'ZALAWADI', nameGu: 'ઝાલાવાડી (Zalawadi)', nameEn: 'Zalawadi' },
    { code: 'GOHILWADI', nameGu: 'ગોહિલવાડી (Gohilwadi)', nameEn: 'Gohilwadi' },
    { code: 'SURTI_GOAT', nameGu: 'સુરતી બકરી (Surti)', nameEn: 'Surti' },
    { code: 'KACHCHHI_GOAT', nameGu: 'કચ્છી બકરી (Kachchhi)', nameEn: 'Kachchhi' },
    { code: 'NON_DESCRIPT', nameGu: 'દેશી બકરી (Local)', nameEn: 'Non-Descript' },
  ],
  SHEEP: [
    { code: 'PATANWADI', nameGu: 'પાટણવાડી (Patanwadi)', nameEn: 'Patanwadi' },
    { code: 'MARWARI', nameGu: 'મારવાડી (Marwari)', nameEn: 'Marwari' },
    { code: 'NON_DESCRIPT', nameGu: 'દેશી ઘેટું (Local)', nameEn: 'Non-Descript' },
  ],
};

/**
 * Standard Diseases for Previous Vaccination Collection.
 */
export const STANDARD_VACCINATION_DISEASES = [
  { code: 'FMD', nameGu: 'ખરવા-મોવાસા (FMD)', typicalIntervalMonths: 6 },
  { code: 'HS', nameGu: 'ગળસૂંઠો (HS)', typicalIntervalMonths: 12 },
  { code: 'BQ', nameGu: 'ગાઠીયો તાવ (BQ)', typicalIntervalMonths: 12 },
  { code: 'BRUCELLOSIS', nameGu: 'બ્રુસેલોસિસ (Brucellosis)', typicalIntervalMonths: 0 },
  { code: 'PPR', nameGu: 'પીપીઆર (PPR - ઘેટાં/બકરાં)', typicalIntervalMonths: 36 },
  { code: 'LSD', nameGu: 'લમ્પી સ્કીન ડીસીઝ (LSD)', typicalIntervalMonths: 12 },
  { code: 'RABIES', nameGu: 'હડકવા (Rabies)', typicalIntervalMonths: 12 },
];

