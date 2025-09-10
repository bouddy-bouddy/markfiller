import { MarkType, Student, MarkInsertionResults, IntelligentWorksheetStructure, DetectedMarkTypes } from "../types";

type NameMatchConfig = {
  baseThreshold: number;
  shortNameThreshold: number;
  shortNameMaxLen: number;
  overlapRelaxedThreshold: number;
  minContainLen: number;
};

/* global Excel */

/**
 * Enhanced Excel Service with Massar Format Support
 *
 * This service now includes special handling for Massar Excel files with the following features:
 *
 * 1. MERGED STUDENT NAME COLUMNS:
 *    - In Massar format, student names are often split across multiple columns
 *    - The service automatically detects and merges adjacent name columns
 *    - Supports Arabic text patterns and filters out numeric/date columns
 *
 * 2. النقطة COLUMN DETECTION:
 *    - Looks for test headers (الفرض الأول, الفرض الثاني, etc.)
 *    - Finds the corresponding النقطة column for each test
 *    - Handles both horizontal and vertical النقطة column layouts
 *
 * 3. INTELLIGENT STRUCTURE ANALYSIS:
 *    - Analyzes the first several rows to understand the Excel structure
 *    - Provides detailed logging for debugging column detection
 *    - Falls back to generic detection if Massar-specific patterns aren't found
 *
 * Usage:
 * - The service automatically detects Massar format based on Arabic indicators
 * - Student name matching works with merged columns
 * - Mark insertion targets the correct النقطة columns
 */
class ExcelService {
  private worksheetStructure: IntelligentWorksheetStructure | null = null;
  private nameMatchConfig: NameMatchConfig = {
    baseThreshold: 0.82,
    shortNameThreshold: 0.9,
    shortNameMaxLen: 6,
    overlapRelaxedThreshold: 0.78,
    minContainLen: 3,
  };

  setNameMatchConfig(config: Partial<NameMatchConfig>): void {
    this.nameMatchConfig = { ...this.nameMatchConfig, ...config };
  }

  /**
   * Extract workbook metadata like المستوى (level) and القسم (section) from visible headers.
   * Searches first 10 rows for common Arabic labels and nearby values.
   */
  async getWorkbookMetadata(): Promise<{ level?: string; section?: string; class?: string }> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load("values");
        await context.sync();

        const values: any[][] = (range.values || []) as any[][];
        const rowsToScan = values.slice(0, Math.min(20, values.length));

        const result: { level?: string; section?: string; class?: string } = {};

        const labelMatchers: Array<{
          kind: "level" | "section";
          patterns: string[];
        }> = [
          { kind: "level", patterns: ["المستوى", "مستوى", "المستوي"] },
          { kind: "section", patterns: ["القسم", "قسم", "الفوج", "الشعبة", "الفصل"] },
        ];

        const getNeighborValue = (r: number, c: number): string | undefined => {
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
        };

        for (let r = 0; r < rowsToScan.length; r++) {
          const row = rowsToScan[r];
          for (let c = 0; c < row.length; c++) {
            const cell = row[c];
            if (!cell || typeof cell !== "string") continue;
            const text = cell.toString();

            for (const matcher of labelMatchers) {
              if (matcher.patterns.some((p) => text.includes(p))) {
                const val = getNeighborValue(r, c);
                if (val) {
                  if (matcher.kind === "level" && !result.level) result.level = val;
                  if (matcher.kind === "section" && !result.section) {
                    result.section = val;
                    result.class = val; // UI alias
                  }
                }
              }
            }
          }
        }

