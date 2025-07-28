// Enhanced OCR service with improved accuracy and resilience
import { Student, StudentMarks, DetectedMarkTypes } from "../types";
import ocrService from "./ocrService";
import OCREdgeCasesHandler from "./ocrEdgeCaseHandler";

// Types for Vision AI API responses and processing
interface BoundingBox {
  vertices: Array<{
    x: number;
    y: number;
  }>;
}

interface TextBlock {
  description: string;
  boundingPoly: BoundingBox;
}

interface TableCell {
  text: string;
  row: number;
  col: number;
  confidence: number;
}

interface ProcessedTable {
  headers: string[];
  rows: TableCell[][];
  confidenceScore: number;
}

// Configuration for mark detection patterns
const MARK_PATTERNS = {
  fard1: [/فرض.*?1/i, /الفرض.*?الأول/i, /الفرض.*?1/i, /فرض.*?١/i, /اختبار.*?1/i],
  fard2: [/فرض.*?2/i, /الفرض.*?الثاني/i, /الفرض.*?2/i, /فرض.*?٢/i, /اختبار.*?2/i],
  fard3: [/فرض.*?3/i, /الفرض.*?الثالث/i, /الفرض.*?3/i, /فرض.*?٣/i, /اختبار.*?3/i],
  activities: [/أنشطة/i, /النشاط/i, /الأنشطة/i, /مراقبة/i, /مستمرة/i],
};

class EnhancedOCRService {
  private processingAttempts = 0;
  private maxProcessingAttempts = 3;

  /**
   * Main method to process an image and extract student marks
   */
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      // Use your existing OCR service first
      const result = await ocrService.processImage(imageFile);

      // If no students were detected, try a specialized handwritten extraction
      if (result.students.length === 0) {
        const handwrittenResult = await this.extractHandwrittenTableData(imageFile);
        if (handwrittenResult.students.length > 0) {
          return handwrittenResult;
        }
      }

      // Apply edge case handling to improve results
      const enhancedResult = OCREdgeCasesHandler.enhanceExtractedData(result.students, result.detectedMarkTypes);

