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

      // Use Gemini Pro Vision model for image analysis
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
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent";

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
    };

    const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);

      if (response.status === 400) {
        throw new Error("فشل الاتصال بخدمة Gemini: خطأ في طلب API. يرجى التحقق من الصورة.");
      } else if (response.status === 403) {
        throw new Error("فشل الاتصال بخدمة Gemini: خطأ في المصادقة. يرجى التحقق من مفتاح API.");
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
   * Extract students from text lines
   */
  private extractStudentsFromLines(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    const students: Student[] = [];
    const allNames: string[] = [];
    const allMarks: string[] = [];

    // First pass: collect all names and marks
    for (const line of lines) {
      if (!line || line.length === 0) continue;

      // Skip headers and special markers
      if (
        line.includes("اسم التلميذ") ||
        line.includes("الفرض") ||
        line.includes("رقم") ||
        line === "حد 07" ||
        line.includes("حد") ||
        line.includes("المجموع") ||
        line.includes("المعدل")
      ) {
        continue;
      }

      // Check if it's a mark - improved pattern matching
      const markPattern = /^[\d]{1,2}[,\.]?\d{0,2}$/;
      if (markPattern.test(line)) {
        const cleanedMark = this.preprocessMark(line);
        if (cleanedMark !== null) {
          allMarks.push(cleanedMark);
          console.log(`📊 Found mark: ${line} -> cleaned: ${cleanedMark}`);
        }
      }
      // Check if it's an Arabic name (at least 2 Arabic characters)
      else if (/[\u0600-\u06FF]{2,}/.test(line)) {
        // Additional check: exclude lines that look like headers or labels
        if (!line.includes("التلميذ") && !line.includes("الاسم") && !line.includes("الفرض") && !line.includes(":")) {
          // Clean name - remove trailing colons
          const cleanedName = line.replace(/[:؛]$/, "").trim();
          allNames.push(cleanedName);
          console.log(`👤 Found name: ${cleanedName}`);
        }
      }
    }

    console.log(`📋 Total names collected: ${allNames.length}`);
    console.log(`📊 Total marks collected: ${allMarks.length}`);

    // Create students by pairing names with marks
    // The key insight: marks appear in the same order as students
    for (let i = 0; i < allNames.length; i++) {
      const markValue = i < allMarks.length ? this.parseMarkValue(allMarks[i]) : null;

      students.push({
        number: i + 1,
        name: allNames[i].trim(),
        marks: {
          fard1: detectedMarkTypes.hasFard1 ? markValue : null,
          fard2: detectedMarkTypes.hasFard2 ? markValue : null,
          fard3: detectedMarkTypes.hasFard3 ? markValue : null,
          fard4: detectedMarkTypes.hasFard4 ? markValue : null,
          activities: detectedMarkTypes.hasActivities ? markValue : null,
        },
      });

      console.log(`✅ Created student ${i + 1}: ${allNames[i]} with mark: ${markValue}`);
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
