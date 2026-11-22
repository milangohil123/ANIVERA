/**
 * Gujarati Transliteration Utility
 * Automatically converts English/Latin place names to Gujarati script
 * when Gujarati script is not populated in backend records.
 */

const KNOWN_MAP: Record<string, string> = {
  // Common prefixes/suffixes & village parts
  mota: 'મોટા',
  moti: 'મોટી',
  nana: 'નાના',
  nani: 'નાની',
  gam: 'ગામ',
  pur: 'પુર',
  nagar: 'નગર',
  vav: 'વાવ',
  vishi: 'વીશી',
  vad: 'વાડ',
  kampa: 'કમ્પા',
  pada: 'પાડા',
  padar: 'પાદર',
  dhrol: 'ધ્રોલ',
  jodiya: 'જોડિયા',
  kalavad: 'કાલાવાડ',
  lalpur: 'લાલપુર',
  jamnagar: 'જામનગર',
  jamjodhpur: 'જામજોધપુર',
  gadhada: 'ગઢડા',
  adtala: 'અડતાળા',
  bhimdad: 'ભીમડાડ',
  bodki: 'બોડકી',
  chiroda: 'ચીરોડા',
  chosla: 'ચોસલા',
  derala: 'દેરાળા',
  dhasa: 'ઢસા',
  'dhasa vishi': 'ઢસા વીશી',
  dhasavishi: 'ઢસા વીશી',
  dhrufaniya: 'ધરૂણીયા',
  ghruniya: 'ધરૂણીયા',
  ankadiya: 'અકાડીયા',
  akadiya: 'અકાડીયા',
  bhandariya: 'ભંડારીયા',
  chabhadiya: 'ચબાદીયા',
  chabadiya: 'ચબાદીયા',
  gadhali: 'ગઢાળી',
  gala: 'ગાળા',
  janada: 'જનડા',
  mandavdhar: 'માંડવધાર',
  pipardi: 'પીપરડી',
  samadhiyala: 'સમઢીયાળા',
  raniyala: 'રળીયાણા',
  raliyana: 'રળીયાણા',
  vanali: 'વનાળી',
  kundal: 'કુંડળ',
  'moti kundal': 'મોટી કુંડળ',
  sitapar: 'સીતાપર',
  libdiya: 'લીબડીયા',
  limbdiya: 'લીબડીયા',
  junvader: 'જૂનવદર',
  junavadar: 'જૂનવદર',
  padadar: 'પાડાવદર',
  padavadar: 'પાડાવદર',
  padvadar: 'પડવંદર',
  malpara: 'માલપરા',
  patana: 'પાટણા',
  patan: 'પાટણ',
  khijadiya: 'ખીજડીયા',
  anida: 'અનીડા',
  rasnal: 'રસનાળ',
  mandva: 'માંડવા',
  jalalpur: 'જલાલપુર',
  vikliya: 'વીકળીયા',
  shiyanagar: 'શીયાનગર',
  tatam: 'ટાટમ',
  pipaliya: 'પીપળીયા',
  zhamapar: 'ઝામાપર',
  zamapar: 'ઝામાપર',
  ingorala: 'ઇંગોરાળા',
  'ingorala khalsa': 'ઇંગોરાળા (ખાલસા)',
  'ingorala (khalsa)': 'ઇંગોરાળા (ખાલસા)',
  nigala: 'નીગાળા',
  surka: 'સુરકા',
  sampar: 'સમપર',
  'sampar nana': 'સમપર નાના',
  'sampar mota': 'સમપર મોટા',
  ugamadi: 'ઉગામડી',
  ugamdi: 'ઉગામડી',
  jinjavadar: 'જીંજાવદર',
  ishvariya: 'ઇશ્વરીયા',
  ishwariya: 'ઇશ્વરીયા',
  pipal: 'પીપળ',
  tarana: 'તરાણા',
  lakhanka: 'લખાણકા',
  khopala: 'ખોપાળા',
  virdi: 'વીરડી',
  kapardi: 'કપરડી',
  haripar: 'હરીપર',
  kerala: 'કેરાળા',
  sejmal: 'સેજમળ',
  raypar: 'રાયપર',
  holaya: 'હોળાયા',
  limbani: 'લીંબાણી',
  itariya: 'ઇતરીયા',
  rampara: 'રામપરા',
  vavdi: 'વાવડી',
  gundala: 'ગુંદાલા',
  sajanavadar: 'સાજણાવદર',
  'ghogha samdi': 'ઘોઘા સામડી',
  ghoghasamdi: 'ઘોઘા સામડી',
  limbala: 'લીંબાલા',
  rajpipla: 'રાજપીપળા',
  'mota umarda': 'મોટા ઉમરડા',
  motaumarda: 'મોટા ઉમરડા',
  'nana umarda': 'નાના ઉમરડા',
  nanaumarda: 'નાના ઉમરડા',
  meghvadiya: 'મેઘવડીયા',
  'sangpar nanu': 'સાંગપર નાનુ',
  sangparnanu: 'સાંગપર નાનુ',
  'sangpar motu': 'સાંગપર મોટુ',
  sangparmotu: 'સાંગપર મોટુ',
  goradka: 'ગોરડકા',
  ratanpar: 'રતનપર',
  ratanvav: 'રતનવાવ',
  hamapar: 'હમાપર',
};

