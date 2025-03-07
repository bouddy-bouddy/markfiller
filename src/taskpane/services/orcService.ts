import { createWorker, Worker, RecognizeResult, PSM } from "tesseract.js";
import { Student, StudentMarks } from "../types";

interface CurrentRow {
  text: string;
  lineNumber: number;
}

class OCRService {
  private worker: Worker | null = null;
  private workerReady: boolean = false;

  async ensureWorkerReady(): Promise<void> {
    if (!this.workerReady) {
      try {
        this.worker = await createWorker();
        await this.worker.loadLanguage("ara+eng");
        await this.worker.initialize("ara+eng");

        // Enhanced parameters for better recognition
        await this.worker.setParameters({
          tessedit_char_whitelist: "0123456789.,٠١٢٣٤٥٦٧٨٩/- ",
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: PSM.SPARSE_TEXT, // Use enum instead of string
          // Remove unsupported parameter: textord_tablefind_recognize_tables
        });

        this.workerReady = true;
      } catch (error) {
        console.error("Worker initialization error:", error);
        throw error;
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

    // Handle common OCR mistakes
    mark = mark.replace(/[oO]/g, "0"); // Convert 'o' or 'O' to '0'
    mark = mark.replace(/[lI]/g, "1"); // Convert 'l' or 'I' to '1'

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

  async processImage(imageFile: File): Promise<Student[]> {
    try {
      await this.ensureWorkerReady();

      if (!this.worker) {
        throw new Error("OCR worker not initialized");
      }

      const base64Image = await this.fileToBase64(imageFile);
      console.log("Starting OCR processing...");

      const { data } = await this.worker.recognize(base64Image);
      console.log("OCR completed, raw text:", data.text);

      const extractedData = this.extractStructuredData(data.text);
      console.log("Structured data:", extractedData);

      if (extractedData.length === 0) {
        throw new Error("لم يتم العثور على أي بيانات في الصورة");
      }

      return extractedData;
    } catch (error) {
      console.error("Processing error:", error);
      throw new Error("فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى.");
    }
  }

  extractStructuredData(text: string): Student[] {
    try {
      const lines = text
        .split("\n")
        .map((line) => this.normalizeArabicNumber(line.trim()))
        .filter((line) => line.length > 0);

      const students: Student[] = [];

      // Enhanced patterns
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
      // Extract marks - modified to avoid using [...row.text.matchAll(marksPattern)]
      const marks: Array<number> = [];
      let match: RegExpExecArray | null;
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

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }
  }
}

export default new OCRService();
