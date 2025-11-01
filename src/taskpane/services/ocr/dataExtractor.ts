import { Student, DetectedMarkTypes, StudentUncertainty } from "../../types";
import { normalizeArabicText, normalizeArabicNumber, isValidStudentName } from "../../utils/arabicTextUtils";
import { MARK_TYPE_REGEX } from "../../constants/markTypes";
import { ExtractionError } from "./errors";
import { logger } from "./logger";
import {
  analyzeAllHeaderSections,
  extractDataRowsInRange,
  parseRowIntoCells,
  extractStudentName,
  isSummaryRow,
  emergencyNameExtraction,
} from "./extractionHelpers";

/**
 * Data Extractor
 * Extracts student data from OCR text with advanced table structure detection
 */

export class DataExtractor {
  // Micro-caches to reduce hot-path allocations
  private cacheNormalizeNameForComparison: Map<string, string> = new Map();
  private cachePreprocessMark: Map<string, string | null> = new Map();
  private ratioPattern: RegExp = /^(\d{1,2})\s*\/?\s*(?:out\s*of\s*)?(\d{1,2})$/i;

  /**
   * Extract student data from the OCR text with enhanced error handling
   */
  extractStudentData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    try {
      logger.info("🔄 Extracting student data from Gemini OCR text...");

      if (!text || text.trim().length === 0) {
        throw new ExtractionError("Empty OCR text received");
      }

      const lines = text
        .split("\n")
        .map((line) => normalizeArabicNumber(line.trim()))
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        throw new ExtractionError("No valid lines found in OCR text");
      }

      logger.debug(`Processing ${lines.length} lines of OCR text`);

      // Detect mark types from headers
      const detectedMarkTypes = this.detectMarkTypes(text);
      logger.debug("Detected mark types:", detectedMarkTypes);

      // Extract students and marks
      const students = this.extractStudentsFromLines(lines, detectedMarkTypes);

      if (students.length === 0) {
        logger.warn("No students extracted from text");
      } else {
        logger.success(`✅ Total students extracted: ${students.length}`);
      }

