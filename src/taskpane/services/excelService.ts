import { MarkType, Student, WorksheetStructure, MarkInsertionResults } from "../types";

/* global Excel */

class ExcelService {
  private worksheetStructure: WorksheetStructure | null = null;

  async validateExcelFile(): Promise<boolean> {
    try {
      return await Excel.run(async (context) => {
        console.log("Validating Excel file...");

        // Get the active worksheet
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");

        // Get the used range to check headers
        const range = sheet.getUsedRange();
        range.load("values");

        await context.sync();

        console.log(`Active sheet name: ${sheet.name}`);
        console.log("Range values sample:", range.values.slice(0, 3));

        // Check if this is a Massar file by looking for specific structural elements
        // First check if the file has any data
        if (!range.values || range.values.length < 5) {
          console.log("File has insufficient data rows");
          return false;
        }

        // Look for Arabic text patterns that would indicate this is a Massar file
        // Check for any of the expected headers or key Massar file indicators
        const massarIndicators = ["رقم التلميذ", "إسم التلميذ", "الفرض", "النقطة", "مسار", "القسم"];

        // Convert all cell values to strings and check for Arabic text
        let foundIndicators = 0;

        // Flatten the 2D array and check each cell
        for (let row of range.values) {
          for (let cell of row) {
            if (cell && typeof cell === "string") {
              // Check if any of our indicators is contained in this cell
              for (let indicator of massarIndicators) {
                if (cell.toString().includes(indicator)) {
                  console.log(`Found Massar indicator: ${indicator} in cell value: ${cell}`);
                  foundIndicators++;
                  // If we found at least 2 indicators, it's likely a Massar file
                  if (foundIndicators >= 2) {
                    console.log("Confirmed Massar file based on indicators");

                    // Store worksheet structure for future use
                    this.worksheetStructure = {
                      headers: this.extractHeaders(range.values),
                      studentNameColumn: this.findStudentNameColumn(this.extractHeaders(range.values)),
                      totalRows: range.values.length,
                      markColumns: this.findMarkColumns(this.extractHeaders(range.values)),
                    };

                    return true;
                  }
                }
              }
            }
          }
        }

        console.log("Could not identify file as Massar export");
        return false;
      });
    } catch (error) {
      console.error("Excel validation error:", error);
      return false;
    }
  }

  // Helper method to extract headers more reliably
  private extractHeaders(values: any[][]): string[] {
    // Try to find the row that has headers by looking for known column headers
    const headerKeywords = ["رقم التلميذ", "إسم التلميذ", "تاريخ"];

    for (let i = 0; i < Math.min(10, values.length); i++) {
      const row = values[i];
      // Check if this row contains any of our header keywords
      if (
        row.some(
          (cell) =>
            cell && typeof cell === "string" && headerKeywords.some((keyword) => cell.toString().includes(keyword))
        )
      ) {
        console.log(`Found header row at index ${i}`);
        return row.map((cell) => (cell ? cell.toString() : ""));
      }
    }

    // Fallback: return the first row as headers
    return values[0].map((cell) => (cell ? cell.toString() : ""));
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
