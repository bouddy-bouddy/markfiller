/**
 * Excel Service - Main Orchestrator
 * Coordinates Excel operations using specialized services
 */

import { MarkType, Student, MarkInsertionResults, IntelligentWorksheetStructure, DetectedMarkTypes } from "../types";
import { ExcelColumnDetector } from "./excel/excelColumnDetector";
import { ExcelFormatDetector } from "./excel/excelFormatDetector";
import { ExcelNameMatcher, NameMatchConfig } from "./excel/excelNameMatcher";
import { ExcelMarkInserter } from "./excel/excelMarkInserter";
import { getNeighborValue } from "./excel/excelHelpers";

/* global Excel, console */

/**
 * Enhanced Excel Service with Massar Format Support
 *
 * This service orchestrates specialized sub-services for:
 * 1. Format detection (Massar vs Generic)
 * 2. Column detection (names, IDs, marks)
 * 3. Name matching (fuzzy logic, merged columns)
 * 4. Mark insertion (intelligent mapping)
 */
class ExcelService {
  private worksheetStructure: IntelligentWorksheetStructure | null = null;
  private columnDetector: ExcelColumnDetector;
  private formatDetector: ExcelFormatDetector;
  private nameMatcher: ExcelNameMatcher;
  private markInserter: ExcelMarkInserter;

  constructor() {
    this.columnDetector = new ExcelColumnDetector();
    this.formatDetector = new ExcelFormatDetector(this.columnDetector);
    this.nameMatcher = new ExcelNameMatcher();
    this.markInserter = new ExcelMarkInserter(this.nameMatcher);
  }

  /**
   * Set name matching configuration
   */
  setNameMatchConfig(config: Partial<NameMatchConfig>): void {
    this.nameMatcher.setConfig(config);
  }

  /**
   * Extract workbook metadata like المستوى (level) and القسم (section)
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

        for (let r = 0; r < rowsToScan.length; r++) {
          const row = rowsToScan[r];
          for (let c = 0; c < row.length; c++) {
            const cell = row[c];
            if (!cell || typeof cell !== "string") continue;
            const text = cell.toString();

            for (const matcher of labelMatchers) {
              if (matcher.patterns.some((p) => text.includes(p))) {
                const val = getNeighborValue(rowsToScan, r, c);
                if (val) {
                  if (matcher.kind === "level" && !result.level) result.level = val;
                  if (matcher.kind === "section" && !result.section) {
                    result.section = val;
                    result.class = val;
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
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");

        const range = sheet.getUsedRange();
        range.load(["values", "rowCount"]);

        await context.sync();

        const values = range.values as any[][];
        if (!values || values.length < 5) {
          return false;
        }

        // Detect format and analyze structure
        const isMassarFormat = this.formatDetector.detectMassarFormat(values);
        if (isMassarFormat) {
          this.worksheetStructure = this.formatDetector.analyzeMassarStructure(values);
          return true;
        }

        // Try generic format detection
        const genericStructure = this.formatDetector.analyzeGenericFormat(values);
        if (genericStructure) {
          this.worksheetStructure = genericStructure;
          return true;
        }

        return false;
      });
    } catch (error) {
      console.error("Excel validation error:", error);
      return false;
    }
  }

  /**
   * Get worksheet structure for mark insertion
   */
  getWorksheetStructure(): IntelligentWorksheetStructure | null {
    return this.worksheetStructure;
  }

  /**
   * Insert marks with intelligent column mapping
   */
  async insertMarks(
    extractedData: Student[],
    markType: string,
    detectedMarkTypes?: DetectedMarkTypes
  ): Promise<MarkInsertionResults> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.markInserter.insertMarks(extractedData, markType, this.worksheetStructure, detectedMarkTypes);
  }

  /**
   * Insert all marks for all detected mark types
   */
  async insertAllMarks(extractedData: Student[], detectedMarkTypes: DetectedMarkTypes): Promise<MarkInsertionResults> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.markInserter.insertAllMarks(extractedData, detectedMarkTypes, this.worksheetStructure);
  }

  /**
   * Insert marks starting at the currently selected cell
   */
  async insertMarksFromSelection(extractedData: Student[], markType: MarkType): Promise<MarkInsertionResults> {
    return this.markInserter.insertMarksFromSelection(extractedData, markType);
  }

  /**
   * Preview mapping before insertion
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
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.markInserter.previewMapping(extractedData, detectedMarkTypes, this.worksheetStructure);
  }

  /**
   * Format mark value for Massar Excel format (legacy compatibility)
   */
  formatMarkForMassar(mark: number): string {
    return parseFloat(mark.toString()).toFixed(2);
  }

  /**
   * Find student row (legacy compatibility - delegates to name matcher)
   */
  async findStudentRow(studentName: string, values: string[][]): Promise<number> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.nameMatcher.findStudentRow(studentName, values, this.worksheetStructure.studentNameColumn);
  }

  /**
   * Find student name column (legacy compatibility - delegates to column detector)
   */
  findStudentNameColumn(headers: string[]): number {
    return this.columnDetector.findStudentNameColumn(headers);
  }

  /**
   * Find student ID column (legacy compatibility - delegates to column detector)
   */
  findStudentIdColumn(headers: string[]): number {
    return this.columnDetector.findStudentIdColumn(headers);
  }

  /**
   * Find mark columns (legacy compatibility - delegates to column detector)
   */
  findMarkColumns(headers: string[]): Record<MarkType, number> {
    return this.columnDetector.findMarkColumns(headers);
  }
}

export default new ExcelService();
