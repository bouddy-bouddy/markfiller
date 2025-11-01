/**
 * Excel Mark Inserter
 * Handles insertion of marks into Excel sheets
 */

import {
  MarkType,
  Student,
  MarkInsertionResults,
  IntelligentWorksheetStructure,
  DetectedMarkTypes,
} from "../../types";
import { formatMarkForMassar, mapDetectedTypeToMarkType, getInternalMarkType } from "./excelHelpers";
import { ExcelNameMatcher } from "./excelNameMatcher";

/* global Excel */

export class ExcelMarkInserter {
  private nameMatcher: ExcelNameMatcher;

  constructor(nameMatcher: ExcelNameMatcher) {
    this.nameMatcher = nameMatcher;
  }

  /**
   * Insert marks with intelligent column mapping
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

        for (const student of extractedData) {
          const rowIndexRel = this.nameMatcher.findStudentRow(
            student.name,
            range.values as string[][],
            structure.studentNameColumn
          );
          if (rowIndexRel !== -1) {
            const columnIndex = structure.markColumns[internalMarkType];
            if (columnIndex !== -1) {
              const cell = sheet.getCell(baseRow + rowIndexRel, baseCol + columnIndex);
              const markValue = student.marks[internalMarkType];

              if (markValue !== null) {
                cell.values = [[formatMarkForMassar(markValue)]];
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
   * Insert all marks for all detected mark types
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

        console.log("🎯 Starting intelligent mark mapping for all students...");
        console.log("📊 Worksheet structure:", structure);
        console.log("📋 Detected mark types:", detectedMarkTypes);
        const workbookMarkTypes = this.detectAvailableMarkTypesInWorkbook(range.values as any[][], structure);
        console.log("🧭 Mark types available in workbook:", workbookMarkTypes);

        const baseRow = range.rowIndex;
        const baseCol = range.columnIndex;

        for (const student of extractedData) {
          console.log(`\n🔍 Processing student: ${student.name}`);

          const rowIndexRel = this.nameMatcher.findStudentRow(
            student.name,
            range.values as string[][],
            structure.studentNameColumn
          );

          if (rowIndexRel !== -1) {
            const absRow = baseRow + rowIndexRel;
            console.log(`✅ Found student at row ${absRow}`);

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

              const markType = mapDetectedTypeToMarkType(detectedType);
              if (!markType) continue;

              const columnIndex = structure.markColumns[markType];
              if (columnIndex === -1) {
                console.log(`⚠️ No column found for ${markType}`);
                continue;
              }

              const markValue = student.marks[markType];
              if (markValue !== null) {
                const cell = sheet.getCell(absRow, baseCol + columnIndex);
                cell.values = [[formatMarkForMassar(markValue)]];
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
      console.error("Excel quick-fill insertion error:", error);
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
      console.error("Mapping preview error:", error);
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
      console.warn("Workbook mark type detection failed, falling back to structure:", error);
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

