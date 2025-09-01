import { MarkType, Student, MarkInsertionResults, IntelligentWorksheetStructure, DetectedMarkTypes } from "../types";

/* global Excel */

class ExcelService {
  private worksheetStructure: IntelligentWorksheetStructure | null = null;

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
    for (let row of values.slice(0, 10)) {
      // Only check first 10 rows for headers
      for (let cell of row) {
        if (cell && typeof cell === "string") {
          // Check if any of our indicators is contained in this cell
          for (let indicator of massarIndicators) {
            if (cell.toString().includes(indicator)) {
              foundIndicators++;

              // If we found at least 2 indicators, it's likely a Massar file
              if (foundIndicators >= 2) {
                // Intelligently analyze the structure
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
   * Analyzes Massar file structure in detail
   */
  private analyzeMassarStructure(values: any[][]): void {
    const headers = this.extractHeaders(values);
    const studentNameColumn = this.findStudentNameColumn(headers);
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
      confidenceMap.fard1 = 0.8; // High confidence for first numeric column
    }

    if (columnStats.length >= 2) {
      confidenceMap.fard2 = 0.7; // Good confidence for second column
    }

    if (columnStats.length >= 3) {
      confidenceMap.fard3 = 0.6; // Moderate confidence for third column
    }

    if (columnStats.length >= 4) {
      confidenceMap.activities = 0.5; // Lower confidence for fourth column
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

    for (let i = 0; i < Math.min(10, values.length); i++) {
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
    ];

    // Try exact match first
    const exactMatch = headers.findIndex((h) => nameHeaders.some((nh) => h && h.toString() === nh));

    if (exactMatch !== -1) return exactMatch;

    // Then try partial match
    return headers.findIndex((h) => nameHeaders.some((nh) => h && h.toString().includes(nh)));
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
      activities: ["الأنشطة", "النشاط", "أنشطة", "المهارات", "الأداء", "نشاط", "تطبيقات", "مراقبة مستمرة"],
    };

    const columns: Record<MarkType, number> = {
      fard1: -1,
      fard2: -1,
      fard3: -1,
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

    return columns;
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

        for (const student of extractedData) {
          const rowIndex = await this.findStudentRow(student.name, range.values as string[][]);
          if (rowIndex !== -1) {
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

  /**
   * ENHANCED: Insert all marks for all detected mark types with intelligent mapping
   */
  async insertAllMarks(extractedData: Student[], detectedMarkTypes: DetectedMarkTypes): Promise<MarkInsertionResults> {
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

        console.log("🎯 Starting intelligent mark mapping for all students...");
        console.log("📊 Worksheet structure:", this.worksheetStructure);
        console.log("📋 Detected mark types:", detectedMarkTypes);

        // Process each student
        for (const student of extractedData) {
          console.log(`\n🔍 Processing student: ${student.name}`);

          const rowIndex = await this.findStudentRow(student.name, range.values as string[][]);

          if (rowIndex !== -1) {
            console.log(`✅ Found student at row ${rowIndex}`);

            // Insert marks for all detected types
            const markTypes: (keyof DetectedMarkTypes)[] = [
              "hasFard1",
              "hasFard2",
              "hasFard3",
              "hasFard4",
              "hasActivities",
            ];

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
                const cell = sheet.getCell(rowIndex, columnIndex);
                cell.values = [[this.formatMarkForMassar(markValue)]];
                results.success++;
                console.log(`✅ Inserted ${markType}: ${markValue} at row ${rowIndex}, col ${columnIndex}`);
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
   * Map detected type to mark type
   */
  private mapDetectedTypeToMarkType(detectedType: keyof DetectedMarkTypes): MarkType | null {
    const mapping: Record<keyof DetectedMarkTypes, MarkType> = {
      hasFard1: "fard1",
      hasFard2: "fard2",
      hasFard3: "fard3",
      hasFard4: "fard1", // Map fard4 to fard1 if needed
      hasActivities: "activities",
    };

    return mapping[detectedType] || null;
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

          // Check each mark type
          const markTypes: MarkType[] = ["fard1", "fard2", "fard3", "activities"];

          for (const markType of markTypes) {
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
      الأنشطة: "activities",
      النشاط: "activities",
      أنشطة: "activities",
    };

    return markTypeMap[arabicMarkType] || null;
  }

  /**
   * Enhanced student name matching with fuzzy logic
   */
  async findStudentRow(studentName: string, values: string[][]): Promise<number> {
    if (!this.worksheetStructure) {
      throw new Error("Worksheet structure not initialized");
    }

    const nameColumn = this.worksheetStructure.studentNameColumn;
    const nameToFind = this.normalizeArabicText(studentName);

    // First try exact match (after normalization)
    for (let i = 1; i < values.length; i++) {
      const cellName = this.normalizeArabicText(values[i][nameColumn]);
      if (cellName === nameToFind) {
        return i;
      }
    }

    // Then try partial name matching (first/last name)
    const nameParts = nameToFind.split(/\s+/);
    for (let i = 1; i < values.length; i++) {
      const cellName = this.normalizeArabicText(values[i][nameColumn]);
      const cellNameParts = cellName.split(/\s+/);

      // Check for first and last name match
      if (nameParts.length > 0 && cellNameParts.length > 0) {
        // First name match
        if (nameParts[0] === cellNameParts[0]) {
          // Last name match (if available)
          if (
            nameParts.length > 1 &&
            cellNameParts.length > 1 &&
            nameParts[nameParts.length - 1] === cellNameParts[cellNameParts.length - 1]
          ) {
            return i;
          }

          // At least first name matches
          return i;
        }

        // Last name match
        if (
          nameParts.length > 1 &&
          cellNameParts.length > 1 &&
          nameParts[nameParts.length - 1] === cellNameParts[cellNameParts.length - 1]
        ) {
          return i;
        }
      }
    }

    // Finally try fuzzy matching
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
