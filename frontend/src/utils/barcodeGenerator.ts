/**
 * PashuRakshak Botad — Standards-Compliant ISO/IEC 15417 Code 128 1D Barcode Generator.
 *
 * Implements high-density 1D linear barcode generation for animal ear tags and logistics:
 * - Code 128 Subset B: standard ASCII (alphanumeric, dashes, colons, underscores).
 * - Code 128 Subset C: high-density double-digit pairs for 10/12-digit numeric tags (e.g. Bharat Pashudhan).
 * - Automatic checksum calculation (mod 103).
 * - Crisp horizontal rectangular SVG generation with quiet zones and human-readable text label.
 * - 100% scannable by physical 1D laser scanners, smartphone cameras, html5-qrcode, and ZXing.
 */

// Canonical Code 128 pattern table (107 patterns: 0..106)
// Each array of 6 numbers defines widths of [bar1, space1, bar2, space2, bar3, space3] (sum = 11 modules)
// Stop pattern (106) has 7 numbers [bar1, space1, bar2, space2, bar3, space3, bar4] (sum = 13 modules)
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0: ' ' / 00
  [2, 2, 2, 1, 2, 2], // 1: '!' / 01
  [2, 2, 2, 2, 2, 1], // 2: '"' / 02
  [1, 2, 1, 2, 2, 3], // 3: '#' / 03
  [1, 2, 1, 3, 2, 2], // 4: '$' / 04
  [1, 3, 1, 2, 2, 2], // 5: '%' / 05
  [1, 2, 2, 2, 1, 3], // 6: '&' / 06
  [1, 2, 2, 3, 1, 2], // 7: '\'' / 07
  [1, 3, 2, 2, 1, 2], // 8: '(' / 08
  [2, 2, 1, 2, 1, 3], // 9: ')' / 09
  [2, 2, 1, 3, 1, 2], // 10: '*' / 10
  [2, 3, 1, 2, 1, 2], // 11: '+' / 11
  [1, 1, 2, 2, 3, 2], // 12: ',' / 12
  [1, 2, 2, 1, 3, 2], // 13: '-' / 13
  [1, 2, 2, 2, 3, 1], // 14: '.' / 14
  [1, 1, 3, 2, 2, 2], // 15: '/' / 15
  [1, 2, 3, 1, 2, 2], // 16: '0' / 16
  [1, 2, 3, 2, 2, 1], // 17: '1' / 17
  [2, 2, 3, 2, 1, 1], // 18: '2' / 18
  [2, 2, 1, 1, 3, 2], // 19: '3' / 19
  [2, 2, 1, 2, 3, 1], // 20: '4' / 20
  [2, 1, 3, 2, 1, 2], // 21: '5' / 21
  [2, 2, 3, 1, 1, 2], // 22: '6' / 22
  [3, 1, 2, 1, 3, 1], // 23: '7' / 23
  [3, 1, 1, 2, 2, 2], // 24: '8' / 24
  [3, 2, 1, 1, 2, 2], // 25: '9' / 25
  [3, 2, 1, 2, 2, 1], // 26: ':' / 26
  [3, 1, 2, 2, 1, 2], // 27: ';' / 27
  [3, 2, 2, 1, 1, 2], // 28: '<' / 28
  [3, 2, 2, 2, 1, 1], // 29: '=' / 29
  [2, 1, 2, 1, 2, 3], // 30: '>' / 30
  [2, 1, 2, 3, 2, 1], // 31: '?' / 31
  [2, 3, 2, 1, 2, 1], // 32: '@' / 32
  [1, 1, 1, 3, 2, 3], // 33: 'A' / 33
  [1, 3, 1, 1, 2, 3], // 34: 'B' / 34
  [1, 3, 1, 3, 2, 1], // 35: 'C' / 35
  [1, 1, 2, 3, 1, 3], // 36: 'D' / 36
  [1, 3, 2, 1, 1, 3], // 37: 'E' / 37
  [1, 3, 2, 3, 1, 1], // 38: 'F' / 38
  [2, 1, 1, 3, 1, 3], // 39: 'G' / 39
  [2, 3, 1, 1, 1, 3], // 40: 'H' / 40
  [2, 3, 1, 3, 1, 1], // 41: 'I' / 41
  [1, 1, 2, 1, 3, 3], // 42: 'J' / 42
  [1, 1, 2, 3, 3, 1], // 43: 'K' / 43
  [1, 3, 2, 1, 3, 1], // 44: 'L' / 44
  [1, 1, 3, 1, 2, 3], // 45: 'M' / 45
  [1, 1, 3, 3, 2, 1], // 46: 'N' / 46
  [1, 3, 3, 1, 2, 1], // 47: 'O' / 47
  [3, 1, 3, 1, 2, 1], // 48: 'P' / 48
  [2, 1, 1, 3, 3, 1], // 49: 'Q' / 49
  [2, 3, 1, 1, 3, 1], // 50: 'R' / 50
  [2, 1, 3, 1, 1, 3], // 51: 'S' / 51
  [2, 1, 3, 3, 1, 1], // 52: 'T' / 52
  [2, 1, 3, 1, 3, 1], // 53: 'U' / 53
  [3, 1, 1, 1, 2, 3], // 54: 'V' / 54
  [3, 1, 1, 3, 2, 1], // 55: 'W' / 55
  [3, 3, 1, 1, 2, 1], // 56: 'X' / 56
  [3, 1, 2, 1, 1, 3], // 57: 'Y' / 57
  [3, 1, 2, 3, 1, 1], // 58: 'Z' / 58
  [3, 3, 2, 1, 1, 1], // 59: '[' / 59
  [3, 1, 4, 1, 1, 1], // 60: '\\' / 60
  [2, 2, 1, 4, 1, 1], // 61: ']' / 61
  [4, 3, 1, 1, 1, 1], // 62: '^' / 62
  [1, 1, 1, 2, 2, 4], // 63: '_' / 63
  [1, 1, 1, 4, 2, 2], // 64: '`' / 64
  [1, 2, 1, 1, 2, 4], // 65: 'a' / 65
  [1, 2, 1, 4, 2, 1], // 66: 'b' / 66
  [1, 4, 1, 1, 2, 2], // 67: 'c' / 67
  [1, 4, 1, 2, 2, 1], // 68: 'd' / 68
  [1, 1, 2, 2, 1, 4], // 69: 'e' / 69
  [1, 1, 2, 4, 1, 2], // 70: 'f' / 70
  [1, 2, 2, 1, 1, 4], // 71: 'g' / 71
  [1, 2, 2, 4, 1, 1], // 72: 'h' / 72
  [1, 4, 2, 1, 1, 2], // 73: 'i' / 73
  [1, 4, 2, 2, 1, 1], // 74: 'j' / 74
  [2, 4, 1, 2, 1, 1], // 75: 'k' / 75
  [2, 2, 1, 1, 1, 4], // 76: 'l' / 76
  [4, 1, 3, 1, 1, 1], // 77: 'm' / 77
  [2, 4, 1, 1, 1, 2], // 78: 'n' / 78
  [1, 3, 4, 1, 1, 1], // 79: 'o' / 79
  [1, 1, 1, 2, 4, 2], // 80: 'p' / 80
  [1, 2, 1, 1, 4, 2], // 81: 'q' / 81
  [1, 2, 1, 2, 4, 1], // 82: 'r' / 82
  [1, 1, 4, 2, 1, 2], // 83: 's' / 83
  [1, 2, 4, 1, 1, 2], // 84: 't' / 84
  [1, 2, 4, 2, 1, 1], // 85: 'u' / 85
  [4, 1, 1, 2, 1, 2], // 86: 'v' / 86
  [4, 2, 1, 1, 1, 2], // 87: 'w' / 87
  [4, 2, 1, 2, 1, 1], // 88: 'x' / 88
  [2, 1, 2, 1, 4, 1], // 89: 'y' / 89
  [2, 1, 4, 1, 2, 1], // 90: 'z' / 90
  [4, 1, 2, 1, 2, 1], // 91: '{' / 91
  [1, 1, 1, 1, 4, 3], // 92: '|' / 92
  [1, 1, 1, 3, 4, 1], // 93: '}' / 93
  [1, 3, 1, 1, 4, 1], // 94: '~' / 94
  [1, 1, 4, 1, 1, 3], // 95: DEL / 95
  [1, 1, 4, 3, 1, 1], // 96: FNC3 / 96
  [4, 1, 1, 1, 1, 3], // 97: FNC2 / 97
  [4, 1, 1, 3, 1, 1], // 98: SHIFT / 98
  [1, 1, 3, 1, 4, 1], // 99: CODE_C / 99
  [1, 1, 4, 1, 3, 1], // 100: CODE_B / 100
  [3, 1, 1, 1, 4, 1], // 101: CODE_A / 101
  [4, 1, 1, 1, 3, 1], // 102: FNC1 / 102
  [2, 1, 1, 4, 1, 2], // 103: START_A / 103
  [2, 1, 1, 2, 1, 4], // 104: START_B / 104
  [2, 1, 1, 2, 3, 2], // 105: START_C / 105
  [2, 3, 3, 1, 1, 1, 2], // 106: STOP / 106 (13 modules)
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

