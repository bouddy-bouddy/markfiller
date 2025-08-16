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
      const base64Content = base64Image.split(",")[1];

      const apiKey = process.env.GOOGLE_VISION_AI_API_KEY;

      if (!apiKey) {
        throw new Error("API key not found. Please check your environment configuration.");
      }

      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

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
                languageHints: ["ar"],
              },
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

      const data = await response.json();

      console.log("🔍 GOOGLE VISION API - COMPLETE RAW RESPONSE:");
      console.log("Full API Response:", JSON.stringify(data, null, 2));

      if (!data.responses || !data.responses[0] || !data.responses[0].fullTextAnnotation) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }

      const extractedText = data.responses[0].fullTextAnnotation.text;

      // Try multiple extraction strategies
      let result = this.extractStructuredData(extractedText);

      // If column-based extraction didn't work well, try alternative methods
      if (result.students.length === 0) {
        console.log("⚠️ Primary extraction failed, trying alternative method...");
        result = this.extractWithAlternativeMethod(extractedText);
      }

      if (result.students.length === 0) {
        throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      return result;
    } catch (error) {
      console.error("Processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  extractStructuredData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    try {
      console.log("🚀 Starting structured data extraction...");

      // Detect mark types from headers
      const detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasFard4: false,
        hasActivities: false,
      };

      // Check for mark type headers
      const headerText = text.substring(0, 500);

      if (headerText.includes("الفرض 1") || headerText.includes("الفرض الأول")) {
        detectedMarkTypes.hasFard1 = true;
        console.log("✅ Detected الفرض 1");
      }
      if (headerText.includes("الفرض 2") || headerText.includes("الفرض الثاني")) {
        detectedMarkTypes.hasFard2 = true;
      }
      if (headerText.includes("الفرض 3") || headerText.includes("الفرض الثالث")) {
        detectedMarkTypes.hasFard3 = true;
      }
      if (headerText.includes("الأنشطة") || headerText.includes("النشاط")) {
        detectedMarkTypes.hasActivities = true;
      }

      // Extract using column-based approach
      const { names, markRows } = this.extractMarksFromTable(text);

      // Create Student objects
      const students: Student[] = [];

      for (let i = 0; i < names.length; i++) {
        const marks = markRows[i] || [];

        let markValue: number | null = null;
        if (marks.length > 0 && marks[0]) {
          markValue = this.cleanMarkValue(marks[0]);
        }

        const student: Student = {
          number: i + 1,
          name: names[i].trim(),
          marks: {
            fard1: detectedMarkTypes.hasFard1 ? markValue : null,
            fard2: detectedMarkTypes.hasFard2 && !detectedMarkTypes.hasFard1 ? markValue : null,
            fard3:
              detectedMarkTypes.hasFard3 && !detectedMarkTypes.hasFard1 && !detectedMarkTypes.hasFard2
                ? markValue
                : null,
            fard4: null,
            activities:
              detectedMarkTypes.hasActivities &&
              !detectedMarkTypes.hasFard1 &&
              !detectedMarkTypes.hasFard2 &&
              !detectedMarkTypes.hasFard3
                ? markValue
                : null,
          },
        };

        students.push(student);
      }

      // Default to fard1 if no specific type detected
      if (
        !detectedMarkTypes.hasFard1 &&
        !detectedMarkTypes.hasFard2 &&
        !detectedMarkTypes.hasFard3 &&
        !detectedMarkTypes.hasActivities &&
        students.length > 0
      ) {
        detectedMarkTypes.hasFard1 = true;
        students.forEach((s) => {
          if (
            s.marks.fard1 === null &&
            (s.marks.fard2 !== null || s.marks.fard3 !== null || s.marks.activities !== null)
          ) {
            s.marks.fard1 = s.marks.fard2 || s.marks.fard3 || s.marks.activities;
            s.marks.fard2 = null;
            s.marks.fard3 = null;
            s.marks.activities = null;
          }
        });
      }

      console.log(`✅ Successfully extracted ${students.length} students`);
      return { students, detectedMarkTypes };
    } catch (error) {
      console.error("❌ Data extraction error:", error);
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

  private extractMarksFromTable(text: string): { names: string[]; markRows: string[][] } {
    const lines = text.split("\n").map((line) => this.normalizeArabicNumber(line.trim()));

    const names: string[] = [];
    const marks: string[] = [];
    let currentSection: "none" | "names" | "marks" = "none";

    console.log("🔍 Processing lines for column-based structure...");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || line.length === 0) continue;

      // Detect section headers
      if (line.includes("اسم التلميذ") || line.includes("الاسم")) {
        currentSection = "names";
        console.log("📝 Entering names section");
        continue;
      }

      if (line.includes("الفرض") || line.includes("فرض")) {
        currentSection = "marks";
        console.log("📊 Entering marks section");
        continue;
      }

      // Process based on content type
      const isArabicName = /[\u0600-\u06FF]{2,}/.test(line) && !line.match(/^\d/);
      const isMark = /^\d+[,\.]\d+$/.test(line);

      if (currentSection === "names" && isArabicName) {
        names.push(line);
        console.log(`✅ Added name: ${line}`);
      } else if (currentSection === "marks" && isMark) {
        marks.push(line);
        console.log(`📊 Added mark: ${line}`);
      } else if (currentSection === "none") {
        // Auto-detect based on content
        if (isArabicName) {
          currentSection = "names";
          names.push(line);
        } else if (isMark) {
          currentSection = "marks";
          marks.push(line);
        }
      } else if (isMark && currentSection === "names") {
        // Switch to marks section
        currentSection = "marks";
        marks.push(line);
      }
    }

    console.log(`📋 Found ${names.length} names and ${marks.length} marks`);

    // Map marks to students in order
    const markRows: string[][] = [];
    for (let i = 0; i < names.length; i++) {
      markRows.push(i < marks.length ? [marks[i]] : []);
    }

    return { names, markRows };
  }

  // Alternative extraction method for different OCR patterns
  private extractWithAlternativeMethod(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    console.log("🔄 Trying alternative extraction method...");

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    const students: Student[] = [];
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: true, // Default to fard1
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    };

    let studentNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = this.normalizeArabicNumber(lines[i]);

      // Skip headers
      if (line.includes("اسم التلميذ") || line.includes("الفرض")) continue;

      // Check if line contains Arabic name
      if (/[\u0600-\u06FF]{2,}/.test(line)) {
        // Look ahead for a mark in the next few lines
        let markValue: number | null = null;

        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          const nextLine = this.normalizeArabicNumber(lines[i + j]);
          if (/^\d+[,\.]\d+$/.test(nextLine)) {
            markValue = this.cleanMarkValue(nextLine);
            break;
          }
        }

        students.push({
          number: studentNumber++,
          name: line,
          marks: {
            fard1: markValue,
            fard2: null,
            fard3: null,
            fard4: null,
            activities: null,
          },
        });
      }
    }

    return { students, detectedMarkTypes };
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
      return Number(num.toFixed(2));
    }

    return null;
  }

  normalizeArabicNumber(text: string): string {
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