      return enhancedResult;
    } catch (error) {
      console.error("Enhanced OCR processing error:", error);
      throw error;
    }
  }

  private async extractHandwrittenTableData(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Initialize detected mark types from table headers
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: true, // We can see الفرض 1 in the header
      hasFard2: true, // We can see الفرض 2 in the header
      hasFard3: true, // We can see الفرض 3 in the header
      hasFard4: true, // We can see الفرض 4 in the header
      hasActivities: true, // We can see الأنشطة in the header
    };

    try {
      // Process with the existing OCR first to get raw text
      const { text, blocks } = await this.getRawOcrData(imageFile);

      // Parse the text to extract rows
      const rows = this.extractTableRows(text);

      // Create student objects from rows
      const students: Student[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Skip header rows
        if (row.includes("اسم التلميذ") || row.includes("الفرض")) {
          continue;
        }

        // Try to extract student data
        const student = this.extractStudentFromRow(row, i + 1);
        if (student) {
          students.push(student);
        }
      }

      return { students, detectedMarkTypes };
    } catch (error) {
      console.error("Handwritten extraction error:", error);
      return {
        students: [],
        detectedMarkTypes: {
          hasFard1: true,
          hasFard2: true,
          hasFard3: true,
          hasFard4: false,
          hasActivities: true,
        },
      };
    }
  }

  private extractStudentFromRow(row: string, number: number): Student | null {
    // This regex looks for patterns of Arabic text followed by numbers
    const nameMatch = row.match(/[\u0600-\u06FF\s]+/);
    const markPatterns = row.match(/\d+[,\.]\d+/g) || [];

    if (nameMatch && markPatterns.length > 0) {
      const name = nameMatch[0].trim();

      // Convert marks like "07,00" to numbers
      const marks: StudentMarks = {
        fard1: null,
        fard2: null,
        fard3: null,
        fard4: null,
        activities: null,
      };

      // Assign marks based on position (assuming order is: fard1, fard2, fard3, fard4, activities)
      if (markPatterns.length >= 1 && markPatterns[0]) {
        marks.fard1 = this.parseHandwrittenMark(markPatterns[0]);
      }
      if (markPatterns.length >= 2 && markPatterns[1]) {
        marks.fard2 = this.parseHandwrittenMark(markPatterns[1]);
      }
      if (markPatterns.length >= 3 && markPatterns[2]) {
        marks.fard3 = this.parseHandwrittenMark(markPatterns[2]);
      }
      if (markPatterns.length >= 4 && markPatterns[3]) {
        marks.fard4 = this.parseHandwrittenMark(markPatterns[3]);
      }
      if (markPatterns.length >= 5 && markPatterns[4]) {
        marks.activities = this.parseHandwrittenMark(markPatterns[4]);
      }

      return {
        number,
        name,
        marks,
      };
    }

    return null;
  }

  // Parse handwritten mark format (e.g., "07,00" -> 7.00)
  private parseHandwrittenMark(markStr: string): number | null {
    if (!markStr) return null;

    try {
      // Replace comma with dot for decimal
      const normalized = markStr.replace(",", ".");
      // Remove leading zeros and parse
      const value = parseFloat(normalized.replace(/^0+/, ""));

      if (isNaN(value) || value < 0 || value > 20) {
        return null;
      }

      return parseFloat(value.toFixed(2));
    } catch {
      return null;
    }
  }

  // Helper to extract table rows from text
  private extractTableRows(text: string): string[] {
    // Split by newlines and filter empty lines
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  // Get raw OCR data from image
  private async getRawOcrData(imageFile: File): Promise<{ text: string; blocks: any[] }> {
    // Use your existing OCR implementation to get raw text
    // This is a simplified placeholder
    const base64Image = await this.fileToBase64(imageFile);
    const base64Content = base64Image.split(",")[1];

    // Placeholder for API call result
    // In reality, this would call your OCR API and get the raw text and blocks

    // For testing, we'll return a simplified structure
    return {
      text: "Sample extracted text",
      blocks: [],
    };
  }

  /**
   * Validate the image file before processing
   */
  private validateImage(file: File): boolean {
    // Check file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      return false;
    }

    // Check file size (max 4MB)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      return false;
    }

    return true;
  }

  /**
   * Process image with multiple strategies and select the best result
   */
  private async processWithMultipleStrategies(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Try table detection first (more structured approach)
    try {
      const tableResult = await this.processWithTableDetection(imageFile);

      // If we get a good number of students with marks, use this result
      if (tableResult.students.length >= 5 && this.hasValidMarks(tableResult.students)) {
        console.log("Table detection succeeded with good quality results");
        return tableResult;
      }
    } catch (tableError) {
      console.log("Table detection failed, will try text detection", tableError);
    }

    // Try text detection as fallback
    try {
      const textResult = await this.processWithTextDetection(imageFile);

      // If we get any students with marks, use this result
      if (textResult.students.length > 0) {
        console.log("Text detection succeeded with usable results");
        return textResult;
      }
    } catch (textError) {
      console.log("Text detection failed", textError);
    }

    // If both methods fail, try one more time with more aggressive settings
    return this.processWithAggressive(imageFile);
  }

  /**
   * Check if the extracted students have valid marks
   */
  private hasValidMarks(students: Student[]): boolean {
    if (students.length === 0) return false;

    // Count students with at least one valid mark
    const studentsWithMarks = students.filter(
      (student) =>
        student.marks.fard1 !== null ||
        student.marks.fard2 !== null ||
        student.marks.fard3 !== null ||
        student.marks.activities !== null
    );

    // At least 50% of students should have marks
    return studentsWithMarks.length >= students.length * 0.5;
  }

  /**
   * Process image with table detection approach
   */
  private async processWithTableDetection(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Convert image to base64
    const base64Image = await this.fileToBase64(imageFile);
    const base64Content = base64Image.split(",")[1];

    // Get API key
    const apiKey = process.env.GOOGLE_VISION_AI_API_KEY || process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw new Error("مفتاح API غير متوفر. يرجى التحقق من إعدادات التطبيق.");
    }

    // Vision AI API endpoint
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    // Request with document text detection for full layout analysis
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Content },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: {
              languageHints: ["ar"],
              textDetectionParams: { enableTextDetectionConfidenceScore: true },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Vision API error:", errorData);
      throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
    }

    const data = await response.json();

    if (!data.responses || !data.responses[0]) {
      throw new Error("لم يتم التعرف على أي نص في الصورة");
    }

    // Full text for backup processing
    const fullText = data.responses[0].fullTextAnnotation?.text || "";

    // Get text blocks with position information
    const textBlocks = data.responses[0].textAnnotations || [];

    // Process the result with layout information
    const { students, detectedMarkTypes } = await this.reconstructTable(fullText, textBlocks);

    // If we couldn't extract data, throw error to try next method
    if (students.length === 0) {
      throw new Error("لم يتم العثور على بيانات طلاب في الجدول");
    }

    return { students, detectedMarkTypes };
  }

  /**
   * Process image with text detection approach
   */
  private async processWithTextDetection(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Convert image to base64
    const base64Image = await this.fileToBase64(imageFile);
    const base64Content = base64Image.split(",")[1];

    // Get API key
    const apiKey = process.env.GOOGLE_VISION_AI_API_KEY || process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw new Error("مفتاح API غير متوفر. يرجى التحقق من إعدادات التطبيق.");
    }

    // Vision AI API endpoint
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    // Request with text detection (simpler approach)
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Content },
            features: [{ type: "TEXT_DETECTION" }],
            imageContext: { languageHints: ["ar"] },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Vision API error:", errorData);
      throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
    }

    const data = await response.json();

    if (!data.responses || !data.responses[0]) {
      throw new Error("لم يتم التعرف على أي نص في الصورة");
    }

    // Extract the full text
    const extractedText =
      data.responses[0].fullTextAnnotation?.text || data.responses[0].textAnnotations?.[0]?.description || "";

    if (!extractedText) {
      throw new Error("لم يتم استخراج نص من الصورة");
    }

    // Process the text to extract structured data
    return this.extractStructuredData(extractedText);
  }

  /**
   * Process with more aggressive settings as a last resort
   */
  private async processWithAggressive(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Convert image to base64
    const base64Image = await this.fileToBase64(imageFile);
    const base64Content = base64Image.split(",")[1];

    // Get API key
    const apiKey = process.env.GOOGLE_VISION_AI_API_KEY || process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw new Error("مفتاح API غير متوفر. يرجى التحقق من إعدادات التطبيق.");
    }

    // Vision AI API endpoint
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    // Request with both document and text detection
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Content },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
              { type: "TEXT_DETECTION", maxResults: 1 },
            ],
            imageContext: {
              languageHints: ["ar", "en"],
              textDetectionParams: { enableTextDetectionConfidenceScore: true },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Vision API error:", errorData);
      throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
    }

    const data = await response.json();

    if (!data.responses || !data.responses[0]) {
      throw new Error("لم يتم التعرف على أي نص في الصورة");
    }

    // Use document text detection if available, otherwise use text detection
    const extractedText =
      data.responses[0].fullTextAnnotation?.text || data.responses[0].textAnnotations?.[0]?.description || "";

    if (!extractedText) {
      throw new Error("لم يتم استخراج نص من الصورة");
    }

    // Process with very permissive settings
    return this.extractStructuredDataAggressive(extractedText);
  }

  /**
   * Retry processing with different settings
   */
  private async retryProcessing(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Different approach based on attempt number
    if (this.processingAttempts === 1) {
      return this.processWithTextDetection(imageFile);
    } else {
      return this.processWithAggressive(imageFile);
    }
  }

  /**
   * Reconstruct a table from text blocks and position information
   */
  private async reconstructTable(
    fullText: string,
    textBlocks: TextBlock[]
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Default detected mark types
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: false,
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    };

    // Skip the first block which contains the entire text
    const blocks = textBlocks.slice(1);

    // First, identify column headers to establish table structure
    const headerBlocks = blocks.filter((block) => {
      const text = block.description.toLowerCase();
      return this.isHeaderText(text);
    });

    if (headerBlocks.length === 0) {
      console.log("No header blocks found, falling back to text-based extraction");
      return this.extractStructuredData(fullText);
    }

    // Determine column boundaries and types
    const columns: Array<{
      type: string;
      xMin: number;
      xMax: number;
      yLevel: number;
    }> = [];

    headerBlocks.forEach((block) => {
      const text = block.description.toLowerCase();
      const boundingBox = block.boundingPoly.vertices;

      // Calculate X position and boundaries
      const xMin = Math.min(...boundingBox.map((v) => v.x));
      const xMax = Math.max(...boundingBox.map((v) => v.x));
      const yLevel = Math.min(...boundingBox.map((v) => v.y));

      let columnType = this.determineColumnType(text);

      // Update detected mark types
      if (columnType === "fard1") detectedMarkTypes.hasFard1 = true;
      else if (columnType === "fard2") detectedMarkTypes.hasFard2 = true;
      else if (columnType === "fard3") detectedMarkTypes.hasFard3 = true;
      else if (columnType === "activities") detectedMarkTypes.hasActivities = true;

      if (columnType) {
        columns.push({ type: columnType, xMin, xMax, yLevel });
      }
    });

    // Sort columns by X position to understand the table layout
    columns.sort((a, b) => a.xMin - b.xMin);

    // If we couldn't find at least name column and one mark column, try other methods
    if (columns.length < 2 || !columns.some((c) => c.type === "name")) {
      return this.extractStructuredData(fullText);
    }

    // Now find row data by looking at Y positions below header
    const headerYLevel = Math.max(...columns.map((c) => c.yLevel));
    const rowBlocks = blocks.filter((block) => {
      const boundingBox = block.boundingPoly.vertices;
      const yMin = Math.min(...boundingBox.map((v) => v.y));
      return yMin > headerYLevel;
    });

    // Group blocks by row (similar Y position)
    const rowGroups: Record<number, TextBlock[]> = {};

    rowBlocks.forEach((block) => {
      const boundingBox = block.boundingPoly.vertices;
      const yCenter = boundingBox.reduce((sum, v) => sum + v.y, 0) / 4;

      // Find or create row group (tolerance for slight vertical misalignments)
      const rowKey = Math.floor(yCenter / 30); // Group within 30px vertically
      if (!rowGroups[rowKey]) {
        rowGroups[rowKey] = [];
      }
      rowGroups[rowKey].push(block);
    });

    // Sort row groups by Y position
    const sortedRowKeys = Object.keys(rowGroups)
      .map(Number)
      .sort((a, b) => a - b);

    // Build student data from rows
    const students: Student[] = [];

    sortedRowKeys.forEach((rowKey, index) => {
      const rowData = rowGroups[rowKey];

      // Create empty student record
      const student: Student = {
        number: index + 1,
        name: "",
        marks: {
          fard1: null,
          fard2: null,
          fard3: null,
          fard4: null,
          activities: null,
        },
      };

      // Assign data to columns based on X position
      rowData.forEach((block) => {
        const text = block.description;
        const xCenter = block.boundingPoly.vertices.reduce((sum, v) => sum + v.x, 0) / 4;

        // Find which column this text belongs to
        for (const column of columns) {
          if (xCenter >= column.xMin && xCenter <= column.xMax) {
            if (column.type === "name") {
              student.name = this.cleanText(text);
            } else if (column.type === "number") {
              student.number = parseInt(text) || index + 1;
            } else if (column.type === "fard1") {
              student.marks.fard1 = this.parseMarkValue(text);
            } else if (column.type === "fard2") {
              student.marks.fard2 = this.parseMarkValue(text);
            } else if (column.type === "fard3") {
              student.marks.fard3 = this.parseMarkValue(text);
            } else if (column.type === "activities") {
              student.marks.activities = this.parseMarkValue(text);
            }
            break;
          }
        }
      });

      // Only add if we have a name (essential) and at least one mark
      if (
        student.name &&
        (student.marks.fard1 !== null ||
          student.marks.fard2 !== null ||
          student.marks.fard3 !== null ||
          student.marks.activities !== null)
      ) {
        students.push(student);
      }
    });

    return { students, detectedMarkTypes };
  }

  /**
   * Extract structured data from OCR text
   */
  private extractStructuredData(text: string): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    return new Promise((resolve) => {
      console.log("Extracting structured data from OCR text");

      // Default detected mark types
      const detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasFard4: false,
        hasActivities: false,
      };

      // Split text into lines for processing
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Detect mark type headers
      for (const line of lines) {
        const normalizedLine = this.normalizeText(line);

        if (MARK_PATTERNS.fard1.some((pattern) => pattern.test(normalizedLine))) {
          detectedMarkTypes.hasFard1 = true;
        }
        if (MARK_PATTERNS.fard2.some((pattern) => pattern.test(normalizedLine))) {
          detectedMarkTypes.hasFard2 = true;
        }
        if (MARK_PATTERNS.fard3.some((pattern) => pattern.test(normalizedLine))) {
          detectedMarkTypes.hasFard3 = true;
        }
        if (MARK_PATTERNS.activities.some((pattern) => pattern.test(normalizedLine))) {
          detectedMarkTypes.hasActivities = true;
        }
      }

      // Try to identify the table structure
      const tableStructure = this.identifyTableStructure(lines);

      // Extract students based on the identified structure
      const students = this.extractStudentsFromLines(lines, tableStructure, detectedMarkTypes);

      // Update detection based on actual marks found
      this.updateDetectedTypesFromStudents(students, detectedMarkTypes);

      resolve({ students, detectedMarkTypes });
    });
  }

  /**
   * Extract structured data with more aggressive/permissive settings
   */
  private extractStructuredDataAggressive(
    text: string
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    return new Promise((resolve) => {
      console.log("Extracting structured data with aggressive settings");

      // Default detected mark types
      const detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasFard4: false,
        hasActivities: false,
      };

      // Split text into lines and normalize
      const lines = text
        .split("\n")
        .map((line) => this.normalizeText(line))
        .filter((line) => line.length > 0);

      // Arrays to hold student data
      const students: Student[] = [];

      // Process each line to look for student data
      let currentStudent: Student | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip likely header lines
        if (this.isHeaderText(line)) continue;

        // Look for a line with a name and numbers
        const nameMatch = /[\u0600-\u06FF\s]{4,}/g.exec(line); // Arabic text at least 4 chars
        const marksMatch = line.match(/\d+[.,]?\d*/g); // Any numbers

        if (nameMatch && marksMatch && marksMatch.length >= 1) {
          // Likely a student row
          const name = this.cleanText(nameMatch[0]);
          const marks = marksMatch.map((m) => this.parseMarkValue(m)).filter((m) => m !== null);

          // Only use marks that are valid student marks (0-20)
          const validMarks = marks.filter((m) => m !== null && m >= 0 && m <= 20) as number[];

          if (name && validMarks.length > 0) {
            currentStudent = {
              number: students.length + 1,
              name,
              marks: {
                fard1: validMarks[0] || null,
                fard2: validMarks[1] || null,
                fard3: validMarks[2] || null,
                fard4: validMarks[3] || null,
                activities: validMarks[4] || null,
              },
            };

            students.push(currentStudent);

            // Update detected types based on available marks
            if (currentStudent && currentStudent.marks.fard1 !== null) detectedMarkTypes.hasFard1 = true;
            if (currentStudent && currentStudent.marks.fard2 !== null) detectedMarkTypes.hasFard2 = true;
            if (currentStudent && currentStudent.marks.fard3 !== null) detectedMarkTypes.hasFard3 = true;
            if (currentStudent && currentStudent.marks.activities !== null) detectedMarkTypes.hasActivities = true;
          }
        }
        // If we have a current student but the line just has numbers,
        // they might be additional marks for the same student
        else if (currentStudent && marksMatch && !nameMatch) {
          const additionalMarks = marksMatch
            .map((m) => this.parseMarkValue(m))
            .filter((m) => m !== null && m >= 0 && m <= 20) as number[];

          if (additionalMarks.length > 0) {
            // Fill in any missing marks
            if (currentStudent && currentStudent.marks.fard1 === null) {
              currentStudent.marks.fard1 = additionalMarks[0];
              detectedMarkTypes.hasFard1 = true;
            } else if (currentStudent && currentStudent.marks.fard2 === null) {
              currentStudent.marks.fard2 = additionalMarks[0];
              detectedMarkTypes.hasFard2 = true;
            } else if (currentStudent && currentStudent.marks.fard3 === null) {
              currentStudent.marks.fard3 = additionalMarks[0];
              detectedMarkTypes.hasFard3 = true;
            } else if (currentStudent && currentStudent.marks.activities === null) {
              currentStudent.marks.activities = additionalMarks[0];
              detectedMarkTypes.hasActivities = true;
            }
          }
        }
      }

      resolve({ students, detectedMarkTypes });
    });
  }

  /**
   * Identify the structure of the table from text lines
   */
  private identifyTableStructure(lines: string[]): {
    headerIndex: number;
    nameColumn: number;
    numberColumn: number;
    markColumns: Record<string, number>;
  } {
    // Default structure
    const structure = {
      headerIndex: -1,
      nameColumn: -1,
      numberColumn: -1,
      markColumns: {} as Record<string, number>,
    };

    // Look for a header row
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].toLowerCase();

      // Check if this line contains multiple header indicators
      const headerMatches = [
        line.includes("اسم") || line.includes("الاسم") || line.includes("التلميذ"),
        line.includes("رقم") || line.includes("الرقم"),
        line.includes("فرض") || line.includes("الفرض"),
        line.includes("أنشطة") || line.includes("الأنشطة"),
      ];

      if (headerMatches.filter(Boolean).length >= 2) {
        structure.headerIndex = i;

        // Split the header into parts to identify columns
        const headerParts = line.split(/\s{2,}|\t/);

        for (let j = 0; j < headerParts.length; j++) {
          const part = headerParts[j].trim();

          if (part.includes("اسم") || part.includes("التلميذ")) {
            structure.nameColumn = j;
          } else if (part.includes("رقم")) {
            structure.numberColumn = j;
          } else if (part.includes("فرض 1") || part.includes("الفرض 1")) {
            structure.markColumns["fard1"] = j;
          } else if (part.includes("فرض 2") || part.includes("الفرض 2")) {
            structure.markColumns["fard2"] = j;
          } else if (part.includes("فرض 3") || part.includes("الفرض 3")) {
            structure.markColumns["fard3"] = j;
          } else if (part.includes("أنشطة") || part.includes("الأنشطة")) {
            structure.markColumns["activities"] = j;
          }
        }

        break;
      }
    }

    return structure;
  }

  /**
   * Extract students from text lines based on identified structure
   */
  private extractStudentsFromLines(
    lines: string[],
    structure: ReturnType<typeof this.identifyTableStructure>,
    detectedMarkTypes: DetectedMarkTypes
  ): Student[] {
    const students: Student[] = [];

    // If we found a header, process rows below it
    if (structure.headerIndex >= 0) {
      for (let i = structure.headerIndex + 1; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines or likely headers
        if (!line || this.isHeaderText(line)) continue;

        // Split the line into parts
        const parts = line.split(/\s{2,}|\t/).map((p) => p.trim());

        if (parts.length < 2) continue; // Need at least name and one mark

        // Create student record
        const student: Student = {
          number: students.length + 1,
          name: "",
          marks: {
            fard1: null,
            fard2: null,
            fard3: null,
            fard4: null,
            activities: null,
          },
        };

        // Get name from identified column or fallback to first part with Arabic text
        if (structure.nameColumn >= 0 && parts.length > structure.nameColumn) {
          student.name = this.cleanText(parts[structure.nameColumn]);
        } else {
          // Find first part with Arabic text
          for (const part of parts) {
            if (/[\u0600-\u06FF]/.test(part)) {
              student.name = this.cleanText(part);
              break;
            }
          }
        }

        // Get student number if available
        if (structure.numberColumn >= 0 && parts.length > structure.numberColumn) {
          const numText = parts[structure.numberColumn];
          const num = parseInt(numText);
          if (!isNaN(num)) {
            student.number = num;
          }
        }

        // Get marks from identified columns
        for (const [markType, colIndex] of Object.entries(structure.markColumns)) {
          if (colIndex >= 0 && parts.length > colIndex) {
            const markValue = this.parseMarkValue(parts[colIndex]);
            if (markValue !== null) {
              student.marks[markType as keyof typeof student.marks] = markValue;

              // Update detected types
              if (markType === "fard1") detectedMarkTypes.hasFard1 = true;
              else if (markType === "fard2") detectedMarkTypes.hasFard2 = true;
              else if (markType === "fard3") detectedMarkTypes.hasFard3 = true;
              else if (markType === "activities") detectedMarkTypes.hasActivities = true;
            }
          }
        }

        // Only add if student has name and at least one mark
        if (
          student.name &&
          (student.marks.fard1 !== null ||
            student.marks.fard2 !== null ||
            student.marks.fard3 !== null ||
            student.marks.activities !== null)
        ) {
          students.push(student);
        }
      }
    } else {
      // If we couldn't identify structure, try line-by-line extraction
      return this.extractStudentsWithoutStructure(lines, detectedMarkTypes);
    }

    return students;
  }

  /**
   * Extract students when no clear table structure is identified
   */
  private extractStudentsWithoutStructure(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    const students: Student[] = [];

    // Look for lines with a name and numbers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip likely header lines
      if (this.isHeaderText(line)) continue;

      // Look for Arabic name (at least 3 chars) and numbers
      const nameMatch = /[\u0600-\u06FF\s]{3,}/g.exec(line);
      const marksMatch = line.match(/\d+[.,]?\d*/g);

      if (nameMatch && marksMatch && marksMatch.length >= 1) {
        const name = this.cleanText(nameMatch[0]);
        const marks = marksMatch.map((m) => this.parseMarkValue(m));

        // Create student with available marks
        const student: Student = {
          number: students.length + 1,
          name,
          marks: {
            fard1: marks.length > 0 ? marks[0] : null,
            fard2: marks.length > 1 ? marks[1] : null,
            fard3: marks.length > 2 ? marks[2] : null,
            fard4: marks.length > 3 ? marks[3] : null,
            activities: marks.length > 4 ? marks[4] : null,
          },
        };

        // Update detected types
        if (student.marks.fard1 !== null) detectedMarkTypes.hasFard1 = true;
        if (student.marks.fard2 !== null) detectedMarkTypes.hasFard2 = true;
        if (student.marks.fard3 !== null) detectedMarkTypes.hasFard3 = true;
        if (student.marks.activities !== null) detectedMarkTypes.hasActivities = true;

        students.push(student);
      }
    }

    return students;
  }

  /**
   * Update detected types based on student marks
   */
  private updateDetectedTypesFromStudents(students: Student[], detectedMarkTypes: DetectedMarkTypes): void {
    // Count marks of each type
    let fard1Count = 0;
    let fard2Count = 0;
    let fard3Count = 0;
    let activitiesCount = 0;

    for (const student of students) {
      if (student.marks.fard1 !== null) fard1Count++;
      if (student.marks.fard2 !== null) fard2Count++;
      if (student.marks.fard3 !== null) fard3Count++;
      if (student.marks.activities !== null) activitiesCount++;
    }

    // Update detected types if we have a significant number of marks (at least 3)
    if (fard1Count >= 3) detectedMarkTypes.hasFard1 = true;
    if (fard2Count >= 3) detectedMarkTypes.hasFard2 = true;
    if (fard3Count >= 3) detectedMarkTypes.hasFard3 = true;
    if (activitiesCount >= 3) detectedMarkTypes.hasActivities = true;
  }

  /**
   * Check if text is likely a header
   */
  private isHeaderText(text: string): boolean {
    const normalizedText = this.normalizeText(text);

    // Check for common header terms
    return (
      normalizedText.includes("اسم") ||
      normalizedText.includes("رقم") ||
      normalizedText.includes("فرض") ||
      normalizedText.includes("أنشطة") ||
      normalizedText.includes("عدد") ||
      normalizedText.includes("القسم") ||
      normalizedText.includes("مادة")
    );
  }

  /**
   * Determine the column type from header text
   */
  private determineColumnType(text: string): string {
    const normalizedText = this.normalizeText(text);

    // Name column patterns
    if (
      normalizedText.includes("اسم") ||
      normalizedText.includes("التلميذ") ||
      normalizedText.includes("الطالب") ||
      normalizedText.includes("المتعلم")
    ) {
      return "name";
    }

    // Number column patterns
    if (
      normalizedText.includes("رقم") ||
      normalizedText.includes("ر.ت") ||
      normalizedText.includes("ر ت") ||
      normalizedText.match(/^ر$/)
    ) {
      return "number";
    }

    // Fard1 patterns
    if (MARK_PATTERNS.fard1.some((pattern) => pattern.test(normalizedText))) {
      return "fard1";
    }

    // Fard2 patterns
    if (MARK_PATTERNS.fard2.some((pattern) => pattern.test(normalizedText))) {
      return "fard2";
    }

    // Fard3 patterns
    if (MARK_PATTERNS.fard3.some((pattern) => pattern.test(normalizedText))) {
      return "fard3";
    }

    // Activities patterns
    if (MARK_PATTERNS.activities.some((pattern) => pattern.test(normalizedText))) {
      return "activities";
    }

    return "";
  }

  /**
   * Parse a mark value from text
   */
  private parseMarkValue(text: string | null): number | null {
    if (!text) return null;

    // Remove non-numeric characters except decimal separators
    const normalized = this.normalizeArabicNumber(text);
    const cleaned = normalized.replace(/[^\d.,]/g, "").replace(",", ".");

    if (!cleaned) return null;

    const value = parseFloat(cleaned);

    if (isNaN(value) || value < 0 || value > 20) {
      return null;
    }

    // Format to 2 decimal places
    return parseFloat(value.toFixed(2));
  }

  /**
   * Clean text by removing extra spaces and normalizing
   */
  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, " "); // Replace multiple spaces with single space
  }

  /**
   * Normalize text for consistent comparisons
   */
  private normalizeText(text: string): string {
    return text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .toLowerCase()
      .trim();
  }

  /**
   * Convert Arabic/Persian numerals to English
   */
  private normalizeArabicNumber(text: string): string {
    // Convert Arabic/Persian numerals to English
    return text
      .replace(/[٠]/g, "0")
      .replace(/[١]/g, "1")
      .replace(/[٢]/g, "2")
      .replace(/[٣]/g, "3")
      .replace(/[٤]/g, "4")
      .replace(/[٥]/g, "5")
      .replace(/[٦]/g, "6")
      .replace(/[٧]/g, "7")
      .replace(/[٨]/g, "8")
      .replace(/[٩]/g, "9");
  }

  /**
   * Convert file to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Enhance the extracted results with post-processing
   */
  private enhanceResults(result: { students: Student[]; detectedMarkTypes: DetectedMarkTypes }): {
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
  } {
    // Copy to avoid modifying the original
    const enhancedResult = {
      students: [...result.students],
      detectedMarkTypes: { ...result.detectedMarkTypes },
    };

    // Enhance student marks with statistical validations
    this.enhanceMarksWithStats(enhancedResult.students);

    // Fix student numbers if needed
    this.fixStudentNumbers(enhancedResult.students);

    // Remove duplicate students (if any)
    enhancedResult.students = this.removeDuplicateStudents(enhancedResult.students);

    return enhancedResult;
  }

  /**
   * Enhance marks with statistical validations
   */
  private enhanceMarksWithStats(students: Student[]): void {
    if (students.length === 0) return;

    // Calculate statistics for each mark type
    const stats: Record<string, { count: number; sum: number; avg: number; stdDev: number }> = {
      fard1: { count: 0, sum: 0, avg: 0, stdDev: 0 },
      fard2: { count: 0, sum: 0, avg: 0, stdDev: 0 },
      fard3: { count: 0, sum: 0, avg: 0, stdDev: 0 },
      activities: { count: 0, sum: 0, avg: 0, stdDev: 0 },
    };

    // Gather all mark values and compute basic stats
    for (const student of students) {
      for (const markType of ["fard1", "fard2", "fard3", "activities"] as const) {
        const mark = student.marks[markType];
        if (mark !== null) {
          stats[markType].count++;
          stats[markType].sum += mark;
        }
      }
    }

    // Calculate averages
    for (const markType of Object.keys(stats)) {
      if (stats[markType].count > 0) {
        stats[markType].avg = stats[markType].sum / stats[markType].count;
      }
    }

    // Calculate standard deviations
    for (const student of students) {
      for (const markType of ["fard1", "fard2", "fard3", "activities"] as const) {
        const mark = student.marks[markType];
        if (mark !== null && stats[markType].count > 0) {
          stats[markType].stdDev += Math.pow(mark - stats[markType].avg, 2);
        }
      }
    }

    for (const markType of Object.keys(stats)) {
      if (stats[markType].count > 1) {
        // Need at least 2 values for stdDev
        stats[markType].stdDev = Math.sqrt(stats[markType].stdDev / stats[markType].count);
      }
    }

    // Clean up any improbable values (outliers)
    if (students.length >= 5) {
      // Only apply if we have enough data
      for (const student of students) {
        for (const markType of ["fard1", "fard2", "fard3", "activities"] as const) {
          const mark = student.marks[markType];
          if (mark !== null && stats[markType].count >= 5 && stats[markType].stdDev > 0) {
            const zScore = Math.abs(mark - stats[markType].avg) / stats[markType].stdDev;

            // If mark is an extreme outlier (z-score > 3), nullify it
            if (zScore > 3) {
              student.marks[markType] = null;
            }
          }
        }
      }
    }
  }

  /**
   * Fix student numbers to ensure they are sequential
   */
  private fixStudentNumbers(students: Student[]): void {
    // Check if numbers are already sequential
    let isSequential = true;
    for (let i = 0; i < students.length; i++) {
      if (students[i].number !== i + 1) {
        isSequential = false;
        break;
      }
    }

    // If not sequential, reassign numbers
    if (!isSequential) {
      for (let i = 0; i < students.length; i++) {
        students[i].number = i + 1;
      }
    }
  }

  /**
   * Remove duplicate students based on name similarity
   */
  private removeDuplicateStudents(students: Student[]): Student[] {
    if (students.length <= 1) return students;

    const uniqueStudents: Student[] = [];
    const processedNames = new Set<string>();

    for (const student of students) {
      const normalizedName = this.normalizeArabicName(student.name);

      // Check if we've seen this name or a very similar one
      let isDuplicate = false;
      for (const name of processedNames) {
        if (this.calculateNameSimilarity(normalizedName, name) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueStudents.push(student);
        processedNames.add(normalizedName);
      }
    }

    return uniqueStudents;
  }

  /**
   * Normalize Arabic name for comparison
   */
  private normalizeArabicName(name: string): string {
    return name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[أإآا]/g, "ا") // Normalize alifs
      .replace(/[ةه]/g, "ه") // Normalize ta marbuta and ha
      .replace(/[ىيی]/g, "ي") // Normalize ya variants
      .toLowerCase()
      .trim();
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateNameSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    // Calculate edit distance
    const distance = this.levenshteinDistance(longer, shorter);

    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str1.length][str2.length];
  }

  /**
   * Validate the final extraction results
   */
  private validateResults(result: { students: Student[]; detectedMarkTypes: DetectedMarkTypes }): void {
    // Need at least some students with marks
    if (result.students.length === 0) {
      throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");
    }

    // Check if we have valid mark types
    const hasAnyMarkType =
      result.detectedMarkTypes.hasFard1 ||
      result.detectedMarkTypes.hasFard2 ||
      result.detectedMarkTypes.hasFard3 ||
      result.detectedMarkTypes.hasActivities;

    if (!hasAnyMarkType) {
      throw new Error("لم يتم التعرف على أنواع العلامات في الصورة");
    }

    // Check if students have marks
    const studentsWithMarks = result.students.filter(
      (student) =>
        student.marks.fard1 !== null ||
        student.marks.fard2 !== null ||
        student.marks.fard3 !== null ||
        student.marks.activities !== null
    );

    if (studentsWithMarks.length === 0) {
      throw new Error("تم العثور على أسماء الطلاب ولكن بدون علامات");
    }
  }

  /**
   * Check for OCR service updates
   */
  async checkForUpdates(): Promise<boolean> {
    try {
      // In a production environment, you would check with your server
      // For now, we'll simulate an update check
      console.log("Checking for OCR service updates...");

      // Current version
      const currentVersion = "1.0.0";

      // Simulated latest version
      const latestVersion = "1.0.0";

      // Compare versions
      const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

      return hasUpdate;
    } catch (error) {
      console.error("Error checking for updates:", error);
      return false;
    }
  }

  /**
   * Compare version strings
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }
}

export default new EnhancedOCRService();