export interface BarcodeOptions {
  barWidth?: number; // Width of a single module in px (default 2)
  barHeight?: number; // Height of bars in px (default 75)
  quietZone?: number; // Margin on left and right in px (default 20)
  topPadding?: number; // Padding at top in px (default 12)
  showText?: boolean; // Show human readable text underneath (default true)
  fontSize?: number; // Font size of text in px (default 13)
  textMargin?: number; // Spacing between bars and text in px (default 14)
  label?: string; // Custom label under barcode (defaults to value)
  color?: string; // Bar color (default '#000000')
  background?: string; // Background color (default '#ffffff')
}

/**
 * Encodes input string into Code 128 integer symbol indices.
 * Uses Subset C for even-length pure numeric strings (high density, e.g. 12-digit Bharat Pashudhan),
 * and Subset B for alphanumeric strings (e.g. ANM-BOT-000004, GJ-BTD-2025-001).
 */
function encodeCode128Symbols(value: string): number[] {
  const isPureDigits = /^\d+$/.test(value);
  const useSubsetC = isPureDigits && value.length % 2 === 0 && value.length >= 4;

  const symbols: number[] = [];

  if (useSubsetC) {
    // START C
    symbols.push(START_C);
    let checksum = START_C;

    for (let i = 0; i < value.length; i += 2) {
      const pair = parseInt(value.substring(i, i + 2), 10);
      symbols.push(pair);
      const position = symbols.length - 1; // 1-indexed for checksum
      checksum += pair * position;
    }

    checksum = checksum % 103;
    symbols.push(checksum);
    symbols.push(STOP);
  } else {
    // START B
    symbols.push(START_B);
    let checksum = START_B;

    for (let i = 0; i < value.length; i++) {
      let code = value.charCodeAt(i) - 32;
      if (code < 0 || code > 95) {
        // Fallback for out-of-range ASCII characters: replace with '?' (31)
        code = 31;
      }
      symbols.push(code);
      const position = symbols.length - 1; // 1-indexed
      checksum += code * position;
    }

    checksum = checksum % 103;
    symbols.push(checksum);
    symbols.push(STOP);
  }

  return symbols;
}

