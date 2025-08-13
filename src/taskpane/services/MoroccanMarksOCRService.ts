// MoroccanMarksOCRService.ts
// Specialized OCR service optimized for Moroccan handwritten marks sheets

import { Student, DetectedMarkTypes, StudentMarks } from "../types";

// Add global type declarations for browser APIs
declare global {
  interface Window {
    File: typeof File;
    console: typeof console;
  }
}

interface OCRConfig {
  confidenceThreshold: number;
  maxRetries: number;
  enableHandwritingMode: boolean;
  enableTableDetection: boolean;
  languageHints: string[];
}

interface ProcessedCell {
  text: string;
  confidence: number;
  bounds: BoundingBox;
  row: number;
  col: number;
  cellType: "name" | "mark" | "number" | "unknown";
}

interface BoundingBox {
  vertices: Array<{ x: number; y: number }>;
}

interface TableStructure {
  rows: ProcessedCell[][];
  headers: string[];
  confidence: number;
  markColumnsMap: Map<number, MarkType>;
}

type MarkType = "fard1" | "fard2" | "fard3" | "fard4" | "activities";

export class MoroccanMarksOCRService {
  private config: OCRConfig = {
    confidenceThreshold: 0.7,
    maxRetries: 3,
    enableHandwritingMode: true,
    enableTableDetection: true,
    languageHints: ["ar", "fr"], // Arabic and French for numbers
  };

  private readonly MARK_PATTERNS = {
    // Enhanced patterns for Moroccan format
    marks: [
      /^\d{1,2}[,\.]\d{2}$/, // 07.00 or 07,00
      /^\d{1,2}$/, // 7 or 17
      /^\d{1,2}[\/]\d{2}$/, // 15/20 format
    ],
    arabicNumbers: {
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
    },
  };

  /**
   * Main processing method with multiple strategies
   */
  async processMarksSheet(imageFile: File): Promise<{
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
    confidence: number;
    warnings: string[];
  }> {
    console.log("🚀 Starting Moroccan Marks OCR Processing...");

    const warnings: string[] = [];
    let bestResult = null;
    let highestConfidence = 0;

    // Strategy 1: Table Detection with Handwriting Recognition
    try {
      const tableResult = await this.processWithTableDetection(imageFile);
      if (tableResult.confidence > highestConfidence) {
        bestResult = tableResult;
        highestConfidence = tableResult.confidence;
      }
    } catch (error) {
      warnings.push("Table detection strategy failed, trying alternatives");
    }

    // Strategy 2: Line-by-Line Processing
    try {
      const lineResult = await this.processLineByLine(imageFile);
      if (lineResult.confidence > highestConfidence) {
        bestResult = lineResult;
        highestConfidence = lineResult.confidence;
      }
    } catch (error) {
      warnings.push("Line processing strategy failed");
    }

    // Strategy 3: Grid-Based Detection
    try {
      const gridResult = await this.processWithGridDetection(imageFile);
      if (gridResult.confidence > highestConfidence) {
        bestResult = gridResult;
        highestConfidence = gridResult.confidence;
      }
    } catch (error) {
      warnings.push("Grid detection strategy failed");
    }

    if (!bestResult) {
      throw new Error("فشل استخراج البيانات. يرجى التأكد من وضوح الصورة.");
    }

    // Apply post-processing enhancements
    const enhanced = await this.enhanceResults(bestResult);

    return {
      ...enhanced,
      confidence: highestConfidence,
      warnings,
    };
  }

