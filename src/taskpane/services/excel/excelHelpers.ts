/**
 * Excel Helper Utilities
 * Pure functions for common Excel operations
 */

import { MarkType } from "../../types";

/**
 * Format mark value for Massar Excel format
 */
export function formatMarkForMassar(mark: number): string {
  return parseFloat(mark.toString()).toFixed(2);
}

/**
 * Get neighbor value from Excel grid (used for metadata extraction)
 */
export function getNeighborValue(rowsToScan: any[][], r: number, c: number): string | undefined {
  const row = rowsToScan[r] || [];
  const normalize = (v: any) => (v == null ? "" : v.toString().trim());

  // 1) Same row: scan up to 3 cells to the right to skip colon cells
  for (let off = 1; off <= 3; off++) {
    const val = normalize(row[c + off]);
    if (val && val !== ":" && val !== "-" && val !== "؛") return val;
  }

  // 2) Same row: one cell left (sometimes the colon is to the right)
  const left = normalize(row[c - 1]);
  if (left && left !== ":" && left !== "-" && left !== "؛") return left;

  // 3) Below cells in same column and one to the right (merged header above)
  for (let down = 1; down <= 2; down++) {
    const below = normalize(rowsToScan[r + down]?.[c]);
    if (below) return below;
    const belowRight = normalize(rowsToScan[r + down]?.[c + 1]);
    if (belowRight) return belowRight;
  }

  return undefined;
}

/**
 * Extract headers from values array
 */
export function extractHeaders(values: any[][]): string[] {
  const headerKeywords = ["رقم التلميذ", "إسم التلميذ", "تاريخ", "رقم", "اسم"];

  for (let i = 0; i < Math.min(20, values.length); i++) {
    const row = values[i];
    if (
      row.some(
        (cell) =>
          cell && typeof cell === "string" && headerKeywords.some((keyword) => cell.toString().includes(keyword))
      )
    ) {
      return row.map((cell) => (cell ? cell.toString() : ""));
    }
  }

  // Fallback: return the first row as headers
  return values[0]?.map((cell) => (cell ? cell.toString() : "")) || [];
}

/**
 * Check if text matches any of the given patterns
 */
export function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

/**
 * Map Arabic display name to internal mark type
 */
export function getInternalMarkType(arabicMarkType: string): MarkType | null {
  const markTypeMap: Record<string, MarkType> = {
    "الفرض 1": "fard1",
    "الفرض الأول": "fard1",
    "فرض 1": "fard1",
    "الفرض 2": "fard2",
    "الفرض الثاني": "fard2",
    "فرض 2": "fard2",
    "الفرض 3": "fard3",
    "الفرض الثالث": "fard3",
    "فرض 3": "fard3",
    "الفرض 4": "fard4",
    "الفرض الرابع": "fard4",
    "فرض 4": "fard4",
    الأنشطة: "activities",
    النشاط: "activities",
    أنشطة: "activities",
  };

  return markTypeMap[arabicMarkType] || null;
}

/**
 * Map detected type key to mark type
 */
export function mapDetectedTypeToMarkType(
  detectedType: "hasFard1" | "hasFard2" | "hasFard3" | "hasFard4" | "hasActivities"
): MarkType | null {
  const mapping: Record<string, MarkType> = {
    hasFard1: "fard1",
    hasFard2: "fard2",
    hasFard3: "fard3",
    hasFard4: "fard4",
    hasActivities: "activities",
  };

  return mapping[detectedType] || null;
}

/**
 * Get merged student name from potentially multiple columns
 */
export function getMergedStudentName(row: any[], primaryNameColumn: number): string {
  let fullName = row[primaryNameColumn] ? row[primaryNameColumn].toString().trim() : "";
  const originalName = fullName;

  // Check adjacent columns for additional name parts
  if (primaryNameColumn + 1 < row.length) {
    const nextColumn = row[primaryNameColumn + 1];
    if (nextColumn && typeof nextColumn === "string") {
      const nextColumnText = nextColumn.toString().trim();

      if (
        ((/[\u0600-\u06FF]/.test(nextColumnText) || /[a-zA-Z]/.test(nextColumnText)) &&
          !/^\d+$/.test(nextColumnText) &&
          !/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(nextColumnText)) ||
        (/^[\p{L} ,\-']+$/u.test(nextColumnText) && nextColumnText.length >= 2)
      ) {
        if (!fullName.includes(nextColumnText)) {
          fullName = (fullName ? fullName + " " : "") + nextColumnText;
        }
      }
    }
  }

  // Check the column before the primary name column
  if (primaryNameColumn > 0) {
    const prevColumn = row[primaryNameColumn - 1];
    if (prevColumn && typeof prevColumn === "string") {
      const prevColumnText = prevColumn.toString().trim();

      if (
        ((/[\u0600-\u06FF]/.test(prevColumnText) || /[a-zA-Z]/.test(prevColumnText)) &&
          !/^\d+$/.test(prevColumnText) &&
          !/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(prevColumnText)) ||
        (/^[\p{L} ,\-']+$/u.test(prevColumnText) && prevColumnText.length >= 2)
      ) {
        if (!fullName.includes(prevColumnText)) {
          fullName = prevColumnText + (fullName ? " " : "") + fullName;
        }
      }
    }
  }

  const finalName = fullName.trim();

  if (finalName !== originalName) {
    console.log(`🔗 Merged name: "${originalName}" → "${finalName}" (column ${primaryNameColumn})`);
  }

  return finalName;
}