        // Backfill alias if only one is present
        if (result.section && !result.class) result.class = result.section;
        if (result.class && !result.section) result.section = result.class;
        return result;
      });
    } catch (error) {
      console.warn("Could not read workbook metadata:", error);
      return {};
    }
  }

  /**
   * Validates the Excel file and intelligently analyzes its structure
   */
  async validateExcelFile(): Promise<boolean> {
    try {
      return await Excel.run(async (context) => {
        // Get the active worksheet
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");

        // Get the used range to check headers
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        // First check if the file has any data
        if (!range.values || range.values.length < 5) {
          return false;
        }

        // Start with basic analysis - recognize Massar file format
        const isMassarFormat = this.detectMassarFormat(range.values);
        if (!isMassarFormat) {
          // Try generic format detection (non-Massar)
          const isGenericFormat = this.analyzeGenericFormat(range.values);
          if (!isGenericFormat) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      console.error("Excel validation error:", error);
      return false;
    }
  }

  /**
   * Detects if the file follows Massar format
   */
  private detectMassarFormat(values: any[][]): boolean {
    // Look for Arabic text patterns that would indicate this is a Massar file
    const massarIndicators = ["رقم التلميذ", "إسم التلميذ", "الفرض", "النقطة", "مسار", "القسم"];

    // Count how many indicators we found
    let foundIndicators = 0;

    // Flatten the 2D array and check each cell
    for (let row of values.slice(0, 20)) {
      // Only check first 10 rows for headers
      for (let cell of row) {
        if (cell && typeof cell === "string") {
          // Check if any of our indicators is contained in this cell
          for (let indicator of massarIndicators) {
            if (cell.toString().includes(indicator)) {
              foundIndicators++;

              // If we found at least 2 indicators, it's likely a Massar file
              if (foundIndicators >= 2) {
                // Intelligently analyze the structure with Massar-specific logic
                this.analyzeMassarStructure(values);
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Analyzes Massar file structure in detail with special handling for merged columns
   */
  private analyzeMassarStructure(values: any[][]): void {
    console.log("🔍 Analyzing Massar file structure...");

    const headers = this.extractHeaders(values);
    console.log("📋 Headers found:", headers);

    const studentNameColumn = this.findMassarStudentNameColumn(headers, values);
    console.log("👤 Student name column:", studentNameColumn, headers[studentNameColumn] || "N/A");

    const studentIdColumn = this.findStudentIdColumn(headers);
    console.log("🆔 Student ID column:", studentIdColumn, headers[studentIdColumn] || "N/A");

    const markColumns = this.findMassarMarkColumns(headers, values);
    console.log("📊 Mark columns found:", markColumns);

    const markColumnsConfidence = this.calculateMarkColumnConfidence(headers, values);
    console.log("🎯 Mark columns confidence:", markColumnsConfidence);

    const additionalMarkColumns = this.findAdditionalMarkColumns(headers, markColumns);
    console.log("➕ Additional mark columns:", additionalMarkColumns);

    this.worksheetStructure = {
      headers,
      studentNameColumn,
      studentIdColumn,
      totalRows: values.length,
      markColumns,
      markColumnsConfidence,
      additionalMarkColumns,
    };

    console.log("✅ Massar structure analysis complete:", this.worksheetStructure);
  }

  /**
   * Analyzes a generic (non-Massar) format
   */
  private analyzeGenericFormat(values: any[][]): boolean {
    // Try to find common patterns in generic student mark sheets
    // Look for student names and numbers
    const headers = this.extractHeaders(values);

    // Try to find student name column
    const studentNameColumn = this.findStudentNameColumn(headers);
    if (studentNameColumn === -1) {
      // Try a more aggressive approach - look for a column with string values that could be names
      const possibleNameColumn = this.findPossibleNameColumn(values);
      if (possibleNameColumn === -1) {
        return false;
      }

      // If we found a possible name column, construct the worksheet structure
      const studentIdColumn = this.findPossibleIdColumn(values, possibleNameColumn);
      const markColumns = this.detectNumericColumns(values, [possibleNameColumn, studentIdColumn]);
      const markColumnsConfidence = this.assignMarkTypesHeuristically(markColumns, values);

      // Convert to proper structure
      const formalMarkColumns: Record<MarkType, number> = {
        fard1: -1,
        fard2: -1,
        fard3: -1,
        fard4: -1,
        activities: -1,
      };

      // Assign detected columns to formal structure
      Object.entries(markColumnsConfidence).forEach(([markType, confidence]) => {
        if (confidence > 0.5) {
          formalMarkColumns[markType as MarkType] = markColumns[parseInt(markType.replace(/\D/g, ""))];
        }
      });

      const additionalMarkColumns = this.findAdditionalMarkColumns(headers, formalMarkColumns);

      this.worksheetStructure = {
        headers: headers.length > 0 ? headers : new Array(values[0].length).fill("").map((_, i) => `Column ${i + 1}`),
        studentNameColumn: possibleNameColumn,
        studentIdColumn,
        totalRows: values.length,
        markColumns: formalMarkColumns,
        markColumnsConfidence,
        additionalMarkColumns,
      };

      return true;
    }

    // If we found a student name column through headers, proceed with standard analysis
    const studentIdColumn = this.findStudentIdColumn(headers);
    const markColumns = this.findMarkColumns(headers);
    const markColumnsConfidence = this.calculateMarkColumnConfidence(headers, values);
    const additionalMarkColumns = this.findAdditionalMarkColumns(headers, markColumns);

    this.worksheetStructure = {
      headers,
      studentNameColumn,
      studentIdColumn,
      totalRows: values.length,
      markColumns,
      markColumnsConfidence,
      additionalMarkColumns,
    };

    return true;
  }

  /**
   * Find a column that likely contains student names based on content analysis
   */
  private findPossibleNameColumn(values: any[][]): number {
    // Skip the first row (assumed to be headers)
    const dataRows = values.slice(1);

    if (dataRows.length === 0 || dataRows[0].length === 0) {
      return -1;
    }

    // For each column, calculate score for how likely it contains names
    const columnScores: number[] = new Array(dataRows[0].length).fill(0);

    for (let colIndex = 0; colIndex < dataRows[0].length; colIndex++) {
      let stringCount = 0;
      let arabicCount = 0;
      let shortValueCount = 0;

      for (let rowIndex = 0; rowIndex < Math.min(dataRows.length, 10); rowIndex++) {
        const value = dataRows[rowIndex][colIndex];

        if (value && typeof value === "string") {
          stringCount++;

          // Check for Arabic characters
          if (/[\u0600-\u06FF]/.test(value)) {
            arabicCount++;
          }

          // Names are usually not very short
          if (value.length > 3) {
            shortValueCount++;
          }
        }
      }

      // Calculate a score
      columnScores[colIndex] = (stringCount + arabicCount * 2 + shortValueCount) / (Math.min(dataRows.length, 10) * 4);
    }

    // Find column with highest score
    const maxScore = Math.max(...columnScores);
    if (maxScore > 0.5) {
      // Threshold to consider it a name column
      return columnScores.indexOf(maxScore);
    }

    return -1;
  }

  /**
   * Find a column that likely contains student IDs
   */
  private findPossibleIdColumn(values: any[][], nameColumn: number): number {
    // Skip the first row (assumed to be headers)
    const dataRows = values.slice(1);

    if (dataRows.length === 0 || dataRows[0].length === 0) {
      return -1;
    }

    // For each column, calculate score for how likely it contains IDs
    const columnScores: number[] = new Array(dataRows[0].length).fill(0);

    for (let colIndex = 0; colIndex < dataRows[0].length; colIndex++) {
      // Skip the name column
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

            // Check if values are sequential (common for IDs)
            if (rowIndex > 0 && numValue === lastValue + 1) {
              sequentialCount++;
            }

            lastValue = numValue;
          }
        }
      }

      // Calculate a score
      columnScores[colIndex] = (numericCount + sequentialCount * 2) / (Math.min(dataRows.length, 10) * 3);
    }

    // Find column with highest score
    const maxScore = Math.max(...columnScores);
    if (maxScore > 0.4) {
      // Lower threshold for ID column
      return columnScores.indexOf(maxScore);
    }

    return -1;
  }

  /**
   * Detect columns that contain numeric values (potential mark columns)
   */
  private detectNumericColumns(values: any[][], excludeColumns: number[]): number[] {
    // Skip the first row (assumed to be headers)
    const dataRows = values.slice(1);

    if (dataRows.length === 0 || dataRows[0].length === 0) {
      return [];
    }

    const numericColumns: number[] = [];

    for (let colIndex = 0; colIndex < dataRows[0].length; colIndex++) {
      // Skip excluded columns
      if (excludeColumns.includes(colIndex)) {
        continue;
      }

      let numericCount = 0;
      let inRangeCount = 0;

      for (let rowIndex = 0; rowIndex < Math.min(dataRows.length, 10); rowIndex++) {
        const value = dataRows[rowIndex][colIndex];

        if (value !== undefined && value !== null) {
          const numValue = parseFloat(value);

          if (!isNaN(numValue)) {
            numericCount++;

            // Check if values are in the expected mark range (0-20)
            if (numValue >= 0 && numValue <= 20) {
              inRangeCount++;
            }
          }
        }
      }

      // If most values are numeric and in range, consider it a mark column
      if (numericCount > Math.min(dataRows.length, 10) * 0.7 && inRangeCount > Math.min(dataRows.length, 10) * 0.5) {
        numericColumns.push(colIndex);
      }
    }

    return numericColumns;
  }

  /**
   * Assign mark types to numeric columns heuristically
   */
  private assignMarkTypesHeuristically(columns: number[], values: any[][]): Record<MarkType, number> {
    // Create a confidence map for each mark type
    const confidenceMap: Record<MarkType, number> = {
      fard1: 0,
      fard2: 0,
      fard3: 0,
      fard4: 0,
      activities: 0,
    };

    // If we have no columns or data, return empty confidence map
    if (columns.length === 0 || values.length <= 1) {
      return confidenceMap;
    }

    // Skip header row
    const dataRows = values.slice(1);

    // Calculate statistics for each column
    const columnStats: Array<{ column: number; avg: number; stdDev: number; hasZeros: boolean }> = [];

    for (const column of columns) {
      const validValues: number[] = [];
      let zeroCount = 0;

      for (const row of dataRows) {
        if (row[column] !== undefined && row[column] !== null) {
          const numValue = parseFloat(row[column]);
          if (!isNaN(numValue)) {
            validValues.push(numValue);
            if (numValue === 0) {
              zeroCount++;
            }
          }
        }
      }

      if (validValues.length > 0) {
        // Calculate average
        const avg = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;

        // Calculate standard deviation
        const sumSquaredDiffs = validValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0);
        const stdDev = Math.sqrt(sumSquaredDiffs / validValues.length);

        columnStats.push({
          column,
          avg,
          stdDev,
          hasZeros: zeroCount > 0,
        });
      } else {
        columnStats.push({
          column,
          avg: 0,
          stdDev: 0,
          hasZeros: false,
        });
      }
    }

    // Sort columns by position (left to right)
    columnStats.sort((a, b) => a.column - b.column);

    // Assign confidence based on column position and statistics
    // In a typical marks sheet, fard1 comes before fard2, etc.
    if (columnStats.length >= 1) {
      confidenceMap.fard1 = 0.8;
    }

    if (columnStats.length >= 2) {
      confidenceMap.fard2 = 0.7;
    }

    if (columnStats.length >= 3) {
      confidenceMap.fard3 = 0.6;
    }

    if (columnStats.length >= 4) {
      confidenceMap.fard4 = 0.55;
    }

    if (columnStats.length >= 5) {
      confidenceMap.activities = 0.5;
    }

    // Adjust confidence based on statistics
    // Activities often have higher averages than tests
    if (columnStats.length >= 2) {
      // Find column with highest average
      const highestAvgColumn = columnStats.reduce(
        (highest, current) => (current.avg > highest.avg ? current : highest),
        columnStats[0]
      );

      // If one column has a much higher average, it's likely activities
      const avgDifference = columnStats.map((col) => Math.abs(col.avg - highestAvgColumn.avg));
      const maxDifference = Math.max(...avgDifference);

      if (maxDifference > 3 && highestAvgColumn.avg > 10) {
        const highestAvgIndex = columnStats.findIndex((col) => col.column === highestAvgColumn.column);

        // Reset confidence for activities
        confidenceMap.activities = 0;

        // Set high confidence for the column with highest average being activities
        if (highestAvgIndex === 0) confidenceMap.fard1 = 0.3;
        if (highestAvgIndex === 1) confidenceMap.fard2 = 0.3;
        if (highestAvgIndex === 2) confidenceMap.fard3 = 0.3;
        if (highestAvgIndex === 3) confidenceMap.activities = 0.3;

        // The column with highest average is likely activities
        confidenceMap.activities = 0.9;
      }
    }

    return confidenceMap;
  }

  /**
   * Calculate confidence in mark column identification
   */
  private calculateMarkColumnConfidence(headers: string[], values: any[][]): Record<MarkType, number> {
    const confidenceMap: Record<MarkType, number> = {
      fard1: 0,
      fard2: 0,
      fard3: 0,
      fard4: 0,
      activities: 0,
    };

    // Check header-based confidence
    headers.forEach((header, index) => {
      if (!header) return;

      const headerString = header.toString().toLowerCase();

      // Calculate confidence based on how closely the header matches expected patterns
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

    // Data-based confidence calculation could be added here
    // For example, analyzing the distribution of values in each column

    return confidenceMap;
  }

  /**
   * Find additional mark columns that don't match standard types
   */
  private findAdditionalMarkColumns(
    headers: string[],
    standardColumns: Record<MarkType, number>
  ): Array<{ index: number; header: string }> {
    const additionalColumns: Array<{ index: number; header: string }> = [];
    const standardColumnIndices = Object.values(standardColumns).filter((index) => index !== -1);

    headers.forEach((header, index) => {
      if (!header) return;

      const headerString = header.toString().toLowerCase();

      // Check if this might be a mark column but isn't one of our standard ones
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

  // Helper method to extract headers more reliably
  private extractHeaders(values: any[][]): string[] {
    // Try to find the row that has headers by looking for known column headers
    const headerKeywords = ["رقم التلميذ", "إسم التلميذ", "تاريخ", "رقم", "اسم"];

    for (let i = 0; i < Math.min(20, values.length); i++) {
      const row = values[i];
      // Check if this row contains any of our header keywords
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
    return values[0].map((cell) => (cell ? cell.toString() : ""));
  }

  /**
   * Find student name column with enhanced matching
   */
  findStudentNameColumn(headers: string[]): number {
    // Look for common name column headers in Massar and other formats
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
      // Added broader synonyms and French variants often seen in Massar exports
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
  private findMassarStudentNameColumn(headers: string[], values: any[][]): number {
    // In Massar format, student name is often merged from multiple columns
    // Look for the main name column first
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
    // Evaluate each column and its neighbor as a combined name
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

    // If not found by header, analyze the data structure to find merged name columns
    // Look for columns that contain Arabic text patterns typical of names
    const dataRows = values.slice(1, Math.min(6, values.length)); // Check first 5 data rows

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      let nameScore = 0;
      let totalRows = 0;

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const cellValue = dataRows[rowIndex][colIndex];

        if (cellValue && typeof cellValue === "string") {
          totalRows++;

          // Check for Arabic text
          if (/[\u0600-\u06FF]/.test(cellValue) || /[a-zA-Z]/.test(cellValue)) {
            nameScore += 2;
          }

          // Check for name patterns (multiple words, reasonable length)
          const words = cellValue.trim().split(/\s+/);
          if (words.length >= 2 && words.length <= 5) {
            nameScore += 1;
          }

          // Check if it's not a pure number or date
          if (!/^\d+$/.test(cellValue) && !/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(cellValue)) {
            nameScore += 1;
          }
        }
      }

      // If this column has a high name score, consider it the name column
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
    // Look for common ID column headers
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
    const markTypes: Record<MarkType, string[]> = {
      fard1: ["الفرض 1", "الفرض الأول", "فرض 1", "فرض١", "اختبار 1", "امتحان 1", "تقويم 1"],
      fard2: ["الفرض 2", "الفرض الثاني", "فرض 2", "فرض٢", "اختبار 2", "امتحان 2", "تقويم 2"],
      fard3: ["الفرض 3", "الفرض الثالث", "فرض 3", "فرض٣", "اختبار 3", "امتحان 3", "تقويم 3"],
      fard4: ["الفرض 4", "الفرض الرابع", "فرض 4", "فرض٤", "اختبار 4", "امتحان 4", "تقويم 4"],
      activities: ["الأنشطة", "النشاط", "أنشطة", "المهارات", "الأداء", "نشاط", "تطبيقات", "مراقبة مستمرة"],
    };

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
  private findMassarMarkColumns(headers: string[], values: any[][]): Record<MarkType, number> {
    const columns: Record<MarkType, number> = {
      fard1: -1,
      fard2: -1,
      fard3: -1,
      fard4: -1,
      activities: -1,
    };

    // In Massar format, look for test headers and their corresponding النقطة columns
    const testPatterns = [
      { type: "fard1" as MarkType, patterns: ["الفرض الأول", "الفرض 1", "فرض 1", "فرض الأول", "فرض١"] },
      { type: "fard2" as MarkType, patterns: ["الفرض الثاني", "الفرض 2", "فرض 2", "فرض الثاني", "فرض٢"] },
      { type: "fard3" as MarkType, patterns: ["الفرض الثالث", "الفرض 3", "فرض 3", "فرض الثالث", "فرض٣"] },
      { type: "fard4" as MarkType, patterns: ["الفرض الرابع", "الفرض 4", "فرض 4", "فرض الرابع", "فرض٤"] },
      {
        type: "activities" as MarkType,
        patterns: ["الأنشطة", "النشاط", "أنشطة", "المراقبة المستمرة", "مراقبة مستمرة"],
      },
    ];

    // Look through multiple rows to find the structure
    for (let rowIndex = 0; rowIndex < Math.min(5, values.length); rowIndex++) {
      const row = values[rowIndex];

      for (const testPattern of testPatterns) {
        // Find test header column
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = row[colIndex];

          if (cellValue && typeof cellValue === "string") {
            const found = testPattern.patterns.some((pattern) => cellValue.toString().includes(pattern));

            if (found) {
              // Look for النقطة column nearby (usually directly below or to the right)
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

      // Check the same column and nearby columns for النقطة
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

    // If no النقطة column found, prefer the first column under the test header block
    // Massar headers typically have the score column directly below the header cell
    if (testHeaderRow + 1 < values.length) {
      return testHeaderCol;
    }
    return -1;
  }

  /**
   * Get worksheet structure for mark insertion
   */
  getWorksheetStructure(): IntelligentWorksheetStructure | null {
    return this.worksheetStructure;
  }

  /**
   * Insert marks with intelligent column mapping based on detected mark types
   */
  async insertMarks(
    extractedData: Student[],
    markType: string,
    detectedMarkTypes?: DetectedMarkTypes
  ): Promise<MarkInsertionResults> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load(["values", "rowIndex", "columnIndex"]);

        await context.sync();

        const results: MarkInsertionResults = {
          success: 0,
          notFound: 0,
          notFoundStudents: [],
        };

        if (!this.worksheetStructure) {
          throw new Error("Worksheet structure not initialized");
        }

        // If we have detected mark types, use that to guide insertion
        let internalMarkType = this.getInternalMarkType(markType);

        // If we don't have the requested mark type but have detected other types,
        // suggest alternative columns to insert into
        if (detectedMarkTypes && internalMarkType) {
          const hasRequestedType = this.markTypeDetected(detectedMarkTypes, internalMarkType);

          if (!hasRequestedType) {
            // Find an available mark type that was detected
            const availableType = this.findAvailableMarkType(detectedMarkTypes);

            if (availableType) {
              internalMarkType = availableType;
            }
          }
        }

        if (!internalMarkType) {
          throw new Error(`Invalid mark type: ${markType}`);
        }

        const baseRow = range.rowIndex;
        const baseCol = range.columnIndex;

        for (const student of extractedData) {
          const rowIndexRel = await this.findStudentRow(student.name, range.values as string[][]);
          if (rowIndexRel !== -1) {
            // Get the correct column for this mark type
            const columnIndex = this.worksheetStructure.markColumns[internalMarkType];
            if (columnIndex !== -1) {
              const cell = sheet.getCell(baseRow + rowIndexRel, baseCol + columnIndex);
              const markValue = student.marks[internalMarkType];

              if (markValue !== null) {
                // Format mark to match Massar requirements
                cell.values = [[this.formatMarkForMassar(markValue)]];
                results.success++;
              }
            }
          } else {
            results.notFound++;
            results.notFoundStudents.push(student.name);
          }
        }

        await context.sync();
        return results;
      });
    } catch (error) {
      console.error("Excel interaction error:", error);
      throw error;
    }
  }

  /**
   * ENHANCED: Insert all marks for all detected mark types with intelligent mapping
   */
  async insertAllMarks(extractedData: Student[], detectedMarkTypes: DetectedMarkTypes): Promise<MarkInsertionResults> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load(["values", "rowIndex", "columnIndex"]);

        await context.sync();

        const results: MarkInsertionResults = {
          success: 0,
          notFound: 0,
          notFoundStudents: [],
        };

        if (!this.worksheetStructure) {
          throw new Error("Worksheet structure not initialized");
        }

        console.log("🎯 Starting intelligent mark mapping for all students...");
        console.log("📊 Worksheet structure:", this.worksheetStructure);
        console.log("📋 Detected mark types:", detectedMarkTypes);
        const workbookMarkTypes = this.detectAvailableMarkTypesInWorkbook(range.values as any[][]);
        console.log("🧭 Mark types available in workbook:", workbookMarkTypes);

        const baseRow = range.rowIndex;
        const baseCol = range.columnIndex;

        // Process each student
        for (const student of extractedData) {
          console.log(`\n🔍 Processing student: ${student.name}`);

          const rowIndexRel = await this.findStudentRow(student.name, range.values as string[][]);

          if (rowIndexRel !== -1) {
            const absRow = baseRow + rowIndexRel;
            console.log(`✅ Found student at row ${absRow}`);

            // Insert marks for all detected types
            const detectedKeys: (keyof DetectedMarkTypes)[] = [
              "hasFard1",
              "hasFard2",
              "hasFard3",
              "hasFard4",
              "hasActivities",
            ];
            const markTypes: (keyof DetectedMarkTypes)[] = detectedKeys.filter((t) => workbookMarkTypes[t]);

            for (const detectedType of markTypes) {
              if (!detectedMarkTypes[detectedType]) continue;

              // Map detected type to mark type
              const markType = this.mapDetectedTypeToMarkType(detectedType);
              if (!markType) continue;

              const columnIndex = this.worksheetStructure.markColumns[markType];
              if (columnIndex === -1) {
                console.log(`⚠️ No column found for ${markType}`);
                continue;
              }

              const markValue = student.marks[markType];
              if (markValue !== null) {
                const cell = sheet.getCell(absRow, baseCol + columnIndex);
                cell.values = [[this.formatMarkForMassar(markValue)]];
                results.success++;
                console.log(`✅ Inserted ${markType}: ${markValue} at row ${absRow}, col ${baseCol + columnIndex}`);
              } else {
                console.log(`⚠️ No mark value for ${markType}`);
              }
            }
          } else {
            results.notFound++;
            results.notFoundStudents.push(student.name);
            console.log(`❌ Student not found: ${student.name}`);
          }
        }

        await context.sync();
        console.log(`\n📊 Mapping completed - Success: ${results.success}, Not found: ${results.notFound}`);
        return results;
      });
    } catch (error) {
      console.error("Excel mapping error:", error);
      throw error;
    }
  }

  /**
   * QUICK FILL: Insert marks starting at the currently selected cell and fill downward
   * This manual mode writes the extracted marks for a chosen mark type in order,
   * starting at the selected cell and continuing downward one row per student.
   */
  async insertMarksFromSelection(extractedData: Student[], markType: MarkType): Promise<MarkInsertionResults> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const selection = context.workbook.getSelectedRange();
        selection.load(["rowIndex", "columnIndex", "address"]);
        await context.sync();

        const startRow = selection.rowIndex;
        const startCol = selection.columnIndex;

        const values: (string | number)[][] = extractedData.map((student) => {
          const value = student.marks[markType];
          return [value !== null ? this.formatMarkForMassar(value) : ""];
        });

        const targetRange = sheet.getRangeByIndexes(startRow, startCol, values.length, 1);
        targetRange.values = values;

        await context.sync();

        const inserted = values.filter((row) => row[0] !== "").length;
        return { success: inserted, notFound: 0, notFoundStudents: [] };
      });
    } catch (error) {
      console.error("Excel quick-fill insertion error:", error);
      throw error;
    }
  }

  /**
   * Map detected type to mark type
   */
  private mapDetectedTypeToMarkType(detectedType: keyof DetectedMarkTypes): MarkType | null {
    const mapping: Record<keyof DetectedMarkTypes, MarkType> = {
      hasFard1: "fard1",
      hasFard2: "fard2",
      hasFard3: "fard3",
      hasFard4: "fard4",
      hasActivities: "activities",
    };

    return mapping[detectedType] || null;
  }

  /**
   * Detect available mark types in the current workbook based on recognized columns
   */
  private detectAvailableMarkTypesInWorkbook(values?: any[][]): DetectedMarkTypes {
    try {
      const cellTexts: string[] = [];

      if (values && values.length > 0) {
        const rowsToScan = values.slice(0, Math.min(6, values.length));
        for (const row of rowsToScan) {
          for (const cell of row) {
            if (cell && typeof cell === "string") {
              cellTexts.push(cell.toString());
            }
          }
        }
      } else if (this.worksheetStructure) {
        // Fallback to scanning known headers if values aren't provided
        for (const h of this.worksheetStructure.headers) {
          if (h) cellTexts.push(h.toString());
        }
      }

      const includesAny = (patterns: string[]): boolean =>
        cellTexts.some((text) => patterns.some((p) => text.includes(p)));

      // Arabic label presence checks
      const hasFard1 = includesAny(["الفرض الأول", "الفرض 1", "فرض 1", "فرض الأول", "فرض١"]);
      const hasFard2 = includesAny(["الفرض الثاني", "الفرض 2", "فرض 2", "فرض الثاني", "فرض٢"]);
      const hasFard3 = includesAny(["الفرض الثالث", "الفرض 3", "فرض 3", "فرض الثالث", "فرض٣"]);
      const hasFard4 = includesAny(["الفرض الرابع", "الفرض 4", "فرض 4", "فرض الرابع", "فرض٤"]);
      const hasActivities = includesAny(["الأنشطة", "النشاط", "أنشطة", "المراقبة المستمرة", "مراقبة مستمرة"]);

      // If we couldn't detect anything via labels, fallback to structure if available
      const detected: DetectedMarkTypes = { hasFard1, hasFard2, hasFard3, hasFard4, hasActivities };
      if (!hasFard1 && !hasFard2 && !hasFard3 && !hasFard4 && !hasActivities && this.worksheetStructure) {
        const columns = this.worksheetStructure.markColumns;
        return {
          hasFard1: columns.fard1 !== -1,
          hasFard2: columns.fard2 !== -1,
          hasFard3: columns.fard3 !== -1,
          hasFard4: columns.fard4 !== -1,
          hasActivities: columns.activities !== -1,
        };
      }

      return detected;
    } catch (error) {
      console.warn("Workbook mark type detection failed, falling back to structure:", error);
      if (!this.worksheetStructure) {
        throw new Error("Worksheet structure not initialized");
      }
      const columns = this.worksheetStructure.markColumns;
      return {
        hasFard1: columns.fard1 !== -1,
        hasFard2: columns.fard2 !== -1,
        hasFard3: columns.fard3 !== -1,
        hasFard4: columns.fard4 !== -1,
        hasActivities: columns.activities !== -1,
      };
    }
  }

  /**
   * ENHANCED: Preview mapping before insertion
   */
  async previewMapping(
    extractedData: Student[],
    detectedMarkTypes: DetectedMarkTypes
  ): Promise<{
    mappingPreview: Array<{
      studentName: string;
      studentFound: boolean;
      excelRow?: number;
      mappings: Array<{
        markType: MarkType;
        extractedValue: number | null;
        targetColumn: number;
        targetColumnHeader: string;
        willInsert: boolean;
      }>;
    }>;
    summary: {
      totalStudents: number;
      studentsFound: number;
      studentsNotFound: number;
      totalMarksToInsert: number;
    };
  }> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        if (!this.worksheetStructure) {
          throw new Error("Worksheet structure not initialized");
        }

        const mappingPreview: Array<{
          studentName: string;
          studentFound: boolean;
          excelRow?: number;
          mappings: Array<{
            markType: MarkType;
            extractedValue: number | null;
            targetColumn: number;
            targetColumnHeader: string;
            willInsert: boolean;
          }>;
        }> = [];

        let studentsFound = 0;
        let totalMarksToInsert = 0;

        for (const student of extractedData) {
          const rowIndex = await this.findStudentRow(student.name, range.values as string[][]);
          const studentFound = rowIndex !== -1;

          if (studentFound) studentsFound++;

          const mappings: Array<{
            markType: MarkType;
            extractedValue: number | null;
            targetColumn: number;
            targetColumnHeader: string;
            willInsert: boolean;
          }> = [];

          // Check only detected mark types
          const detectedMarkTypesList: MarkType[] = [];
          if (detectedMarkTypes.hasFard1) detectedMarkTypesList.push("fard1");
          if (detectedMarkTypes.hasFard2) detectedMarkTypesList.push("fard2");
          if (detectedMarkTypes.hasFard3) detectedMarkTypesList.push("fard3");
          if (detectedMarkTypes.hasFard4) detectedMarkTypesList.push("fard4");
          if (detectedMarkTypes.hasActivities) detectedMarkTypesList.push("activities");

          for (const markType of detectedMarkTypesList) {
            const columnIndex = this.worksheetStructure.markColumns[markType];
            const extractedValue = student.marks[markType];
            const willInsert = studentFound && columnIndex !== -1 && extractedValue !== null;

            if (willInsert) totalMarksToInsert++;

            mappings.push({
              markType,
              extractedValue,
              targetColumn: columnIndex,
              targetColumnHeader:
                columnIndex !== -1
                  ? this.worksheetStructure.headers[columnIndex] || `Column ${columnIndex + 1}`
                  : "غير متوفر",
              willInsert,
            });
          }

          mappingPreview.push({
            studentName: student.name,
            studentFound,
            excelRow: studentFound ? rowIndex : undefined,
            mappings,
          });
        }

        return {
          mappingPreview,
          summary: {
            totalStudents: extractedData.length,
            studentsFound,
            studentsNotFound: extractedData.length - studentsFound,
            totalMarksToInsert,
          },
        };
      });
    } catch (error) {
      console.error("Mapping preview error:", error);
      throw error;
    }
  }

  /**
   * Check if a specific mark type was detected in the image
   */
  private markTypeDetected(detectedTypes: DetectedMarkTypes, markType: MarkType): boolean {
    switch (markType) {
      case "fard1":
        return detectedTypes.hasFard1;
      case "fard2":
        return detectedTypes.hasFard2;
      case "fard3":
        return detectedTypes.hasFard3;
      case "fard4":
        return detectedTypes.hasFard4;
      case "activities":
        return detectedTypes.hasActivities;
      default:
        return false;
    }
  }

  /**
   * Find an available mark type that was detected
   */
  private findAvailableMarkType(detectedTypes: DetectedMarkTypes): MarkType | null {
    if (detectedTypes.hasFard1) return "fard1";
    if (detectedTypes.hasFard2) return "fard2";
    if (detectedTypes.hasFard3) return "fard3";
    if (detectedTypes.hasFard4) return "fard4";
    if (detectedTypes.hasActivities) return "activities";
    return null;
  }

  /**
   * Map from Arabic display name to internal mark type
   */
  private getInternalMarkType(arabicMarkType: string): MarkType | null {
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
   * Enhanced student name matching with fuzzy logic and merged column support
   */
  async findStudentRow(studentName: string, values: string[][]): Promise<number> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    const nameColumn = this.worksheetStructure.studentNameColumn;
    const nameToFind = this.normalizeArabicText(studentName);

    // First try exact match (after normalization)
    for (let i = 1; i < values.length; i++) {
      const cellName = this.getMergedStudentName(values[i], nameColumn);
      const normalizedCellName = this.normalizeArabicText(cellName);
      if (normalizedCellName === nameToFind) {
        return i;
      }
    }

    // Order-agnostic full-name equality (all tokens must match, order can differ)
    {
      const targetTokens = nameToFind.split(/\s+/).filter(Boolean).sort();
      for (let i = 1; i < values.length; i++) {
        const cellName = this.getMergedStudentName(values[i], nameColumn);
        const normalizedCellName = this.normalizeArabicText(cellName);
        const cellTokens = normalizedCellName.split(/\s+/).filter(Boolean).sort();
        if (
          targetTokens.length >= 2 &&
          cellTokens.length === targetTokens.length &&
          cellTokens.every((t, idx) => t === targetTokens[idx])
        ) {
          return i;
        }
      }
    }

    // Finally try fuzzy matching requiring high similarity of the FULL name only
    for (let i = 1; i < values.length; i++) {
      const cellName = this.getMergedStudentName(values[i], nameColumn);
      const normalizedCellName = this.normalizeArabicText(cellName);
      // Require strong similarity score and identical token count to avoid first-name-only matches
      const tokensA = nameToFind.split(/\s+/).filter(Boolean);
      const tokensB = normalizedCellName.split(/\s+/).filter(Boolean);
      const strongSimilarity = this.compareNames(nameToFind, normalizedCellName);
      if (strongSimilarity && tokensA.length === tokensB.length) {
        return i;
      }
    }

    // Last resort: scan across all columns in the row to detect the name cell if studentName appears elsewhere
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const concatenated = this.normalizeArabicText(row.map((c) => (c == null ? "" : c.toString())).join(" "));
      // Only consider as match if full token sequence appears, not just first name
      const pattern = new RegExp(`(^|\\s)${nameToFind.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}($|\\s)`);
      if (pattern.test(concatenated)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Get merged student name from potentially multiple columns
   */
  private getMergedStudentName(row: any[], primaryNameColumn: number): string {
    // Start with the primary name column
    let fullName = row[primaryNameColumn] ? row[primaryNameColumn].toString().trim() : "";
    const originalName = fullName;

    // In Massar format, check adjacent columns for additional name parts
    // This handles cases where the name is split across multiple columns
    if (primaryNameColumn + 1 < row.length) {
      const nextColumn = row[primaryNameColumn + 1];
      if (nextColumn && typeof nextColumn === "string") {
        const nextColumnText = nextColumn.toString().trim();

        // Check if the next column contains name-like text (Arabic, Latin letters, not numbers/dates)
        if (
          ((/[\u0600-\u06FF]/.test(nextColumnText) || /[a-zA-Z]/.test(nextColumnText)) &&
            !/^\d+$/.test(nextColumnText) &&
            !/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(nextColumnText)) ||
          // Some Massar sheets have first/last separated with dashes or commas; still treat as name
          (/^[\p{L} ,\-']+$/u.test(nextColumnText) && nextColumnText.length >= 2)
        ) {
          if (!fullName.includes(nextColumnText)) {
            fullName = (fullName ? fullName + " " : "") + nextColumnText;
          }
        }
      }
    }

    // Also check the column before the primary name column
    if (primaryNameColumn > 0) {
      const prevColumn = row[primaryNameColumn - 1];
      if (prevColumn && typeof prevColumn === "string") {
        const prevColumnText = prevColumn.toString().trim();

        // Check if the previous column contains name-like text
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

    // Log name merging process for debugging
    if (finalName !== originalName) {
      console.log(`🔗 Merged name: "${originalName}" → "${finalName}" (column ${primaryNameColumn})`);
    }

    return finalName;
  }

  normalizeArabicText(text: string | undefined): string {
    if (!text) return "";

    // Convert to string and normalize compatibility forms first
    let s = text.toString();

    // Remove BOM and invisible formatting/RTL marks that often sneak in from Excel/OCR
    // - Zero width: U+200B..U+200D, U+FEFF, U+2060
    // - Directional marks: U+200E (LRM), U+200F (RLM), U+061C (ALM)
    // - Embedding/override: U+202A..U+202E, Isolates: U+2066..U+2069
    s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, "");

    // Replace special/nb spaces with a normal space
    s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");

    // Remove Arabic tatweel/kashida
    s = s.replace(/\u0640/g, "");

    // Normalize compatibility/composition
    s = s.normalize("NFKC");

    // Remove Latin combining marks (already covered by NFKC) and explicitly remove Arabic diacritics
    // Arabic diacritics ranges: 0610-061A, 064B-065F, 0670, 06D6-06DC, 06DF-06E8, 06EA-06ED
    s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");

    // Normalize common Arabic letter variants that differ by code point but look identical
    // Persian Yeh -> Arabic Yeh, Keheh -> Kaf, Heh goal -> Heh
    s = s
      .replace(/\u06CC/g, "\u064A") // ی -> ي
      .replace(/\u06A9/g, "\u0643") // ک -> ك
      .replace(/\u06C1/g, "\u0647"); // ہ -> ه

    // Unify alef variants and common letter variants
    s = s
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي");

    // Replace Lam-Alef ligatures with their decomposed form
    s = s.replace(/[\uFEFB-\uFEFE]/g, "لا");

    // Keep only letters/numbers/spaces; drop punctuation/symbols that can confuse matching
    s = s.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ");

    // Collapse repeated whitespace, trim, and lowercase (Arabic is case-insensitive)
    s = s.replace(/\s+/g, " ").trim().toLowerCase();

    return s;
  }

  compareNames(name1: string, name2: string): boolean {
    // Normalize again for safety (callers usually pass normalized values already)
    const a = this.normalizeArabicText(name1);
    const b = this.normalizeArabicText(name2);

    if (a === b) return true;

    // Quick containment check ignoring spaces
    const aNoSpace = a.replace(/\s+/g, "");
    const bNoSpace = b.replace(/\s+/g, "");
    if (aNoSpace.includes(bNoSpace) || bNoSpace.includes(aNoSpace)) {
      if (Math.min(aNoSpace.length, bNoSpace.length) >= this.nameMatchConfig.minContainLen) return true;
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

    const simRaw = this.calculateSimilarity(a, b);
    const simNoSpace = this.calculateSimilarity(aNoSpace, bNoSpace);
    const simTok = this.calculateSimilarity(aTok, bTok);

    // Adaptive thresholding
    let threshold = this.nameMatchConfig.baseThreshold;
    const minLen = Math.min(a.length, b.length);
    if (minLen <= this.nameMatchConfig.shortNameMaxLen) threshold = this.nameMatchConfig.shortNameThreshold;

    // If tokens largely overlap, allow slightly lower threshold
    const aSet = new Set(a.split(/\s+/).filter(Boolean));
    const bSet = new Set(b.split(/\s+/).filter(Boolean));
    const overlap = [...aSet].filter((t) => bSet.has(t)).length;
    const required = Math.max(1, Math.ceil(Math.min(aSet.size, bSet.size) * 0.6));
    if (overlap >= required && Math.max(aSet.size, bSet.size) >= 2)
      threshold = Math.min(threshold, this.nameMatchConfig.overlapRelaxedThreshold);

    const best = Math.max(simRaw, simNoSpace, simTok);
    return best >= threshold;
  }

  calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  editDistance(s1: string, s2: string): number {
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

  formatMarkForMassar(mark: number): string {
    // Ensure mark is formatted as required by Massar
    return parseFloat(mark.toString()).toFixed(2);
  }

  // Helper: score how likely a column is a name column
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

  // Helper: score adjacent column pair as combined name
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
export default new ExcelService();
