/* global fetch, File, FileReader, console, process, Image, document, setTimeout, createImageBitmap, OffscreenCanvas */
import { Student, DetectedMarkTypes, StudentUncertainty } from "../types";
import { normalizeArabicText, normalizeArabicNumber, isValidStudentName } from "../utils/arabicTextUtils";
import { MARK_TYPE_REGEX } from "../constants/markTypes";

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

/** Retry configuration for API calls */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
} as const;

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

class GeminiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public originalError?: any
  ) {
    super(message);
    this.name = "GeminiAPIError";
  }
}

class JSONParseError extends Error {
  constructor(
    message: string,
    public rawContent?: string
  ) {
    super(message);
    this.name = "JSONParseError";
  }
}

class ExtractionError extends Error {
  constructor(
    message: string,
    public context?: any
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Exponential backoff utility */
async function exponentialBackoff(attempt: number, config = RETRY_CONFIG): Promise<void> {
  const delay = Math.min(config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt), config.maxDelayMs);
  const jitter = Math.random() * 0.3 * delay; // Add 0-30% jitter
  await new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

/** Check if an error is retryable */
function isRetryableError(error: any, statusCode?: number): boolean {
  if (statusCode) {
    const retryableStatuses: readonly number[] = RETRY_CONFIG.retryableStatusCodes;
    if (retryableStatuses.includes(statusCode)) {
      return true;
    }
  }
  if (error instanceof GeminiAPIError && error.retryable) {
    return true;
  }
  // Network errors are typically retryable
  if (error.name === "NetworkError" || error.message?.includes("network")) {
    return true;
  }
  return false;
}

/** Enhanced logging utility */
class Logger {
  private static prefix = "🔍 [GeminiOCR]";

  static info(message: string, data?: any): void {
    console.log(`${this.prefix} ${message}`, data !== undefined ? data : "");
  }

  static warn(message: string, data?: any): void {
    console.warn(`${this.prefix} ⚠️ ${message}`, data !== undefined ? data : "");
  }

  static error(message: string, error?: any): void {
    console.error(`${this.prefix} ❌ ${message}`, error !== undefined ? error : "");
  }

  static success(message: string, data?: any): void {
    console.log(`${this.prefix} ✅ ${message}`, data !== undefined ? data : "");
  }

  static debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === "development") {
      console.log(`${this.prefix} 🐛 ${message}`, data !== undefined ? data : "");
    }
  }
}

// ============================================================================
// JSON PARSING UTILITIES
// ============================================================================

class JSONParser {
  /**
   * Parse JSON with multiple fallback strategies
   */
  static parseRobust(text: string): any | null {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Strategy 1: Direct parse
    const direct = this.tryDirectParse(text);
    if (direct) return direct;

    // Strategy 2: Strip markdown code fences
    const withoutFences = this.tryParseWithoutCodeFences(text);
    if (withoutFences) return withoutFences;

    // Strategy 3: Extract JSON block from mixed content
    const extracted = this.tryExtractJSONBlock(text);
    if (extracted) return extracted;

    // Strategy 4: Fix common JSON errors
    const fixed = this.tryParseWithCommonFixes(text);
    if (fixed) return fixed;

    return null;
  }

  private static tryDirectParse(text: string): any | null {
    try {
      return JSON.parse(text.trim());
    } catch {
      return null;
    }
  }

