/* global console */

import { Student, DetectedMarkTypes, StudentUncertainty } from "../../types";
import { normalizeArabicNumber, isValidStudentName } from "../../utils/arabicTextUtils";
import { logger } from "./logger";

/**
 * Extraction Helpers
 * Contains helper methods for student data extraction from OCR text
 */

/**
 * Advanced header structure analysis
 */
export function analyzeHeaderStructure(lines: string[]): {
  headerRowIndex: number;
  columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
  markColumnMapping: Record<string, keyof Student["marks"]>;
} | null {
  // Look for header row in first 15 lines
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    if (isAdvancedHeaderRow(line)) {
      const columnStructure = analyzeColumnStructure(line);
      const markColumnMapping = createMarkColumnMapping(columnStructure);

      if (columnStructure.length >= 3) {
        return { headerRowIndex: i, columnStructure, markColumnMapping };
      }
    }
  }

  return null;
}

/**
 * Find all header sections throughout the document
 */
export function analyzeAllHeaderSections(lines: string[]): Array<{
  headerRowIndex: number;
  columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
  markColumnMapping: Record<string, keyof Student["marks"]>;
}> {
  const analyses: Array<{
    headerRowIndex: number;
    columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
    markColumnMapping: Record<string, keyof Student["marks"]>;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    if (!isAdvancedHeaderRow(line)) continue;
    
    const columnStructure = analyzeColumnStructure(line);
    const markColumnMapping = createMarkColumnMapping(columnStructure);
    
    if (columnStructure.length >= 3) {
      // Avoid adding duplicate headers very close to each other
      if (analyses.length === 0 || i - analyses[analyses.length - 1].headerRowIndex > 2) {
        analyses.push({ headerRowIndex: i, columnStructure, markColumnMapping });
      }
    }
  }
  
  return analyses;
}

/**
 * Enhanced header row detection
 */
export function isAdvancedHeaderRow(line: string): boolean {
  const headerPatterns = [
    /اسم.*الفرض|الفرض.*اسم/,
    /التلميذ.*الفرض|الفرض.*التلميذ/,
    /رقم.*اسم.*الفرض/,
    /الاسم.*الفرض.*الأنشطة/,
    /name.*fard|fard.*name/,
    /student.*mark|mark.*student/,
    /رقم|الاسم|الفرض|الأنشطة/,
    /number|name|fard|activities/,
  ];

  const hasHeaderPattern = headerPatterns.some((pattern) => pattern.test(line));
  const hasMultipleColumns = line.split(/[\s\t|،]+/).filter((col) => col.trim().length > 0).length >= 3;

  return hasHeaderPattern && hasMultipleColumns;
}

/**
 * Analyze column structure with type detection
 */
export function analyzeColumnStructure(
  headerRow: string
): Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }> {
  const columns = headerRow
    .split(/[\s\t|،]+/)
    .map((col) => col.trim())
    .filter((col) => col.length > 0);

  return columns.map((col, index) => {
    let type: "number" | "name" | "mark" | "unknown" = "unknown";

    if (/رقم|الرقم|number/i.test(col)) {
      type = "number";
    } else if (/اسم|الاسم|التلميذ|name|student/i.test(col)) {
      type = "name";
    } else if (/الفرض|الأنشطة|fard|activities/i.test(col)) {
      type = "mark";
    }

    return { index, title: col, type };
  });
}

/**
 * Create mapping between column titles and mark types
 */
export function createMarkColumnMapping(
  columnStructure: Array<{ index: number; title: string; type: string }>
): Record<string, keyof Student["marks"]> {
  const mapping: Record<string, keyof Student["marks"]> = {};

  columnStructure.forEach(({ title }) => {
    const normalizedTitle = title
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي");

    if (/الفرض1|الفرض١|فرض1|فرض١|fard1|الاول|الأول/.test(normalizedTitle)) {
      mapping[title] = "fard1";
    } else if (/الفرض2|الفرض٢|فرض2|فرض٢|fard2|الثاني|ثاني/.test(normalizedTitle)) {
      mapping[title] = "fard2";
    } else if (/الفرض3|الفرض٣|فرض3|فرض٣|fard3|الثالث|ثالث/.test(normalizedTitle)) {
      mapping[title] = "fard3";
    } else if (/الفرض4|الفرض٤|فرض4|فرض٤|fard4|الرابع|رابع/.test(normalizedTitle)) {
      mapping[title] = "fard4";
    } else if (/الانشطه|الأنشطة|النشاط|المراقبهالمستمره|المراقبةالمستمرة|activities/.test(normalizedTitle)) {
      mapping[title] = "activities";
    }
  });

  return mapping;
}

