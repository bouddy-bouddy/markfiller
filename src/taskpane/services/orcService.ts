// src/taskpane/services/ocrService.ts
import { Student, StudentMarks } from "../types";
import { GOOGLE_CLOUD_VISION_API_KEY, GOOGLE_CLOUD_VISION_API_URL } from "../config/apiConfig";

interface CurrentRow {
  text: string;
  lineNumber: number;
}

class OCRService {
  async processImage(imageFile: File): Promise<Student[]> {
    try {
      console.log("Starting Google Cloud Vision OCR processing...");

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64Image.split(",")[1];

      // Prepare request to Google Cloud Vision API
      const response = await fetch(`${GOOGLE_CLOUD_VISION_API_URL}?key=${GOOGLE_CLOUD_VISION_API_KEY}`, {
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
                  type: "TEXT_DETECTION",
                  // Using DOCUMENT_TEXT_DETECTION for better handling of structured text
                  // like tables, which is common in grade sheets
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

      const data = await response.json();

      if (!response.ok) {
        console.error("Google Vision API error:", data);
        throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
      }

      if (!data.responses || !data.responses[0] || !data.responses[0].fullTextAnnotation) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }

      const extractedText = data.responses[0].fullTextAnnotation.text;
      console.log("OCR completed, raw text:", extractedText);

      // Extract structured student data from the OCR result
      const extractedData = this.extractStructuredData(extractedText);
      console.log("Structured data:", extractedData);

      if (extractedData.length === 0) {
        throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      return extractedData;
    } catch (error) {
      console.error("Processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  extractStructuredData(text: string): Student[] {
    try {
      const lines = text
        .split("\n")
        .map((line) => this.normalizeArabicNumber(line.trim()))
        .filter((line) => line.length > 0);

      const students: Student[] = [];

      // Enhanced pattern for student detection
      // This pattern is designed to match Arabic names with student numbers
      const studentPattern = /^(\d{1,2})\s*([\u0600-\u06FF\s]+)/;

      let currentRow: CurrentRow = {
        text: "",
        lineNumber: 0,
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip headers and empty lines
        if (!line || line.includes("الفرض") || line.includes("ر.ت")) {
          continue;
        }

        // Try to match student information
        const studentMatch = line.match(studentPattern);
        if (studentMatch) {
          // Process previous row if exists
          if (currentRow.text) {
            this.processStudentRow(currentRow, students);
          }

          currentRow = {
            text: line,
            lineNumber: i,
          };

          // Look ahead for marks in the next line
          if (i < lines.length - 1) {
            currentRow.text += " " + lines[i + 1];
          }
        }
      }

      // Process last row
      if (currentRow.text) {
        this.processStudentRow(currentRow, students);
      }

      return students;
    } catch (error) {
      console.error("Data extraction error:", error);
      return [];
    }
  }

  processStudentRow(row: CurrentRow, students: Student[]): void {
    const studentPattern = /^(\d{1,2})\s*([\u0600-\u06FF\s]+)/;
    const marksPattern = /\b(\d{1,2}(?:[.,]\d{1,2})?)\b/g;

    const studentMatch = row.text.match(studentPattern);
    if (studentMatch) {
      // Extract marks
      const marks: Array<number> = [];
      let match: RegExpExecArray | null;

      // Reset the lastIndex to ensure we start matching from the beginning
      marksPattern.lastIndex = 0;

      while ((match = marksPattern.exec(row.text)) !== null) {
        const markValue = this.cleanMarkValue(match[1]);
        if (markValue !== null) {
          marks.push(markValue);
        }
      }

      if (marks.length > 0) {
        students.push({
          number: parseInt(studentMatch[1]),
          name: studentMatch[2].trim(),
          marks: {
            fard1: this.formatMarkToDecimal(marks[0]) || null,
            fard2: this.formatMarkToDecimal(marks[1]) || null,
            fard3: this.formatMarkToDecimal(marks[2]) || null,
            activities: this.formatMarkToDecimal(marks[3]) || null,
          },
        });
      }
    }
  }

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
    mark = mark.replace(/[^\d.,]/g, "");

    // Convert comma to dot for decimal
    mark = mark.replace(",", ".");

    // Parse the number
    const num = parseFloat(mark);

    // Validate the mark is within reasonable range (0-20)
    if (!isNaN(num) && num >= 0 && num <= 20) {
      // Format to 2 decimal places
      return this.formatMarkToDecimal(num);
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
}

export default new OCRService();
