import { MarkType } from "../types";

/**
 * Arabic display names for mark types
 */
export const MARK_TYPE_NAMES: Record<MarkType, string> = {
  fard1: "الفرض الأول",
  fard2: "الفرض الثاني",
  fard3: "الفرض الثالث",
  fard4: "الفرض الرابع",
  activities: "الأنشطة",
};

/**
 * Alternative Arabic patterns for each mark type (used for detection in headers)
 */
export const MARK_TYPE_PATTERNS: Record<MarkType, string[]> = {
  fard1: ["الفرض 1", "الفرض الأول", "فرض 1", "فرض الأول", "فرض١", "اختبار 1", "امتحان 1", "تقويم 1"],
  fard2: ["الفرض 2", "الفرض الثاني", "فرض 2", "فرض الثاني", "فرض٢", "اختبار 2", "امتحان 2", "تقويم 2"],
  fard3: ["الفرض 3", "الفرض الثالث", "فرض 3", "فرض الثالث", "فرض٣", "اختبار 3", "امتحان 3", "تقويم 3"],
  fard4: ["الفرض 4", "الفرض الرابع", "فرض 4", "فرض الرابع", "فرض٤", "اختبار 4", "امتحان 4", "تقويم 4"],
  activities: [
    "الأنشطة",
    "النشاط",
    "أنشطة",
    "المهارات",
    "الأداء",
    "نشاط",
    "تطبيقات",
    "مراقبة مستمرة",
    "المراقبة المستمرة",
  ],
};

/**
 * Regex patterns for detecting mark types in text
 */
export const MARK_TYPE_REGEX: Record<MarkType, RegExp> = {
  fard1: /(ال)?فرض\s*(?:1|١|الأول|اول)/,
  fard2: /(ال)?فرض\s*(?:2|٢|الثاني|ثاني)/,
  fard3: /(ال)?فرض\s*(?:3|٣|الثالث|ثالث)/,
  fard4: /(ال)?فرض\s*(?:4|٤|الرابع|رابع)/,
  activities: /الأنشطة|النشاط|المراقبة\s*المستمرة|مراقبة\s*مستمرة|أنشطة/,
};

/**
 * Get mark type name in Arabic
 */
export function getMarkTypeName(markType: MarkType): string {
  return MARK_TYPE_NAMES[markType] || markType;
}

/**
 * Get all mark types as array
 */
export const ALL_MARK_TYPES: MarkType[] = ["fard1", "fard2", "fard3", "fard4", "activities"];

