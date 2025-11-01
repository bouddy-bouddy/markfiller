/**
 * Excel Mark Inserter
 * Handles insertion of marks into Excel sheets
 */

import { MarkType, Student, MarkInsertionResults, IntelligentWorksheetStructure, DetectedMarkTypes } from "../../types";
import { formatMarkForMassar, mapDetectedTypeToMarkType, getInternalMarkType } from "./excelHelpers";
import { ExcelNameMatcher } from "./excelNameMatcher";
import { logger } from "../../utils/logger";

/* global Excel */

export class ExcelMarkInserter {
  private nameMatcher: ExcelNameMatcher;

  constructor(nameMatcher: ExcelNameMatcher) {
    this.nameMatcher = nameMatcher;
  }

  /**
   * Insert marks with intelligent column mapping (optimized with batch updates)
   */
  async insertMarks(
    extractedData: Student[],
    markType: string,
    structure: IntelligentWorksheetStructure,
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

        let internalMarkType = getInternalMarkType(markType);

        // If we don't have the requested mark type but have detected other types
        if (detectedMarkTypes && internalMarkType) {
          const hasRequestedType = this.markTypeDetected(detectedMarkTypes, internalMarkType);

          if (!hasRequestedType) {
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
        const columnIndex = structure.markColumns[internalMarkType];

        if (columnIndex === -1) {
          logger.warn(`No column found for mark type: ${internalMarkType}`);
          return results;
        }

        // Pre-calculate all cell updates with relative positions (batch preparation)
        const cellUpdates: Array<{ rowRel: number; value: string | number }> = [];

        for (const student of extractedData) {
          const rowIndexRel = this.nameMatcher.findStudentRow(
            student.name,
            range.values as string[][],
            structure.studentNameColumn
          );
          if (rowIndexRel !== -1) {
            const markValue = student.marks[internalMarkType];

            if (markValue !== null) {
              cellUpdates.push({
                rowRel: rowIndexRel,
                value: formatMarkForMassar(markValue),
              });
              results.success++;
            }
          } else {
            results.notFound++;
            results.notFoundStudents.push(student.name);
          }
        }

        // Optimized batch update: group updates by column for bulk range operations
        if (cellUpdates.length > 0) {
          // Sort updates by row for potential range optimization
          cellUpdates.sort((a, b) => a.rowRel - b.rowRel);

          // Apply all cell updates - Excel queues these internally before sync
          for (const update of cellUpdates) {
            const cell = sheet.getCell(baseRow + update.rowRel, baseCol + columnIndex);
            cell.values = [[update.value]];
          }
        }

        await context.sync();
        return results;
      });
    } catch (error) {
      logger.error("Excel interaction error:", error);
      throw error;
    }
  }

  /**
   * Insert all marks for all detected mark types (optimized with batch updates)
   */
  async insertAllMarks(
    extractedData: Student[],
    detectedMarkTypes: DetectedMarkTypes,
    structure: IntelligentWorksheetStructure
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

        logger.info("🎯 Starting intelligent mark mapping for all students...");
        logger.debug("📊 Worksheet structure:", structure);
        logger.debug("📋 Detected mark types:", detectedMarkTypes);
        const workbookMarkTypes = this.detectAvailableMarkTypesInWorkbook(range.values as any[][], structure);
        logger.debug("🧭 Mark types available in workbook:", workbookMarkTypes);

        const baseRow = range.rowIndex;
        const baseCol = range.columnIndex;

        // Pre-calculate all mark types to process
        const detectedKeys: (keyof DetectedMarkTypes)[] = [
          "hasFard1",
          "hasFard2",
          "hasFard3",
          "hasFard4",
          "hasActivities",
        ];
        const markTypesToProcess: (keyof DetectedMarkTypes)[] = detectedKeys.filter((t) => workbookMarkTypes[t]);

        // Optimized batch preparation: group updates by column for better performance
        interface CellUpdate {
          row: number;
          col: number;
          value: string | number;
          markType: string;
        }
        const cellUpdates: CellUpdate[] = [];

        for (const student of extractedData) {
          logger.debug(`\n🔍 Processing student: ${student.name}`);

          const rowIndexRel = this.nameMatcher.findStudentRow(
            student.name,
            range.values as string[][],
            structure.studentNameColumn
          );

          if (rowIndexRel !== -1) {
            const absRow = baseRow + rowIndexRel;
            logger.debug(`✅ Found student at row ${absRow}`);

            for (const detectedType of markTypesToProcess) {
              if (!detectedMarkTypes[detectedType]) continue;

              const markType = mapDetectedTypeToMarkType(detectedType);
              if (!markType) continue;

              const columnIndex = structure.markColumns[markType];
              if (columnIndex === -1) {
                logger.debug(`⚠️ No column found for ${markType}`);
                continue;
              }

              const markValue = student.marks[markType];
              if (markValue !== null) {
                cellUpdates.push({
                  row: absRow,
                  col: baseCol + columnIndex,
                  value: formatMarkForMassar(markValue),
                  markType: markType,
                });
                results.success++;
                logger.debug(`✅ Queued ${markType}: ${markValue} at row ${absRow}, col ${baseCol + columnIndex}`);
              } else {
                logger.debug(`⚠️ No mark value for ${markType}`);
              }
            }
          } else {
            results.notFound++;
            results.notFoundStudents.push(student.name);
            logger.debug(`❌ Student not found: ${student.name}`);
          }
        }

        // Optimized batch update: sort by row then column for optimal Excel processing
        if (cellUpdates.length > 0) {
          logger.info(`📝 Applying ${cellUpdates.length} cell updates in optimized batch...`);
          
          // Sort updates for better cache locality and Excel performance
          cellUpdates.sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
          });

          // Queue all cell updates - Excel batches these internally before sync
          for (const update of cellUpdates) {
            const cell = sheet.getCell(update.row, update.col);
            cell.values = [[update.value]];
          }
        }

        await context.sync();
        logger.info(`\n📊 Mapping completed - Success: ${results.success}, Not found: ${results.notFound}`);
        return results;
      });
    } catch (error) {
      logger.error("Excel mapping error:", error);
      throw error;
    }
  }

  /**
   * Insert marks starting at the currently selected cell
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
          return [value !== null ? formatMarkForMassar(value) : ""];
        });

        const targetRange = sheet.getRangeByIndexes(startRow, startCol, values.length, 1);
        targetRange.values = values;

        await context.sync();

        const inserted = values.filter((row) => row[0] !== "").length;
        return { success: inserted, notFound: 0, notFoundStudents: [] };
      });
    } catch (error) {
      logger.error("Excel quick-fill insertion error:", error);
      throw error;
    }
  }

  /**
   * Preview mapping before insertion
   */
  async previewMapping(
    extractedData: Student[],
    detectedMarkTypes: DetectedMarkTypes,
    structure: IntelligentWorksheetStructure
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
          const rowIndex = this.nameMatcher.findStudentRow(
            student.name,
            range.values as string[][],
            structure.studentNameColumn
          );
          const studentFound = rowIndex !== -1;

          if (studentFound) studentsFound++;

          const mappings: Array<{
            markType: MarkType;
            extractedValue: number | null;
            targetColumn: number;
            targetColumnHeader: string;
            willInsert: boolean;
          }> = [];

          const detectedMarkTypesList: MarkType[] = [];
          if (detectedMarkTypes.hasFard1) detectedMarkTypesList.push("fard1");
          if (detectedMarkTypes.hasFard2) detectedMarkTypesList.push("fard2");
          if (detectedMarkTypes.hasFard3) detectedMarkTypesList.push("fard3");
          if (detectedMarkTypes.hasFard4) detectedMarkTypesList.push("fard4");
          if (detectedMarkTypes.hasActivities) detectedMarkTypesList.push("activities");

          for (const markType of detectedMarkTypesList) {
            const columnIndex = structure.markColumns[markType];
            const extractedValue = student.marks[markType];
            const willInsert = studentFound && columnIndex !== -1 && extractedValue !== null;

            if (willInsert) totalMarksToInsert++;

            mappings.push({
              markType,
              extractedValue,
              targetColumn: columnIndex,
              targetColumnHeader:
                columnIndex !== -1 ? structure.headers[columnIndex] || `Column ${columnIndex + 1}` : "غير متوفر",
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
      logger.error("Mapping preview error:", error);
      throw error;
    }
  }

  /**
   * Check if a specific mark type was detected
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
   * Detect available mark types in the current workbook
   */
  private detectAvailableMarkTypesInWorkbook(
    values?: any[][],
    structure?: IntelligentWorksheetStructure
  ): DetectedMarkTypes {
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
      } else if (structure) {
        for (const h of structure.headers) {
          if (h) cellTexts.push(h.toString());
        }
      }

      const includesAny = (patterns: string[]): boolean =>
        cellTexts.some((text) => patterns.some((p) => text.includes(p)));

      const hasFard1 = includesAny(["الفرض الأول", "الفرض 1", "فرض 1", "فرض الأول", "فرض١"]);
      const hasFard2 = includesAny(["الفرض الثاني", "الفرض 2", "فرض 2", "فرض الثاني", "فرض٢"]);
      const hasFard3 = includesAny(["الفرض الثالث", "الفرض 3", "فرض 3", "فرض الثالث", "فرض٣"]);
      const hasFard4 = includesAny(["الفرض الرابع", "الفرض 4", "فرض 4", "فرض الرابع", "فرض٤"]);
      const hasActivities = includesAny(["الأنشطة", "النشاط", "أنشطة", "المراقبة المستمرة", "مراقبة مستمرة"]);

      const detected: DetectedMarkTypes = { hasFard1, hasFard2, hasFard3, hasFard4, hasActivities };
      if (!hasFard1 && !hasFard2 && !hasFard3 && !hasFard4 && !hasActivities && structure) {
        const columns = structure.markColumns;
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
      logger.warn("Workbook mark type detection failed, falling back to structure:", error);
      if (!structure) {
        throw new Error("Worksheet structure not initialized");
      }
      const columns = structure.markColumns;
      return {
        hasFard1: columns.fard1 !== -1,
        hasFard2: columns.fard2 !== -1,
        hasFard3: columns.fard3 !== -1,
        hasFard4: columns.fard4 !== -1,
        hasActivities: columns.activities !== -1,
      };
    }
  }
}
