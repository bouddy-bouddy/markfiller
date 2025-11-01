/**
 * Excel Format Detector
 * Detects Massar vs Generic Excel formats
 */

import { IntelligentWorksheetStructure } from "../../types";
import { ExcelColumnDetector } from "./excelColumnDetector";

export class ExcelFormatDetector {
  private columnDetector: ExcelColumnDetector;

  constructor(columnDetector: ExcelColumnDetector) {
    this.columnDetector = columnDetector;
  }

  /**
   * Detects if the file follows Massar format
   */
  detectMassarFormat(values: any[][]): boolean {
    const massarIndicators = ["رقم التلميذ", "إسم التلميذ", "الفرض", "النقطة", "مسار", "القسم"];

    let foundIndicators = 0;

    for (let row of values.slice(0, 20)) {
      for (let cell of row) {
        if (cell && typeof cell === "string") {
          for (let indicator of massarIndicators) {
            if (cell.toString().includes(indicator)) {
              foundIndicators++;
              if (foundIndicators >= 2) {
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
   * Analyzes Massar file structure in detail
   */
  analyzeMassarStructure(values: any[][]): IntelligentWorksheetStructure {
    console.log("🔍 Analyzing Massar file structure...");

    const headers = this.columnDetector.extractHeaders(values);
    console.log("📋 Headers found:", headers);

    const studentNameColumn = this.columnDetector.findMassarStudentNameColumn(headers, values);
    console.log("👤 Student name column:", studentNameColumn, headers[studentNameColumn] || "N/A");

    const studentIdColumn = this.columnDetector.findStudentIdColumn(headers);
    console.log("🆔 Student ID column:", studentIdColumn, headers[studentIdColumn] || "N/A");

    const markColumns = this.columnDetector.findMassarMarkColumns(headers, values);
    console.log("📊 Mark columns found:", markColumns);

    const markColumnsConfidence = this.columnDetector.calculateMarkColumnConfidence(headers, values);
    console.log("🎯 Mark columns confidence:", markColumnsConfidence);

    const additionalMarkColumns = this.columnDetector.findAdditionalMarkColumns(headers, markColumns);
    console.log("➕ Additional mark columns:", additionalMarkColumns);

    const structure: IntelligentWorksheetStructure = {
      headers,
      studentNameColumn,
      studentIdColumn,
      totalRows: values.length,
      markColumns,
      markColumnsConfidence,
      additionalMarkColumns,
    };

    console.log("✅ Massar structure analysis complete:", structure);
    return structure;
  }

  /**
   * Analyzes a generic (non-Massar) format
   */
  analyzeGenericFormat(values: any[][]): IntelligentWorksheetStructure | null {
    const headers = this.columnDetector.extractHeaders(values);

    let studentNameColumn = this.columnDetector.findStudentNameColumn(headers);
    if (studentNameColumn === -1) {
      studentNameColumn = this.columnDetector.findPossibleNameColumn(values);
      if (studentNameColumn === -1) {
        return null;
      }
    }

    const studentIdColumn =
      studentNameColumn !== -1
        ? this.columnDetector.findPossibleIdColumn(values, studentNameColumn)
        : this.columnDetector.findStudentIdColumn(headers);

    const markColumns = this.columnDetector.findMarkColumns(headers);
    const markColumnsConfidence = this.columnDetector.calculateMarkColumnConfidence(headers, values);
    const additionalMarkColumns = this.columnDetector.findAdditionalMarkColumns(headers, markColumns);

    return {
      headers: headers.length > 0 ? headers : new Array(values[0].length).fill("").map((_, i) => `Column ${i + 1}`),
      studentNameColumn,
      studentIdColumn,
      totalRows: values.length,
      markColumns,
      markColumnsConfidence,
      additionalMarkColumns,
    };
  }
}

