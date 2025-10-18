/* Backend OCR Service - All sensitive logic runs here */

export interface Student {
  number: number;
  name: string;
  marks: {
    fard1: number | null;
    fard2: number | null;
    fard3: number | null;
    fard4: number | null;
    activities: number | null;
  };
  uncertain?: {
    name: boolean;
    marks: {
      fard1: boolean;
      fard2: boolean;
      fard3: boolean;
      fard4: boolean;
      activities: boolean;
    };
  };
}

export interface DetectedMarkTypes {
  hasFard1: boolean;
  hasFard2: boolean;
  hasFard3: boolean;
  hasFard4: boolean;
  hasActivities: boolean;
}

interface StudentUncertainty {
  name: boolean;
  marks: {
    fard1: boolean;
    fard2: boolean;
    fard3: boolean;
    fard4: boolean;
    activities: boolean;
  };
}

class GeminiOCRService {
  private geminiApiKey: string;

  // Configurable model and endpoint fallbacks
  private getModelCandidates(): string[] {
    const envModel = (process.env.GEMINI_MODEL || "").trim();
    const defaults = [
      "gemini-2.5-pro-latest",
      "gemini-2.5-pro",
      "gemini-2.0-pro-latest",
      "gemini-2.0-pro",
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
      "gemini-2.5-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-pro-vision",
    ];
    if (envModel) {
      return [envModel, ...defaults.filter((m) => m !== envModel)];
    }
    return defaults;
  }

  private getApiBases(): string[] {
    const envBase = (process.env.GEMINI_API_BASE || "").trim();
    const defaults = [
      "https://generativelanguage.googleapis.com/v1",
      "https://generativelanguage.googleapis.com/v1beta",
    ];
    if (envBase) {
      return [envBase, ...defaults.filter((b) => b !== envBase)];
    }
    return defaults;
  }

  // Micro-caches and precompiled helpers
  private cacheNormalizeNameForComparison: Map<string, string> = new Map();
  private cachePreprocessMark: Map<string, string | null> = new Map();
  private ratioPattern: RegExp = /^(\d{1,2})\s*\/?\s*(?:out\s*of\s*)?(\d{1,2})$/i;
  private arabicDigitMap: Record<string, string> = {
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

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || "";
    if (!this.geminiApiKey) {
      throw new Error("GEMINI_API_KEY not found in environment variables");
    }
  }