/**
 * Extract data rows between two indices
 */
export function extractDataRowsInRange(lines: string[], headerRowIndex: number, endExclusive: number): string[] {
  const dataRows = lines.slice(headerRowIndex + 1, Math.max(headerRowIndex + 1, endExclusive));
  const filteredRows = dataRows.filter((row) => {
    if (!row || row.trim().length === 0) return false;
    if (isSummaryRow(row)) return false;
    if (isAdvancedHeaderRow(row)) return false;
    const hasArabicOrNumbers = /[\u0600-\u06FF]/.test(row) || /\d/.test(row);
    return hasArabicOrNumbers;
  });
  return filteredRows;
}

/**
 * Check if a row is a summary row (should be skipped)
 */
export function isSummaryRow(row: string): boolean {
  const summaryKeywords = ["المجموع", "المعدل", "total", "average", "sum", "إجمالي", "الإجمالي"];
  const lowerRow = row.toLowerCase().trim();

  return summaryKeywords.some((keyword) => {
    const keywordLower = keyword.toLowerCase();
    return (
      lowerRow.startsWith(keywordLower) ||
      lowerRow === keywordLower ||
      (row.length < 20 && lowerRow.includes(keywordLower) && !containsArabicName(row))
    );
  });
}

/**
 * Check if a row contains an Arabic name
 */
export function containsArabicName(row: string): boolean {
  const arabicSequences = row.match(/[\u0600-\u06FF]{3,}/g);
  if (!arabicSequences) return false;

  const summaryKeywords = ["المجموع", "المعدل", "إجمالي", "الإجمالي"];
  return arabicSequences.some((seq) => !summaryKeywords.some((keyword) => seq.includes(keyword)));
}

/**
 * Parse row into cells with intelligent separator handling
 */
export function parseRowIntoCells(row: string): string[] {
  let working = row.replace(/\s+/g, " ").trim();

  // Extract leading student number if present
  const leadingNumMatch = working.match(/^\s*(\d{1,3})\s+/);
  const cells: string[] = [];
  if (leadingNumMatch) {
    cells.push(leadingNumMatch[1]);
    working = working.slice(leadingNumMatch[0].length).trim();
  }

  // Split on strong separators
  let segments = working
    .split(/[|\t،]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) {
    segments = [working];
  }

  // Process each segment
  const markLike = /^(?:\d{1,2})(?:[.,]\d{1,2})?$/;

  for (const seg of segments) {
    if (markLike.test(normalizeArabicNumber(seg))) {
      cells.push(seg);
    } else {
      cells.push(seg.replace(/[:؛]$/, "").trim());
    }
  }

  // Fallback parsing
  if (cells.length === 0) {
    const parts = working.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length > 0) {
      return groupPartsIntoCells(parts);
    }
    return working.length > 0 ? [working] : [];
  }

  // Try to split single cell further if needed
  if (cells.length === 1 && !markLike.test(normalizeArabicNumber(cells[0]))) {
    const parts = cells[0].split(/\s+/).filter((p) => p.length > 0);
    if (parts.length > 1) {
      return groupPartsIntoCells(parts);
    }
  }

  return cells;
}

/**
 * Group parts into logical cells
 */
function groupPartsIntoCells(parts: string[]): string[] {
  const cells: string[] = [];
  let currentCell = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // If this looks like a mark (numeric), start a new cell
    if (isNumericHelper(part)) {
      if (currentCell) {
        cells.push(currentCell.trim());
        currentCell = "";
      }
      cells.push(part);
    } else {
      currentCell += (currentCell ? " " : "") + part;
    }
  }

  if (currentCell) {
    cells.push(currentCell.trim());
  }

  return cells;
}

/**
 * Extract student name using multiple strategies
 */