/**
 * Converts Code 128 symbols into binary module widths (bars and spaces).
 */
function symbolsToModules(symbols: number[]): boolean[] {
  const modules: boolean[] = [];

  for (let sIdx = 0; sIdx < symbols.length; sIdx++) {
    const symbolCode = symbols[sIdx];
    const pattern = CODE128_PATTERNS[symbolCode];
    if (!pattern) continue;

    let isBar = true;
    for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
      const width = pattern[pIdx];
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
      isBar = !isBar;
    }
  }

  return modules;
}

/**
 * Generates a clean, horizontally rectangular Code 128 1D Barcode SVG string.
 *
 * @param value Alphanumeric or numeric code to encode (e.g. "ANM-BOT-000004" or "202412000005")
 * @param options Styling and layout options
 */
export function generateBarcodeSvgString(value: string, options: BarcodeOptions = {}): string {
  const cleanValue = (value || '').trim() || 'ANM-000000';
  const barWidth = options.barWidth ?? 2;
  const barHeight = options.barHeight ?? 75;
  const quietZone = options.quietZone ?? 20;
  const topPadding = options.topPadding ?? 12;
  const showText = options.showText ?? true;
  const fontSize = options.fontSize ?? 13;
  const textMargin = options.textMargin ?? 16;
  const label = options.label ?? cleanValue;
  const color = options.color ?? '#000000';
  const background = options.background ?? '#ffffff';

  const symbols = encodeCode128Symbols(cleanValue);
  const modules = symbolsToModules(symbols);

  const barcodeContentWidth = modules.length * barWidth;
  const totalWidth = barcodeContentWidth + quietZone * 2;
  const textHeight = showText ? fontSize + textMargin : 0;
  const totalHeight = topPadding + barHeight + textHeight + 8;

  // Build rectangular SVG paths for bars
  const rects: string[] = [];
  let currentX = quietZone;
  let inBar = false;
  let barStart = currentX;

  for (let i = 0; i < modules.length; i++) {
    const isBar = modules[i];
    if (isBar && !inBar) {
      inBar = true;
      barStart = quietZone + i * barWidth;
    } else if (!isBar && inBar) {
      inBar = false;
      const width = quietZone + i * barWidth - barStart;
      rects.push(
        `<rect x="${barStart}" y="${topPadding}" width="${width}" height="${barHeight}" fill="${color}" />`
      );
    }
  }
  // Flush trailing bar
  if (inBar) {
    const width = quietZone + modules.length * barWidth - barStart;
    rects.push(
      `<rect x="${barStart}" y="${topPadding}" width="${width}" height="${barHeight}" fill="${color}" />`
    );
  }

  // Human-readable text label
  let textElem = '';
  if (showText) {
    const textY = topPadding + barHeight + textMargin;
    textElem = `<text x="${totalWidth / 2}" y="${textY}" text-anchor="middle" font-family="'JetBrains Mono', 'Fira Code', 'Courier New', monospace" font-size="${fontSize}" font-weight="700" fill="${color}" letter-spacing="2">${escapeXml(
      label
    )}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background-color: ${background}; max-width: 100%; height: auto; display: block;" role="img" aria-label="Barcode for ${escapeXml(
    cleanValue
  )}">
  <rect width="100%" height="100%" fill="${background}" />
  <g class="barcode-bars">
    ${rects.join('\n    ')}
  </g>
  ${textElem}
</svg>`;
}

/**
 * Generates an SVG Data URL (data:image/svg+xml;utf8,...) for inline image tags.
 */
export function generateBarcodeDataUrl(value: string, options: BarcodeOptions = {}): string {
  const svg = generateBarcodeSvgString(value, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Escapes XML/SVG special characters.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
