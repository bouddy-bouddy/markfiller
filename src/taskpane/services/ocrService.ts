// Export this new version of the OCR service

import { Student, DetectedMarkTypes } from "../types";

interface CurrentRow {
  text: string;
  lineNumber: number;
}

class OCRService {
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      console.log("Starting Vision AI OCR processing...");

      // First, try the advanced table extraction method
      try {
        const result = await this.processImageWithTableExtraction(imageFile);
        if (result.students.length > 0) {
          return result;
        }
      } catch (tableError) {
        console.log("Table extraction failed, falling back to basic extraction", tableError);
      }

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      // Remove the data URL prefix
      const base64Content = base64Image.split(",")[1];

      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_VISION_AI_API_KEY;

      if (!apiKey) {
        throw new Error("API key not found. Please check your environment configuration.");
      }

      // Vision AI API endpoint
      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

      console.log("Sending request to Vision AI API...");

      // Prepare request to Vision AI API
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
              features: [
                {
                  type: "DOCUMENT_TEXT_DETECTION",
                },
              ],
              imageContext: {
                languageHints: ["ar"], // Specify Arabic language for better accuracy
              },
            },
          ],
        }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Google Vision API error:", errorData);
        throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
      }

      const data = await response.json();

      if (!data.responses || !data.responses[0] || !data.responses[0].fullTextAnnotation) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }

      const extractedText = data.responses[0].fullTextAnnotation.text;
      console.log("OCR completed, raw text:", extractedText);

      // Use the improved extraction method
      const { students, detectedMarkTypes } = this.extractStructuredData(extractedText);
      console.log("Structured data:", students);
      console.log("Detected mark types:", detectedMarkTypes);

      if (students.length === 0) {
        throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      return { students, detectedMarkTypes };
    } catch (error) {
      console.error("Processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  // Include the new extractStructuredData method

  extractStructuredData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    try {
      console.log("Extracting structured data from OCR text");

      // Default detected mark types
      const detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasActivities: false,
      };

      // Split text into lines for processing
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Arrays to hold student names and marks
      const names: string[] = [];
      const marksByType: {
        fard1: number[];
        fard2: number[];
        fard3: number[];
        activities: number[];
      } = {
        fard1: [],
        fard2: [],
        fard3: [],
        activities: [],
      };

      // Identify mark type headers to detect the structure
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect column headers for marks
        if (line.includes("الفرض 1") || line.includes("فرض 1")) {
          detectedMarkTypes.hasFard1 = true;
        }
        if (line.includes("الفرض 2") || line.includes("فرض 2")) {
          detectedMarkTypes.hasFard2 = true;
        }
        if (line.includes("الفرض 3") || line.includes("فرض 3")) {
          detectedMarkTypes.hasFard3 = true;
        }
        if (line.includes("الأنشطة") || line.includes("أنشطة")) {
          detectedMarkTypes.hasActivities = true;
        }
      }

      // Extract student names
      let studentsStarted = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for indicators that we're in the student list section
        if (line.includes("اسم التلميذ") || line.includes("رقم التلميذ")) {
          studentsStarted = true;
          continue;
        }

        if (studentsStarted) {
          // Check if this line likely contains a student name (Arabic characters)
          const containsArabic = /[\u0600-\u06FF]/.test(line);
          const containsDigits = /\d/.test(line);

          // If it has Arabic and not just numbers, it might be a student name
          if (containsArabic && !line.match(/^\d+$/)) {
            // Extract the name - look for patterns of Arabic characters
            const nameMatch = line.match(/[\u0600-\u06FF\s]+/);
            if (nameMatch) {
              const name = nameMatch[0].trim();
              if (name.length > 2) {
                names.push(name);

                // Look for marks on this line (numbers with potential decimal points)
                const marksMatch = line.match(/\d+[.,]?\d*/g);
                if (marksMatch) {
                  // Try to match marks to appropriate columns
                  // The pattern often follows the order of columns in the document
                  const marks = marksMatch.map((m) => parseFloat(m.replace(",", ".")));

                  // Store marks by their respective columns
                  // The order depends on your document structure
                  if (marks.length >= 1 && marks[0] >= 0 && marks[0] <= 20) marksByType.fard1.push(marks[0]);
                  if (marks.length >= 2 && marks[1] >= 0 && marks[1] <= 20) marksByType.fard2.push(marks[1]);
                  if (marks.length >= 3 && marks[2] >= 0 && marks[2] <= 20) marksByType.fard3.push(marks[2]);
                  if (marks.length >= 4 && marks[3] >= 0 && marks[3] <= 20) marksByType.activities.push(marks[3]);
                }
              }
            }
          }
        }
      }

      // Create student objects from collected data
      const students: Student[] = [];
      for (let i = 0; i < names.length; i++) {
        students.push({
          number: i + 1,
          name: names[i],
          marks: {
            fard1: marksByType.fard1[i] !== undefined ? this.formatMarkToDecimal(marksByType.fard1[i]) : null,
            fard2: marksByType.fard2[i] !== undefined ? this.formatMarkToDecimal(marksByType.fard2[i]) : null,
            fard3: marksByType.fard3[i] !== undefined ? this.formatMarkToDecimal(marksByType.fard3[i]) : null,
            activities:
              marksByType.activities[i] !== undefined ? this.formatMarkToDecimal(marksByType.activities[i]) : null,
          },
        });
      }

      // Update detection based on actual data found
      detectedMarkTypes.hasFard1 = marksByType.fard1.length > 0 || detectedMarkTypes.hasFard1;
      detectedMarkTypes.hasFard2 = marksByType.fard2.length > 0 || detectedMarkTypes.hasFard2;
      detectedMarkTypes.hasFard3 = marksByType.fard3.length > 0 || detectedMarkTypes.hasFard3;
      detectedMarkTypes.hasActivities = marksByType.activities.length > 0 || detectedMarkTypes.hasActivities;

      console.log("Extracted students:", students);
      return { students, detectedMarkTypes };
    } catch (error) {
      console.error("Data extraction error:", error);
      return {
        students: [],
        detectedMarkTypes: {
          hasFard1: false,
          hasFard2: false,
          hasFard3: false,
          hasActivities: false,
        },
      };
    }
  }

  // Include the rest of the methods from previous artifacts

  // Rest of original methods...

  formatMarkToDecimal(mark: string | number | null | undefined): number | null {
    if (mark === null || mark === undefined) return null;

    // Convert to number and handle any potential parsing issues
    let num: number = typeof mark === "string" ? parseFloat(mark.replace(",", ".")) : (mark as number);

    if (isNaN(num)) return null;

    // Round to 2 decimal places and ensure proper format
    return parseFloat(num.toFixed(2));
  }

  cleanMarkValue(mark: string | null): number | null {
    if (!mark) return null;

    // Remove any non-numeric characters except dots and commas
    const cleaned = mark.replace(/[^\d.,]/g, "");

    // Convert comma to dot for decimal
    const normalized = cleaned.replace(",", ".");

    // Parse the number
    const num = parseFloat(normalized);

    // Validate the mark is within reasonable range (0-20)
    if (!isNaN(num) && num >= 0 && num <= 20) {
      // Ensure it's returned as a number
      return Number(num.toFixed(2));
    }

    return null;
  }

  normalizeArabicNumber(text: string): string {
    // Convert Arabic/Persian numerals to English
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

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Include the advanced table extraction methods
  async processImageWithTableExtraction(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      console.log("Starting Vision AI table extraction...");

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_VISION_AI_API_KEY;

      if (!apiKey) {
        throw new Error("API key not found. Please check your environment configuration.");
      }

      // Vision AI API endpoint with DOCUMENT_TEXT_DETECTION and layout analysis
      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

      // Request both text detection and layout analysis
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
              features: [
                {
                  type: "DOCUMENT_TEXT_DETECTION", // Gets text with layout info
                  maxResults: 1,
                },
              ],
              imageContext: {
                languageHints: ["ar"],
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

      // Extract full text for backup processing
      const fullText = data.responses[0].fullTextAnnotation?.text || "";

      // Get text blocks with position information
      const textBlocks = data.responses[0].textAnnotations || [];

      // Process the result with layout information to reconstruct the table
      return this.extractStructuredTableData(fullText, textBlocks);
    } catch (error) {
      console.error("Table extraction error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Extract table data using layout information
   */
  extractStructuredTableData(
    fullText: string,
    textBlocks: any[]
  ): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    // Default detected mark types
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: false,
      hasFard2: false,
      hasFard3: false,
      hasActivities: false,
    };

    // Skip the first block which contains the entire text
    const blocks = textBlocks.slice(1);

    // First, identify column headers to establish table structure
    const headerBlocks = blocks.filter((block) => {
      const text = block.description.toLowerCase();
      return text.includes("فرض") || text.includes("أنشطة") || text.includes("اسم") || text.includes("رقم");
    });

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

      // Calculate average X position and boundaries
      const xMin = Math.min(...boundingBox.map((v: any) => v.x));
      const xMax = Math.max(...boundingBox.map((v: any) => v.x));
      const yLevel = Math.min(...boundingBox.map((v: any) => v.y));

      let columnType = "";

      if (text.includes("اسم")) {
        columnType = "name";
      } else if (text.includes("رقم")) {
        columnType = "number";
      } else if (text.includes("فرض 1") || text.includes("الفرض 1")) {
        columnType = "fard1";
        detectedMarkTypes.hasFard1 = true;
      } else if (text.includes("فرض 2") || text.includes("الفرض 2")) {
        columnType = "fard2";
        detectedMarkTypes.hasFard2 = true;
      } else if (text.includes("فرض 3") || text.includes("الفرض 3")) {
        columnType = "fard3";
        detectedMarkTypes.hasFard3 = true;
      } else if (text.includes("أنشطة") || text.includes("الأنشطة")) {
        columnType = "activities";
        detectedMarkTypes.hasActivities = true;
      }

      if (columnType) {
        columns.push({ type: columnType, xMin, xMax, yLevel });
      }
    });

    // Sort columns by X position
    columns.sort((a, b) => a.xMin - b.xMin);

    // Now find row data by looking at Y positions below header
    const headerYLevel = Math.max(...columns.map((c) => c.yLevel));
    const rowBlocks = blocks.filter((block) => {
      const boundingBox = block.boundingPoly.vertices;
      const yMin = Math.min(...boundingBox.map((v: any) => v.y));
      return yMin > headerYLevel;
    });

    // Group blocks by row (similar Y position)
    const rowGroups: Record<number, any[]> = {};

    rowBlocks.forEach((block) => {
      const boundingBox = block.boundingPoly.vertices;
      const yCenter = boundingBox.reduce((sum: number, v: any) => sum + v.y, 0) / 4;

      // Find or create row group (allowing some vertical tolerance)
      const rowKey = Math.floor(yCenter / 20); // Group within 20px vertically
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
          activities: null,
        },
      };

      // Assign data to columns based on X position
      rowData.forEach((block) => {
        const text = block.description;
        const xCenter = block.boundingPoly.vertices.reduce((sum: number, v: any) => sum + v.x, 0) / 4;

        // Find which column this text belongs to
        for (const column of columns) {
          if (xCenter >= column.xMin && xCenter <= column.xMax) {
            if (column.type === "name") {
              student.name = text;
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

      // Only add if we have a name or marks
      if (student.name || Object.values(student.marks).some((mark) => mark !== null)) {
        students.push(student);
      }
    });

    // If we don't have enough structure from layout analysis, fall back to simple text parsing
    if (students.length === 0) {
      return this.extractStructuredData(fullText);
    }

    return { students, detectedMarkTypes };
  }

  /**
   * Parse a mark value from text, handling different formats
   */
  parseMarkValue(text: string): number | null {
    if (!text) return null;

    // Remove non-numeric characters except decimal separators
    const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
    const value = parseFloat(cleaned);

    if (isNaN(value) || value < 0 || value > 20) {
      return null;
    }

    return this.formatMarkToDecimal(value);
  }
}
export default new OCRService();
