/**
 * Excel Column Detector
 * Detects student name, ID, and mark columns in Excel sheets
 */

import { MarkType } from "../../types";
import { MARK_TYPE_PATTERNS } from "../../constants/markTypes";
import { extractHeaders as extractHeadersHelper } from "./excelHelpers";

export class ExcelColumnDetector {
  /**
   * Extract headers from values array
   */
  extractHeaders(values: any[][]): string[] {
    return extractHeadersHelper(values);
  }

  /**
   * Find student name column with enhanced matching
   */
  findStudentNameColumn(headers: string[]): number {
    const nameHeaders = [
      "الاسم الكامل",
      "اسم التلميذ",
      "الاسم",
      "إسم التلميذ",
      "اسم الطالب",
      "التلميذ",
      "الطالب",
      "اسم المتعلم",
      "المتعلم",
      "nom et prénom",
      "nom",
      "prénom",
      "nom complet",
      "eleve",
      "élève",
      "nom de l'élève",
    ];

    // Try exact match first (case-insensitive)
    const exactMatch = headers.findIndex((h) =>
      nameHeaders.some((nh) => h && h.toString().toLowerCase() === nh.toLowerCase())
    );

    if (exactMatch !== -1) return exactMatch;

    // Then try partial match (case-insensitive)
    return headers.findIndex((h) =>
      nameHeaders.some((nh) => h && h.toString().toLowerCase().includes(nh.toLowerCase()))
    );
  }

  /**
   * Find student name column in Massar format with merged column handling
   */
  findMassarStudentNameColumn(headers: string[], values: any[][]): number {
    let nameColumn = this.findStudentNameColumn(headers);

    if (nameColumn !== -1) {
      return nameColumn;
    }

    // Heuristic 1: Name column is usually adjacent to the ID column
    const idCol = this.findStudentIdColumn(headers);
    if (idCol !== -1) {
      const candidates: number[] = [];
      if (idCol + 1 < headers.length) candidates.push(idCol + 1);
      if (idCol - 1 >= 0) candidates.push(idCol - 1);

      const scored = candidates
        .map((col) => ({ col, score: this.scoreColumnAsName(values, col) }))
        .sort((a, b) => b.score - a.score);

      if (scored.length && scored[0].score >= 0.6) {
        return scored[0].col;
      }
    }

    // Heuristic 2: Detect name pairs split across two adjacent columns
    let bestPair = { baseCol: -1, score: 0 };
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const singleScore = this.scoreColumnAsName(values, colIndex);
      const pairScoreRight = this.scorePairAsName(values, colIndex, colIndex + 1);
      const pairScoreLeft = this.scorePairAsName(values, colIndex - 1, colIndex);
      const maxForThisCol = Math.max(singleScore, pairScoreRight, pairScoreLeft);
      if (maxForThisCol > bestPair.score) {
        bestPair = { baseCol: colIndex, score: maxForThisCol };
      }
    }
    if (bestPair.baseCol !== -1 && bestPair.score >= 0.6) {
      return bestPair.baseCol;
    }

    // Heuristic 3: Analyze data structure for name patterns
    const dataRows = values.slice(1, Math.min(6, values.length));
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      let nameScore = 0;
      let totalRows = 0;

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const cellValue = dataRows[rowIndex][colIndex];

