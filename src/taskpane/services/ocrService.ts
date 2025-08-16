import { Student, DetectedMarkTypes } from "../types";

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
      console.log("📄 Extracted text:", extractedText);

      // Try multiple extraction strategies
      let result = this.extractStructuredData(extractedText);

      // If we didn't get enough students, try alternative methods
      if (result.students.length < 10) {
        console.log("⚠️ Found only " + result.students.length + " students, trying comprehensive extraction...");
        result = this.comprehensiveExtraction(extractedText);
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

      // Extract using comprehensive approach
      const students = this.comprehensiveExtraction(text).students;

      // Default to fard1 if no specific type detected
      if (
        !detectedMarkTypes.hasFard1 &&
        !detectedMarkTypes.hasFard2 &&
        !detectedMarkTypes.hasFard3 &&
        !detectedMarkTypes.hasActivities
      ) {
        detectedMarkTypes.hasFard1 = true;
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

  private comprehensiveExtraction(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    console.log("🔄 Using comprehensive extraction method...");

    const lines = text.split("\n").map((line) => this.normalizeArabicNumber(line.trim()));

    const allNames: string[] = [];
    const allMarks: string[] = [];

    // First pass: collect ALL names and marks from the entire document
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || line.length === 0) continue;

      // Skip headers
      if (line.includes("اسم التلميذ") || line.includes("الفرض") || line.includes("رقم") || line === "حد 07") {
        continue;
      }

      // Check if it's a mark (format: XX,00 or XX.00 or XX100)
      const markPattern = /^\d{1,2}[,\.]\d{2}$|^\d{1,2}100$/;
      if (markPattern.test(line)) {
        allMarks.push(line);
        console.log(`📊 Found mark: ${line}`);
      }
      // Check if it's an Arabic name (at least 2 Arabic characters)
      else if (/[\u0600-\u06FF]{2,}/.test(line)) {
        // Additional check: exclude lines that look like headers or labels
        if (!line.includes("التلميذ") && !line.includes("الاسم") && !line.includes("الفرض")) {
          allNames.push(line);
          console.log(`👤 Found name: ${line}`);
        }
      }
    }

    console.log(`📋 Total names collected: ${allNames.length}`);
    console.log(`📊 Total marks collected: ${allMarks.length}`);

    // Create students by pairing names with marks
    const students: Student[] = [];
    const maxCount = Math.max(allNames.length, allMarks.length);

    for (let i = 0; i < maxCount; i++) {
      if (i < allNames.length) {
        const markValue = i < allMarks.length ? this.cleanMarkValue(allMarks[i]) : null;

        students.push({
          number: i + 1,
          name: allNames[i].trim(),
          marks: {
            fard1: markValue, // Since we detected الفرض 1
            fard2: null,
            fard3: null,
            fard4: null,
            activities: null,
          },
        });

        console.log(`✅ Created student ${i + 1}: ${allNames[i]} with mark: ${markValue}`);
      }
    }

    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: true, // We found الفرض 1 in the header
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    };

    console.log(`✅ Total students extracted: ${students.length}`);

    return { students, detectedMarkTypes };
  }

  private extractMarksFromTable(text: string): { names: string[]; markRows: string[][] } {
    const lines = text.split("\n").map((line) => this.normalizeArabicNumber(line.trim()));

    const names: string[] = [];
    const marks: string[] = [];

    console.log("🔍 Extracting all names and marks from document...");

    // Process all lines and extract names and marks regardless of position
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || line.length === 0) continue;

      // Skip known headers and special markers
      if (line.includes("اسم التلميذ") || line.includes("الفرض") || line.includes("رقم") || line === "حد 07") {
        continue;
      }

      // Check if it's a mark (XX,00 or XX.00 or XX100 format)
      const markPattern = /^\d{1,2}[,\.]\d{2}$|^\d{1,2}100$/;
      if (markPattern.test(line)) {
        marks.push(line);
        console.log(`📊 Found mark: ${line}`);
      }
      // Check if it's an Arabic name
      else if (/[\u0600-\u06FF]{2,}/.test(line) && !line.match(/^\d/)) {
        // Filter out headers and labels
        if (!line.includes("التلميذ") && !line.includes("الاسم")) {
          names.push(line);
          console.log(`👤 Found name: ${line}`);
        }
      }
    }

    console.log(`📋 Total: ${names.length} names and ${marks.length} marks`);

    // Map marks to students in order
    const markRows: string[][] = [];
    for (let i = 0; i < names.length; i++) {
      markRows.push(i < marks.length ? [marks[i]] : []);
    }

    return { names, markRows };
  }

  cleanMarkValue(mark: string | null): number | null {
    if (!mark) return null;

    // Handle special format like "25,00" or "108,00" or "10100"
    let cleaned = mark.replace(/[^\d.,]/g, "");

    // Handle the "XXX00" format (like "10100" which should be 10.00)
    if (/^\d{3,}00$/.test(cleaned)) {
      // Remove the last two zeros and add decimal point
      cleaned = cleaned.slice(0, -2) + ".00";
    }

    // Convert comma to dot for decimal
    cleaned = cleaned.replace(",", ".");

    // Parse the number
    const num = parseFloat(cleaned);

    // Validate the mark is within reasonable range (0-20)
    // Note: Some marks might be higher (like 25.00), but we'll cap at 20
    if (!isNaN(num)) {
      if (num > 20) {
        console.warn(`⚠️ Mark ${num} exceeds 20, capping at 20`);
        return 20;
      }
      if (num >= 0) {
        return Number(num.toFixed(2));
      }
    }

    console.warn(`⚠️ Invalid mark value: ${mark}`);
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