  /**
   * Process with advanced table detection
   */
  private async processWithTableDetection(imageFile: File): Promise<{
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
    confidence: number;
  }> {
    const base64 = await this.fileToBase64(imageFile);
    const apiResponse = await this.callVisionAPI(base64, {
      features: [
        { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
        { type: "TEXT_DETECTION", maxResults: 50 },
      ],
      imageContext: {
        languageHints: this.config.languageHints,
        textDetectionParams: {
          enableTextDetectionConfidenceScore: true,
        },
      },
    });

    // Extract table structure
    const table = this.extractTableStructure(apiResponse);

    // Convert to students
    const students = this.tableToStudents(table);

    // Detect mark types
    const detectedMarkTypes = this.detectMarkTypes(table);

    return {
      students,
      detectedMarkTypes,
      confidence: table.confidence,
    };
  }

  /**
   * Extract table structure from OCR response
   */
  private extractTableStructure(apiResponse: any): TableStructure {
    const blocks = apiResponse.responses[0].textAnnotations || [];
    const fullText = apiResponse.responses[0].fullTextAnnotation;

    // Group text blocks by rows based on Y coordinates
    const rows = this.groupBlocksByRows(blocks);

    // Identify headers
    const headers = this.identifyHeaders(rows[0] || []);

    // Map columns to mark types
    const markColumnsMap = this.mapColumnsToMarkTypes(headers);

    // Process each row
    const processedRows = rows.slice(1).map((row, rowIndex) => this.processRow(row, rowIndex, markColumnsMap));

    // Calculate overall confidence
    const confidence = this.calculateTableConfidence(processedRows);

    return {
      rows: processedRows,
      headers,
      confidence,
      markColumnsMap,
    };
  }

  /**
   * Group text blocks into rows based on Y coordinates
   */
  private groupBlocksByRows(blocks: any[]): any[][] {
    if (!blocks || blocks.length === 0) return [];

    // Skip the first block (full text)
    const textBlocks = blocks.slice(1);

    // Sort by Y coordinate
    textBlocks.sort((a: any, b: any) => {
      const aY = Math.min(...a.boundingPoly.vertices.map((v: any) => v.y));
      const bY = Math.min(...b.boundingPoly.vertices.map((v: any) => v.y));
      return aY - bY;
    });

    // Group into rows with tolerance
    const rows: any[][] = [];
    let currentRow: any[] = [];
    let currentY = -1;
    const Y_TOLERANCE = 20; // pixels

    for (const block of textBlocks) {
      const blockY = Math.min(...block.boundingPoly.vertices.map((v: any) => v.y));

      if (currentY === -1 || Math.abs(blockY - currentY) <= Y_TOLERANCE) {
        currentRow.push(block);
        currentY = blockY;
      } else {
        if (currentRow.length > 0) {
          // Sort row by X coordinate
          currentRow.sort((a: any, b: any) => {
            const aX = Math.min(...a.boundingPoly.vertices.map((v: any) => v.x));
            const bX = Math.min(...b.boundingPoly.vertices.map((v: any) => v.x));
            return aX - bX;
          });
          rows.push(currentRow);
        }
        currentRow = [block];
        currentY = blockY;
      }
    }

    if (currentRow.length > 0) {
      currentRow.sort((a: any, b: any) => {
        const aX = Math.min(...a.boundingPoly.vertices.map((v: any) => v.x));
        const bX = Math.min(...b.boundingPoly.vertices.map((v: any) => v.x));
        return aX - bX;
      });
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Process a single row of data
   */
  private processRow(row: any[], rowIndex: number, markColumnsMap: Map<number, MarkType>): ProcessedCell[] {
    return row.map((block, colIndex) => {
      const text = this.normalizeText(block.description);
      const cellType = this.determineCellType(text, colIndex, markColumnsMap);

      return {
        text,
        confidence: block.confidence || 0.8,
        bounds: block.boundingPoly,
        row: rowIndex,
        col: colIndex,
        cellType,
      };
    });
  }

  /**
   * Determine cell type (name, mark, number, etc.)
   */
  private determineCellType(
    text: string,
    colIndex: number,
    markColumnsMap: Map<number, MarkType>
  ): ProcessedCell["cellType"] {
    // Check if it's a mark
    if (this.isValidMark(text)) {
      return "mark";
    }

    // Check if it's a student number
    if (/^\d{1,3}$/.test(text)) {
      return "number";
    }

    // Check if it's Arabic text (likely a name)
    if (/[\u0600-\u06FF]{2,}/.test(text)) {
      return "name";
    }

    return "unknown";
  }

  /**
   * Convert table structure to Student objects
   */
  private tableToStudents(table: TableStructure): Student[] {
    const students: Student[] = [];

    for (const row of table.rows) {
      // Find name cell
      const nameCell = row.find((cell) => cell.cellType === "name");
      if (!nameCell) continue;

      // Extract marks based on column positions
      const marks: StudentMarks = {
        fard1: null,
        fard2: null,
        fard3: null,
        fard4: null,
        activities: null,
      };

      // Map cells to mark types based on column index
      for (const [colIndex, markType] of table.markColumnsMap) {
        const markCell = row.find((cell) => cell.col === colIndex && cell.cellType === "mark");
        if (markCell) {
          marks[markType] = this.parseMarkValue(markCell.text);
        }
      }

      students.push({
        number: students.length + 1,
        name: this.cleanArabicName(nameCell.text),
        marks,
      });
    }

    return students;
  }

  /**
   * Parse mark value from text
   */
  private parseMarkValue(text: string): number | null {
    if (!text) return null;

    // Normalize Arabic numbers
    let normalized = text;
    for (const [ar, en] of Object.entries(this.MARK_PATTERNS.arabicNumbers)) {
      normalized = normalized.replace(new RegExp(ar, "g"), en);
    }

    // Handle different formats
    // Format: 07,00 or 07.00
    if (/^\d{1,2}[,\.]\d{2}$/.test(normalized)) {
      return parseFloat(normalized.replace(",", "."));
    }

    // Format: 15/20 (take numerator)
    if (/^\d{1,2}\/\d{2}$/.test(normalized)) {
      const [numerator] = normalized.split("/");
      return parseFloat(numerator);
    }

    // Simple number
    if (/^\d{1,2}$/.test(normalized)) {
      return parseFloat(normalized);
    }

    return null;
  }

  /**
   * Clean and normalize Arabic names
   */
  private cleanArabicName(name: string): string {
    return (
      name
        .trim()
        // Remove extra spaces
        .replace(/\s+/g, " ")
        // Fix common OCR errors in Arabic
        .replace(/ة\s+/g, "ة ")
        .replace(/\s+و\s+/g, " و")
        // Remove any non-Arabic characters except spaces
        .replace(/[^\u0600-\u06FF\s]/g, "")
        .trim()
    );
  }

  /**
   * Detect mark types from table headers
   */
  private detectMarkTypes(table: TableStructure): DetectedMarkTypes {
    const detected: DetectedMarkTypes = {
      hasFard1: false,
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    };

    // Check headers
    const headerText = table.headers.join(" ");

    if (/الفرض\s*1|فرض\s*الأول/.test(headerText)) detected.hasFard1 = true;
    if (/الفرض\s*2|فرض\s*الثاني/.test(headerText)) detected.hasFard2 = true;
    if (/الفرض\s*3|فرض\s*الثالث/.test(headerText)) detected.hasFard3 = true;
    if (/الفرض\s*4|فرض\s*الرابع/.test(headerText)) detected.hasFard4 = true;
    if (/الأنشطة|النشاط/.test(headerText)) detected.hasActivities = true;

    // Also check actual data presence
    for (const [_, markType] of table.markColumnsMap) {
      if (markType === "fard1") detected.hasFard1 = true;
      if (markType === "fard2") detected.hasFard2 = true;
      if (markType === "fard3") detected.hasFard3 = true;
      if (markType === "fard4") detected.hasFard4 = true;
      if (markType === "activities") detected.hasActivities = true;
    }

    return detected;
  }

  /**
   * Process line by line (fallback strategy)
   */
  private async processLineByLine(imageFile: File): Promise<{
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
    confidence: number;
  }> {
    const base64 = await this.fileToBase64(imageFile);
    const apiResponse = await this.callVisionAPI(base64, {
      features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
      imageContext: { languageHints: this.config.languageHints },
    });

    const fullText = apiResponse.responses[0].textAnnotations?.[0]?.description || "";
    const lines: string[] = fullText.split("\n").filter((line: string) => line.trim());

    const students: Student[] = [];
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: false,
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    };

    for (const line of lines) {
      // Skip headers
      if (this.isHeaderLine(line)) continue;

      // Extract student data from line
      const studentData = this.extractStudentFromLine(line);
      if (studentData) {
        students.push(studentData);

        // Update detected types
        if (studentData.marks.fard1 !== null) detectedMarkTypes.hasFard1 = true;
        if (studentData.marks.fard2 !== null) detectedMarkTypes.hasFard2 = true;
        if (studentData.marks.fard3 !== null) detectedMarkTypes.hasFard3 = true;
        if (studentData.marks.fard4 !== null) detectedMarkTypes.hasFard4 = true;
        if (studentData.marks.activities !== null) detectedMarkTypes.hasActivities = true;
      }
    }

    return {
      students,
      detectedMarkTypes,
      confidence: 0.7, // Lower confidence for line-by-line
    };
  }

  /**
   * Process with grid detection (for well-structured tables)
   */
  private async processWithGridDetection(imageFile: File): Promise<{
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
    confidence: number;
  }> {
    // Implementation for grid-based detection
    // This would use image processing to detect grid lines
    // and extract data from cells

    // For now, returning a basic implementation
    return this.processLineByLine(imageFile);
  }

  /**
   * Enhance results with post-processing
   */
  private async enhanceResults(result: { students: Student[]; detectedMarkTypes: DetectedMarkTypes }): Promise<{
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
  }> {
    let enhanced = { ...result };

    // Fix common OCR errors
    enhanced.students = this.fixCommonOCRErrors(enhanced.students);

    // Validate marks statistically
    enhanced.students = this.validateMarksStatistically(enhanced.students);

    // Remove duplicates
    enhanced.students = this.removeDuplicates(enhanced.students);

    // Fix student numbering
    enhanced.students = this.fixStudentNumbering(enhanced.students);

    return enhanced;
  }

  /**
   * Fix common OCR errors in extracted data
   */
  private fixCommonOCRErrors(students: Student[]): Student[] {
    return students.map((student) => ({
      ...student,
      name: this.fixArabicOCRErrors(student.name),
      marks: this.fixMarkOCRErrors(student.marks),
    }));
  }

  /**
   * Fix common Arabic OCR errors
   */
  private fixArabicOCRErrors(text: string): string {
    return (
      text
        // Common letter confusions
        .replace(/ـ/g, "") // Remove kashida
        .replace(/إ/g, "ا") // Normalize alif
        .replace(/أ/g, "ا")
        .replace(/آ/g, "ا")
        .replace(/ى/g, "ي") // Normalize ya
        .replace(/ة/g, "ه") // Sometimes ة is read as ه
        // Fix spacing issues
        .replace(/([ا-ي])\s+([ا-ي])/g, "$1 $2")
        .trim()
    );
  }

  /**
   * Fix mark OCR errors
   */
  private fixMarkOCRErrors(marks: StudentMarks): StudentMarks {
    const fixed: StudentMarks = { ...marks };

    for (const key of Object.keys(fixed) as Array<keyof StudentMarks>) {
      const value = fixed[key];
      if (value !== null) {
        // Fix decimal issues (e.g., 750 should be 7.50)
        if (value > 100) {
          fixed[key] = value / 100;
        }
        // Cap at 20
        if (value > 20) {
          fixed[key] = 20;
        }
        // Round to 2 decimals
        fixed[key] = Math.round(value * 100) / 100;
      }
    }

    return fixed;
  }

  /**
   * Validate marks using statistical methods
   */
  private validateMarksStatistically(students: Student[]): Student[] {
    if (students.length < 5) return students; // Need enough data

    // Calculate statistics for each mark type
    const stats = this.calculateStatistics(students);

    return students.map((student) => {
      const validated = { ...student };

      for (const markType of Object.keys(student.marks) as Array<keyof StudentMarks>) {
        const mark = student.marks[markType];
        if (mark !== null && stats[markType]) {
          const zScore = Math.abs((mark - stats[markType].mean) / stats[markType].stdDev);

          // If it's an extreme outlier, check if it might be an OCR error
          if (zScore > 3) {
            // Possibly a decimal point issue
            if (mark > 100) {
              validated.marks[markType] = mark / 100;
            }
            // Or a missing decimal (e.g., 1500 should be 15.00)
            else if (mark > 20 && mark < 1000) {
              validated.marks[markType] = mark / 100;
            }
          }
        }
      }

      return validated;
    });
  }

  /**
   * Calculate statistics for each mark type
   */
  private calculateStatistics(
    students: Student[]
  ): Record<keyof StudentMarks, { mean: number; stdDev: number } | null> {
    const stats: Record<keyof StudentMarks, { mean: number; stdDev: number } | null> = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };

    for (const markType of Object.keys(stats) as Array<keyof StudentMarks>) {
      const values = students.map((s) => s.marks[markType]).filter((v): v is number => v !== null);

      if (values.length >= 3) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        stats[markType] = { mean, stdDev };
      }
    }

    return stats;
  }

