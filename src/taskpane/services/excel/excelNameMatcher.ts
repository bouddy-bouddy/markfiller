/**
 * Excel Name Matcher
 * Handles student name matching with fuzzy logic
 */

import { normalizeArabicText, compareNames } from "../../utils/arabicTextUtils";
import { getMergedStudentName } from "./excelHelpers";

export type NameMatchConfig = {
  baseThreshold: number;
  shortNameThreshold: number;
  shortNameMaxLen: number;
  overlapRelaxedThreshold: number;
  minContainLen: number;
};

export class ExcelNameMatcher {
  private config: NameMatchConfig = {
    baseThreshold: 0.82,
    shortNameThreshold: 0.9,
    shortNameMaxLen: 6,
    overlapRelaxedThreshold: 0.78,
    minContainLen: 3,
  };

  setConfig(config: Partial<NameMatchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): NameMatchConfig {
    return { ...this.config };
  }

  /**
   * Enhanced student name matching with fuzzy logic and merged column support
   */
  findStudentRow(studentName: string, values: string[][], nameColumn: number): number {
    const nameToFind = normalizeArabicText(studentName);

    // Strategy 1: Exact match (after normalization)
    for (let i = 1; i < values.length; i++) {
      const cellName = getMergedStudentName(values[i], nameColumn);
      const normalizedCellName = normalizeArabicText(cellName);
      if (normalizedCellName === nameToFind) {
        return i;
      }
    }

    // Strategy 2: Order-agnostic full-name equality
    const targetTokens = nameToFind.split(/\s+/).filter(Boolean).sort();
    for (let i = 1; i < values.length; i++) {
      const cellName = getMergedStudentName(values[i], nameColumn);
      const normalizedCellName = normalizeArabicText(cellName);
      const cellTokens = normalizedCellName.split(/\s+/).filter(Boolean).sort();
      if (
        targetTokens.length >= 2 &&
        cellTokens.length === targetTokens.length &&
        cellTokens.every((t, idx) => t === targetTokens[idx])
      ) {
        return i;
      }
    }

    // Strategy 3: Fuzzy matching with token count validation
    for (let i = 1; i < values.length; i++) {
      const cellName = getMergedStudentName(values[i], nameColumn);
      const normalizedCellName = normalizeArabicText(cellName);
      const tokensA = nameToFind.split(/\s+/).filter(Boolean);
      const tokensB = normalizedCellName.split(/\s+/).filter(Boolean);
      const strongSimilarity = compareNames(nameToFind, normalizedCellName, this.config);
      if (strongSimilarity && tokensA.length === tokensB.length) {
        return i;
      }
    }

    // Strategy 4: Last resort - scan across all columns
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const concatenated = normalizeArabicText(row.map((c) => (c == null ? "" : c.toString())).join(" "));
      const pattern = new RegExp(`(^|\\s)${nameToFind.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}($|\\s)`);
      if (pattern.test(concatenated)) {
        return i;
      }
    }

    return -1;
  }
}

