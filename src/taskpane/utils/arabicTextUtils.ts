/**
 * Shared utility functions for Arabic text normalization and processing
 */

/**
 * Map of Arabic digits to English digits
 */
const ARABIC_DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/**
 * Normalize Arabic text for comparison by:
 * - Removing invisible formatting characters (BOM, zero-width, directional marks)
 * - Normalizing spaces
 * - Removing tatweel/kashida
 * - Removing diacritics
 * - Normalizing letter variants (alef, yeh, heh, etc.)
 * - Removing punctuation
 * - Converting to lowercase
 */
export function normalizeArabicText(text: string | undefined | null): string {
  if (!text) return "";

  let s = text.toString();

  // Remove BOM and invisible formatting/RTL marks
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, "");

  // Replace special/non-breaking spaces with normal space
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");

  // Remove Arabic tatweel/kashida
  s = s.replace(/\u0640/g, "");

  // Normalize compatibility/composition
  s = s.normalize("NFKC");

  // Remove Arabic diacritics
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");

  // Normalize common Arabic letter variants
  s = s
    .replace(/\u06CC/g, "\u064A") // Persian Yeh -> Arabic Yeh
    .replace(/\u06A9/g, "\u0643") // Keheh -> Kaf
    .replace(/\u06C1/g, "\u0647"); // Heh goal -> Heh

  // Unify alef variants and common letter variants
  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");

  // Replace Lam-Alef ligatures
  s = s.replace(/[\uFEFB-\uFEFE]/g, "لا");

  // Keep only letters/numbers/spaces
  s = s.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ");

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, " ").trim().toLowerCase();

  return s;
}

/**
 * Normalize Arabic numbers to English numbers
 */
export function normalizeArabicNumber(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => ARABIC_DIGIT_MAP[d] || d);
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function editDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * Uses normalized edit distance
 */
export function calculateSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

/**
 * Compare two names with fuzzy matching
 * Returns true if names are similar enough to be considered a match
 */
export function compareNames(
  name1: string,
  name2: string,
  options: {
    baseThreshold?: number;
    shortNameThreshold?: number;
    shortNameMaxLen?: number;
    minContainLen?: number;
  } = {}
): boolean {
  const {
    baseThreshold = 0.82,
    shortNameThreshold = 0.9,
    shortNameMaxLen = 6,
    minContainLen = 3,
  } = options;

  const a = normalizeArabicText(name1);
  const b = normalizeArabicText(name2);

  if (a === b) return true;

  // Quick containment check
  const aNoSpace = a.replace(/\s+/g, "");
  const bNoSpace = b.replace(/\s+/g, "");
  if (aNoSpace.includes(bNoSpace) || bNoSpace.includes(aNoSpace)) {
    if (Math.min(aNoSpace.length, bNoSpace.length) >= minContainLen) return true;
  }

  // Token-sort comparison (order agnostic)
  const tokenSort = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .sort((x, y) => x.localeCompare(y))
      .join(" ");

  const aTok = tokenSort(a);
  const bTok = tokenSort(b);

  const simRaw = calculateSimilarity(a, b);
  const simNoSpace = calculateSimilarity(aNoSpace, bNoSpace);
  const simTok = calculateSimilarity(aTok, bTok);

  // Adaptive thresholding
  let threshold = baseThreshold;
  const minLen = Math.min(a.length, b.length);
  if (minLen <= shortNameMaxLen) threshold = shortNameThreshold;

  // Token overlap check
  const aSet = new Set(a.split(/\s+/).filter(Boolean));
  const bSet = new Set(b.split(/\s+/).filter(Boolean));
  const overlap = [...aSet].filter((t) => bSet.has(t)).length;
  const required = Math.max(1, Math.ceil(Math.min(aSet.size, bSet.size) * 0.6));

  if (overlap >= required && Math.max(aSet.size, bSet.size) >= 2) {
    threshold = Math.min(threshold, 0.78);
  }

  const best = Math.max(simRaw, simNoSpace, simTok);
  return best >= threshold;
}

/**
 * Check if a string contains valid Arabic text
 */
export function hasArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Check if a string is a valid student name
 */
export function isValidStudentName(name: string): boolean {
  if (!name || name.length < 1) return false;

  // Must not be purely numeric
  if (/^\d+([.,]\d+)?$/.test(name.replace(/\s/g, ""))) return false;

  // Must have at least some letter content after cleaning
  const cleaned = name.replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "").trim();
  if (cleaned.length < 1) return false;

  // Must not be only punctuation or symbols
  if (/^[^\u0600-\u06FF\u0041-\u005A\u0061-\u007A\s]+$/.test(name)) return false;

  return true;
}

