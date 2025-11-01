/**
 * Excel Service - Main Orchestrator (Optimized)
 * Coordinates Excel operations using specialized services
 * Features: lazy initialization, caching, request deduplication
 */

import { MarkType, Student, MarkInsertionResults, IntelligentWorksheetStructure, DetectedMarkTypes } from "../../types";
import { ExcelColumnDetector } from "./excelColumnDetector";
import { ExcelFormatDetector } from "./excelFormatDetector";
import { ExcelNameMatcher, NameMatchConfig } from "./excelNameMatcher";
import { ExcelMarkInserter } from "./excelMarkInserter";
import { getNeighborValue } from "./excelHelpers";
import { logger } from "../../utils/logger";

/* global Excel */

/**
 * Enhanced Excel Service with Massar Format Support (Optimized)
 *
 * This service orchestrates specialized sub-services for:
 * 1. Format detection (Massar vs Generic)
 * 2. Column detection (names, IDs, marks)
 * 3. Name matching (fuzzy logic, merged columns)
 * 4. Mark insertion (intelligent mapping)
 *
 * Performance optimizations:
 * - Lazy initialization of sub-services
 * - Cached worksheet structure with TTL
 * - Request deduplication for simultaneous calls
 * - Combined Excel operations where possible
 */

interface CachedStructure {
  structure: IntelligentWorksheetStructure;
  timestamp: number;
  sheetName: string;
}

interface CachedMetadata {
  metadata: { level?: string; section?: string; class?: string };
  timestamp: number;
  sheetName: string;
}

class ExcelService {
  // Lazy-initialized sub-services
  private _columnDetector: ExcelColumnDetector | null = null;
  private _formatDetector: ExcelFormatDetector | null = null;
  private _nameMatcher: ExcelNameMatcher | null = null;
  private _markInserter: ExcelMarkInserter | null = null;

  // Caching
  private cachedStructure: CachedStructure | null = null;
  private cachedMetadata: CachedMetadata | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Request deduplication
  private pendingValidation: Promise<boolean> | null = null;
  private pendingMetadata: Promise<{ level?: string; section?: string; class?: string }> | null = null;

  constructor() {
    // Services are now lazy-initialized via getters
  }

  /**
   * Lazy getter for column detector
   */
  private get columnDetector(): ExcelColumnDetector {
    if (!this._columnDetector) {
      this._columnDetector = new ExcelColumnDetector();
    }
    return this._columnDetector;
  }

  /**
   * Lazy getter for format detector
   */
  private get formatDetector(): ExcelFormatDetector {
    if (!this._formatDetector) {
      this._formatDetector = new ExcelFormatDetector(this.columnDetector);
    }
    return this._formatDetector;
  }

  /**
   * Lazy getter for name matcher
   */
  private get nameMatcher(): ExcelNameMatcher {
    if (!this._nameMatcher) {
      this._nameMatcher = new ExcelNameMatcher();
    }
    return this._nameMatcher;
  }

  /**
   * Lazy getter for mark inserter
   */
  private get markInserter(): ExcelMarkInserter {
    if (!this._markInserter) {
      this._markInserter = new ExcelMarkInserter(this.nameMatcher);
    }
    return this._markInserter;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL_MS;
  }

  /**
   * Invalidate all caches (call when worksheet changes)
   */
  invalidateCache(): void {
    this.cachedStructure = null;
    this.cachedMetadata = null;
    this.pendingValidation = null;
    this.pendingMetadata = null;
    logger.debug("📦 Excel service cache invalidated");
  }

  /**
   * Set name matching configuration
   */
  setNameMatchConfig(config: Partial<NameMatchConfig>): void {
    this.nameMatcher.setConfig(config);
  }