        if (cellValue && typeof cellValue === "string") {
          totalRows++;

          if (/[\u0600-\u06FF]/.test(cellValue) || /[a-zA-Z]/.test(cellValue)) {
            nameScore += 2;
          }

          const words = cellValue.trim().split(/\s+/);
          if (words.length >= 2 && words.length <= 5) {
            nameScore += 1;
          }

          if (!/^\d+$/.test(cellValue) && !/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(cellValue)) {
            nameScore += 1;
          }
        }
      }

      if (totalRows > 0 && nameScore / totalRows > 2.5) {
        return colIndex;
      }
    }

    return -1;
  }

  /**
   * Find student ID column
   */
  findStudentIdColumn(headers: string[]): number {
    const idHeaders = [
      "رقم التلميذ",
      "رقم",
      "ر.ت",
      "ر.م",
      "الرقم",
      "المسلسل",
      "رقم الطالب",
      "الرقم الترتيبي",
      "ت",
      "id",
      "الرقم التسلسلي",
    ];

    // Try exact match first
    const exactMatch = headers.findIndex((h) => idHeaders.some((ih) => h && h.toString() === ih));

    if (exactMatch !== -1) return exactMatch;

    // Then try partial match
    return headers.findIndex((h) => idHeaders.some((ih) => h && h.toString().includes(ih)));
  }

  /**
   * Find mark columns with enhanced pattern matching
   */
  findMarkColumns(headers: string[]): Record<MarkType, number> {
    const markTypes = MARK_TYPE_PATTERNS;

    const columns: Record<MarkType, number> = {
      fard1: -1,
      fard2: -1,
      fard3: -1,
      fard4: -1,
      activities: -1,
    };

    // Try exact matches first
    for (const [type, patterns] of Object.entries(markTypes)) {
      columns[type as MarkType] = headers.findIndex((h) => patterns.some((p) => h && h.toString() === p));
    }

    // Then try partial matches for any that weren't found
    for (const [type, patterns] of Object.entries(markTypes)) {
      if (columns[type as MarkType] === -1) {
        columns[type as MarkType] = headers.findIndex((h) => patterns.some((p) => h && h.toString().includes(p)));
      }
    }

    // For any still not found, try fuzzy matching with numbers
    if (columns.fard1 === -1) {
      columns.fard1 = headers.findIndex(
        (h) => h && h.toString().match(/فرض.*1|1.*فرض|اختبار.*1|1.*اختبار|امتحان.*1|1.*امتحان/)
      );
    }

    if (columns.fard2 === -1) {
      columns.fard2 = headers.findIndex(
        (h) => h && h.toString().match(/فرض.*2|2.*فرض|اختبار.*2|2.*اختبار|امتحان.*2|2.*امتحان/)
      );
    }

    if (columns.fard3 === -1) {
      columns.fard3 = headers.findIndex(
        (h) => h && h.toString().match(/فرض.*3|3.*فرض|اختبار.*3|3.*اختبار|امتحان.*3|3.*امتحان/)
      );
    }

    if (columns.fard4 === -1) {
      columns.fard4 = headers.findIndex(
        (h) => h && h.toString().match(/فرض.*4|4.*فرض|اختبار.*4|4.*اختبار|امتحان.*4|4.*امتحان/)
      );
    }

    return columns;
  }

  /**
   * Find mark columns in Massar format with النقطة column detection
   */
  findMassarMarkColumns(headers: string[], values: any[][]): Record<MarkType, number> {
    const columns: Record<MarkType, number> = {
      fard1: -1,
      fard2: -1,
      fard3: -1,
      fard4: -1,
      activities: -1,
    };

    const testPatterns = Object.entries(MARK_TYPE_PATTERNS).map(([type, patterns]) => ({
      type: type as MarkType,
      patterns,
    }));

    // Look through multiple rows to find the structure
    for (let rowIndex = 0; rowIndex < Math.min(5, values.length); rowIndex++) {
      const row = values[rowIndex];

      for (const testPattern of testPatterns) {
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = row[colIndex];

          if (cellValue && typeof cellValue === "string") {
            const found = testPattern.patterns.some((pattern) => cellValue.toString().includes(pattern));

            if (found) {
              const scoreColumn = this.findNuqtaColumn(values, rowIndex, colIndex);
              if (scoreColumn !== -1) {
                columns[testPattern.type] = scoreColumn;
              }
            }
          }
        }
      }
    }

    // Fallback to standard detection if Massar-specific detection didn't work
    const standardColumns = this.findMarkColumns(headers);
    for (const [type, col] of Object.entries(columns)) {
      if (col === -1 && standardColumns[type as MarkType] !== -1) {
        columns[type as MarkType] = standardColumns[type as MarkType];
      }
    }

    return columns;
  }

  /**
   * Find النقطة column for a specific test
   */
  private findNuqtaColumn(values: any[][], testHeaderRow: number, testHeaderCol: number): number {
    // Look in the row below the test header
    if (testHeaderRow + 1 < values.length) {
      const nextRow = values[testHeaderRow + 1];

      for (let offset = 0; offset <= 2; offset++) {
        const colIndex = testHeaderCol + offset;
        if (colIndex < nextRow.length) {
          const cellValue = nextRow[colIndex];
          if (cellValue && typeof cellValue === "string" && cellValue.toString().includes("النقطة")) {
            return colIndex;
          }
        }
      }
    }

    // Look in the same row to the right for النقطة
    const sameRow = values[testHeaderRow];
    for (let offset = 1; offset <= 3; offset++) {
      const colIndex = testHeaderCol + offset;
      if (colIndex < sameRow.length) {
        const cellValue = sameRow[colIndex];
        if (cellValue && typeof cellValue === "string" && cellValue.toString().includes("النقطة")) {
          return colIndex;
        }
      }
    }

    // Fallback: use the column directly under the test header
    if (testHeaderRow + 1 < values.length) {
      return testHeaderCol;
    }
    return -1;
  }

  /**
   * Calculate confidence in mark column identification
   */
  calculateMarkColumnConfidence(headers: string[], values: any[][]): Record<MarkType, number> {
    const confidenceMap: Record<MarkType, number> = {
      fard1: 0,
      fard2: 0,
      fard3: 0,
      fard4: 0,
      activities: 0,
    };

    headers.forEach((header) => {
      if (!header) return;

      const headerString = header.toString().toLowerCase();

      if (headerString.includes("فرض 1") || headerString.includes("فرض الأول") || headerString.includes("فرض١")) {
        confidenceMap.fard1 = 0.9;
      } else if (headerString.includes("فرض") && headerString.includes("1")) {
        confidenceMap.fard1 = 0.7;
      }

      if (headerString.includes("فرض 2") || headerString.includes("فرض الثاني") || headerString.includes("فرض٢")) {
        confidenceMap.fard2 = 0.9;
      } else if (headerString.includes("فرض") && headerString.includes("2")) {
        confidenceMap.fard2 = 0.7;
      }

      if (headerString.includes("فرض 3") || headerString.includes("فرض الثالث") || headerString.includes("فرض٣")) {
        confidenceMap.fard3 = 0.9;
      } else if (headerString.includes("فرض") && headerString.includes("3")) {
        confidenceMap.fard3 = 0.7;
      }

      if (headerString.includes("فرض 4") || headerString.includes("فرض الرابع") || headerString.includes("فرض٤")) {
        confidenceMap.fard4 = 0.9;
      } else if (headerString.includes("فرض") && headerString.includes("4")) {
        confidenceMap.fard4 = 0.7;
      }

      if (headerString.includes("أنشطة") || headerString.includes("نشاط")) {
        confidenceMap.activities = 0.9;
      } else if (headerString.includes("أداء") || headerString.includes("مهارات")) {
        confidenceMap.activities = 0.7;
      }
    });

    return confidenceMap;
  }

  /**
   * Find additional mark columns that don't match standard types
   */
  findAdditionalMarkColumns(
    headers: string[],
    standardColumns: Record<MarkType, number>
  ): Array<{ index: number; header: string }> {
    const additionalColumns: Array<{ index: number; header: string }> = [];
    const standardColumnIndices = Object.values(standardColumns).filter((index) => index !== -1);

    headers.forEach((header, index) => {
      if (!header) return;

      const headerString = header.toString().toLowerCase();

      if (
        (headerString.includes("فرض") ||
          headerString.includes("امتحان") ||
          headerString.includes("اختبار") ||
          headerString.includes("تقويم")) &&
        !standardColumnIndices.includes(index)
      ) {
        additionalColumns.push({
          index,
          header: headers[index],
        });
      }
    });

    return additionalColumns;
  }

  /**
   * Find a column that likely contains student names based on content analysis
   */
  findPossibleNameColumn(values: any[][]): number {
    const dataRows = values.slice(1);

    if (dataRows.length === 0 || dataRows[0].length === 0) {
      return -1;
    }

    const columnScores: number[] = new Array(dataRows[0].length).fill(0);

    for (let colIndex = 0; colIndex < dataRows[0].length; colIndex++) {
      let stringCount = 0;
      let arabicCount = 0;
      let shortValueCount = 0;

      for (let rowIndex = 0; rowIndex < Math.min(dataRows.length, 10); rowIndex++) {
        const value = dataRows[rowIndex][colIndex];

        if (value && typeof value === "string") {
          stringCount++;

          if (/[\u0600-\u06FF]/.test(value)) {
            arabicCount++;
          }

          if (value.length > 3) {
            shortValueCount++;
          }
        }
      }

      columnScores[colIndex] = (stringCount + arabicCount * 2 + shortValueCount) / (Math.min(dataRows.length, 10) * 4);
    }

    const maxScore = Math.max(...columnScores);
    if (maxScore > 0.5) {
      return columnScores.indexOf(maxScore);
    }

    return -1;
  }

  /**
   * Find a column that likely contains student IDs
   */
  findPossibleIdColumn(values: any[][], nameColumn: number): number {
    const dataRows = values.slice(1);

    if (dataRows.length === 0 || dataRows[0].length === 0) {
      return -1;
    }

    const columnScores: number[] = new Array(dataRows[0].length).fill(0);

    for (let colIndex = 0; colIndex < dataRows[0].length; colIndex++) {
      if (colIndex === nameColumn) {
        continue;
      }

      let numericCount = 0;
      let sequentialCount = 0;
      let lastValue = 0;

      for (let rowIndex = 0; rowIndex < Math.min(dataRows.length, 10); rowIndex++) {
        const value = dataRows[rowIndex][colIndex];

        if (value !== undefined && value !== null) {
          const numValue = parseFloat(value);

          if (!isNaN(numValue)) {
            numericCount++;

            if (rowIndex > 0 && numValue === lastValue + 1) {
              sequentialCount++;
            }

            lastValue = numValue;
          }
        }
      }

      columnScores[colIndex] = (numericCount + sequentialCount * 2) / (Math.min(dataRows.length, 10) * 3);
    }

    const maxScore = Math.max(...columnScores);
    if (maxScore > 0.4) {
      return columnScores.indexOf(maxScore);
    }

    return -1;
  }

  /**
   * Score how likely a column is a name column
   */
  private scoreColumnAsName(values: any[][], colIndex: number): number {
    if (colIndex < 0) return 0;
    const dataRows = values.slice(1, Math.min(11, values.length));
    let total = 0;
    let score = 0;
    for (const row of dataRows) {
      const v = row[colIndex];
      if (v && typeof v === "string") {
        total++;
        const t = v.trim();
        if ((/[\u0600-\u06FF]/.test(t) || /[a-zA-Z]/.test(t)) && t.length >= 2) score += 1.5;
        if (t.split(/\s+/).length >= 2) score += 1.0;
        if (!/^\d+$/.test(t)) score += 0.5;
        if (!/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(t)) score += 0.3;
      }
    }
    return total ? Math.min(1, score / (total * 3.3)) : 0;
  }

  /**
   * Score adjacent column pair as combined name
   */
  private scorePairAsName(values: any[][], leftCol: number, rightCol: number): number {
    if (leftCol < 0 || rightCol >= (values[0]?.length || 0)) return 0;
    const dataRows = values.slice(1, Math.min(11, values.length));
    let total = 0;
    let score = 0;
    for (const row of dataRows) {
      const a = row[leftCol];
      const b = row[rightCol];
      const combined = [a, b]
        .filter((x) => x && typeof x === "string")
        .map((x) => x.toString().trim())
        .join(" ");
      if (combined) {
        total++;
        if ((/[\u0600-\u06FF]/.test(combined) || /[a-zA-Z]/.test(combined)) && combined.length >= 3) score += 1.5;
        if (combined.split(/\s+/).length >= 2) score += 1.0;
        if (!/^\d+$/.test(combined)) score += 0.5;
      }
    }
    return total ? Math.min(1, score / (total * 3.0)) : 0;
  }
}