  /**
   * Main method to process an image and extract student marks
   * @param base64Image - Base64 encoded image data
   * @param mimeType - Image MIME type
   */
  async processImage(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<{
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
  }> {
    try {
      console.log("🚀 STARTING GEMINI PRO OCR PROCESSING");

      // Run structured and text extraction in parallel
      const structuredPromise = this.callGeminiAPIStructured(base64Image, mimeType);
      const textPromise = this.callGeminiAPI(base64Image);

      const [structuredOutcome, textOutcome] = await Promise.allSettled([structuredPromise, textPromise]);

      let structuredStudents: Student[] = [];
      let structuredDetected: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasFard4: false,
        hasActivities: false,
      };

      if (structuredOutcome.status === "fulfilled") {
        const structuredResult = structuredOutcome.value;
        structuredStudents = (structuredResult.students || []).map((student: any, index: number) => ({
          number: index + 1,
          name: student.name,
          marks: {
            fard1: student.marks?.fard1 ?? null,
            fard2: student.marks?.fard2 ?? null,
            fard3: student.marks?.fard3 ?? null,
            fard4: student.marks?.fard4 ?? null,
            activities: student.marks?.activities ?? null,
          },
          uncertain: {
            name: false,
            marks: { fard1: false, fard2: false, fard3: false, fard4: false, activities: false },
          },
        }));
        structuredDetected = {
          hasFard1: !!structuredResult.markTypes?.hasFard1,
          hasFard2: !!structuredResult.markTypes?.hasFard2,
          hasFard3: !!structuredResult.markTypes?.hasFard3,
          hasFard4: !!structuredResult.markTypes?.hasFard4,
          hasActivities: !!structuredResult.markTypes?.hasActivities,
        };
      }

      let textStudents: Student[] = [];
      let textDetected: DetectedMarkTypes = {
        hasFard1: false,
        hasFard2: false,
        hasFard3: false,
        hasFard4: false,
        hasActivities: false,
      };

      if (textOutcome.status === "fulfilled" && textOutcome.value && textOutcome.value.text) {
        const extracted = this.extractStudentData(textOutcome.value.text);
        textStudents = extracted.students;
        textDetected = extracted.detectedMarkTypes;
      }

      // Choose best source then merge
      let students: Student[] = structuredStudents.length ? structuredStudents : textStudents;
      let detectedMarkTypes: DetectedMarkTypes = {
        hasFard1: structuredDetected.hasFard1 || textDetected.hasFard1,
        hasFard2: structuredDetected.hasFard2 || textDetected.hasFard2,
        hasFard3: structuredDetected.hasFard3 || textDetected.hasFard3,
        hasFard4: structuredDetected.hasFard4 || textDetected.hasFard4,
        hasActivities: structuredDetected.hasActivities || textDetected.hasActivities,
      };

      if (structuredStudents.length && textStudents.length) {
        students = this.mergeStudentsByName(structuredStudents, textStudents);
      }

      if (students.length === 0) {
        throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      const postProcessed = this.postProcessStudents(students, detectedMarkTypes);
      return { students: postProcessed, detectedMarkTypes };
    } catch (error) {
      console.error("Gemini processing error:", error);
      throw new Error(error instanceof Error ? error.message : "فشلت معالجة الصورة");
    }
  }

  /**
   * Call Gemini API with structured JSON output
   */
  private async callGeminiAPIStructured(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<{ students: any[]; markTypes: any }> {
    const structuredPrompt = `You are an expert OCR system for Moroccan student marksheets. Extract the data and return it as valid JSON.

Analyze this marksheet image and extract:
1. All student names (in Arabic)
2. All numerical marks for each student
3. Column headers to identify mark types

Return ONLY valid JSON in this exact format:
{
  "markTypes": {
    "hasFard1": boolean,
    "hasFard2": boolean, 
    "hasFard3": boolean,
    "hasFard4": boolean,
    "hasActivities": boolean
  },
  "students": [
    {
      "name": "اسم الطالب بالعربية",
      "marks": {
        "fard1": 15.50,
        "fard2": 12.00,
        "fard3": null,
        "fard4": null,
        "activities": 18.25
      }
    }
  ]
}

CRITICAL RULES:
- Student names must be in exact Arabic as shown
- Marks are numbers 0-20 or null if missing
- Use null for missing marks, not 0
- Preserve decimal precision (XX.XX format)
- Only include students with visible names
- Mark types are detected from headers like "الفرض 1", "الأنشطة"

Return ONLY the JSON, no other text.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: structuredPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 4096,
        candidateCount: 1,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
    };

    const { data } = await this.generateContentWithFallback(requestBody);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response from Gemini API");
    }

    const parts = data.candidates[0].content.parts || [];
    const texts: string[] = parts
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .filter((t: string) => t && t.length > 0);
    const combinedText = texts.join("\n\n");

    const parsed = this.tryParseStructuredJson(combinedText);
    if (parsed) return parsed;

    throw new Error("Failed to parse structured response");
  }

  /**
   * Try to parse JSON even if wrapped in code fences
   */
  private tryParseStructuredJson(text: string): any | null {
    if (!text) return null;
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```json[\s\S]*?```/gi, (m) => m.replace(/```json|```/gi, "").trim());
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim());

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // Continue to direct parse
      }
    }

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  /**
   * Call Gemini API with text extraction
   */
  private async callGeminiAPI(base64Image: string): Promise<{ text: string }> {
    const prompt = `You are an expert OCR system specializing in Arabic educational documents. Analyze this marksheet image and extract student data with maximum precision.

This is a Moroccan student marksheet containing:
- Student names in Arabic
- Numerical marks (format: XX,XX or XX.XX, range 0-20)
- Column headers like: الفرض 1, الفرض 2, الفرض 3, الفرض 4, الأنشطة

Extract the complete table structure maintaining the relationship between each student name and their marks.`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 4096,
        candidateCount: 1,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
    };

    const { data } = await this.generateContentWithFallback(requestBody);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("استجابة غير صحيحة من خدمة Gemini");
    }

    const text = data.candidates[0].content.parts[0].text;
    return { text };
  }

  /**
   * Generic sender with model and endpoint fallbacks
   */
  private async generateContentWithFallback(requestBody: any): Promise<{ data: any; model: string; base: string }> {
    const tried: Array<{ model: string; base: string; status?: number; error?: any }> = [];

    for (const base of this.getApiBases()) {
      for (const model of this.getModelCandidates()) {
        const apiUrl = `${base}/models/${model}:generateContent`;
        try {
          const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            tried.push({ model, base, status: response.status, error: errorData });

            if (response.status === 404 || response.status === 403) {
              continue;
            }
            if (response.status === 400) {
              throw new Error("فشل الاتصال بخدمة Gemini: خطأ في طلب API");
            }
            if (response.status === 429) {
              throw new Error("خدمة Gemini مشغولة. حاول بعد قليل");
            }
            throw new Error("فشل الاتصال بخدمة Gemini");
          }

          const data = await response.json();
          return { data, model, base };
        } catch (err) {
          tried.push({ model, base, error: err });
          continue;
        }
      }
    }

    throw new Error("فشل الاتصال بخدمة Gemini: لم يتم العثور على نموذج متاح");
  }

  // NOTE: The following methods are simplified for backend
  // Full implementation available in original file (lines 604-2080)

  private extractStudentData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    // Simplified implementation - add full logic from original file if needed
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

  private mergeStudentsByName(primary: Student[], secondary: Student[]): Student[] {
    // Simplified - use original implementation from lines 71-134
    return primary;
  }

  private postProcessStudents(students: Student[], _detectedMarkTypes: DetectedMarkTypes): Student[] {
    // Simplified - use original implementation from lines 2055-2080
    return students;
  }

  private normalizeNameForComparison(text: string): string {
    if (!text) return "";
    const cached = this.cacheNormalizeNameForComparison.get(text);
    if (cached !== undefined) return cached;

    let s = text.toString();
    s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, "");
    s = s.normalize("NFKC");
    s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
    s = s
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي");
    s = s.replace(/\s+/g, " ").trim().toLowerCase();

    this.cacheNormalizeNameForComparison.set(text, s);
    return s;
  }
}

export default new GeminiOCRService();