  /**
   * Extract workbook metadata like المستوى (level) and القسم (section)
   * Optimized with caching and request deduplication
   */
  async getWorkbookMetadata(): Promise<{ level?: string; section?: string; class?: string }> {
    try {
      // Request deduplication - return pending promise if one exists
      if (this.pendingMetadata) {
        logger.debug("📦 Returning pending metadata request");
        return this.pendingMetadata;
      }

      // Check cache first
      const metadataPromise = Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");
        const range = sheet.getUsedRange();
        range.load("values");
        await context.sync();

        const sheetName = sheet.name;

        // Return cached metadata if valid and for same sheet
        if (this.cachedMetadata && this.cachedMetadata.sheetName === sheetName && this.isCacheValid(this.cachedMetadata.timestamp)) {
          logger.debug("📦 Using cached metadata");
          return this.cachedMetadata.metadata;
        }

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

        // Cache the result
        this.cachedMetadata = {
          metadata: result,
          timestamp: Date.now(),
          sheetName,
        };

        return result;
      });

      // Store pending request
      this.pendingMetadata = metadataPromise;

      // Wait for completion
      const result = await metadataPromise;

      // Clear pending request
      this.pendingMetadata = null;

      return result;
    } catch (error) {
      this.pendingMetadata = null;
      logger.warn("Could not read workbook metadata:", error);
      return {};
    }
  }

  /**
   * Validates the Excel file and intelligently analyzes its structure
   * Optimized with caching and request deduplication
   */
  async validateExcelFile(): Promise<boolean> {
    try {
      // Request deduplication - return pending promise if one exists
      if (this.pendingValidation) {
        logger.debug("📦 Returning pending validation request");
        return this.pendingValidation;
      }

      const validationPromise = Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");

        const range = sheet.getUsedRange();
        range.load(["values", "rowCount"]);

        await context.sync();

        const sheetName = sheet.name;
        const values = range.values as any[][];

        // Return cached structure if valid and for same sheet
        if (this.cachedStructure && this.cachedStructure.sheetName === sheetName && this.isCacheValid(this.cachedStructure.timestamp)) {
          logger.debug("📦 Using cached worksheet structure");
          return true;
        }

        if (!values || values.length < 5) {
          return false;
        }

        // Detect format and analyze structure
        const isMassarFormat = this.formatDetector.detectMassarFormat(values);
        let structure: IntelligentWorksheetStructure | null = null;

        if (isMassarFormat) {
          structure = this.formatDetector.analyzeMassarStructure(values);
        } else {
          // Try generic format detection
          structure = this.formatDetector.analyzeGenericFormat(values);
        }

        if (structure) {
          // Cache the structure
          this.cachedStructure = {
            structure,
            timestamp: Date.now(),
            sheetName,
          };
          logger.debug("📦 Cached worksheet structure");
          return true;
        }

        return false;
      });

      // Store pending request
      this.pendingValidation = validationPromise;

      // Wait for completion
      const result = await validationPromise;

      // Clear pending request
      this.pendingValidation = null;

      return result;
    } catch (error) {
      this.pendingValidation = null;
      logger.error("Excel validation error:", error);
      return false;
    }
  }

  /**
   * Get worksheet structure for mark insertion
   * Now returns cached structure
   */
  getWorksheetStructure(): IntelligentWorksheetStructure | null {
    return this.cachedStructure?.structure || null;
  }

  /**
   * Insert marks with intelligent column mapping
   */
  async insertMarks(
    extractedData: Student[],
    markType: string,
    detectedMarkTypes?: DetectedMarkTypes
  ): Promise<MarkInsertionResults> {
    const structure = this.getWorksheetStructure();
    if (!structure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.markInserter.insertMarks(extractedData, markType, structure, detectedMarkTypes);
  }

  /**
   * Insert all marks for all detected mark types
   */
  async insertAllMarks(extractedData: Student[], detectedMarkTypes: DetectedMarkTypes): Promise<MarkInsertionResults> {
    const structure = this.getWorksheetStructure();
    if (!structure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.markInserter.insertAllMarks(extractedData, detectedMarkTypes, structure);
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
    const structure = this.getWorksheetStructure();
    if (!structure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.markInserter.previewMapping(extractedData, detectedMarkTypes, structure);
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
    const structure = this.getWorksheetStructure();
    if (!structure) {
      throw new Error("Worksheet structure not initialized");
    }

    return this.nameMatcher.findStudentRow(studentName, values, structure.studentNameColumn);
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