      return { students, detectedMarkTypes };
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      logger.error("Error in extractStudentData:", error);
      throw new ExtractionError("Failed to extract student data from OCR text", { originalError: error });
    }
  }

  /**
   * Detect which mark types are present in the document
   */
  private detectMarkTypes(text: string): DetectedMarkTypes {
    return {
      hasFard1: MARK_TYPE_REGEX.fard1.test(text),
      hasFard2: MARK_TYPE_REGEX.fard2.test(text),
      hasFard3: MARK_TYPE_REGEX.fard3.test(text),
      hasFard4: MARK_TYPE_REGEX.fard4.test(text),
      hasActivities: MARK_TYPE_REGEX.activities.test(text),
    };
  }

  /**
   * Merge two student arrays by normalized name
   */
  mergeStudentsByName(primary: Student[], secondary: Student[]): Student[] {
    const normalize = (s: string) => normalizeArabicText(s);

    const byName = new Map<string, Student>();
    for (const s of primary) {
      byName.set(normalize(s.name), { ...s });
    }

    for (const s of secondary) {
      const key = normalize(s.name);
      if (!byName.has(key)) {
        byName.set(key, { ...s, number: byName.size + 1 });
      } else {
        const existing = byName.get(key)!;
        const merged: Student = {
          ...existing,
          marks: {
            fard1: existing.marks.fard1 ?? s.marks.fard1 ?? null,
            fard2: existing.marks.fard2 ?? s.marks.fard2 ?? null,
            fard3: existing.marks.fard3 ?? s.marks.fard3 ?? null,
            fard4: existing.marks.fard4 ?? s.marks.fard4 ?? null,
            activities: existing.marks.activities ?? s.marks.activities ?? null,
          },
          uncertain: {
            name: existing.uncertain?.name || false || s.uncertain?.name || false,
            marks: {
              fard1:
                (existing.marks.fard1 !== null
                  ? existing.uncertain?.marks?.fard1
                  : (s.uncertain?.marks?.fard1 ?? true)) || false,
              fard2:
                (existing.marks.fard2 !== null
                  ? existing.uncertain?.marks?.fard2
                  : (s.uncertain?.marks?.fard2 ?? true)) || false,
              fard3:
                (existing.marks.fard3 !== null
                  ? existing.uncertain?.marks?.fard3
                  : (s.uncertain?.marks?.fard3 ?? true)) || false,
              fard4:
                (existing.marks.fard4 !== null
                  ? existing.uncertain?.marks?.fard4
                  : (s.uncertain?.marks?.fard4 ?? true)) || false,
              activities:
                (existing.marks.activities !== null
                  ? existing.uncertain?.marks?.activities
                  : (s.uncertain?.marks?.activities ?? true)) || false,
            },
          },
        };
        byName.set(key, merged);
      }
    }

    // Preserve original order
    const primaryKeys = primary.map((s) => normalize(s.name));
    const extras: string[] = [];
    byName.forEach((_value, key) => {
      if (!primaryKeys.includes(key)) {
        extras.push(key);
      }
    });
    const orderedKeys = primaryKeys.concat(extras);
    return orderedKeys.map((k, i) => ({ ...byName.get(k)!, number: i + 1 }));
  }

  /**
   * Post-process students to deduplicate and renumber
   */
  postProcessStudents(students: Student[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    // Note: detectedMarkTypes parameter preserved for future enhancements
    const byKey = new Map<string, Student>();
    const order: string[] = [];
    
    for (const s of students) {
      const key = this.normalizeNameForComparison(s.name);
      if (!key) continue;
      
      if (!byKey.has(key)) {
        byKey.set(key, { ...s });
        order.push(key);
      } else {
        const existing = byKey.get(key)!;
        byKey.set(key, {
          ...existing,
          marks: {
            fard1: existing.marks.fard1 ?? s.marks.fard1 ?? null,
            fard2: existing.marks.fard2 ?? s.marks.fard2 ?? null,
            fard3: existing.marks.fard3 ?? s.marks.fard3 ?? null,
            fard4: existing.marks.fard4 ?? s.marks.fard4 ?? null,
            activities: existing.marks.activities ?? s.marks.activities ?? null,
          },
        });
      }
    }
    
    return order.map((k, idx) => ({ ...byKey.get(k)!, number: idx + 1 }));
  }

  /**
   * Parse mark value with better handling
   */
  parseMarkValue(mark: string | null): number | null {
    if (!mark) return null;

    const pre = this.preprocessMark(mark) ?? mark;

    // Handle ratio formats like "14/20" or "7/10"
    const ratio = pre.match(this.ratioPattern);
    if (ratio) {
      const num = parseInt(ratio[1], 10);
      const den = parseInt(ratio[2], 10);
      if (den > 0) {
        const normalizedTo20 = (num / den) * 20;
        if (normalizedTo20 >= 0 && normalizedTo20 <= 20) return Number(normalizedTo20.toFixed(2));
      }
    }

    const normalized = pre.replace(",", ".");
    const cleaned = normalized.replace(/[^\d.]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0 && num <= 20) {
      return Number(num.toFixed(2));
    }
    return null;
  }

  /**
   * Check if a string is numeric (could be a mark)
   */
  isNumeric(str: string): boolean {
    if (!str) return false;
    return this.parseMarkValue(str) !== null;
  }

  /**
   * Preprocess mark to handle OCR quirks
   */
  private preprocessMark(mark: string): string | null {
    if (!mark) return null;
    const cached = this.cachePreprocessMark.get(mark);
    if (cached !== undefined) return cached;

    // Remove any spaces
    let cleaned = mark.replace(/\s+/g, "");

    // Normalize Arabic punctuation and common OCR mistakes
    cleaned = cleaned
      .replace(/،/g, ",") // Arabic comma
      .replace(/[٫﹒·]/g, ".") // Arabic decimal dot and similar
      .replace(/[oO]/g, "0"); // OCR: O -> 0

    // Handle formats like "07100" which should be "07,00"
    if (/^\d{2}100$/.test(cleaned)) {
      cleaned = cleaned.substring(0, 2) + ",00";
      logger.debug(`  Converted ${mark} to ${cleaned}`);
    }
    // Handle formats like "03100" -> "03,00"
    else if (/^\d{1}100$/.test(cleaned)) {
      cleaned = "0" + cleaned.substring(0, 1) + ",00";
      logger.debug(`  Converted ${mark} to ${cleaned}`);
    }
    // Handle formats like "10100" -> "10,00"
    else if (/^\d{3}00$/.test(cleaned) && cleaned !== "10000") {
      const firstTwo = cleaned.substring(0, 2);
      const num = parseInt(firstTwo);
      if (num <= 20) {
        cleaned = firstTwo + ",00";
        logger.debug(`  Converted ${mark} to ${cleaned}`);
      }
    }
    // Handle "108,00" which is likely "10,00" or "08,00"
    else if (cleaned === "108,00") {
      cleaned = "10,00";
      logger.debug(`  Converted ${mark} to ${cleaned}`);
    }

    this.cachePreprocessMark.set(mark, cleaned);
    return cleaned;
  }

  /**
   * Normalize name for comparison
   */
  private normalizeNameForComparison(text: string): string {
    if (!text) return "";
    const cached = this.cacheNormalizeNameForComparison.get(text);
    if (cached !== undefined) return cached;
    const normalized = normalizeArabicText(text);
    this.cacheNormalizeNameForComparison.set(text, normalized);
    return normalized;
  }

  /**
   * Extract students from text lines with advanced table structure detection
   */
  private extractStudentsFromLines(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    try {
      let students: Student[] = [];

      // Find all header sections
      const headerAnalyses = analyzeAllHeaderSections(lines);
      if (headerAnalyses.length === 0) {
        logger.warn("⚠️ No valid header structure found, using fallback");
        return [];
      }

      logger.info(`📋 Found ${headerAnalyses.length} header sections`);

      for (let s = 0; s < headerAnalyses.length; s++) {
        const headerAnalysis = headerAnalyses[s];
        const nextHeader = headerAnalyses[s + 1]?.headerRowIndex ?? lines.length;
        const dataRows = extractDataRowsInRange(lines, headerAnalysis.headerRowIndex, nextHeader);

        logger.debug(`📊 Section ${s + 1}/${headerAnalyses.length} — rows: ${dataRows.length}`);

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          if (!row || row.trim().length === 0) continue;
          if (isSummaryRow(row)) continue;

          try {
            const student = this.extractStudentFromRowAdvanced(
              row,
              headerAnalysis,
              detectedMarkTypes,
              students.length + 1
            );
            if (student) {
              students.push(student);
            } else {
              const cells = parseRowIntoCells(row);
              logger.debug(`⚠️ Section ${s + 1} row ${i + 1} failed; cells:`, cells);
              const emergencyName = emergencyNameExtraction(row, cells);
              if (emergencyName) {
                students.push({
                  number: students.length + 1,
                  name: emergencyName,
                  marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
                  uncertain: {
                    name: true,
                    marks: { fard1: false, fard2: false, fard3: false, fard4: false, activities: false },
                  },
                });
              }
            }
          } catch (rowError) {
            logger.warn(`Error processing row ${i + 1} in section ${s + 1}:`, rowError);
          }
        }
      }

      logger.info(`📊 Extracted ${students.length} students`);
      return students;
    } catch (error) {
      logger.error("Error in extractStudentsFromLines:", error);
      return [];
    }
  }

  /**
   * Advanced student extraction with intelligent cell parsing
   */
  private extractStudentFromRowAdvanced(
    row: string,
    headerAnalysis: {
      headerRowIndex: number;
      columnStructure: Array<{ index: number; title: string; type: string }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    },
    detectedMarkTypes: DetectedMarkTypes,
    studentNumber: number
  ): Student | null {
    const cells = parseRowIntoCells(row);

    if (cells.length === 0) {
      return null;
    }

    // Find student name
    let studentName = extractStudentName(cells, headerAnalysis.columnStructure);

    if (!studentName) {
      studentName = emergencyNameExtraction(row, cells);
    }

    if (!studentName) {
      return null;
    }

    // Extract marks
    const { marks, flags } = this.extractMarksAdvanced(cells, headerAnalysis, detectedMarkTypes);
    const nameUncertain = !isValidStudentName(studentName);

    return {
      number: studentNumber,
      name: studentName,
      marks,
      uncertain: { name: nameUncertain, marks: flags },
    };
  }

  /**
   * Advanced mark extraction using column mapping
   */
  private extractMarksAdvanced(
    cells: string[],
    headerAnalysis: {
      columnStructure: Array<{ index: number; title: string; type: string }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    },
    detectedMarkTypes: DetectedMarkTypes
  ): { marks: Student["marks"]; flags: StudentUncertainty["marks"] } {
    const marks: Student["marks"] = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };
    const flags: StudentUncertainty["marks"] = {
      fard1: false,
      fard2: false,
      fard3: false,
      fard4: false,
      activities: false,
    };

    // Use column mapping to extract marks
    Object.entries(headerAnalysis.markColumnMapping).forEach(([columnTitle, markType]) => {
      const columnIndex = headerAnalysis.columnStructure.findIndex((col) => col.title === columnTitle);
      if (columnIndex !== -1 && cells[columnIndex]) {
        const markValue = this.parseMarkValue(cells[columnIndex]);
        if (markValue !== null) {
          marks[markType] = markValue;
          logger.debug(`📊 Found ${markType} mark: ${cells[columnIndex]} -> ${markValue}`);
          (flags as any)[markType] = false;
        }
      }
    });

    // Fallback: try to extract marks intelligently
    if (Object.values(marks).every((mark) => mark === null)) {
      const nameCol = headerAnalysis.columnStructure.find((c) => c.type === "name")?.index;
      const numericCellsAll = cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => this.isNumeric(cell));

      const numericCells = nameCol !== undefined
        ? numericCellsAll.filter((x) => x.index > nameCol)
        : numericCellsAll;

      let markIndex = 0;
      if (detectedMarkTypes.hasFard1 && markIndex < numericCells.length) {
        marks.fard1 = this.parseMarkValue(numericCells[markIndex++].cell);
        if (marks.fard1 !== null) flags.fard1 = true;
      }
      if (detectedMarkTypes.hasFard2 && markIndex < numericCells.length) {
        marks.fard2 = this.parseMarkValue(numericCells[markIndex++].cell);
        if (marks.fard2 !== null) flags.fard2 = true;
      }
      if (detectedMarkTypes.hasFard3 && markIndex < numericCells.length) {
        marks.fard3 = this.parseMarkValue(numericCells[markIndex++].cell);
        if (marks.fard3 !== null) flags.fard3 = true;
      }
      if (detectedMarkTypes.hasFard4 && markIndex < numericCells.length) {
        marks.fard4 = this.parseMarkValue(numericCells[markIndex++].cell);
        if (marks.fard4 !== null) flags.fard4 = true;
      }
      if (detectedMarkTypes.hasActivities && markIndex < numericCells.length) {
        marks.activities = this.parseMarkValue(numericCells[markIndex++].cell);
        if (marks.activities !== null) flags.activities = true;
      }
    }

    return { marks, flags };
  }
}

// Default instance
export const dataExtractor = new DataExtractor();

