import { MarkType, Student, WorksheetStructure, MarkInsertionResults } from "../types";

/* global Excel */

class ExcelService {
  private worksheetStructure: WorksheetStructure | null = null;

  async validateExcelFile(): Promise<boolean> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        // Verify this is a Massar file by checking for specific headers
        const headers = range.values[0] as string[];
        const requiredHeaders = ["الفرض 1", "الفرض 2", "الفرض 3", "الأنشطة"];
        const foundHeaders = requiredHeaders.filter((header) =>
          headers.some((h) => h && h.toString().includes(header))
        );

        // Store worksheet structure for future use
        this.worksheetStructure = {
          headers,
          studentNameColumn: this.findStudentNameColumn(headers),
          totalRows: range.values.length,
          markColumns: this.findMarkColumns(headers),
        };

        return foundHeaders.length >= 1;
      });
    } catch (error) {
      console.error("Excel validation error:", error);
      return false;
    }
  }

  findStudentNameColumn(headers: string[]): number {
    // Look for common name column headers in Massar
    const nameHeaders = ["الاسم الكامل", "اسم التلميذ", "الاسم"];
    return headers.findIndex((h) => nameHeaders.some((nh) => h && h.toString().includes(nh)));
  }

  findMarkColumns(headers: string[]): Record<MarkType, number> {
    const markTypes: Record<MarkType, string[]> = {
      fard1: ["الفرض 1", "الفرض الأول"],
      fard2: ["الفرض 2", "الفرض الثاني"],
      fard3: ["الفرض 3", "الفرض الثالث"],
      activities: ["الأنشطة", "النشاط"],
    };

    const columns: Record<MarkType, number> = {
      fard1: -1,
      fard2: -1,
      fard3: -1,
      activities: -1,
    };

    for (const [type, patterns] of Object.entries(markTypes)) {
      columns[type as MarkType] = headers.findIndex((h) => patterns.some((p) => h && h.toString().includes(p)));
    }

    return columns;
  }

  async insertMarks(extractedData: Student[], markType: string): Promise<MarkInsertionResults> {
    try {
      return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        const results: MarkInsertionResults = {
          success: 0,
          notFound: 0,
          notFoundStudents: [],
        };

        if (!this.worksheetStructure) {
          throw new Error("Worksheet structure not initialized");
        }

        for (const student of extractedData) {
          const rowIndex = await this.findStudentRow(student.name, range.values as string[][]);
          if (rowIndex !== -1) {
            // Map the mark type from Arabic display name to internal property name
            const internalMarkType = this.getInternalMarkType(markType);

            if (!internalMarkType) {
              console.error("Invalid mark type:", markType);
              continue;
            }

            // Get the correct column for this mark type
            const columnIndex = this.worksheetStructure.markColumns[internalMarkType];
            if (columnIndex !== -1) {
              const cell = sheet.getCell(rowIndex, columnIndex);
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

  private getInternalMarkType(arabicMarkType: string): MarkType | null {
    const markTypeMap: Record<string, MarkType> = {
      "الفرض 1": "fard1",
      "الفرض 2": "fard2",
      "الفرض 3": "fard3",
      الأنشطة: "activities",
    };

    return markTypeMap[arabicMarkType] || null;
  }

  async findStudentRow(studentName: string, values: string[][]): Promise<number> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    const nameColumn = this.worksheetStructure.studentNameColumn;
    const nameToFind = this.normalizeArabicText(studentName);

    for (let i = 1; i < values.length; i++) {
      const cellName = this.normalizeArabicText(values[i][nameColumn]);
      if (this.compareNames(nameToFind, cellName)) {
        return i;
      }
    }
    return -1;
  }

  normalizeArabicText(text: string | undefined): string {
    if (!text) return "";

    // Remove diacritics and normalize Arabic characters
    return text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .trim()
      .toLowerCase();
  }

  compareNames(name1: string, name2: string): boolean {
    // Calculate similarity between names
    const similarity = this.calculateSimilarity(name1, name2);
    return similarity > 0.8; // 80% similarity threshold
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
}

export default new ExcelService();
