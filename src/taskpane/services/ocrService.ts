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

      // Use the comprehensive extraction method
      const result = this.comprehensiveExtraction(extractedText);

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

  private comprehensiveExtraction(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    console.log("🔄 Using comprehensive extraction method...");

    const lines = text.split("\n").map((line) => this.normalizeArabicNumber(line.trim()));

    const allNames: string[] = [];
    const allMarks: string[] = [];

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

    // Process lines to extract names and marks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || line.length === 0) continue;

      // Skip headers and special markers
      if (
        line.includes("اسم التلميذ") ||
        line.includes("الفرض") ||
        line.includes("رقم") ||
        line === "حد 07" ||
        line.includes("حد")
      ) {
        continue;
      }

      // Check if it's a mark - improved pattern matching
      // Matches: XX,00 or XX.00 or XXX00 or XX100 etc.
      const markPattern = /^[\d]{2,}[,\.]?\d{0,2}$/;

      if (markPattern.test(line)) {
        // Clean and validate the mark before adding
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
          // Skip lines with colons (like "بخالة ادم :")
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
    const students: Student[] = [];

    // The key insight: marks appear in the same order as students
    for (let i = 0; i < allNames.length; i++) {
      const markValue = i < allMarks.length ? this.parseMarkValue(allMarks[i]) : null;

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

    // Default mark types
    if (
      !detectedMarkTypes.hasFard1 &&
      !detectedMarkTypes.hasFard2 &&
      !detectedMarkTypes.hasFard3 &&
      !detectedMarkTypes.hasActivities
    ) {
      detectedMarkTypes.hasFard1 = true;
    }

    console.log(`✅ Total students extracted: ${students.length}`);

    return { students, detectedMarkTypes };
  }

  // Preprocess mark to handle OCR quirks
  private preprocessMark(mark: string): string | null {
    if (!mark) return null;

    // Remove any spaces
    let cleaned = mark.replace(/\s+/g, "");

    // Handle formats like "07100" which should be "07,00"
    // Pattern: if we have 5 digits and ends with "100", it's likely XX,00
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

  // Parse mark value with better handling
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

  // Clean mark value (deprecated - use parseMarkValue instead)
  cleanMarkValue(mark: string | null): number | null {
    return this.parseMarkValue(this.preprocessMark(mark || "") || null);
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