export function extractStudentName(
  cells: string[],
  columnStructure: Array<{ index: number; title: string; type: string }>
): string | null {
  // Strategy 1: Use column structure
  const nameColumn = columnStructure.find((col) => col.type === "name");
  if (nameColumn && cells[nameColumn.index]) {
    const name = cells[nameColumn.index];
    if (isValidStudentName(name)) {
      return cleanStudentName(name);
    }
  }

  // Strategy 2: Find longest Arabic text
  let bestName = "";
  for (const cell of cells) {
    if (isValidStudentName(cell) && cell.length > bestName.length) {
      bestName = cell;
    }
  }

  if (bestName) {
    return cleanStudentName(bestName);
  }

  // Strategy 3: Look for Arabic text in any cell
  for (const cell of cells) {
    if (/[\u0600-\u06FF]{2,}/.test(cell) && !isStrictHeaderLike(cell)) {
      return cleanStudentName(cell);
    }
  }

  // Strategy 4: Any cell with Arabic characters
  for (const cell of cells) {
    const cleaned = cell.replace(/[^\u0600-\u06FF\s]/g, "").trim();
    if (cleaned.length >= 2 && !isStrictHeaderLike(cell)) {
      logger.debug(`📝 Fallback name extraction: "${cell}" → "${cleaned}"`);
      return cleanStudentName(cell);
    }
  }

  // Strategy 5: Ultra lenient
  for (const cell of cells) {
    if (/[\u0600-\u06FF]/.test(cell) && !isStrictHeaderLike(cell)) {
      const cleaned = cleanStudentName(cell);
      if (cleaned.length > 0) {
        logger.debug(`📝 Ultra-lenient name extraction: "${cell}" → "${cleaned}"`);
        return cleaned;
      }
    }
  }

  return null;
}

/**
 * Clean student name
 */
export function cleanStudentName(name: string): string {
  return name
    .replace(/[:؛]$/, "")
    .replace(/^\d+\s*/, "")
    .trim();
}

/**
 * Check if text looks like a header
 */
export function isStrictHeaderLike(text: string): boolean {
  const strictHeaderKeywords = [
    "الاسم الكامل",
    "اسم التلميذ",
    "الفرض الأول",
    "الفرض الثاني",
    "الفرض الثالث",
    "الأنشطة المدمجة",
    "المجموع العام",
    "المعدل العام",
    "المجموع",
    "المعدل",
    "total",
    "average",
  ];

  const lowerText = text.toLowerCase().trim();
  return strictHeaderKeywords.some((keyword) => lowerText === keyword.toLowerCase());
}

/**
 * Helper to check if string is numeric
 */
function isNumericHelper(str: string): boolean {
  if (!str) return false;
  const cleaned = str.replace(",", ".");
  const num = parseFloat(cleaned);
  return !isNaN(num) && num >= 0 && num <= 20;
}

/**
 * Emergency name extraction when all other strategies fail
 */
export function emergencyNameExtraction(originalRow: string, cells: string[]): string | null {
  logger.debug(`🚨 Emergency name extraction for row: "${originalRow}"`);

  // Strategy 1: Look for any text that's not purely numeric
  for (const cell of cells) {
    if (cell && cell.trim().length > 0 && !/^\d+([.,]\d+)?$/.test(cell.trim())) {
      const cleaned = cell
        .trim()
        .replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "")
        .trim();
      if (cleaned.length >= 2) {
        logger.debug(`🚨 Emergency extraction found: "${cleaned}" from cell: "${cell}"`);
        return cleaned;
      }
    }
  }

  // Strategy 2: Extract from the original row directly
  const rowText = originalRow.trim();
  let workingText = rowText.replace(/^\d+\s*/, "");

  // Look for Arabic text patterns
  const arabicMatch = workingText.match(/[\u0600-\u06FF][^\d]*[\u0600-\u06FF]/);
  if (arabicMatch) {
    const extracted = arabicMatch[0]
      .trim()
      .replace(/[^\u0600-\u06FF\s]/g, "")
      .trim();
    if (extracted.length >= 2) {
      logger.debug(`🚨 Emergency Arabic extraction: "${extracted}" from: "${workingText}"`);
      return extracted;
    }
  }

  // Strategy 3: Look for any sequence of letters
  const letterMatch = workingText.match(/[^\d\s.,|]+/);
  if (letterMatch) {
    const extracted = letterMatch[0].trim();
    if (extracted.length >= 2 && !/^[.,|]+$/.test(extracted)) {
      logger.debug(`🚨 Emergency letter extraction: "${extracted}" from: "${workingText}"`);
      return extracted;
    }
  }

  // Strategy 4: Last resort
  const parts = workingText.split(/\s+/).filter((p) => p.length > 1 && !/^\d+([.,]\d+)?$/.test(p));
  if (parts.length > 0) {
    const extracted = parts[0].replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "").trim();
    if (extracted.length >= 1) {
      logger.debug(`🚨 Emergency part extraction: "${extracted}" from parts:`, parts);
      return extracted;
    }
  }

  logger.debug(`🚨 Emergency extraction failed completely for: "${originalRow}"`);
  return null;
}

