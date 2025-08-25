import { Student, DetectedMarkTypes } from "../types";

class GeminiOCRService {
  private geminiApiKey: string;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || "";
    if (!this.geminiApiKey) {
      console.warn("GEMINI_API_KEY not found in environment variables");
    }
  }

  /**
   * Main method to process an image and extract student marks
   */
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      if (!this.geminiApiKey) {
        throw new Error("Gemini API key not found. Please check your environment configuration.");
      }

      // Use Gemini Vision-capable model for image analysis
      const response = await this.callGeminiAPI(base64Content);

      if (!response || !response.text) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }

      const extractedText = response.text;
      console.log("📄 Extracted text from Gemini:", extractedText);

      // Extract students and detect mark types
      const result = this.extractStudentData(extractedText);

      if (result.students.length === 0) {
        throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      return result;
    } catch (error) {
      console.error("Gemini processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Call Gemini API with optimized prompt for student marks sheets
   */
  private async callGeminiAPI(base64Image: string): Promise<{ text: string }> {
    // Use a valid, image-capable Gemini model to avoid 404 errors
    // Options: "gemini-1.5-flash", "gemini-1.5-pro", or legacy "gemini-1.0-pro-vision-latest"
    const model = "gemini-1.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `Analyze this image of a student marks sheet and extract all the text content in the exact order it appears.

This is an Arabic document that contains:
1. Student names (in Arabic)
2. Mark values (numbers, possibly with decimals like 07,00 or 15.50)
3. Headers and labels (like الفرض 1, الفرض 2, الأنشطة)

Please extract the text exactly as it appears, preserving the original formatting and order.
Focus on maintaining the structure so we can identify which marks belong to which students.

Return only the extracted text without any additional commentary or formatting.`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    } as const;

    const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API error:", errorData);

      if (response.status === 400) {
        throw new Error("فشل الاتصال بخدمة Gemini: خطأ في طلب API. يرجى التحقق من الصورة.");
      } else if (response.status === 403) {
        throw new Error("فشل الاتصال بخدمة Gemini: خطأ في المصادقة. يرجى التحقق من مفتاح API.");
      } else if (response.status === 404) {
        throw new Error("فشل الاتصال بخدمة Gemini: نموذج غير موجود. تم تحديث النموذج إلى إصدار مدعوم.");
      } else {
        throw new Error("فشل الاتصال بخدمة Gemini. يرجى المحاولة مرة أخرى.");
      }
    }

    const data = await response.json();
    console.log("🔍 GEMINI API - COMPLETE RAW RESPONSE:");
    console.log("Full API Response:", JSON.stringify(data, null, 2));

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("استجابة غير صحيحة من خدمة Gemini");
    }

    const text = data.candidates[0].content.parts[0].text;
    return { text };
  }

  /**
   * Extract student data from the OCR text
   */
  private extractStudentData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    console.log("🔄 Extracting student data from Gemini OCR text...");

    const lines = text
      .split("\n")
      .map((line) => this.normalizeArabicNumber(line.trim()))
      .filter((line) => line.length > 0);

    // Detect mark types from headers
    const detectedMarkTypes = this.detectMarkTypes(text);

    // Extract students and marks
    const students = this.extractStudentsFromLines(lines, detectedMarkTypes);

    console.log(`✅ Total students extracted: ${students.length}`);
    console.log(`📊 Detected mark types:`, detectedMarkTypes);

    return { students, detectedMarkTypes };
  }

  /**
   * Detect which mark types are present in the document
   */
  private detectMarkTypes(text: string): DetectedMarkTypes {
    const headerText = text.substring(0, 1000); // Check first 1000 characters for headers

    return {
      hasFard1: /الفرض\s*1|فرض\s*الأول|الفرض\s*الأول/.test(headerText),
      hasFard2: /الفرض\s*2|فرض\s*الثاني|الفرض\s*الثاني/.test(headerText),
      hasFard3: /الفرض\s*3|فرض\s*الثالث|الفرض\s*الثالث/.test(headerText),
      hasFard4: /الفرض\s*4|فرض\s*الرابع|الفرض\s*الرابع/.test(headerText),
      hasActivities: /الأنشطة|النشاط|مراقبة|مستمرة/.test(headerText),
    };
  }

  /**
   * Advanced header structure analysis
   */
  private analyzeHeaderStructure(lines: string[]): {
    headerRowIndex: number;
    columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
    markColumnMapping: Record<string, keyof Student["marks"]>;
  } | null {
    // Look for header row in first 15 lines
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;

      if (this.isAdvancedHeaderRow(line)) {
        const columnStructure = this.analyzeColumnStructure(line);
        const markColumnMapping = this.createMarkColumnMapping(columnStructure);

        if (columnStructure.length >= 3) {
          // At least number, name, and one mark column
          return {
            headerRowIndex: i,
            columnStructure,
            markColumnMapping,
          };
        }
      }
    }

    return null;
  }

  /**
   * Enhanced header row detection
   */
  private isAdvancedHeaderRow(line: string): boolean {
    const headerPatterns = [
      // Arabic patterns
      /اسم.*الفرض|الفرض.*اسم/,
      /التلميذ.*الفرض|الفرض.*التلميذ/,
      /رقم.*اسم.*الفرض/,
      /الاسم.*الفرض.*الأنشطة/,
      // Mixed patterns
      /name.*fard|fard.*name/,
      /student.*mark|mark.*student/,
      // Generic table patterns
      /رقم|الاسم|الفرض|الأنشطة/,
      /number|name|fard|activities/,
    ];

    const hasHeaderPattern = headerPatterns.some((pattern) => pattern.test(line));
    const hasMultipleColumns = line.split(/[\s\t|،]+/).filter((col) => col.trim().length > 0).length >= 3;

    return hasHeaderPattern && hasMultipleColumns;
  }

  /**
   * Analyze column structure with type detection
   */
  private analyzeColumnStructure(
    headerRow: string
  ): Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }> {
    const columns = headerRow
      .split(/[\s\t|،]+/)
      .map((col, index) => col.trim())
      .filter((col) => col.length > 0);

    return columns.map((col, index) => {
      let type: "number" | "name" | "mark" | "unknown" = "unknown";

      if (/رقم|الرقم|number/i.test(col)) {
        type = "number";
      } else if (/اسم|الاسم|التلميذ|name|student/i.test(col)) {
        type = "name";
      } else if (/الفرض|الأنشطة|fard|activities/i.test(col)) {
        type = "mark";
      }

      return { index, title: col, type };
    });
  }

  /**
   * Create mapping between column titles and mark types
   */
  private createMarkColumnMapping(
    columnStructure: Array<{ index: number; title: string; type: string }>
  ): Record<string, keyof Student["marks"]> {
    const mapping: Record<string, keyof Student["marks"]> = {};

    columnStructure.forEach(({ index, title }) => {
      const normalizedTitle = title.toLowerCase().replace(/\s+/g, "");

      if (/الفرض1|فرض1|fard1/.test(normalizedTitle)) {
        mapping[title] = "fard1";
      } else if (/الفرض2|فرض2|fard2/.test(normalizedTitle)) {
        mapping[title] = "fard2";
      } else if (/الفرض3|فرض3|fard3/.test(normalizedTitle)) {
        mapping[title] = "fard3";
      } else if (/الفرض4|فرض4|fard4/.test(normalizedTitle)) {
        mapping[title] = "fard4";
      } else if (/الأنشطة|النشاط|activities/.test(normalizedTitle)) {
        mapping[title] = "activities";
      }
    });

    return mapping;
  }

  /**
   * Extract data rows with better filtering
   */
  private extractDataRows(lines: string[], headerRowIndex: number): string[] {
    const dataRows = lines.slice(headerRowIndex + 1);

    return dataRows.filter((row) => {
      if (!row || row.trim().length === 0) return false;

      // Skip summary rows
      if (this.isSummaryRow(row)) return false;

      // Skip header-like rows that might appear after the main header
      if (this.isAdvancedHeaderRow(row)) return false;

      // Must contain at least some Arabic text (student names)
      return /[\u0600-\u06FF]{2,}/.test(row);
    });
  }

  /**
   * Advanced student extraction with intelligent cell parsing
   */
  private extractStudentFromRowAdvanced(
    row: string,
    headerAnalysis: {
      headerRowIndex: number;
      columnStructure: Array<{ index: number; title: string; type: string }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    },
    detectedMarkTypes: DetectedMarkTypes,
    studentNumber: number
  ): Student | null {
    // Parse row into cells with better separator handling
    const cells = this.parseRowIntoCells(row);
    if (cells.length < 2) return null;

    // Find student name using multiple strategies
    const studentName = this.extractStudentName(cells, headerAnalysis.columnStructure);
    if (!studentName) return null;

    // Extract marks using the column mapping
    const marks = this.extractMarksAdvanced(cells, headerAnalysis, detectedMarkTypes);

    return {
      number: studentNumber,
      name: studentName,
      marks,
    };
  }

  /**
   * Parse row into cells with intelligent separator handling
   */
  private parseRowIntoCells(row: string): string[] {
    // Normalize spaces
    let working = row.replace(/\s+/g, " ").trim();

    // 1) Extract leading student number if present
    const leadingNumMatch = working.match(/^\s*(\d{1,3})\s+/);
    const cells: string[] = [];
    if (leadingNumMatch) {
      cells.push(leadingNumMatch[1]);
      working = working.slice(leadingNumMatch[0].length).trim();
    }

    // 2) First split on strong separators (pipes, tabs, Arabic comma). This preserves spaces inside names
    let segments = working
      .split(/[|\t،]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If no strong separators found, keep the whole remainder as one segment
    if (segments.length === 0) {
      segments = [working];
    }

    // 3) For each segment, if it's clearly a mark keep as-is; otherwise treat as text (name) even if multi-word
    const markLike = /^(?:\d{1,2})(?:[\.,]\d{1,2})?$/;

    for (const seg of segments) {
      if (markLike.test(this.normalizeArabicNumber(seg))) {
        cells.push(seg);
      } else {
        // Some OCR rows may still contain extra spaces between name parts – keep full name segment
        // but trim trailing punctuation
        cells.push(seg.replace(/[:؛]$/, "").trim());
      }
    }

    // 4) As a safety, if after this we still have < 2 cells, fallback to grouping by numeric boundaries
    if (cells.length < 2) {
      const parts = working.split(/\s+/).filter((p) => p.length > 0);
      return this.groupPartsIntoCells(parts);
    }

    return cells;
  }

  /**
   * Group parts into logical cells based on content patterns
   */
  private groupPartsIntoCells(parts: string[]): string[] {
    const cells: string[] = [];
    let currentCell = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // If this looks like a mark (numeric), start a new cell
      if (this.isNumeric(part)) {
        if (currentCell) {
          cells.push(currentCell.trim());
          currentCell = "";
        }
        cells.push(part);
      } else {
        // If it's text, add to current cell
        currentCell += (currentCell ? " " : "") + part;
      }
    }

    // Add the last cell if it exists
    if (currentCell) {
      cells.push(currentCell.trim());
    }

    return cells;
  }

  /**
   * Extract student name using multiple strategies
   */
  private extractStudentName(
    cells: string[],
    columnStructure: Array<{ index: number; title: string; type: string }>
  ): string | null {
    // Strategy 1: Use column structure to find name column
    const nameColumn = columnStructure.find((col) => col.type === "name");
    if (nameColumn && cells[nameColumn.index]) {
      const name = cells[nameColumn.index];
      if (this.isValidStudentName(name)) {
        return this.cleanStudentName(name);
      }
    }

    // Strategy 2: Find the longest Arabic text that's not a header
    let bestName = "";
    for (const cell of cells) {
      if (this.isValidStudentName(cell) && cell.length > bestName.length) {
        bestName = cell;
      }
    }

    if (bestName) {
      return this.cleanStudentName(bestName);
    }

    // Strategy 3: Look for Arabic text in any cell
    for (const cell of cells) {
      if (/[\u0600-\u06FF]{2,}/.test(cell) && !this.isHeaderLike(cell)) {
        return this.cleanStudentName(cell);
      }
    }

    return null;
  }

  /**
   * Check if a string is a valid student name
   */
  private isValidStudentName(name: string): boolean {
    if (!name || name.length < 2) return false;

    // Must contain Arabic text
    if (!/[\u0600-\u06FF]{2,}/.test(name)) return false;

    // Must not be header-like
    if (this.isHeaderLike(name)) return false;

    // Must not be purely numeric
    if (/^\d+$/.test(name.replace(/[,\.]/g, ""))) return false;

    return true;
  }

  /**
   * Check if a string looks like a header
   */
  private isHeaderLike(text: string): boolean {
    const headerKeywords = [
      "اسم",
      "الاسم",
      "التلميذ",
      "الفرض",
      "الأنشطة",
      "رقم",
      "الرقم",
      "المجموع",
      "المعدل",
      "total",
      "average",
      "sum",
      "name",
      "student",
    ];

    return headerKeywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Clean student name
   */
  private cleanStudentName(name: string): string {
    return name
      .replace(/[:؛]$/, "") // Remove trailing colons
      .replace(/^\d+\s*/, "") // Remove leading numbers
      .trim();
  }

  /**
   * Advanced mark extraction using column mapping
   */
  private extractMarksAdvanced(
    cells: string[],
    headerAnalysis: {
      headerRowIndex: number;
      columnStructure: Array<{ index: number; title: string; type: string }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    },
    detectedMarkTypes: DetectedMarkTypes
  ): Student["marks"] {
    const marks: Student["marks"] = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };

    // Use column mapping to extract marks
    Object.entries(headerAnalysis.markColumnMapping).forEach(([columnTitle, markType]) => {
      const columnIndex = headerAnalysis.columnStructure.findIndex((col) => col.title === columnTitle);
      if (columnIndex !== -1 && cells[columnIndex]) {
        const markValue = this.parseMarkValue(cells[columnIndex]);
        if (markValue !== null) {
          marks[markType] = markValue;
          console.log(`📊 Found ${markType} mark: ${cells[columnIndex]} -> ${markValue}`);
        }
      }
    });

    // If no structured marks found, try intelligent fallback
    if (Object.values(marks).every((mark) => mark === null)) {
      this.extractMarksIntelligently(cells, marks, detectedMarkTypes);
    }

    return marks;
  }

  /**
   * Intelligent mark extraction when column mapping fails
   */
  private extractMarksIntelligently(
    cells: string[],
    marks: Student["marks"],
    detectedMarkTypes: DetectedMarkTypes
  ): void {
    const numericCells = cells.filter((cell) => this.isNumeric(cell));

    if (numericCells.length === 0) return;

    // Sort numeric cells by their position in the original row
    const numericCellPositions = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => this.isNumeric(cell))
      .sort((a, b) => a.index - b.index);

    // Assign marks based on detected types and position
    let markIndex = 0;

    if (detectedMarkTypes.hasFard1 && markIndex < numericCellPositions.length) {
      marks.fard1 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
    }
    if (detectedMarkTypes.hasFard2 && markIndex < numericCellPositions.length) {
      marks.fard2 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
    }
    if (detectedMarkTypes.hasFard3 && markIndex < numericCellPositions.length) {
      marks.fard3 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
    }
    if (detectedMarkTypes.hasFard4 && markIndex < numericCellPositions.length) {
      marks.fard4 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
    }
    if (detectedMarkTypes.hasActivities && markIndex < numericCellPositions.length) {
      marks.activities = this.parseMarkValue(numericCellPositions[markIndex++].cell);
    }
  }

  /**
   * Validate and fix alignment issues
   */
  private validateAndFixAlignment(students: Student[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    if (students.length === 0) return students;

    // Check for common alignment issues
    const issues = this.detectAlignmentIssues(students, detectedMarkTypes);

    if (issues.length > 0) {
      console.log(`⚠️ Detected ${issues.length} alignment issues:`, issues);
      return this.fixAlignmentIssues(students, issues, detectedMarkTypes);
    }

    return students;
  }

  /**
   * Detect common alignment issues
   */
  private detectAlignmentIssues(
    students: Student[],
    detectedMarkTypes: DetectedMarkTypes
  ): Array<{
    type: "missing_marks" | "inconsistent_structure" | "wrong_mark_count";
    studentIndex: number;
    details: string;
  }> {
    const issues: Array<{
      type: "missing_marks" | "inconsistent_structure" | "wrong_mark_count";
      studentIndex: number;
      details: string;
    }> = [];

    students.forEach((student, index) => {
      const markCount = Object.values(student.marks).filter((mark) => mark !== null).length;
      const expectedMarkCount = Object.values(detectedMarkTypes).filter((has) => has).length;

      if (markCount === 0) {
        issues.push({
          type: "missing_marks",
          studentIndex: index,
          details: `Student ${student.name} has no marks`,
        });
      } else if (markCount !== expectedMarkCount) {
        issues.push({
          type: "wrong_mark_count",
          studentIndex: index,
          details: `Student ${student.name} has ${markCount} marks, expected ${expectedMarkCount}`,
        });
      }
    });

    return issues;
  }

  /**
   * Fix alignment issues
   */
  private fixAlignmentIssues(
    students: Student[],
    issues: Array<{ type: string; studentIndex: number; details: string }>,
    detectedMarkTypes: DetectedMarkTypes
  ): Student[] {
    // For now, return the original students
    // In the future, this could implement more sophisticated fixes
    console.log("🔧 Alignment issues detected but not yet fixed. Consider manual review.");
    return students;
  }

  /**
   * Advanced fallback extraction when structured extraction fails
   */
  private advancedFallbackExtraction(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    console.log("🔄 Using advanced fallback extraction method");

    const students: Student[] = [];
    const allNames: string[] = [];
    const allMarks: string[] = [];

    // Collect names and marks with better filtering
    for (const line of lines) {
      if (!line || line.length === 0) continue;

      // Skip headers and special markers
      if (this.isAdvancedHeaderRow(line) || this.isSummaryRow(line)) {
        continue;
      }

      // Check if it's a mark
      if (this.isNumeric(line)) {
        const cleanedMark = this.preprocessMark(line);
        if (cleanedMark !== null) {
          allMarks.push(cleanedMark);
        }
      }
      // Check if it's an Arabic name
      else if (/[\u0600-\u06FF]{2,}/.test(line)) {
        const cleanedName = line.replace(/[:؛]$/, "").trim();
        allNames.push(cleanedName);
      }
    }

    // Create students with better mark assignment
    for (let i = 0; i < allNames.length; i++) {
      const markValue = i < allMarks.length ? this.parseMarkValue(allMarks[i]) : null;

      students.push({
        number: i + 1,
        name: allNames[i],
        marks: {
          fard1: detectedMarkTypes.hasFard1 ? markValue : null,
          fard2: detectedMarkTypes.hasFard2 ? markValue : null,
          fard3: detectedMarkTypes.hasFard3 ? markValue : null,
          fard4: detectedMarkTypes.hasFard4 ? markValue : null,
          activities: detectedMarkTypes.hasActivities ? markValue : null,
        },
      });
    }

    return students;
  }

  /**
   * Extract students from text lines with advanced table structure detection
   */
  private extractStudentsFromLines(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    const students: Student[] = [];

    // Step 1: Find and analyze the header row
    const headerAnalysis = this.analyzeHeaderStructure(lines);
    if (!headerAnalysis) {
      console.warn("⚠️ No valid header structure found, using advanced fallback");
      return this.advancedFallbackExtraction(lines, detectedMarkTypes);
    }

    console.log(`📋 Header analysis:`, headerAnalysis);

    // Step 2: Extract and validate data rows
    const dataRows = this.extractDataRows(lines, headerAnalysis.headerRowIndex);
    console.log(`📊 Found ${dataRows.length} data rows`);

    // Step 3: Process each data row with intelligent alignment
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.trim().length === 0) continue;

      // Skip summary rows
      if (this.isSummaryRow(row)) continue;

      const student = this.extractStudentFromRowAdvanced(row, headerAnalysis, detectedMarkTypes, i + 1);
      if (student) {
        students.push(student);
        console.log(`✅ Extracted student ${i + 1}: ${student.name} with marks:`, student.marks);
      }
    }

    // Step 4: Validate and fix alignment issues
    const validatedStudents = this.validateAndFixAlignment(students, detectedMarkTypes);

    return validatedStudents;
  }

  /**
   * Find the header row that contains column titles
   */
  private findHeaderRow(lines: string[]): number {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      // Check first 10 lines
      const line = lines[i];
      if (this.isHeaderRow(line)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if a line is a header row
   */
  private isHeaderRow(line: string): boolean {
    const headerKeywords = [
      "اسم",
      "الاسم",
      "التلميذ",
      "الفرض",
      "الأنشطة",
      "رقم",
      "الرقم",
      "fard",
      "activities",
      "name",
      "number",
    ];

    const hasHeaderKeyword = headerKeywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase()));

    // Header should also contain some separators or multiple words
    const hasMultipleParts = line.split(/\s+/).length >= 2;

    return hasHeaderKeyword && hasMultipleParts;
  }

  /**
   * Extract column structure from header row
   */
  private extractColumnStructure(headerRow: string): string[] {
    // Split by common separators and clean up
    const columns = headerRow
      .split(/[\s\t|،]+/) // Split by spaces, tabs, pipes, or Arabic commas
      .map((col) => col.trim())
      .filter((col) => col.length > 0);

    return columns;
  }

  /**
   * Extract student data from a single row
   */
  private extractStudentFromRow(
    row: string,
    columnStructure: string[],
    detectedMarkTypes: DetectedMarkTypes,
    studentNumber: number
  ): Student | null {
    // Split row by the same separators as header
    const cells = row
      .split(/[\s\t|،]+/)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells.length < 2) return null; // Need at least number and name

    // First cell is usually the student number
    const studentNumberCell = cells[0];

    // Find the name (usually the second cell, but could vary)
    let nameCell = cells[1];
    if (this.isNumeric(studentNumberCell) && cells.length > 1) {
      nameCell = cells[1];
    } else if (!this.isNumeric(studentNumberCell)) {
      nameCell = studentNumberCell; // First cell is the name
    }

    // Validate that we have a name
    if (!nameCell || !/[\u0600-\u06FF]{2,}/.test(nameCell)) {
      return null;
    }

    // Extract marks based on column structure
    const marks = this.extractMarksFromCells(cells, columnStructure, detectedMarkTypes);

    return {
      number: studentNumber,
      name: nameCell.replace(/[:؛]$/, "").trim(),
      marks,
    };
  }

  /**
   * Extract marks from row cells based on column structure
   */
  private extractMarksFromCells(
    cells: string[],
    columnStructure: string[],
    detectedMarkTypes: DetectedMarkTypes
  ): Student["marks"] {
    const marks: Student["marks"] = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };

    // Map column structure to mark types
    const columnToMarkType: Record<string, keyof Student["marks"]> = {
      "الفرض 1": "fard1",
      "الفرض 2": "fard2",
      "الفرض 3": "fard3",
      "الفرض 4": "fard4",
      الأنشطة: "activities",
      "fard 1": "fard1",
      "fard 2": "fard2",
      "fard 3": "fard3",
      "fard 4": "fard4",
      activities: "activities",
    };

    // Find marks in cells based on column structure
    for (let i = 0; i < Math.min(cells.length, columnStructure.length); i++) {
      const columnTitle = columnStructure[i];
      const cellValue = cells[i];

      if (!cellValue) continue;

      // Check if this column corresponds to a mark type
      const markType = columnToMarkType[columnTitle];
      if (markType && typeof markType === "string") {
        const hasMarkTypeKey = `has${markType.charAt(0).toUpperCase() + markType.slice(1)}` as keyof DetectedMarkTypes;
        if (detectedMarkTypes[hasMarkTypeKey]) {
          const markValue = this.parseMarkValue(cellValue);
          if (markValue !== null) {
            marks[markType] = markValue;
            console.log(`📊 Found ${markType} mark: ${cellValue} -> ${markValue}`);
          }
        }
      }
    }

    // If no structured marks found, try to find marks in any numeric cells
    if (Object.values(marks).every((mark) => mark === null)) {
      this.extractMarksFromUnstructuredCells(cells, marks, detectedMarkTypes);
    }

    return marks;
  }

  /**
   * Extract marks from unstructured cells when column mapping fails
   */
  private extractMarksFromUnstructuredCells(
    cells: string[],
    marks: Student["marks"],
    detectedMarkTypes: DetectedMarkTypes
  ): void {
    const numericCells = cells.filter((cell) => this.isNumeric(cell));

    if (numericCells.length === 0) return;

    // Assign marks based on detected types and available numeric values
    let markIndex = 0;

    if (detectedMarkTypes.hasFard1 && markIndex < numericCells.length) {
      marks.fard1 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasFard2 && markIndex < numericCells.length) {
      marks.fard2 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasFard3 && markIndex < numericCells.length) {
      marks.fard3 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasFard4 && markIndex < numericCells.length) {
      marks.fard4 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasActivities && markIndex < numericCells.length) {
      marks.activities = this.parseMarkValue(numericCells[markIndex++]);
    }
  }

  /**
   * Check if a string is numeric (could be a mark)
   */
  private isNumeric(str: string): boolean {
    if (!str) return false;
    const cleaned = str.replace(/[,\.]/g, "");
    return /^\d+$/.test(cleaned) && parseFloat(str.replace(",", ".")) <= 20;
  }

  /**
   * Check if a row is a summary row (should be skipped)
   */
  private isSummaryRow(row: string): boolean {
    const summaryKeywords = ["المجموع", "المعدل", "total", "average", "sum"];
    return summaryKeywords.some((keyword) => row.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Fallback extraction method when structured extraction fails
   */
  private fallbackExtraction(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    console.log("🔄 Using fallback extraction method");

    const students: Student[] = [];
    const allNames: string[] = [];
    const allMarks: string[] = [];

    // Collect names and marks
    for (const line of lines) {
      if (!line || line.length === 0) continue;

      // Skip headers and special markers
      if (this.isHeaderRow(line) || this.isSummaryRow(line)) {
        continue;
      }

      // Check if it's a mark
      if (this.isNumeric(line)) {
        const cleanedMark = this.preprocessMark(line);
        if (cleanedMark !== null) {
          allMarks.push(cleanedMark);
        }
      }
      // Check if it's an Arabic name
      else if (/[\u0600-\u06FF]{2,}/.test(line)) {
        const cleanedName = line.replace(/[:؛]$/, "").trim();
        allNames.push(cleanedName);
      }
    }

    // Create students
    for (let i = 0; i < allNames.length; i++) {
      const markValue = i < allMarks.length ? this.parseMarkValue(allMarks[i]) : null;

      students.push({
        number: i + 1,
        name: allNames[i],
        marks: {
          fard1: detectedMarkTypes.hasFard1 ? markValue : null,
          fard2: detectedMarkTypes.hasFard2 ? markValue : null,
          fard3: detectedMarkTypes.hasFard3 ? markValue : null,
          fard4: detectedMarkTypes.hasFard4 ? markValue : null,
          activities: detectedMarkTypes.hasActivities ? markValue : null,
        },
      });
    }

    return students;
  }

  /**
   * Preprocess mark to handle OCR quirks
   */
  private preprocessMark(mark: string): string | null {
    if (!mark) return null;

    // Remove any spaces
    let cleaned = mark.replace(/\s+/g, "");

    // Handle formats like "07100" which should be "07,00"
    if (/^\d{2}100$/.test(cleaned)) {
      cleaned = cleaned.substring(0, 2) + ",00";
      console.log(`  Converted ${mark} to ${cleaned}`);
    }
    // Handle formats like "03100" -> "03,00"
    else if (/^\d{1}100$/.test(cleaned)) {
      cleaned = "0" + cleaned.substring(0, 1) + ",00";
      console.log(`  Converted ${mark} to ${cleaned}`);
    }
    // Handle formats like "10100" -> "10,00"
    else if (/^\d{3}00$/.test(cleaned) && cleaned !== "10000") {
      const firstTwo = cleaned.substring(0, 2);
      const num = parseInt(firstTwo);
      if (num <= 20) {
        cleaned = firstTwo + ",00";
        console.log(`  Converted ${mark} to ${cleaned}`);
      }
    }
    // Handle "108,00" which is likely "10,00" or "08,00"
    else if (cleaned === "108,00") {
      cleaned = "10,00"; // Most likely 10,00
      console.log(`  Converted ${mark} to ${cleaned}`);
    }

    return cleaned;
  }

  /**
   * Parse mark value with better handling
   */
  private parseMarkValue(mark: string | null): number | null {
    if (!mark) return null;

    // The mark should already be preprocessed
    // Convert comma to dot for decimal
    const normalized = mark.replace(",", ".");

    // Remove any remaining non-numeric characters except dot
    const cleaned = normalized.replace(/[^\d.]/g, "");

    // Parse the number
    const num = parseFloat(cleaned);

    // Validate the mark is within reasonable range (0-20)
    if (!isNaN(num) && num >= 0 && num <= 20) {
      return Number(num.toFixed(2));
    }

    console.warn(`⚠️ Invalid mark value after parsing: ${mark} -> ${num}`);
    return null;
  }

  /**
   * Normalize Arabic numbers to English
   */
  private normalizeArabicNumber(text: string): string {
    const numeralMap: Record<string, string> = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
    };

    return text.replace(/[٠-٩]/g, (d) => numeralMap[d] || d);
  }

  /**
   * Convert file to base64 string
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export default new GeminiOCRService();