  private static tryParseWithoutCodeFences(text: string): any | null {
    try {
      let cleaned = text.trim();
      // Remove ```json ... ``` or ``` ... ```
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
      cleaned = cleaned.replace(/\n?```\s*$/, "");
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  private static tryExtractJSONBlock(text: string): any | null {
    try {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return null;
      }

      const candidate = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  private static tryParseWithCommonFixes(text: string): any | null {
    try {
      let fixed = text.trim();

      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

      // Fix single quotes to double quotes (risky but sometimes necessary)
      if (!fixed.includes('"') && fixed.includes("'")) {
        fixed = fixed.replace(/'/g, '"');
      }

      // Try parsing after fixes
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }

  /**
   * Validate parsed JSON structure for student data
   */
  static validateStructuredResponse(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Response is not an object" };
    }

    if (!data.students || !Array.isArray(data.students)) {
      return { valid: false, error: "Missing or invalid 'students' array" };
    }

    if (!data.markTypes || typeof data.markTypes !== "object") {
      return { valid: false, error: "Missing or invalid 'markTypes' object" };
    }

    // Validate at least one student
    if (data.students.length === 0) {
      return { valid: false, error: "No students found in response" };
    }

    // Validate student structure
    for (let i = 0; i < Math.min(data.students.length, 3); i++) {
      const student = data.students[i];
      if (!student.name || typeof student.name !== "string") {
        return { valid: false, error: `Student at index ${i} missing valid name` };
      }
      if (!student.marks || typeof student.marks !== "object") {
        return { valid: false, error: `Student at index ${i} missing marks object` };
      }
    }

    return { valid: true };
  }
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class GeminiOCRService {
  private geminiApiKey: string;
  // Configurable model and endpoint fallbacks
  private getModelCandidates(): string[] {
    const envModel = (process.env.GEMINI_MODEL || "").trim();
    const defaults = [
      // Prefer the latest Pro family first (newest to oldest)
      "gemini-2.5-pro-latest",
      "gemini-2.5-pro",
      "gemini-2.0-pro-latest",
      "gemini-2.0-pro",
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
      // Secondary fallbacks
      "gemini-2.5-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      // Vision legacy
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
  // Micro-caches and precompiled helpers to reduce hot-path allocations
  private cacheNormalizeNameForComparison: Map<string, string> = new Map();
  private cachePreprocessMark: Map<string, string | null> = new Map();
  private ratioPattern: RegExp = /^(\d{1,2})\s*\/?\s*(?:out\s*of\s*)?(\d{1,2})$/i;

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
    const normalize = (s: string) => normalizeArabicText(s);

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
    const startTime = Date.now();

    try {
      // Validate image file
      if (!this.isValidImageFile(imageFile)) {
        throw new ExtractionError("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
      }

      Logger.info("🚀 STARTING ENHANCED GEMINI PRO OCR PROCESSING");
      Logger.info("📸 Image file details:", {
        name: imageFile.name,
        size: `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`,
        type: imageFile.type,
        lastModified: new Date(imageFile.lastModified).toISOString(),
      });

      // Convert image to base64 with optimization (downscale/compress if large)
      const base64Image = await this.fileToOptimizedBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      if (!this.geminiApiKey) {
        throw new GeminiAPIError("Gemini API key not found. Please check your environment configuration.");
      }

      // Run structured and text extraction in parallel, then merge
      Logger.info("🚀 Launching parallel OCR extractions (structured + text)…");
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
        Logger.success("Structured extraction completed successfully");
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
        Logger.debug("Structured extraction found:", {
          students: structuredStudents.length,
          markTypes: structuredDetected,
        });
      } else {
        Logger.warn("Structured extraction failed:", structuredOutcome.reason);
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
        Logger.success("Text extraction completed successfully");
        try {
          const extracted = this.extractStudentData(textOutcome.value.text);
          textStudents = extracted.students;
          textDetected = extracted.detectedMarkTypes;
          Logger.debug("Text extraction found:", {
            students: textStudents.length,
            markTypes: textDetected,
          });
        } catch (extractError) {
          Logger.warn("Text extraction parsing failed:", extractError);
        }
      } else {
        Logger.warn(
          "Text extraction failed or empty:",
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
        Logger.info("Merging structured and text extraction results…");
        students = this.mergeStudentsByName(structuredStudents, textStudents);
        Logger.success(`Merged results: ${students.length} students`);
      }

      if (students.length === 0) {
        throw new ExtractionError("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      const postProcessed = this.postProcessStudents(students, detectedMarkTypes);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      Logger.success(`✨ Processing complete in ${elapsed}s: ${postProcessed.length} students extracted`);

      return { students: postProcessed, detectedMarkTypes };
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      Logger.error(`Processing failed after ${elapsed}s:`, error);

      // Convert specific errors to user-friendly messages
      if (error instanceof GeminiAPIError) {
        throw new Error(error.message);
      }
      if (error instanceof ExtractionError) {
        throw new Error(error.message);
      }
      if (error instanceof JSONParseError) {
        throw new Error("فشل تحليل نتيجة المعالجة. يرجى المحاولة مرة أخرى.");
      }

      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Fast path: single structured Gemini Pro call only (no text fallback)
   */
  async processImageFast(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    const startTime = Date.now();

    try {
      if (!this.isValidImageFile(imageFile)) {
        throw new ExtractionError("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
      }

      Logger.info("🚀 STARTING FAST OCR PROCESSING");

      // Use optimized base64 to reduce payload where possible
      const base64Image = await this.fileToOptimizedBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      let structuredResult: { students: any[]; markTypes: any };
      // Kick off a text extraction concurrently; merge behavior remains unchanged
      const textPromise = this.callGeminiAPI(base64Content);

      try {
        structuredResult = await this.callGeminiAPIStructured(base64Content, imageFile.type || "image/jpeg");
      } catch (e) {
        Logger.warn("Structured parse failed, falling back to text extraction once.", e);
        const response = await textPromise.catch(() => null as any);
        if (!response || !response.text) {
          throw new ExtractionError("لم يتم التعرف على أي نص في الصورة");
        }
        const fallback = this.extractStudentData(response.text);
        const postProcessed = this.postProcessStudents(fallback.students, fallback.detectedMarkTypes);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        Logger.success(`✨ Fast processing complete (fallback) in ${elapsed}s: ${postProcessed.length} students`);
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

      if (!students.length) {
        throw new ExtractionError("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      // Always run a secondary text extraction and merge to avoid partial results
      try {
        const response = await textPromise;
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

          Logger.info("🤝 Hybrid OCR merge complete:", {
            structuredCount: students.length,
            fallbackCount: fallback.students.length,
            mergedCount: mergedStudents.length,
          });

          const postProcessed = this.postProcessStudents(mergedStudents, mergedDetected);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          Logger.success(`✨ Fast processing complete (merged) in ${elapsed}s: ${postProcessed.length} students`);
          return { students: postProcessed, detectedMarkTypes: mergedDetected };
        }
      } catch (mergeError) {
        Logger.warn("Hybrid merge step failed; returning structured results only.", mergeError);
      }

      const postProcessed = this.postProcessStudents(students, detectedMarkTypes);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      Logger.success(`✨ Fast processing complete in ${elapsed}s: ${postProcessed.length} students`);
      return { students: postProcessed, detectedMarkTypes };
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      Logger.error(`Fast processing failed after ${elapsed}s:`, error);

      // Convert specific errors to user-friendly messages
      if (error instanceof GeminiAPIError) {
        throw new Error(error.message);
      }
      if (error instanceof ExtractionError) {
        throw new Error(error.message);
      }
      if (error instanceof JSONParseError) {
        throw new Error("فشل تحليل نتيجة المعالجة. يرجى المحاولة مرة أخرى.");
      }

      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Call Gemini API with structured JSON output for precise data extraction
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

    try {
      const { data, model, base } = await this.generateContentWithFallback(requestBody);
      Logger.info(`Using Gemini model: ${model} via ${base}`);

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new GeminiAPIError("Invalid response from Gemini API - missing candidates or content");
      }

      // Collect all text parts
      const parts = data.candidates[0].content.parts || [];
      const texts: string[] = parts
        .map((p: any) => (typeof p.text === "string" ? p.text : ""))
        .filter((t: string) => t && t.length > 0);

      if (texts.length === 0) {
        throw new GeminiAPIError("No text content in API response");
      }

      const combinedText = texts.join("\n\n");
      Logger.debug("Raw API response text:", combinedText.substring(0, 500));

      // Try robust JSON parsing with the new parser
      const parsed = JSONParser.parseRobust(combinedText);
      if (parsed) {
        // Validate the parsed structure
        const validation = JSONParser.validateStructuredResponse(parsed);
        if (validation.valid) {
          Logger.success(`Successfully parsed structured response with ${parsed.students.length} students`);
          return parsed;
        } else {
          Logger.warn(`Parsed JSON but validation failed: ${validation.error}`);
        }
      }

      // If combined text failed, try individual parts
      for (let i = 0; i < texts.length; i++) {
        const partParsed = JSONParser.parseRobust(texts[i]);
        if (partParsed) {
          const validation = JSONParser.validateStructuredResponse(partParsed);
          if (validation.valid) {
            Logger.success(`Successfully parsed from part ${i + 1}/${texts.length}`);
            return partParsed;
          }
        }
      }

      throw new JSONParseError("Failed to parse structured response after all attempts", combinedText);
    } catch (error) {
      if (error instanceof GeminiAPIError || error instanceof JSONParseError) {
        throw error;
      }
      Logger.error("Unexpected error in callGeminiAPIStructured:", error);
      throw new GeminiAPIError("Failed to process structured API request", undefined, false, error);
    }
  }

  /**
   * Call Gemini API with optimized prompt for student marks sheets
   */
  private async callGeminiAPI(base64Image: string): Promise<{ text: string }> {
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

    try {
      const { data, model, base } = await this.generateContentWithFallback(requestBody);
      Logger.info(`Using Gemini model: ${model} via ${base}`);
      Logger.debug("GEMINI API - COMPLETE RAW RESPONSE:", JSON.stringify(data, null, 2));

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new GeminiAPIError("استجابة غير صحيحة من خدمة Gemini - missing candidates or content");
      }

      const parts = data.candidates[0].content.parts;
      if (!parts || parts.length === 0 || !parts[0].text) {
        throw new GeminiAPIError("No text content in API response");
      }

      const text = parts[0].text;
      Logger.success(`Received text response: ${text.length} characters`);
      return { text };
    } catch (error) {
      if (error instanceof GeminiAPIError) {
        throw error;
      }
      Logger.error("Unexpected error in callGeminiAPI:", error);
      throw new GeminiAPIError("Failed to process text API request", undefined, false, error);
    }
  }

  /**
   * Generic sender with model and endpoint fallbacks + retry mechanism
   */
  private async generateContentWithFallback(requestBody: any): Promise<{ data: any; model: string; base: string }> {
    const tried: Array<{ model: string; base: string; status?: number; error?: any; attempt: number }> = [];

    for (const base of this.getApiBases()) {
      for (const model of this.getModelCandidates()) {
        const apiUrl = `${base}/models/${model}:generateContent`;

        // Try with retry mechanism
        let lastError: any = null;
        for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              Logger.info(`Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} for ${model}`);
              await exponentialBackoff(attempt - 1);
            }

            const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              Logger.warn(`API error (${response.status}):`, errorData);

              tried.push({ model, base, status: response.status, error: errorData, attempt });

              // Handle specific error codes
              if (response.status === 404 || response.status === 403) {
                // Model not available - try next model immediately
                Logger.warn(`Model ${model} not available (${response.status}), trying next model`);
                break; // Break retry loop, try next model
              }

              if (response.status === 400) {
                throw new GeminiAPIError(
                  "فشل الاتصال بخدمة Gemini: خطأ في طلب API. يرجى التحقق من الصورة.",
                  400,
                  false
                );
              }

              // Retryable errors (429, 500, 502, 503, 504)
              if (isRetryableError(null, response.status)) {
                if (attempt < RETRY_CONFIG.maxRetries) {
                  Logger.warn(`Retryable error ${response.status}, will retry...`);
                  lastError = new GeminiAPIError(`API returned ${response.status}`, response.status, true, errorData);
                  continue; // Retry this model
                } else {
                  // Max retries reached for this model
                  Logger.warn(`Max retries reached for ${model}, trying next model`);
                  break; // Try next model
                }
              }

              // Non-retryable error
              throw new GeminiAPIError(
                "فشل الاتصال بخدمة Gemini. يرجى المحاولة مرة أخرى.",
                response.status,
                false,
                errorData
              );
            }

            // Success!
            const data = await response.json();
            if (attempt > 0) {
              Logger.success(`Successfully connected after ${attempt} retry attempts`);
            }
            return { data, model, base };
          } catch (err) {
            lastError = err;

            // If it's a non-retryable GeminiAPIError, throw immediately
            if (err instanceof GeminiAPIError && !err.retryable) {
              throw err;
            }

            // Network or other retryable errors
            if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(err)) {
              Logger.warn(`Network error on attempt ${attempt + 1}, will retry...`, err);
              tried.push({ model, base, error: err, attempt });
              continue; // Retry
            }

            // Max retries reached or non-retryable error
            Logger.warn(`Request failed for ${model} via ${base}:`, err);
            tried.push({ model, base, error: err, attempt });
            break; // Try next model
          }
        }

        // If we got here, all retries failed for this model - continue to next model
        if (lastError) {
          Logger.warn(`All retry attempts failed for ${model}, trying next model`);
        }
      }
    }

    // All models and bases failed
    const attempted = tried
      .map((t) => `${t.base?.includes("/v1") ? "v1" : "v1beta"}/${t.model} (${t.attempt + 1} attempts)`)
      .join(", ");

    Logger.error("All API attempts exhausted", { attemptCount: tried.length, attempted });

    throw new GeminiAPIError(
      `فشل الاتصال بخدمة Gemini: لم يتم العثور على نموذج متاح لهذا المشروع أو لا يوجد وصول. تأكد من صحة مفتاح API وتمكين خدمة Generative Language API. (تمت المحاولة: ${attempted})`,
      undefined,
      false
    );
  }

  /**
   * Extract student data from the OCR text with enhanced error handling
   */
  private extractStudentData(text: string): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    try {
      Logger.info("🔄 Extracting student data from Gemini OCR text...");

      if (!text || text.trim().length === 0) {
        throw new ExtractionError("Empty OCR text received");
      }

      const lines = text
        .split("\n")
        .map((line) => normalizeArabicNumber(line.trim()))
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        throw new ExtractionError("No valid lines found in OCR text");
      }

      Logger.debug(`Processing ${lines.length} lines of OCR text`);

      // Detect mark types from headers
      const detectedMarkTypes = this.detectMarkTypes(text);
      Logger.debug("Detected mark types:", detectedMarkTypes);

      // Extract students and marks
      const students = this.extractStudentsFromLines(lines, detectedMarkTypes);

      if (students.length === 0) {
        Logger.warn("No students extracted from text");
      } else {
        Logger.success(`✅ Total students extracted: ${students.length}`);
      }

      return { students, detectedMarkTypes };
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      Logger.error("Error in extractStudentData:", error);
      throw new ExtractionError("Failed to extract student data from OCR text", { originalError: error });
    }
  }

  /**
   * Detect which mark types are present in the document
   */
  private detectMarkTypes(text: string): DetectedMarkTypes {
    // Scan full text to avoid missing headers that appear later in multi-section documents
    return {
      hasFard1: MARK_TYPE_REGEX.fard1.test(text),
      hasFard2: MARK_TYPE_REGEX.fard2.test(text),
      hasFard3: MARK_TYPE_REGEX.fard3.test(text),
      hasFard4: MARK_TYPE_REGEX.fard4.test(text),
      hasActivities: MARK_TYPE_REGEX.activities.test(text),
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
        Logger.debug(`🚫 Skipping summary row: "${row}"`);
        return false;
      }

      // Skip header-like rows that might appear after the main header
      if (this.isAdvancedHeaderRow(row)) {
        Logger.debug(`🚫 Skipping header row: "${row}"`);
        return false;
      }

      // Must contain at least some Arabic text OR numbers (for student data)
      const hasArabicOrNumbers = /[\u0600-\u06FF]/.test(row) || /\d/.test(row);
      if (!hasArabicOrNumbers) {
        Logger.debug(`🚫 Skipping row without Arabic/numbers: "${row}"`);
        return false;
      }

      return true;
    });

    Logger.debug(`📊 Filtered ${filteredRows.length} data rows from ${dataRows.length} total rows`);
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
        Logger.debug(`🚨 Emergency name extraction successful: "${studentName}" from row: "${row}"`);
      }
    }

    // IMPROVED: Only return null if we absolutely cannot find any name
    if (!studentName) {
      Logger.debug(`⚠️ Could not extract any student name from row: "${row}"`);
      Logger.debug(`⚠️ Parsed cells were:`, cells);
      return null;
    }

    // Extract marks using the column mapping
    const { marks, flags } = this.extractMarksAdvanced(cells, headerAnalysis, detectedMarkTypes);
    let nameUncertain = false;
    if (!isValidStudentName(studentName)) {
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
      if (markLike.test(normalizeArabicNumber(seg))) {
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
    if (cells.length === 1 && !markLike.test(normalizeArabicNumber(cells[0]))) {
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
      if (isValidStudentName(name)) {
        return this.cleanStudentName(name);
      }
    }

    // Strategy 2: Find the longest Arabic text that's not a header
    let bestName = "";
    for (const cell of cells) {
      if (isValidStudentName(cell) && cell.length > bestName.length) {
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
        Logger.debug(`📝 Fallback name extraction: "${cell}" → "${cleaned}"`);
        return this.cleanStudentName(cell);
      }
    }

    // Strategy 5: IMPROVED - Ultra lenient: any cell with ANY Arabic character
    for (const cell of cells) {
      if (/[\u0600-\u06FF]/.test(cell) && !this.isStrictHeaderLike(cell)) {
        const cleaned = this.cleanStudentName(cell);
        if (cleaned.length > 0) {
          Logger.debug(`📝 Ultra-lenient name extraction: "${cell}" → "${cleaned}"`);
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
    Logger.debug(`🚨 Emergency name extraction for row: "${originalRow}"`);

    // Emergency Strategy 1: Look for any text that's not purely numeric
    for (const cell of cells) {
      if (cell && cell.trim().length > 0 && !/^\d+([.,]\d+)?$/.test(cell.trim())) {
        const cleaned = cell
          .trim()
          .replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "")
          .trim();
        if (cleaned.length >= 2) {
          Logger.debug(`🚨 Emergency extraction found: "${cleaned}" from cell: "${cell}"`);
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
        Logger.debug(`🚨 Emergency Arabic extraction: "${extracted}" from: "${workingText}"`);
        return extracted;
      }
    }

    // Emergency Strategy 3: Look for any sequence of letters (Arabic or Latin)
    const letterMatch = workingText.match(/[^\d\s.,|]+/);
    if (letterMatch) {
      const extracted = letterMatch[0].trim();
      if (extracted.length >= 2 && !/^[.,|]+$/.test(extracted)) {
        Logger.debug(`🚨 Emergency letter extraction: "${extracted}" from: "${workingText}"`);
        return extracted;
      }
    }

    // Emergency Strategy 4: Last resort - use the first meaningful part
    const parts = workingText.split(/\s+/).filter((p) => p.length > 1 && !/^\d+([.,]\d+)?$/.test(p));
    if (parts.length > 0) {
      const extracted = parts[0].replace(/[^\u0600-\u06FF\s\u0041-\u005A\u0061-\u007A]/g, "").trim();
      if (extracted.length >= 1) {
        Logger.debug(`🚨 Emergency part extraction: "${extracted}" from parts:`, parts);
        return extracted;
      }
    }

    Logger.debug(`🚨 Emergency extraction failed completely for: "${originalRow}"`);
    return null;
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
          Logger.debug(`📊 Found ${markType} mark: ${cells[columnIndex]} -> ${markValue}`);
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
    Logger.warn("🆘 Using emergency fallback extraction");
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

        Logger.debug(`🆘 Emergency extracted: ${studentName} with ${numbers.length} marks`);
      }
    }

    return students;
  }

  /**
   * Advanced fallback extraction when structured extraction fails
   */
  private advancedFallbackExtraction(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    Logger.info("🔄 Using advanced fallback extraction method");

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
    try {
      let students: Student[] = [];

      // Find all header sections and parse each one
      const headerAnalyses = this.analyzeAllHeaderSections(lines);
      if (headerAnalyses.length === 0) {
        Logger.warn("⚠️ No valid header structure found across the document, using advanced fallback");
        return this.advancedFallbackExtraction(lines, detectedMarkTypes);
      }

      Logger.info(`📋 Found ${headerAnalyses.length} header sections`);

      for (let s = 0; s < headerAnalyses.length; s++) {
        const headerAnalysis = headerAnalyses[s];
        const nextHeader = headerAnalyses[s + 1]?.headerRowIndex ?? lines.length;
        const dataRows = this.extractDataRowsInRange(lines, headerAnalysis.headerRowIndex, nextHeader);

        Logger.debug(`📊 Section ${s + 1}/${headerAnalyses.length} — rows: ${dataRows.length}`);

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          if (!row || row.trim().length === 0) continue;
          if (this.isSummaryRow(row)) continue;

          try {
            const student = this.extractStudentFromRowAdvanced(
              row,
              headerAnalysis,
              detectedMarkTypes,
              students.length + 1
            );
            if (student) {
              students.push(student);
            } else {
              const cells = this.parseRowIntoCells(row);
              Logger.debug(`⚠️ Section ${s + 1} row ${i + 1} failed; cells:`, cells);
              const emergencyStudent = this.lastResortStudentExtraction(row, students.length + 1);
              if (emergencyStudent) students.push(emergencyStudent);
            }
          } catch (rowError) {
            Logger.warn(`Error processing row ${i + 1} in section ${s + 1}:`, rowError);
            // Continue to next row
          }
        }
      }

      Logger.info(`📊 Extracted ${students.length} students before validation`);

      if (students.length > 0) {
        const validatedStudents = this.validateAndFixAlignment(students, detectedMarkTypes);
        Logger.info(`📊 Final validated students: ${validatedStudents.length}`);
        return validatedStudents.length ? validatedStudents : students;
      }

      return students;
    } catch (error) {
      Logger.error("Error in extractStudentsFromLines:", error);
      throw new ExtractionError("Failed to extract students from lines", { originalError: error });
    }
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
    Logger.debug(`🆘 Last resort extraction for row ${studentNumber}: "${row}"`);

    // Remove any leading student number
    let workingRow = row.replace(/^\s*\d+\s*/, "").trim();

    // If the row is too short, skip it
    if (workingRow.length < 2) {
      Logger.debug(`🆘 Row too short after cleaning: "${workingRow}"`);
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
      Logger.debug(`🆘 Using placeholder name: "${extractedName}" for row: "${row}"`);
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

    Logger.debug(`🆘 Last resort extraction created:`, student);
    return student;
  }

  /**
   * Fallback extraction method when structured extraction fails
   */
  private fallbackExtraction(lines: string[], detectedMarkTypes: DetectedMarkTypes): Student[] {
    Logger.info("🔄 Using fallback extraction method");

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
    const cached = this.cachePreprocessMark.get(mark);
    if (cached !== undefined) return cached;

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
      Logger.debug(`  Converted ${mark} to ${cleaned}`);
    }
    // Handle formats like "03100" -> "03,00"
    else if (/^\d{1}100$/.test(cleaned)) {
      cleaned = "0" + cleaned.substring(0, 1) + ",00";
      Logger.debug(`  Converted ${mark} to ${cleaned}`);
    }
    // Handle formats like "10100" -> "10,00"
    else if (/^\d{3}00$/.test(cleaned) && cleaned !== "10000") {
      const firstTwo = cleaned.substring(0, 2);
      const num = parseInt(firstTwo);
      if (num <= 20) {
        cleaned = firstTwo + ",00";
        Logger.debug(`  Converted ${mark} to ${cleaned}`);
      }
    }
    // Handle "108,00" which is likely "10,00" or "08,00"
    else if (cleaned === "108,00") {
      cleaned = "10,00"; // Most likely 10,00
      Logger.debug(`  Converted ${mark} to ${cleaned}`);
    }

    this.cachePreprocessMark.set(mark, cleaned);
    return cleaned;
  }

  /**
   * Parse mark value with better handling
   */
  private parseMarkValue(mark: string | null): number | null {
    if (!mark) return null;

    const pre = this.preprocessMark(mark) ?? mark;

    // Handle ratio formats like "14/20" or "7/10"
    const ratio = pre.match(this.ratioPattern);
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

  private normalizeNameForComparison(text: string): string {
    if (!text) return "";
    const cached = this.cacheNormalizeNameForComparison.get(text);
    if (cached !== undefined) return cached;
    const normalized = normalizeArabicText(text);
    this.cacheNormalizeNameForComparison.set(text, normalized);
    return normalized;
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

    const maxWidth = 2000;

    try {
      const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(file) : null;
      if (bitmap) {
        const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
        const targetW = Math.max(1, Math.round(bitmap.width * scale));
        const targetH = Math.max(1, Math.round(bitmap.height * scale));

        // @ts-ignore OffscreenCanvas may not be typed
        const off: any = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(targetW, targetH) : null;
        if (off) {
          const ctx = off.getContext("2d");
          if (ctx) {
            // @ts-ignore drawImage on OffscreenCanvasRenderingContext2D
            ctx.drawImage(bitmap as any, 0, 0, targetW, targetH);
            const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
            // @ts-ignore convertToBlob is available on OffscreenCanvas
            const blob = await off.convertToBlob({ type: mime, quality: 0.9 });
            return await new Promise<string>((resolve) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result as string);
              fr.readAsDataURL(blob);
            });
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx2 = canvas.getContext("2d");
        if (ctx2) {
          // @ts-ignore drawImage accepts ImageBitmap
          ctx2.drawImage(bitmap as any, 0, 0, targetW, targetH);
          const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
          return canvas.toDataURL(mime, 0.9);
        }
      }
    } catch (_e) {
      // Fallback below
    }

    // Draw into canvas to downscale
    const imgDataUrl = await this.fileToBase64(file);
    const img = (await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = imgDataUrl;
    })) as any;

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

    const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
    return canvas.toDataURL(mime, 0.9);
  }
}

export default new GeminiOCRService();