const CONSONANTS: Record<string, string> = {
  k: 'ક', kh: 'ખ', g: 'ગ', gh: 'ઘ',
  ch: 'ચ', chh: 'છ', j: 'જ', jh: 'ઝ', z: 'ઝ',
  t: 'ત', th: 'થ', d: 'દ', dh: 'ધ', n: 'ન',
  p: 'પ', ph: 'ફ', f: 'ફ', b: 'બ', bh: 'ભ', m: 'મ',
  y: 'ય', r: 'ર', l: 'લ', v: 'વ', w: 'વ',
  sh: 'શ', s: 'સ', h: 'હ',
};

const VOWEL_SIGNS: Record<string, string> = {
  a: '',
  aa: 'ા',
  i: 'િ',
  ee: 'ી',
  u: 'ુ',
  oo: 'ૂ',
  e: 'ે',
  ai: 'ૈ',
  o: 'ો',
  au: 'ૌ',
};

const INITIAL_VOWELS: Record<string, string> = {
  a: 'અ',
  aa: 'આ',
  i: 'ઇ',
  ee: 'ઈ',
  u: 'ઉ',
  oo: 'ઊ',
  e: 'એ',
  ai: 'ઐ',
  o: 'ઓ',
  au: 'ઔ',
};

export function transliterateToGujarati(text?: string | null): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // If already contains Gujarati script characters, preserve as-is
  if (/[\u0A80-\u0AFF]/.test(trimmed)) {
    return trimmed;
  }

  // Check known words dictionary
  const lower = trimmed.toLowerCase();
  if (KNOWN_MAP[lower]) {
    return KNOWN_MAP[lower];
  }

  // Check composite multi-word
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => transliterateToGujarati(w)).join(' ');
  }

  // Phonetic rule-based transliteration
  let result = '';
  let i = 0;
  const str = lower;
  const len = str.length;

  // Initial vowel check
  for (const v of ['aa', 'ai', 'au', 'ee', 'oo', 'a', 'i', 'u', 'e', 'o']) {
    if (str.startsWith(v)) {
      result += INITIAL_VOWELS[v] || 'અ';
      i += v.length;
      break;
    }
  }

  while (i < len) {
    // Try 3-char, 2-char, 1-char consonants
    let matchedConsonant = '';
    let cLen = 0;

    for (const cl of ['chh', 'sh', 'kh', 'gh', 'ch', 'jh', 'th', 'dh', 'ph', 'bh']) {
      if (str.startsWith(cl, i)) {
        matchedConsonant = CONSONANTS[cl];
        cLen = cl.length;
        break;
      }
    }

    if (!matchedConsonant) {
      const c1 = str[i];
      if (CONSONANTS[c1]) {
        matchedConsonant = CONSONANTS[c1];
        cLen = 1;
      }
    }

    if (matchedConsonant) {
      result += matchedConsonant;
      i += cLen;

      // Check following vowel
      let matchedVowel = '';
      let vLen = 0;
      for (const vl of ['aa', 'ai', 'au', 'ee', 'oo', 'a', 'i', 'u', 'e', 'o']) {
        if (str.startsWith(vl, i)) {
          matchedVowel = VOWEL_SIGNS[vl] ?? '';
          vLen = vl.length;
          break;
        }
      }

      if (vLen > 0) {
        result += matchedVowel;
        i += vLen;
      }
    } else {
      // Non-consonant, punctuation, number or unmapped char
      const char = str[i];
      if (char >= '0' && char <= '9') {
        const gujDigits = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
        result += gujDigits[parseInt(char, 10)];
      } else {
        result += trimmed[i] || char;
      }
      i++;
    }
  }

  return result || trimmed;
}