  /**
   * Remove duplicate students based on name similarity
   */
  private removeDuplicates(students: Student[]): Student[] {
    const unique: Student[] = [];
    const seenNames = new Set<string>();

    for (const student of students) {
      const normalizedName = this.normalizeNameForComparison(student.name);
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        unique.push(student);
      }
    }

    return unique;
  }

  /**
   * Normalize name for duplicate comparison
   */
  private normalizeNameForComparison(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\u0600-\u06FF\s]/g, "") // Keep only Arabic letters and spaces
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  /**
   * Fix student numbering to be sequential
   */
  private fixStudentNumbering(students: Student[]): Student[] {
    return students.map((student, index) => ({
      ...student,
      number: index + 1,
    }));
  }

  /**
   * Check if a line is a header line
   */
  private isHeaderLine(line: any): boolean {
    const headerPatterns = [/الاسم|اسم|الطالب/, /الفرض|فرض/, /الأنشطة|النشاط/, /العدد|رقم/, /المجموع|المعدل/];

    return headerPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Extract student data from a single line
   */
  private extractStudentFromLine(line: string): Student | null {
    // Split line by common separators
    const parts = line.split(/[\s\t,;|]+/).filter((part) => part.trim());

    if (parts.length < 3) return null; // Need at least name and some marks

    // Find Arabic name (likely first part)
    const nameIndex = parts.findIndex((part) => /[\u0600-\u06FF]{2,}/.test(part));
    if (nameIndex === -1) return null;

    const name = parts[nameIndex];
    const marks: StudentMarks = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };

    // Extract marks from remaining parts
    let markIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      if (i === nameIndex) continue;

      const part = parts[i];
      const markValue = this.parseMarkValue(part);

      if (markValue !== null) {
        switch (markIndex) {
          case 0:
            marks.fard1 = markValue;
            break;
          case 1:
            marks.fard2 = markValue;
            break;
          case 2:
            marks.fard3 = markValue;
            break;
          case 3:
            marks.fard4 = markValue;
            break;
          case 4:
            marks.activities = markValue;
            break;
        }
        markIndex++;
      }
    }

    return {
      number: 0, // Will be fixed later
      name: this.cleanArabicName(name),
      marks,
    };
  }

  /**
   * Check if text represents a valid mark
   */
  private isValidMark(text: string): boolean {
    if (!text) return false;

    // Normalize Arabic numbers first
    let normalized = text;
    for (const [ar, en] of Object.entries(this.MARK_PATTERNS.arabicNumbers)) {
      normalized = normalized.replace(new RegExp(ar, "g"), en);
    }

    // Check against mark patterns
    return this.MARK_PATTERNS.marks.some((pattern) => pattern.test(normalized));
  }

  /**
   * Normalize text for processing
   */
  private normalizeText(text: string): string {
    if (!text) return "";

    return text
      .trim()
      .replace(/\s+/g, " ") // Normalize spaces
      .replace(/[^\u0600-\u06FF\s\d,\.\/]/g, "") // Keep Arabic, numbers, spaces, commas, dots, slashes
      .trim();
  }

  /**
   * Identify headers from the first row
   */
  private identifyHeaders(firstRow: any[]): string[] {
    return firstRow.map((block) => this.normalizeText(block.description || ""));
  }

  /**
   * Map columns to mark types based on headers
   */
  private mapColumnsToMarkTypes(headers: string[]): Map<number, MarkType> {
    const mapping = new Map<number, MarkType>();

    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase();

      if (/الفرض\s*1|فرض\s*الأول|fard1/i.test(lowerHeader)) {
        mapping.set(index, "fard1");
      } else if (/الفرض\s*2|فرض\s*الثاني|fard2/i.test(lowerHeader)) {
        mapping.set(index, "fard2");
      } else if (/الفرض\s*3|فرض\s*الثالث|fard3/i.test(lowerHeader)) {
        mapping.set(index, "fard3");
      } else if (/الفرض\s*4|فرض\s*الرابع|fard4/i.test(lowerHeader)) {
        mapping.set(index, "fard4");
      } else if (/الأنشطة|النشاط|activities/i.test(lowerHeader)) {
        mapping.set(index, "activities");
      }
    });

    return mapping;
  }

  /**
   * Calculate confidence for table structure
   */
  private calculateTableConfidence(rows: ProcessedCell[][]): number {
    if (rows.length === 0) return 0;

    let totalConfidence = 0;
    let totalCells = 0;

    for (const row of rows) {
      for (const cell of row) {
        totalConfidence += cell.confidence;
        totalCells++;
      }
    }

    return totalCells > 0 ? totalConfidence / totalCells : 0;
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

  /**
   * Call Google Vision API
   */
  private async callVisionAPI(base64Image: string, options: any): Promise<any> {
    const apiKey = process.env.GOOGLE_VISION_AI_API_KEY;

    if (!apiKey) {
      throw new Error("Google Vision API key not found. Please check your environment configuration.");
    }

    const apiUrl = `https://vision.googleapis.com/v1p2beta1/files:annotate?key=${apiKey}`;

    // Remove data URL prefix if present
    const base64Content = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Content,
            },
            ...options,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Vision API error:", errorData);

      if (response.status === 403) {
        throw new Error("فشل الاتصال بخدمة التعرف على النص: خطأ في المصادقة. يرجى التحقق من مفتاح API.");
      } else {
        throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
      }
    }

    return response.json();
  }
}
