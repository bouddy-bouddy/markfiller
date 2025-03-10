import { Student, DetectedMarkTypes } from "../types";

interface CurrentRow {
  text: string;
  lineNumber: number;
}

class OCRService {
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      console.log("Starting Google Cloud Vision OCR processing...");

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      // Remove the data URL prefix
      const base64Content = base64Image.split(",")[1];

      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

      if (!apiKey) {
        throw new Error("API key not found. Please check your environment configuration.");
      }

      // Build proper URL with API key
      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

      console.log("Sending request to Google Cloud Vision API...");

      // Prepare request to Google Cloud Vision API
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
      console.log("OCR completed, raw text:", extractedText);

      // Extract structured student data from the OCR result
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

  extractStructuredData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    try {
      // Split the text into lines and normalize
      const lines = text
        .split("\n")
        .map((line) => this.normalizeArabicNumber(line.trim()))
        .filter((line) => line.length > 0);

      const students: Student[] = [];
      const detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasActivities: false,
      };

      // First, detect the mark types from headers
      const headerText = lines.slice(0, 10).join(" ");
      if (headerText.includes("الفرض 1") || headerText.includes("فرض 1")) {
        detectedMarkTypes.hasFard1 = true;
      }
      if (headerText.includes("الفرض 2") || headerText.includes("فرض 2")) {
        detectedMarkTypes.hasFard2 = true;
      }
      if (headerText.includes("الفرض 3") || headerText.includes("فرض 3")) {
        detectedMarkTypes.hasFard3 = true;
      }
      if (headerText.includes("الأنشطة") || headerText.includes("أنشطة")) {
        detectedMarkTypes.hasActivities = true;
      }

      // Find where the student list starts (usually after header)
      let studentStartIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("اسم التلميذ") || lines[i].includes("اسم الطالب")) {
          studentStartIndex = i + 1;
          break;
        }
      }

      // Extract student names first
      const studentNames: string[] = [];
      const marksLines: string[] = [];

      // Process the document in two passes - first collect names, then marks
      for (let i = studentStartIndex; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines or lines that look like headers
        if (!line || line.includes("الفرض") || line.includes("ر.ت")) {
          continue;
        }

        // Check if this line has a student name pattern
        // Look for lines that start with Arabic text and don't have many numbers
        const hasArabicName = /^[\u0600-\u06FF\s]+/.test(line);
        const numberCount = (line.match(/\d/g) || []).length;

        if (hasArabicName && numberCount < 3) {
          studentNames.push(line);
        } else if (numberCount >= 3) {
          // This is likely a line with marks
          marksLines.push(line);
        }
      }

      // Now match marks with student names
      for (let i = 0; i < studentNames.length && i < marksLines.length; i++) {
        const name = studentNames[i];
        const marksLine = marksLines[i];

        // Extract marks using regex
        const markValues: number[] = [];
        const markMatches = marksLine.match(/\d+(?:[.,]\d+)?/g);

        if (markMatches) {
          for (const markMatch of markMatches) {
            const cleanMark = this.cleanMarkValue(markMatch);
            if (cleanMark !== null) {
              markValues.push(cleanMark);
            }
          }
        }

        // Create student object if we have at least one mark
        if (markValues.length > 0) {
          students.push({
            number: i + 1, // Use index+1 as student number if not found
            name: name,
            marks: {
              fard1: markValues.length > 0 ? markValues[0] : null,
              fard2: markValues.length > 1 ? markValues[1] : null,
              fard3: markValues.length > 2 ? markValues[2] : null,
              activities: markValues.length > 3 ? markValues[3] : null,
            },
          });
        }
      }

      console.log("Extracted students:", students);

      // Detect mark types based on available data if not found in headers
      if (students.length > 0) {
        let countFard1 = 0,
          countFard2 = 0,
          countFard3 = 0,
          countActivities = 0;

        students.forEach((student) => {
          if (student.marks.fard1 !== null) countFard1++;
          if (student.marks.fard2 !== null) countFard2++;
          if (student.marks.fard3 !== null) countFard3++;
          if (student.marks.activities !== null) countActivities++;
        });

        // Set detected types if enough students have values
        const threshold = students.length * 0.3;
        if (countFard1 > threshold) detectedMarkTypes.hasFard1 = true;
        if (countFard2 > threshold) detectedMarkTypes.hasFard2 = true;
        if (countFard3 > threshold) detectedMarkTypes.hasFard3 = true;
        if (countActivities > threshold) detectedMarkTypes.hasActivities = true;
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
          hasActivities: false,
        },
      };
    }
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
