import { Student, DetectedMarkTypes } from "../types";

interface CurrentRow {
  text: string;
  lineNumber: number;
}

class OCRService {
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
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
      const apiUrl = `https://vision.googleapis.com/v1p2beta1/files:annotate?key=${apiKey}`;

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

        // Provide more specific error message based on response status
        if (response.status === 403) {
          throw new Error("فشل الاتصال بخدمة التعرف على النص: خطأ في المصادقة. يرجى التحقق من مفتاح API.");
        } else {
          throw new Error("فشل الاتصال بخدمة التعرف على النص. يرجى المحاولة مرة أخرى.");
        }
      }

      const data = await response.json();

      if (!data.responses || !data.responses[0] || !data.responses[0].fullTextAnnotation) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }

      const extractedText = data.responses[0].fullTextAnnotation.text;

      // Extract structured student data from the OCR result
      const { students, detectedMarkTypes } = this.extractStructuredData(extractedText);

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

  extractStructuredData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    try {
      // Default detected mark types for this document format
      const detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: true,
        hasFard2: true,
        hasFard3: true,
        hasFard4: false,
        hasActivities: true,
      };

      // Extract student names and mark rows
      const { names, markRows } = this.extractMarksFromTable(text);

      // Map to Student objects
      const students: Student[] = [];

      for (let i = 0; i < names.length; i++) {
        const marks = markRows[i] || [];

        // Create student object with correctly mapped marks
        const student: Student = {
          number: i + 1,
          name: names[i],
          marks: {
            // Map based on document column order: Activities, Fard3, Fard2, Fard1
            activities: marks.length > 0 ? this.cleanMarkValue(marks[0] || null) : null,
            fard3: marks.length > 1 ? this.cleanMarkValue(marks[1] || null) : null,
            fard2: marks.length > 2 ? this.cleanMarkValue(marks[2] || null) : null,
            fard1: marks.length > 3 ? this.cleanMarkValue(marks[3] || null) : null,
            fard4: null, // Not used in this format
          },
        };

        students.push(student);
      }

      return { students, detectedMarkTypes };
    } catch (error) {
      console.error("Data extraction error:", error);
      return {
        students: [],
        detectedMarkTypes: {
          hasFard1: false,
          hasFard2: false,
          hasFard3: false,
          hasFard4: false,
          hasActivities: false,
        },
      };
    }
  }

  // Add this function to ocrService.ts:
  private extractMarksFromTable(text: string): { names: string[]; markRows: string[][] } {
    const lines = text.split("\n").map((line) => this.normalizeArabicNumber(line.trim()));

    const names: string[] = [];
    const markRows: string[][] = [];

    // Look for student names and match with corresponding marks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip header lines and empty lines
      if (!line || line.includes("اسم التلميذ") || line.includes("رقم التلميذ")) {
        continue;
      }

      // Look for lines with Arabic names - typically at the end of the line
      if (/[\u0600-\u06FF]+\s*$/.test(line)) {
        // Extract the name (Arabic text at the end)
        const nameMatch = line.match(/[\u0600-\u06FF\s]+$/);
        if (nameMatch) {
          const name = nameMatch[0].trim();

          // Extract all numbers from the line
          const marks = line.match(/\d+(?:[.,]\d+)?/g) || [];

          // Only add if we have valid data
          if (name.length > 2) {
            names.push(name);
            markRows.push(marks);
          }
        }
      }
    }

    return { names, markRows };
  }

  detectMarkTypesFromHeader(lines: string[], detectedMarkTypes: DetectedMarkTypes): void {
    // Look for mark type headers in the first 5 lines
    const headerLines = lines.slice(0, 5).join(" ");

    // Common patterns for mark headers
    if (headerLines.includes("الفرض 1") || headerLines.includes("الفرض الأول") || headerLines.includes("فرض 1")) {
      detectedMarkTypes.hasFard1 = true;
    }

    if (headerLines.includes("الفرض 2") || headerLines.includes("الفرض الثاني") || headerLines.includes("فرض 2")) {
      detectedMarkTypes.hasFard2 = true;
    }

    if (headerLines.includes("الفرض 3") || headerLines.includes("الفرض الثالث") || headerLines.includes("فرض 3")) {
      detectedMarkTypes.hasFard3 = true;
    }

    if (headerLines.includes("الأنشطة") || headerLines.includes("النشاط") || headerLines.includes("أنشطة")) {
      detectedMarkTypes.hasActivities = true;
    }
  }

  anyMarkTypeDetected(detectedMarkTypes: DetectedMarkTypes): boolean {
    return (
      detectedMarkTypes.hasFard1 ||
      detectedMarkTypes.hasFard2 ||
      detectedMarkTypes.hasFard3 ||
      detectedMarkTypes.hasActivities
    );
  }

  inferMarkTypesFromData(students: Student[], detectedMarkTypes: DetectedMarkTypes): void {
    // Count how many students have each mark type
    const counts = {
      fard1: 0,
      fard2: 0,
      fard3: 0,
      activities: 0,
    };

    // Count non-null values for each mark type
    students.forEach((student) => {
      if (student.marks.fard1 !== null) counts.fard1++;
      if (student.marks.fard2 !== null) counts.fard2++;
      if (student.marks.fard3 !== null) counts.fard3++;
      if (student.marks.activities !== null) counts.activities++;
    });

    // Use a threshold (e.g., if more than 30% of students have a mark type)
    const threshold = students.length * 0.3;

    if (counts.fard1 > threshold) detectedMarkTypes.hasFard1 = true;
    if (counts.fard2 > threshold) detectedMarkTypes.hasFard2 = true;
    if (counts.fard3 > threshold) detectedMarkTypes.hasFard3 = true;
    if (counts.activities > threshold) detectedMarkTypes.hasActivities = true;

    // If we still haven't detected any mark types but have data,
    // handle the sequential assignment case (where marks are in columns but not labeled)
    if (!this.anyMarkTypeDetected(detectedMarkTypes) && students.length > 0) {
      // Sort mark types by frequency
      const sortedCounts = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count > 0);

      // Assign mark types based on frequency (most frequent first)
      if (sortedCounts.length >= 1) {
        const markType = sortedCounts[0][0] as keyof typeof counts;
        if (markType === "fard1") detectedMarkTypes.hasFard1 = true;
        else if (markType === "fard2") detectedMarkTypes.hasFard2 = true;
        else if (markType === "fard3") detectedMarkTypes.hasFard3 = true;
        else if (markType === "activities") detectedMarkTypes.hasActivities = true;
      }
    }
  }

  processStudentRow(row: CurrentRow, students: Student[], detectedMarkTypes: DetectedMarkTypes): void {
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
        // Update detected mark types based on how many marks we found
        if (marks.length >= 1 && !detectedMarkTypes.hasFard1) detectedMarkTypes.hasFard1 = true;
        if (marks.length >= 2 && !detectedMarkTypes.hasFard2) detectedMarkTypes.hasFard2 = true;
        if (marks.length >= 3 && !detectedMarkTypes.hasFard3) detectedMarkTypes.hasFard3 = true;
        if (marks.length >= 4 && !detectedMarkTypes.hasActivities) detectedMarkTypes.hasActivities = true;

        students.push({
          number: parseInt(studentMatch[1]),
          name: studentMatch[2].trim(),
          marks: {
            fard1: this.formatMarkToDecimal(marks[0]) || null,
            fard2: this.formatMarkToDecimal(marks[1]) || null,
            fard3: this.formatMarkToDecimal(marks[2]) || null,
            fard4: null, // Not used in this format
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

  // Ensure cleanMarkValue handles null or undefined input
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

  // Debug logging removed for production
}

export default new OCRService();
