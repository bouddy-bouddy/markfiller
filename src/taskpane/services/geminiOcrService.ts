/* global fetch, File, FileReader, console, process, Image, document */
import { Student, DetectedMarkTypes, StudentUncertainty } from "../types";

class GeminiOCRService {
  private geminiApiKey: string;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || "";
    if (!this.geminiApiKey) {
      console.warn("GEMINI_API_KEY not found in environment variables");
    }
  }

  /**
   * Merge two student arrays by normalized name, preferring non-null marks from either source
   */
  private mergeStudentsByName(primary: Student[], secondary: Student[]): Student[] {
    const normalize = (s: string) => this.normalizeNameForComparison(s);

    const byName = new Map<string, Student>();
    for (const s of primary) {
      byName.set(normalize(s.name), { ...s });
    }

    for (const s of secondary) {
      const key = normalize(s.name);
      if (!byName.has(key)) {
        byName.set(key, { ...s, number: byName.size + 1 });
      } else {
        const existing = byName.get(key)!;
        const merged: Student = {
          ...existing,
          marks: {
            fard1: existing.marks.fard1 ?? s.marks.fard1 ?? null,
            fard2: existing.marks.fard2 ?? s.marks.fard2 ?? null,
            fard3: existing.marks.fard3 ?? s.marks.fard3 ?? null,
            fard4: existing.marks.fard4 ?? s.marks.fard4 ?? null,
            activities: existing.marks.activities ?? s.marks.activities ?? null,
          },
          uncertain: {
            name: existing.uncertain?.name || false || s.uncertain?.name || false,
            marks: {
              fard1:
                (existing.marks.fard1 !== null
                  ? existing.uncertain?.marks?.fard1
                  : (s.uncertain?.marks?.fard1 ?? true)) || false,
              fard2:
                (existing.marks.fard2 !== null
                  ? existing.uncertain?.marks?.fard2
                  : (s.uncertain?.marks?.fard2 ?? true)) || false,
              fard3:
                (existing.marks.fard3 !== null
                  ? existing.uncertain?.marks?.fard3
                  : (s.uncertain?.marks?.fard3 ?? true)) || false,
              fard4:
                (existing.marks.fard4 !== null
                  ? existing.uncertain?.marks?.fard4
                  : (s.uncertain?.marks?.fard4 ?? true)) || false,
              activities:
                (existing.marks.activities !== null
                  ? existing.uncertain?.marks?.activities
                  : (s.uncertain?.marks?.activities ?? true)) || false,
            },
          },
        };
        byName.set(key, merged);
      }
    }

    // Preserve original order as much as possible: primary first, then new ones
    const primaryKeys = primary.map((s) => normalize(s.name));
    const extras: string[] = [];
    byName.forEach((_value, key) => {
      if (!primaryKeys.includes(key)) {
        extras.push(key);
      }
    });
    const orderedKeys = primaryKeys.concat(extras);
    return orderedKeys.map((k, i) => ({ ...byName.get(k)!, number: i + 1 }));
  }

  /**
   * Main method to process an image and extract student marks
   */
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      // Validate image file
      if (!this.isValidImageFile(imageFile)) {
        throw new Error("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
      }

      console.log("🚀 STARTING ENHANCED GEMINI PRO OCR PROCESSING");
      console.log("📸 Image file details:", {
        name: imageFile.name,
        size: `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`,
        type: imageFile.type,
        lastModified: new Date(imageFile.lastModified).toISOString(),
      });

      // Convert image to base64 with optimization (downscale/compress if large)
      const base64Image = await this.fileToOptimizedBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      if (!this.geminiApiKey) {
        throw new Error("Gemini API key not found. Please check your environment configuration.");
      }

      // Run structured and text extraction in parallel, then merge
      console.log("🚀 Launching parallel OCR extractions (structured + text)…");
      const structuredPromise = this.callGeminiAPIStructured(base64Content, imageFile.type || "image/jpeg");
      const textPromise = this.callGeminiAPI(base64Content);

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
        console.log("✅ Structured extraction returned a result");
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
      } else {
        console.warn("⚠️ Structured extraction failed:", structuredOutcome.reason);
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
        console.log("✅ Text extraction returned a result");
        const extracted = this.extractStudentData(textOutcome.value.text);
        textStudents = extracted.students;
        textDetected = extracted.detectedMarkTypes;
      } else {
        console.warn(
          "⚠️ Text extraction failed or empty:",
          textOutcome.status === "rejected" ? textOutcome.reason : "no text"
        );
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
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Fast path: single structured Gemini Pro call only (no text fallback)
   */
  async processImageFast(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    if (!this.isValidImageFile(imageFile)) {
      throw new Error("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
    }
    const base64Image = await this.fileToBase64(imageFile);
    const base64Content = base64Image.split(",")[1];
    let structuredResult: { students: any[]; markTypes: any };
    try {
      structuredResult = await this.callGeminiAPIStructured(base64Content, imageFile.type || "image/jpeg");
    } catch (e) {
      console.warn("Structured parse failed, falling back to text extraction once.", e);
      const response = await this.callGeminiAPI(base64Content);
      if (!response || !response.text) {
        throw new Error("لم يتم التعرف على أي نص في الصورة");
      }
      const fallback = this.extractStudentData(response.text);
      const postProcessed = this.postProcessStudents(fallback.students, fallback.detectedMarkTypes);
      return { students: postProcessed, detectedMarkTypes: fallback.detectedMarkTypes };
    }
    const students: Student[] = (structuredResult.students || []).map((student: any, index: number) => ({
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
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: !!structuredResult.markTypes?.hasFard1,
      hasFard2: !!structuredResult.markTypes?.hasFard2,
      hasFard3: !!structuredResult.markTypes?.hasFard3,
      hasFard4: !!structuredResult.markTypes?.hasFard4,
      hasActivities: !!structuredResult.markTypes?.hasActivities,
    };
    if (!students.length) throw new Error("لم يتم العثور على أي بيانات طلاب في الصورة");

    // Always run a secondary text extraction and merge to avoid partial results
    try {
      const response = await this.callGeminiAPI(base64Content);
      if (response && response.text) {
        const fallback = this.extractStudentData(response.text);

        const mergedStudents = this.mergeStudentsByName(students, fallback.students);
        const mergedDetected: DetectedMarkTypes = {
          hasFard1: detectedMarkTypes.hasFard1 || fallback.detectedMarkTypes.hasFard1,
          hasFard2: detectedMarkTypes.hasFard2 || fallback.detectedMarkTypes.hasFard2,
          hasFard3: detectedMarkTypes.hasFard3 || fallback.detectedMarkTypes.hasFard3,
          hasFard4: detectedMarkTypes.hasFard4 || fallback.detectedMarkTypes.hasFard4,
          hasActivities: detectedMarkTypes.hasActivities || fallback.detectedMarkTypes.hasActivities,
        };

        console.log("🤝 Hybrid OCR merge complete:", {
          structuredCount: students.length,
          fallbackCount: fallback.students.length,
          mergedCount: mergedStudents.length,
        });

        const postProcessed = this.postProcessStudents(mergedStudents, mergedDetected);
        return { students: postProcessed, detectedMarkTypes: mergedDetected };
      }
    } catch (mergeError) {
      console.warn("Hybrid merge step failed; returning structured results only.", mergeError);
    }
    const postProcessed = this.postProcessStudents(students, detectedMarkTypes);
    return { students: postProcessed, detectedMarkTypes };
  }

  /**
   * Call Gemini API with structured JSON output for precise data extraction
   */
  private async callGeminiAPIStructured(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<{ students: any[]; markTypes: any }> {
    const model = "gemini-1.5-pro";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response from Gemini API");
    }

    // Collect all text parts
    const parts = data.candidates[0].content.parts || [];
    const texts: string[] = parts
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .filter((t: string) => t && t.length > 0);
    const combinedText = texts.join("\n\n");

    // Try robust JSON parsing
    const parsed = this.tryParseStructuredJson(combinedText);
    if (parsed) return parsed;

    // As a last attempt, if there is a single part and it has text, try that directly
    if (texts.length === 1) {
      const direct = this.tryParseStructuredJson(texts[0]);
      if (direct) return direct;
    }

    throw new Error("Failed to parse structured response");
  }

  // Try to parse JSON even if wrapped in code fences or with pre/post text
  private tryParseStructuredJson(text: string): any | null {
    if (!text) return null;
    let cleaned = text.trim();
    // Strip code fences like ```json ... ```
    cleaned = cleaned.replace(/```json[\s\S]*?```/gi, (m) => m.replace(/```json|```/gi, "").trim());
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim());
    // If still contains extra prose, try extracting the largest {...} block
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // Try to balance braces quickly
      }
    }
    // Direct parse attempt
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  /**
   * Call Gemini API with optimized prompt for student marks sheets
   */
  private async callGeminiAPI(base64Image: string): Promise<{ text: string }> {
    // Use Gemini 1.5 Pro for superior OCR accuracy on complex documents like marksheets
    // Gemini 1.5 Pro has better vision capabilities and understanding of structured documents
    const model = "gemini-1.5-pro";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `You are an expert OCR system specializing in Arabic educational documents. Analyze this marksheet image and extract student data with maximum precision.

This is a Moroccan student marksheet containing:
- Student names in Arabic (like أحمد محمد, فاطمة الزهراء)
- Numerical marks (format: XX,XX or XX.XX, range 0-20)
- Column headers like: الفرض 1, الفرض 2, الفرض 3, الفرض 4, الأنشطة
- Student numbers/IDs
- Table structure with rows and columns

CRITICAL REQUIREMENTS:
1. Preserve exact Arabic text - every letter and diacritic matters
2. Maintain precise numerical values - don't confuse 07,00 with 0700
3. Respect table structure - align names with their corresponding marks
4. Handle OCR artifacts like merged characters or misaligned text
5. Distinguish between headers and data rows
6. Preserve decimal formatting (comma or dot separators)

Extract the complete table structure maintaining the relationship between:
- Each student name and their row of marks
- Column headers and their corresponding mark types
- Sequential order of students

Provide the raw extracted text exactly as it appears in the image, preserving all spacing, line breaks, and formatting that indicates table structure. Focus on accuracy over interpretation.`;

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
        temperature: 0.0, // Maximum determinism for OCR accuracy
        topK: 1, // Most confident predictions only
        topP: 0.1, // Very focused sampling for precise text extraction
        maxOutputTokens: 4096, // Increased for larger marksheets
        candidateCount: 1, // Single best result
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
    } as const;

    const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API error:", errorData);

      if (response.status === 400) {
        throw new Error("فشل الاتصال بخدمة Gemini: خطأ في طلب API. يرجى التحقق من الصورة.");
      } else if (response.status === 403) {
        throw new Error("فشل الاتصال بخدمة Gemini: خطأ في المصادقة. يرجى التحقق من مفتاح API.");
      } else if (response.status === 404) {
        throw new Error("فشل الاتصال بخدمة Gemini: نموذج غير موجود. تم تحديث النموذج إلى إصدار مدعوم.");
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
    // Scan full text to avoid missing headers that appear later in multi-section documents
    const headerText = text;

    return {
      hasFard1: /(ال)?فرض\s*(?:1|١|الأول|اول)/.test(headerText),
      hasFard2: /(ال)?فرض\s*(?:2|٢|الثاني|ثاني)/.test(headerText),
      hasFard3: /(ال)?فرض\s*(?:3|٣|الثالث|ثالث)/.test(headerText),
      hasFard4: /(ال)?فرض\s*(?:4|٤|الرابع|رابع)/.test(headerText),
      hasActivities: /الأنشطة|النشاط|المراقبة\s*المستمرة|مراقبة\s*مستمرة|أنشطة/.test(headerText),
    };
  }

  /**
   * Advanced header structure analysis
   */
  private analyzeHeaderStructure(lines: string[]): {
    headerRowIndex: number;
    columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
    markColumnMapping: Record<string, keyof Student["marks"]>;
  } | null {
    // Look for header row in first 15 lines
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;

      if (this.isAdvancedHeaderRow(line)) {
        const columnStructure = this.analyzeColumnStructure(line);
        const markColumnMapping = this.createMarkColumnMapping(columnStructure);

        if (columnStructure.length >= 3) {
          // At least number, name, and one mark column
          return {
            headerRowIndex: i,
            columnStructure,
            markColumnMapping,
          };
        }
      }
    }

    return null;
  }

  /**
   * Find all header sections throughout the document (handles repeated tables/columns)
   */
  private analyzeAllHeaderSections(lines: string[]): Array<{
    headerRowIndex: number;
    columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
    markColumnMapping: Record<string, keyof Student["marks"]>;
  }> {
    const analyses: Array<{
      headerRowIndex: number;
      columnStructure: Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;
      if (!this.isAdvancedHeaderRow(line)) continue;
      const columnStructure = this.analyzeColumnStructure(line);
      const markColumnMapping = this.createMarkColumnMapping(columnStructure);
      if (columnStructure.length >= 3) {
        // Avoid adding duplicate headers very close to each other
        if (analyses.length === 0 || i - analyses[analyses.length - 1].headerRowIndex > 2) {
          analyses.push({ headerRowIndex: i, columnStructure, markColumnMapping });
        }
      }
    }
    return analyses;
  }

  /**
   * Enhanced header row detection
   */
  private isAdvancedHeaderRow(line: string): boolean {
    const headerPatterns = [
      // Arabic patterns
      /اسم.*الفرض|الفرض.*اسم/,
      /التلميذ.*الفرض|الفرض.*التلميذ/,
      /رقم.*اسم.*الفرض/,
      /الاسم.*الفرض.*الأنشطة/,
      // Mixed patterns
      /name.*fard|fard.*name/,
      /student.*mark|mark.*student/,
      // Generic table patterns
      /رقم|الاسم|الفرض|الأنشطة/,
      /number|name|fard|activities/,
    ];

    const hasHeaderPattern = headerPatterns.some((pattern) => pattern.test(line));
    const hasMultipleColumns = line.split(/[\s\t|،]+/).filter((col) => col.trim().length > 0).length >= 3;

    return hasHeaderPattern && hasMultipleColumns;
  }

  /**
   * Analyze column structure with type detection
   */
  private analyzeColumnStructure(
    headerRow: string
  ): Array<{ index: number; title: string; type: "number" | "name" | "mark" | "unknown" }> {
    const columns = headerRow
      .split(/[\s\t|،]+/)
      .map((col) => col.trim())
      .filter((col) => col.length > 0);

    return columns.map((col, index) => {
      let type: "number" | "name" | "mark" | "unknown" = "unknown";

      if (/رقم|الرقم|number/i.test(col)) {
        type = "number";
      } else if (/اسم|الاسم|التلميذ|name|student/i.test(col)) {
        type = "name";
      } else if (/الفرض|الأنشطة|fard|activities/i.test(col)) {
        type = "mark";
      }

      return { index, title: col, type };
    });
  }

  /**
   * Create mapping between column titles and mark types
   */
  private createMarkColumnMapping(
    columnStructure: Array<{ index: number; title: string; type: string }>
  ): Record<string, keyof Student["marks"]> {
    const mapping: Record<string, keyof Student["marks"]> = {};

    columnStructure.forEach(({ title }) => {
      const normalizedTitle = title
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي");

      if (/الفرض1|الفرض١|فرض1|فرض١|fard1|الاول|الأول/.test(normalizedTitle)) {
        mapping[title] = "fard1";
      } else if (/الفرض2|الفرض٢|فرض2|فرض٢|fard2|الثاني|ثاني/.test(normalizedTitle)) {
        mapping[title] = "fard2";
      } else if (/الفرض3|الفرض٣|فرض3|فرض٣|fard3|الثالث|ثالث/.test(normalizedTitle)) {
        mapping[title] = "fard3";
      } else if (/الفرض4|الفرض٤|فرض4|فرض٤|fard4|الرابع|رابع/.test(normalizedTitle)) {
        mapping[title] = "fard4";
      } else if (/الانشطه|الأنشطة|النشاط|المراقبهالمستمره|المراقبةالمستمرة|activities/.test(normalizedTitle)) {
        mapping[title] = "activities";
      }
    });

    return mapping;
  }

  /**
   * Extract data rows with better filtering
   */
  private extractDataRows(lines: string[], headerRowIndex: number): string[] {
    const dataRows = lines.slice(headerRowIndex + 1);

    const filteredRows = dataRows.filter((row) => {
      if (!row || row.trim().length === 0) return false;

      // Skip summary rows (but be more specific)
      if (this.isSummaryRow(row)) {
        console.log(`🚫 Skipping summary row: "${row}"`);
        return false;
      }

      // Skip header-like rows that might appear after the main header
      if (this.isAdvancedHeaderRow(row)) {
        console.log(`🚫 Skipping header row: "${row}"`);
        return false;
      }

      // Must contain at least some Arabic text OR numbers (for student data)
      const hasArabicOrNumbers = /[\u0600-\u06FF]/.test(row) || /\d/.test(row);
      if (!hasArabicOrNumbers) {
        console.log(`🚫 Skipping row without Arabic/numbers: "${row}"`);
        return false;
      }

      return true;
    });

    console.log(`📊 Filtered ${filteredRows.length} data rows from ${dataRows.length} total rows`);
    return filteredRows;
  }

  /**
   * Extract data rows between two indices (start after header, stop before next header)
   */
  private extractDataRowsInRange(lines: string[], headerRowIndex: number, endExclusive: number): string[] {
    const dataRows = lines.slice(headerRowIndex + 1, Math.max(headerRowIndex + 1, endExclusive));
    const filteredRows = dataRows.filter((row) => {
      if (!row || row.trim().length === 0) return false;
      if (this.isSummaryRow(row)) return false;
      if (this.isAdvancedHeaderRow(row)) return false;
      const hasArabicOrNumbers = /[\u0600-\u06FF]/.test(row) || /\d/.test(row);
      return hasArabicOrNumbers;
    });
    return filteredRows;
  }

  /**
   * Advanced student extraction with intelligent cell parsing
   */
  private extractStudentFromRowAdvanced(
    row: string,
    headerAnalysis: {
      headerRowIndex: number;
      columnStructure: Array<{ index: number; title: string; type: string }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    },
    detectedMarkTypes: DetectedMarkTypes,
    studentNumber: number
  ): Student | null {
    // Parse row into cells with better separator handling
    const cells = this.parseRowIntoCells(row);

    // IMPROVED: More lenient cell count check - allow even single cell if it contains meaningful data
    if (cells.length === 0) {
      console.warn(`⚠️ No cells found in row: "${row}"`);
      return null;
    }

    // Find student name using multiple strategies
    let studentName = this.extractStudentName(cells, headerAnalysis.columnStructure);

    // IMPROVED: If name extraction fails, try emergency fallback extraction
    if (!studentName) {
      studentName = this.emergencyNameExtraction(row, cells);
      if (studentName) {
        console.log(`🚨 Emergency name extraction successful: "${studentName}" from row: "${row}"`);
      }
    }

    // IMPROVED: Only return null if we absolutely cannot find any name
    if (!studentName) {
      console.warn(`⚠️ Could not extract any student name from row: "${row}"`);
      console.warn(`⚠️ Parsed cells were:`, cells);
      return null;
    }

    // Extract marks using the column mapping
    const { marks, flags } = this.extractMarksAdvanced(cells, headerAnalysis, detectedMarkTypes);
    let nameUncertain = false;
    if (!this.isValidStudentName(studentName)) {
      nameUncertain = true;
    }

    return {
      number: studentNumber,
      name: studentName,
      marks,
      uncertain: { name: nameUncertain, marks: flags },
    };
  }

  /**
   * Parse row into cells with intelligent separator handling - IMPROVED VERSION
   */
  private parseRowIntoCells(row: string): string[] {
    // Normalize spaces
    let working = row.replace(/\s+/g, " ").trim();

    // 1) Extract leading student number if present
    const leadingNumMatch = working.match(/^\s*(\d{1,3})\s+/);
    const cells: string[] = [];
    if (leadingNumMatch) {
      cells.push(leadingNumMatch[1]);
      working = working.slice(leadingNumMatch[0].length).trim();
    }

    // 2) First split on strong separators (pipes, tabs, Arabic comma). This preserves spaces inside names
    let segments = working
      .split(/[|\t،]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If no strong separators found, keep the whole remainder as one segment
    if (segments.length === 0) {
      segments = [working];
    }

    // 3) For each segment, if it's clearly a mark keep as-is; otherwise treat as text (name) even if multi-word
    const markLike = /^(?:\d{1,2})(?:[.,]\d{1,2})?$/;

    for (const seg of segments) {
      if (markLike.test(this.normalizeArabicNumber(seg))) {
        cells.push(seg);
      } else {
        // Some OCR rows may still contain extra spaces between name parts – keep full name segment
        // but trim trailing punctuation
        cells.push(seg.replace(/[:؛]$/, "").trim());
      }
    }

    // 4) IMPROVED: More aggressive fallback parsing
    if (cells.length === 0) {
      // Emergency: just split by spaces and try to find meaningful parts
      const parts = working.split(/\s+/).filter((p) => p.length > 0);
      if (parts.length > 0) {
        return this.groupPartsIntoCells(parts);
      }
      // Last resort: return the entire row as a single cell
      return working.length > 0 ? [working] : [];
    }

    // 5) If we only have one cell and it's not a number, try to split it further
    if (cells.length === 1 && !markLike.test(this.normalizeArabicNumber(cells[0]))) {
      const parts = cells[0].split(/\s+/).filter((p) => p.length > 0);
      if (parts.length > 1) {
        return this.groupPartsIntoCells(parts);
      }
    }

    return cells;
  }

  /**
   * Group parts into logical cells based on content patterns
   */
  private groupPartsIntoCells(parts: string[]): string[] {
    const cells: string[] = [];
    let currentCell = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // If this looks like a mark (numeric), start a new cell
      if (this.isNumeric(part)) {
        if (currentCell) {
          cells.push(currentCell.trim());
          currentCell = "";
        }
        cells.push(part);
      } else {
        // If it's text, add to current cell
        currentCell += (currentCell ? " " : "") + part;
      }
    }

    // Add the last cell if it exists
    if (currentCell) {
      cells.push(currentCell.trim());
    }

    return cells;
  }

  /**
   * Extract student name using multiple strategies - IMPROVED VERSION
   */
  private extractStudentName(
    cells: string[],
    columnStructure: Array<{ index: number; title: string; type: string }>
  ): string | null {
    // Strategy 1: Use column structure to find name column
    const nameColumn = columnStructure.find((col) => col.type === "name");
    if (nameColumn && cells[nameColumn.index]) {
      const name = cells[nameColumn.index];
      if (this.isValidStudentName(name)) {
        return this.cleanStudentName(name);
      }
    }

    // Strategy 2: Find the longest Arabic text that's not a header
    let bestName = "";
    for (const cell of cells) {
      if (this.isValidStudentName(cell) && cell.length > bestName.length) {
        bestName = cell;
      }
    }

    if (bestName) {
      return this.cleanStudentName(bestName);
    }

    // Strategy 3: Look for Arabic text in any cell (more lenient)
    for (const cell of cells) {
      if (/[\u0600-\u06FF]{2,}/.test(cell) && !this.isStrictHeaderLike(cell)) {
        return this.cleanStudentName(cell);
      }
    }

    // Strategy 4: Even more lenient - any cell with Arabic characters
    for (const cell of cells) {
      const cleaned = cell.replace(/[^\u0600-\u06FF\s]/g, "").trim();
      if (cleaned.length >= 2 && !this.isStrictHeaderLike(cell)) {
        // IMPROVED: Reduced from 3 to 2 characters
        console.log(`📝 Fallback name extraction: "${cell}" → "${cleaned}"`);
        return this.cleanStudentName(cell);
      }
    }

    // Strategy 5: IMPROVED - Ultra lenient: any cell with ANY Arabic character
    for (const cell of cells) {
      if (/[\u0600-\u06FF]/.test(cell) && !this.isStrictHeaderLike(cell)) {
        const cleaned = this.cleanStudentName(cell);
        if (cleaned.length > 0) {
          console.log(`📝 Ultra-lenient name extraction: "${cell}" → "${cleaned}"`);
          return cleaned;
        }
      }
    }

    return null;
  }

  /**
   * Emergency name extraction when all other strategies fail - NEW METHOD
   */
  private emergencyNameExtraction(originalRow: string, cells: string[]): string | null {
    console.log(`🚨 Emergency name extraction for row: "${originalRow}"`);

    // Emergency Strategy 1: Look for any text that's not purely numeric
    for (const cell of cells) {
      if (cell && cell.trim().length > 0 && !/^\d+([.,]\d+)?$/.test(cell.trim())) {
        const cleaned = cell
          .trim()
          .replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "")
          .trim();
        if (cleaned.length >= 2) {
          console.log(`🚨 Emergency extraction found: "${cleaned}" from cell: "${cell}"`);
          return cleaned;
        }
      }
    }

    // Emergency Strategy 2: Extract from the original row directly
    const rowText = originalRow.trim();

    // Remove leading numbers (student numbers)
    let workingText = rowText.replace(/^\d+\s*/, "");

    // Look for Arabic text patterns
    const arabicMatch = workingText.match(/[\u0600-\u06FF][^\d]*[\u0600-\u06FF]/);
    if (arabicMatch) {
      const extracted = arabicMatch[0]
        .trim()
        .replace(/[^\u0600-\u06FF\s]/g, "")
        .trim();
      if (extracted.length >= 2) {
        console.log(`🚨 Emergency Arabic extraction: "${extracted}" from: "${workingText}"`);
        return extracted;
      }
    }

    // Emergency Strategy 3: Look for any sequence of letters (Arabic or Latin)
    const letterMatch = workingText.match(/[^\d\s.,|]+/);
    if (letterMatch) {
      const extracted = letterMatch[0].trim();
      if (extracted.length >= 2 && !/^[.,|]+$/.test(extracted)) {
        console.log(`🚨 Emergency letter extraction: "${extracted}" from: "${workingText}"`);
        return extracted;
      }
    }

    // Emergency Strategy 4: Last resort - use the first meaningful part
    const parts = workingText.split(/\s+/).filter((p) => p.length > 1 && !/^\d+([.,]\d+)?$/.test(p));
    if (parts.length > 0) {
      const extracted = parts[0].replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "").trim();
      if (extracted.length >= 1) {
        console.log(`🚨 Emergency part extraction: "${extracted}" from parts:`, parts);
        return extracted;
      }
    }

    console.log(`🚨 Emergency extraction failed completely for: "${originalRow}"`);
    return null;
  }

  /**
   * Check if a string is a valid student name - IMPROVED VERSION (More Lenient)
   */
  private isValidStudentName(name: string): boolean {
    if (!name || name.length < 1) return false; // IMPROVED: Allow single character names

    // IMPROVED: Allow names without Arabic text (for mixed language scenarios)
    // Original strict check: if (!/[\u0600-\u06FF]/.test(name)) return false;

    // Must not be header-like (but be more lenient)
    if (this.isStrictHeaderLike(name)) return false;

    // Must not be purely numeric
    if (/^\d+([.,]\d+)?$/.test(name.replace(/\s/g, ""))) return false;

    // IMPROVED: More lenient validation after cleaning
    const cleaned = name.replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "").trim();
    if (cleaned.length < 1) return false; // IMPROVED: Allow single character after cleaning

    // IMPROVED: Additional check - reject if it's only punctuation or symbols
    if (/^[^\u0600-\u06FF\u0041-\u005A\u0061-\u007A\s]+$/.test(name)) return false;

    return true;
  }

  /**
   * Check if a string looks like a header
   */
  private isHeaderLike(text: string): boolean {
    const headerKeywords = [
      "اسم",
      "الاسم",
      "التلميذ",
      "الفرض",
      "الأنشطة",
      "رقم",
      "الرقم",
      "المجموع",
      "المعدل",
      "total",
      "average",
      "sum",
      "name",
      "student",
    ];

    return headerKeywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Stricter header check for name validation - IMPROVED VERSION (More Lenient)
   */
  private isStrictHeaderLike(text: string): boolean {
    const strictHeaderKeywords = [
      "الاسم الكامل",
      "اسم التلميذ",
      "الفرض الأول",
      "الفرض الثاني",
      "الفرض الثالث",
      "الأنشطة المدمجة",
      "المجموع العام",
      "المعدل العام",
      "المجموع",
      "المعدل",
      "total",
      "average",
    ];

    // IMPROVED: Only reject if it's an EXACT match to header keywords
    const lowerText = text.toLowerCase().trim();
    return strictHeaderKeywords.some((keyword) => lowerText === keyword.toLowerCase());

    // REMOVED: The partial match condition that was too aggressive:
    // || (lowerText.includes(keyword.toLowerCase()) && text.length < 15)
  }

  /**
   * Clean student name
   */
  private cleanStudentName(name: string): string {
    return name
      .replace(/[:؛]$/, "") // Remove trailing colons
      .replace(/^\d+\s*/, "") // Remove leading numbers
      .trim();
  }

  /**
   * Advanced mark extraction using column mapping
   */
  private extractMarksAdvanced(
    cells: string[],
    headerAnalysis: {
      headerRowIndex: number;
      columnStructure: Array<{ index: number; title: string; type: string }>;
      markColumnMapping: Record<string, keyof Student["marks"]>;
    },
    detectedMarkTypes: DetectedMarkTypes
  ): { marks: Student["marks"]; flags: StudentUncertainty["marks"] } {
    const marks: Student["marks"] = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };
    const flags: StudentUncertainty["marks"] = {
      fard1: false,
      fard2: false,
      fard3: false,
      fard4: false,
      activities: false,
    };

    // Use column mapping to extract marks
    Object.entries(headerAnalysis.markColumnMapping).forEach(([columnTitle, markType]) => {
      const columnIndex = headerAnalysis.columnStructure.findIndex((col) => col.title === columnTitle);
      if (columnIndex !== -1 && cells[columnIndex]) {
        const markValue = this.parseMarkValue(cells[columnIndex]);
        if (markValue !== null) {
          marks[markType] = markValue;
          console.log(`📊 Found ${markType} mark: ${cells[columnIndex]} -> ${markValue}`);
          (flags as any)[markType] = false;
        }
      }
    });

    // If no structured marks found, try intelligent fallback
    if (Object.values(marks).every((mark) => mark === null)) {
      const nameCol = headerAnalysis.columnStructure.find((c) => c.type === "name")?.index;
      const fb = this.extractMarksIntelligently(cells, detectedMarkTypes, nameCol);
      (Object.keys(marks) as Array<keyof Student["marks"]>).forEach((k) => {
        if (fb.marks[k] !== null) {
          marks[k] = fb.marks[k];
          (flags as any)[k] = fb.flags[k] ?? true;
        }
      });
    }

    return { marks, flags };
  }

  /**
   * Intelligent mark extraction when column mapping fails
   */
  private extractMarksIntelligently(
    cells: string[],
    detectedMarkTypes: DetectedMarkTypes,
    probableNameIndex?: number
  ): { marks: Student["marks"]; flags: StudentUncertainty["marks"] } {
    const marks: Student["marks"] = { fard1: null, fard2: null, fard3: null, fard4: null, activities: null };
    const flags: StudentUncertainty["marks"] = {
      fard1: false,
      fard2: false,
      fard3: false,
      fard4: false,
      activities: false,
    };
    const numericCellPositionsAll = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => this.isNumeric(cell))
      .sort((a, b) => a.index - b.index);

    if (numericCellPositionsAll.length === 0) return { marks, flags };

    const isNameIndexProvided = typeof probableNameIndex === "number";
    const hasAfterName =
      isNameIndexProvided && numericCellPositionsAll.some((x) => x.index > (probableNameIndex as number));
    const numericCellPositions = hasAfterName
      ? numericCellPositionsAll.filter((x) => x.index > (probableNameIndex as number))
      : numericCellPositionsAll;

    let markIndex = 0;

    if (detectedMarkTypes.hasFard1 && markIndex < numericCellPositions.length) {
      marks.fard1 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
      if (marks.fard1 !== null) flags.fard1 = true;
    }
    if (detectedMarkTypes.hasFard2 && markIndex < numericCellPositions.length) {
      marks.fard2 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
      if (marks.fard2 !== null) flags.fard2 = true;
    }
    if (detectedMarkTypes.hasFard3 && markIndex < numericCellPositions.length) {
      marks.fard3 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
      if (marks.fard3 !== null) flags.fard3 = true;
    }
    if (detectedMarkTypes.hasFard4 && markIndex < numericCellPositions.length) {
      marks.fard4 = this.parseMarkValue(numericCellPositions[markIndex++].cell);
      if (marks.fard4 !== null) flags.fard4 = true;
    }
    if (detectedMarkTypes.hasActivities && markIndex < numericCellPositions.length) {
      marks.activities = this.parseMarkValue(numericCellPositions[markIndex++].cell);
      if (marks.activities !== null) flags.activities = true;
    }
    return { marks, flags };
  }

  /**
   * Validate and fix alignment issues
   */
  private validateAndFixAlignment(students: Student[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    if (students.length === 0) return students;

    // Check for common alignment issues
    const issues = this.detectAlignmentIssues(students, detectedMarkTypes);

    if (issues.length > 0) {
      console.log(`⚠️ Detected ${issues.length} alignment issues:`, issues);
      return this.fixAlignmentIssues(students, issues, detectedMarkTypes);
    }

    return students;
  }

  /**
   * Detect common alignment issues
   */
  private detectAlignmentIssues(
    students: Student[],
    detectedMarkTypes: DetectedMarkTypes
  ): Array<{
    type: "missing_marks" | "inconsistent_structure" | "wrong_mark_count";
    studentIndex: number;
    details: string;
  }> {
    const issues: Array<{
      type: "missing_marks" | "inconsistent_structure" | "wrong_mark_count";
      studentIndex: number;
      details: string;
    }> = [];

    students.forEach((student, index) => {
      const markCount = Object.values(student.marks).filter((mark) => mark !== null).length;
      const expectedMarkCount = Object.values(detectedMarkTypes).filter((has) => has).length;

      if (markCount === 0) {
        issues.push({
          type: "missing_marks",
          studentIndex: index,
          details: `Student ${student.name} has no marks`,
        });
      } else if (markCount !== expectedMarkCount) {
        issues.push({
          type: "wrong_mark_count",
          studentIndex: index,
          details: `Student ${student.name} has ${markCount} marks, expected ${expectedMarkCount}`,
        });
      }
    });

    return issues;
  }

  /**
   * Fix alignment issues
   */
  private fixAlignmentIssues(
    students: Student[],
    issues: Array<{ type: string; studentIndex: number; details: string }>,
    detectedMarkTypes: DetectedMarkTypes
  ): Student[] {
    // For now, return the original students
    // In the future, this could implement more sophisticated fixes
    console.log("🔧 Alignment issues detected but not yet fixed. Consider manual review.");
    void issues;
    void detectedMarkTypes;
    return students;
  }

  /**
   * Emergency fallback when no students are extracted
   */
  private emergencyFallbackExtraction(dataRows: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    console.log("🆘 Using emergency fallback extraction");
    const students: Student[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.trim().length === 0) continue;

      const cells = this.parseRowIntoCells(row);
      if (cells.length < 1) continue;

      // Very lenient name extraction - any cell with Arabic text
      let studentName: string | null = null;
      for (const cell of cells) {
        if (/[\u0600-\u06FF]/.test(cell)) {
          studentName = this.cleanStudentName(cell);
          break;
        }
      }

      if (studentName) {
        // Extract any numbers as potential marks
        const marks: Student["marks"] = {
          fard1: null,
          fard2: null,
          fard3: null,
          fard4: null,
          activities: null,
        };
        const flags: StudentUncertainty["marks"] = {
          fard1: false,
          fard2: false,
          fard3: false,
          fard4: false,
          activities: false,
        };

        const numbers = cells.filter((cell) => this.isNumeric(cell));
        if (numbers.length > 0 && detectedMarkTypes.hasFard1) {
          marks.fard1 = this.parseMarkValue(numbers[0]);
          if (marks.fard1 !== null) flags.fard1 = true;
        }
        if (numbers.length > 1 && detectedMarkTypes.hasFard2) {
          marks.fard2 = this.parseMarkValue(numbers[1]);
          if (marks.fard2 !== null) flags.fard2 = true;
        }
        if (numbers.length > 2 && detectedMarkTypes.hasFard3) {
          marks.fard3 = this.parseMarkValue(numbers[2]);
          if (marks.fard3 !== null) flags.fard3 = true;
        }
        if (numbers.length > 3 && detectedMarkTypes.hasActivities) {
          marks.activities = this.parseMarkValue(numbers[3]);
          if (marks.activities !== null) flags.activities = true;
        }

        students.push({
          number: i + 1,
          name: studentName,
          marks,
          uncertain: { name: true, marks: flags },
        });

        console.log(`🆘 Emergency extracted: ${studentName} with ${numbers.length} marks`);
      }
    }

    return students;
  }

  /**
   * Advanced fallback extraction when structured extraction fails
   */
  private advancedFallbackExtraction(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    console.log("🔄 Using advanced fallback extraction method");

    const students: Student[] = [];
    const allNames: string[] = [];
    const allMarks: string[] = [];

    // Collect names and marks with better filtering
    for (const line of lines) {
      if (!line || line.length === 0) continue;

      // Skip headers and special markers
      if (this.isAdvancedHeaderRow(line) || this.isSummaryRow(line)) {
        continue;
      }

      // Check if it's a mark
      if (this.isNumeric(line)) {
        const cleanedMark = this.preprocessMark(line);
        if (cleanedMark !== null) {
          allMarks.push(cleanedMark);
        }
      }
      // Check if it's an Arabic name
      else if (/[\u0600-\u06FF]{2,}/.test(line)) {
        const cleanedName = line.replace(/[:؛]$/, "").trim();
        allNames.push(cleanedName);
      }
    }

    // Create students with better mark assignment
    for (let i = 0; i < allNames.length; i++) {
      const markValue = i < allMarks.length ? this.parseMarkValue(allMarks[i]) : null;

      const marks: Student["marks"] = {
        fard1: detectedMarkTypes.hasFard1 ? markValue : null,
        fard2: detectedMarkTypes.hasFard2 ? markValue : null,
        fard3: detectedMarkTypes.hasFard3 ? markValue : null,
        fard4: detectedMarkTypes.hasFard4 ? markValue : null,
        activities: detectedMarkTypes.hasActivities ? markValue : null,
      };
      const flags: StudentUncertainty["marks"] = {
        fard1: marks.fard1 !== null,
        fard2: marks.fard2 !== null,
        fard3: marks.fard3 !== null,
        fard4: marks.fard4 !== null,
        activities: marks.activities !== null,
      };

      students.push({
        number: i + 1,
        name: allNames[i],
        marks,
        uncertain: { name: true, marks: flags },
      });
    }

    return students;
  }

  /**
   * Extract students from text lines with advanced table structure detection
   */
  private extractStudentsFromLines(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    let students: Student[] = [];

    // Find all header sections and parse each one
    const headerAnalyses = this.analyzeAllHeaderSections(lines);
    if (headerAnalyses.length === 0) {
      console.warn("⚠️ No valid header structure found across the document, using advanced fallback");
      return this.advancedFallbackExtraction(lines, detectedMarkTypes);
    }

    console.log(`📋 Found ${headerAnalyses.length} header sections`);

    for (let s = 0; s < headerAnalyses.length; s++) {
      const headerAnalysis = headerAnalyses[s];
      const nextHeader = headerAnalyses[s + 1]?.headerRowIndex ?? lines.length;
      const dataRows = this.extractDataRowsInRange(lines, headerAnalysis.headerRowIndex, nextHeader);

      console.log(`📊 Section ${s + 1}/${headerAnalyses.length} — rows: ${dataRows.length}`);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.trim().length === 0) continue;
        if (this.isSummaryRow(row)) continue;

        const student = this.extractStudentFromRowAdvanced(row, headerAnalysis, detectedMarkTypes, students.length + 1);
        if (student) {
          students.push(student);
        } else {
          const cells = this.parseRowIntoCells(row);
          console.warn(`⚠️ Section ${s + 1} row ${i + 1} failed; cells:`, cells);
          const emergencyStudent = this.lastResortStudentExtraction(row, students.length + 1);
          if (emergencyStudent) students.push(emergencyStudent);
        }
      }
    }

    console.log(`📊 Extracted ${students.length} students before validation`);
    const validatedStudents = this.validateAndFixAlignment(students, detectedMarkTypes);
    console.log(`📊 Final validated students: ${validatedStudents.length}`);
    return validatedStudents.length ? validatedStudents : students;
  }

  /**
   * Find the header row that contains column titles
   */
  private findHeaderRow(lines: string[]): number {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      // Check first 10 lines
      const line = lines[i];
      if (this.isHeaderRow(line)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if a line is a header row
   */
  private isHeaderRow(line: string): boolean {
    const headerKeywords = [
      "اسم",
      "الاسم",
      "التلميذ",
      "الفرض",
      "الأنشطة",
      "رقم",
      "الرقم",
      "fard",
      "activities",
      "name",
      "number",
    ];

    const hasHeaderKeyword = headerKeywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase()));

    // Header should also contain some separators or multiple words
    const hasMultipleParts = line.split(/\s+/).length >= 2;

    return hasHeaderKeyword && hasMultipleParts;
  }

  /**
   * Extract column structure from header row
   */
  private extractColumnStructure(headerRow: string): string[] {
    // Split by common separators and clean up
    const columns = headerRow
      .split(/[\s\t|،]+/) // Split by spaces, tabs, pipes, or Arabic commas
      .map((col) => col.trim())
      .filter((col) => col.length > 0);

    return columns;
  }

  /**
   * Extract student data from a single row
   */
  private extractStudentFromRow(
    row: string,
    columnStructure: string[],
    detectedMarkTypes: DetectedMarkTypes,
    studentNumber: number
  ): Student | null {
    // Split row by the same separators as header
    const cells = row
      .split(/[\s\t|،]+/)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells.length < 2) return null; // Need at least number and name

    // First cell is usually the student number
    const studentNumberCell = cells[0];

    // Find the name (usually the second cell, but could vary)
    let nameCell = cells[1];
    if (this.isNumeric(studentNumberCell) && cells.length > 1) {
      nameCell = cells[1];
    } else if (!this.isNumeric(studentNumberCell)) {
      nameCell = studentNumberCell; // First cell is the name
    }

    // Validate that we have a name
    if (!nameCell || !/[\u0600-\u06FF]{2,}/.test(nameCell)) {
      return null;
    }

    // Extract marks based on column structure
    const marks = this.extractMarksFromCells(cells, columnStructure, detectedMarkTypes);

    return {
      number: studentNumber,
      name: nameCell.replace(/[:؛]$/, "").trim(),
      marks,
    };
  }

  /**
   * Extract marks from row cells based on column structure
   */
  private extractMarksFromCells(
    cells: string[],
    columnStructure: string[],
    detectedMarkTypes: DetectedMarkTypes
  ): Student["marks"] {
    const marks: Student["marks"] = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };

    // Map column structure to mark types
    const columnToMarkType: Record<string, keyof Student["marks"]> = {
      "الفرض 1": "fard1",
      "الفرض 2": "fard2",
      "الفرض 3": "fard3",
      "الفرض 4": "fard4",
      الأنشطة: "activities",
      "fard 1": "fard1",
      "fard 2": "fard2",
      "fard 3": "fard3",
      "fard 4": "fard4",
      activities: "activities",
    };

    // Find marks in cells based on column structure
    for (let i = 0; i < Math.min(cells.length, columnStructure.length); i++) {
      const columnTitle = columnStructure[i];
      const cellValue = cells[i];

      if (!cellValue) continue;

      // Check if this column corresponds to a mark type
      const markType = columnToMarkType[columnTitle];
      if (markType && typeof markType === "string") {
        const hasMarkTypeKey = `has${markType.charAt(0).toUpperCase() + markType.slice(1)}` as keyof DetectedMarkTypes;
        if (detectedMarkTypes[hasMarkTypeKey]) {
          const markValue = this.parseMarkValue(cellValue);
          if (markValue !== null) {
            marks[markType] = markValue;
            console.log(`📊 Found ${markType} mark: ${cellValue} -> ${markValue}`);
          }
        }
      }
    }

    // If no structured marks found, try to find marks in any numeric cells
    if (Object.values(marks).every((mark) => mark === null)) {
      this.extractMarksFromUnstructuredCells(cells, marks, detectedMarkTypes);
    }

    return marks;
  }

  /**
   * Extract marks from unstructured cells when column mapping fails
   */
  private extractMarksFromUnstructuredCells(
    cells: string[],
    marks: Student["marks"],
    detectedMarkTypes: DetectedMarkTypes,
    probableNameIndex?: number
  ): void {
    const numericCellsAll = cells.map((cell, idx) => ({ cell, idx })).filter(({ cell }) => this.isNumeric(cell));
    if (numericCellsAll.length === 0) return;

    const filteredAfterName =
      typeof probableNameIndex === "number"
        ? numericCellsAll.filter((x) => x.idx > probableNameIndex)
        : numericCellsAll;
    const numericCells = (filteredAfterName.length ? filteredAfterName : numericCellsAll).map((x) => x.cell);

    if (numericCells.length === 0) return;

    let markIndex = 0;

    if (detectedMarkTypes.hasFard1 && markIndex < numericCells.length) {
      marks.fard1 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasFard2 && markIndex < numericCells.length) {
      marks.fard2 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasFard3 && markIndex < numericCells.length) {
      marks.fard3 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasFard4 && markIndex < numericCells.length) {
      marks.fard4 = this.parseMarkValue(numericCells[markIndex++]);
    }
    if (detectedMarkTypes.hasActivities && markIndex < numericCells.length) {
      marks.activities = this.parseMarkValue(numericCells[markIndex++]);
    }
  }

  /**
   * Check if a string is numeric (could be a mark)
   */
  private isNumeric(str: string): boolean {
    if (!str) return false;
    return this.parseMarkValue(str) !== null;
  }

  /**
   * Check if a row is a summary row (should be skipped) - IMPROVED VERSION (More Precise)
   */
  private isSummaryRow(row: string): boolean {
    const summaryKeywords = ["المجموع", "المعدل", "total", "average", "sum", "إجمالي", "الإجمالي"];

    // IMPROVED: Much more specific check - must be a clear summary row
    const lowerRow = row.toLowerCase().trim();

    // Only skip if the row STARTS with a summary keyword or is very short and contains only the keyword
    return summaryKeywords.some((keyword) => {
      const keywordLower = keyword.toLowerCase();
      return (
        lowerRow.startsWith(keywordLower) ||
        lowerRow === keywordLower ||
        (row.length < 20 && lowerRow.includes(keywordLower) && !this.containsArabicName(row))
      );
    });
  }

  /**
   * Check if a row contains what looks like an Arabic name - NEW HELPER METHOD
   */
  private containsArabicName(row: string): boolean {
    // Look for sequences of Arabic characters that could be names
    const arabicSequences = row.match(/[\u0600-\u06FF]{3,}/g);
    if (!arabicSequences) return false;

    // If we find Arabic sequences that aren't just summary keywords, it's likely a name
    const summaryKeywords = ["المجموع", "المعدل", "إجمالي", "الإجمالي"];
    return arabicSequences.some((seq) => !summaryKeywords.some((keyword) => seq.includes(keyword)));
  }

  /**
   * Last resort student extraction when all other methods fail - NEW METHOD
   */
  private lastResortStudentExtraction(row: string, studentNumber: number): Student | null {
    console.log(`🆘 Last resort extraction for row ${studentNumber}: "${row}"`);

    // Remove any leading student number
    let workingRow = row.replace(/^\s*\d+\s*/, "").trim();

    // If the row is too short, skip it
    if (workingRow.length < 2) {
      console.log(`🆘 Row too short after cleaning: "${workingRow}"`);
      return null;
    }

    // Try to find ANY text that could be a name
    let extractedName = "";

    // Method 1: Look for Arabic text
    const arabicMatch = workingRow.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/);
    if (arabicMatch) {
      extractedName = arabicMatch[0].trim();
    }

    // Method 2: If no Arabic, look for Latin letters
    if (!extractedName) {
      const latinMatch = workingRow.match(/[A-Za-z]+(?:\s+[A-Za-z]+)*/);
      if (latinMatch) {
        extractedName = latinMatch[0].trim();
      }
    }

    // Method 3: Take the first non-numeric word
    if (!extractedName) {
      const words = workingRow.split(/\s+/);
      for (const word of words) {
        if (word.length > 1 && !/^\d+([.,]\d+)?$/.test(word) && !/^[.,|]+$/.test(word)) {
          extractedName = word.trim();
          break;
        }
      }
    }

    // If we still don't have a name, use a placeholder based on row content
    if (!extractedName || extractedName.length === 0) {
      // Create a meaningful placeholder name
      const cleanRow = workingRow.replace(/[^\u0600-\u06FF\u0041-\u005A\u0061-\u007A\s]/g, "").trim();
      if (cleanRow.length > 0) {
        extractedName = cleanRow.substring(0, Math.min(20, cleanRow.length));
      } else {
        extractedName = `Student_${studentNumber}`;
      }
      console.log(`🆘 Using placeholder name: "${extractedName}" for row: "${row}"`);
    }

    // Extract any numeric values that could be marks
    const numbers = workingRow.match(/\d+(?:[.,]\d+)?/g) || [];
    const marks: Student["marks"] = {
      fard1: null,
      fard2: null,
      fard3: null,
      fard4: null,
      activities: null,
    };
    const flags: StudentUncertainty["marks"] = {
      fard1: false,
      fard2: false,
      fard3: false,
      fard4: false,
      activities: false,
    };

    // Assign numbers to marks in order
    const markKeys: (keyof Student["marks"])[] = ["fard1", "fard2", "fard3", "activities"];
    for (let i = 0; i < Math.min(numbers.length, markKeys.length); i++) {
      const numValue = parseFloat(numbers[i].replace(",", "."));
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 20) {
        const key = markKeys[i];
        marks[key] = numValue;
        flags[key] = true;
      }
    }

    const student: Student = {
      number: studentNumber,
      name: extractedName,
      marks: marks,
      uncertain: { name: true, marks: flags },
    };

    console.log(`🆘 Last resort extraction created:`, student);
    return student;
  }

  /**
   * Fallback extraction method when structured extraction fails
   */
  private fallbackExtraction(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    console.log("🔄 Using fallback extraction method");

    const students: Student[] = [];
    const allNames: string[] = [];
    const allMarks: string[] = [];

    // Collect names and marks
    for (const line of lines) {
      if (!line || line.length === 0) continue;

      // Skip headers and special markers
      if (this.isHeaderRow(line) || this.isSummaryRow(line)) {
        continue;
      }

      // Check if it's a mark
      if (this.isNumeric(line)) {
        const cleanedMark = this.preprocessMark(line);
        if (cleanedMark !== null) {
          allMarks.push(cleanedMark);
        }
      }
      // Check if it's an Arabic name
      else if (/[\u0600-\u06FF]{2,}/.test(line)) {
        const cleanedName = line.replace(/[:؛]$/, "").trim();
        allNames.push(cleanedName);
      }
    }

    // Create students
    for (let i = 0; i < allNames.length; i++) {
      const markValue = i < allMarks.length ? this.parseMarkValue(allMarks[i]) : null;

      students.push({
        number: i + 1,
        name: allNames[i],
        marks: {
          fard1: detectedMarkTypes.hasFard1 ? markValue : null,
          fard2: detectedMarkTypes.hasFard2 ? markValue : null,
          fard3: detectedMarkTypes.hasFard3 ? markValue : null,
          fard4: detectedMarkTypes.hasFard4 ? markValue : null,
          activities: detectedMarkTypes.hasActivities ? markValue : null,
        },
      });
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

    // Normalize Arabic punctuation and common OCR mistakes
    cleaned = cleaned
      .replace(/،/g, ",") // Arabic comma
      .replace(/[٫﹒·]/g, ".") // Arabic decimal dot and similar
      .replace(/[oO]/g, "0"); // OCR: O -> 0

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

    const pre = this.preprocessMark(mark) ?? mark;

    // Handle ratio formats like "14/20" or "7/10"
    const ratio = pre.match(/^(\d{1,2})\s*\/?\s*(?:out\s*of\s*)?(\d{1,2})$/i);
    if (ratio) {
      const num = parseInt(ratio[1], 10);
      const den = parseInt(ratio[2], 10);
      if (den > 0) {
        const normalizedTo20 = (num / den) * 20;
        if (normalizedTo20 >= 0 && normalizedTo20 <= 20) return Number(normalizedTo20.toFixed(2));
      }
    }

    const normalized = pre.replace(",", ".");
    const cleaned = normalized.replace(/[^\d.]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0 && num <= 20) {
      return Number(num.toFixed(2));
    }
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

  private normalizeNameForComparison(text: string): string {
    if (!text) return "";
    let s = text.toString();
    s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, "");
    s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");
    s = s.replace(/\u0640/g, "");
    s = s.normalize("NFKC");
    s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
    s = s
      .replace(/\u06CC/g, "\u064A")
      .replace(/\u06A9/g, "\u0643")
      .replace(/\u06C1/g, "\u0647");
    s = s
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي");
    s = s.replace(/[\uFEFB-\uFEFE]/g, "لا");
    s = s.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ");
    s = s.replace(/\s+/g, " ").trim().toLowerCase();
    return s;
  }

  private getProbableNameCellIndex(cells: string[]): number {
    let bestIndex = -1;
    let bestScore = -1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i] || "";
      const arabicOnly = c.replace(/[^\u0600-\u06FF\s]/g, "").trim();
      const score = arabicOnly.length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  private postProcessStudents(students: Student[], _detectedMarkTypes: DetectedMarkTypes): Student[] {
    void _detectedMarkTypes;
    const byKey = new Map<string, Student>();
    const order: string[] = [];
    for (const s of students) {
      const key = this.normalizeNameForComparison(s.name);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, { ...s });
        order.push(key);
      } else {
        const existing = byKey.get(key)!;
        byKey.set(key, {
          ...existing,
          marks: {
            fard1: existing.marks.fard1 ?? s.marks.fard1 ?? null,
            fard2: existing.marks.fard2 ?? s.marks.fard2 ?? null,
            fard3: existing.marks.fard3 ?? s.marks.fard3 ?? null,
            fard4: existing.marks.fard4 ?? s.marks.fard4 ?? null,
            activities: existing.marks.activities ?? s.marks.activities ?? null,
          },
        });
      }
    }
    return order.map((k, idx) => ({ ...byKey.get(k)!, number: idx + 1 }));
  }

  /**
   * Validate image file type and size
   */
  private isValidImageFile(file: File): boolean {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const maxSize = 10 * 1024 * 1024; // 10MB limit

    if (!validTypes.includes(file.type.toLowerCase())) {
      console.error(`Invalid file type: ${file.type}`);
      return false;
    }

    if (file.size > maxSize) {
      console.error(`File too large: ${file.size} bytes (max: ${maxSize})`);
      return false;
    }

    return true;
  }

  /**
   * Convert file to base64 string with error handling
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        console.log(`📷 Image converted to base64: ${(result.length / 1024).toFixed(1)} KB`);
        resolve(result);
      };

      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(new Error("فشل في قراءة ملف الصورة"));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert file to base64 and opportunistically downscale to speed up OCR without losing precision
   * - Keeps width up to 2000px to preserve numbers/names clarity but reduces huge photos
   * - Uses JPEG at 0.9 quality for balanced size/quality
   */
  private async fileToOptimizedBase64(file: File): Promise<string> {
    // Fast path for small files
    if (file.size <= 1.5 * 1024 * 1024) {
      return this.fileToBase64(file);
    }

    // Draw into canvas to downscale
    const imgDataUrl = await this.fileToBase64(file);
    const img = (await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = imgDataUrl;
    })) as any;

    const maxWidth = 2000;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imgDataUrl;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img as any, 0, 0, targetW, targetH);

    // Use original mime if supported, otherwise JPEG
    const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
    const optimized = canvas.toDataURL(mime, 0.9);
    return optimized;
  }
}

export default new GeminiOCRService();
