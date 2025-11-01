/* global fetch */

import { RETRY_CONFIG, API_CONFIG, getModelCandidates, getApiBases, getApiKey } from "./config";
import { GeminiAPIError, JSONParseError, isRetryableError } from "./errors";
import { logger, exponentialBackoff } from "./logger";
import { JSONParser } from "./jsonParser";

/**
 * Gemini API Client
 * Handles all communication with the Gemini API including retries and fallbacks
 */

export class GeminiAPIClient {
  private geminiApiKey: string;

  constructor() {
    this.geminiApiKey = getApiKey();
    if (!this.geminiApiKey) {
      console.warn("GEMINI_API_KEY not found in environment variables");
    }
  }

  /**
   * Call Gemini API with structured JSON output for precise data extraction
   */
  async callStructuredAPI(
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
      safetySettings: API_CONFIG.safetySettings,
    };

    try {
      const { data, model, base } = await this.generateContentWithFallback(requestBody);
      logger.info(`Using Gemini model: ${model} via ${base}`);

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
      logger.debug("Raw API response text:", combinedText.substring(0, 500));

      // Try robust JSON parsing
      const parsed = JSONParser.parseRobust(combinedText);
      if (parsed) {
        const validation = JSONParser.validateStructuredResponse(parsed);
        if (validation.valid) {
          logger.success(`Successfully parsed structured response with ${parsed.students.length} students`);
          return parsed;
        } else {
          logger.warn(`Parsed JSON but validation failed: ${validation.error}`);
        }
      }

      // If combined text failed, try individual parts
      for (let i = 0; i < texts.length; i++) {
        const partParsed = JSONParser.parseRobust(texts[i]);
        if (partParsed) {
          const validation = JSONParser.validateStructuredResponse(partParsed);
          if (validation.valid) {
            logger.success(`Successfully parsed from part ${i + 1}/${texts.length}`);
            return partParsed;
          }
        }
      }

      throw new JSONParseError("Failed to parse structured response after all attempts", combinedText);
    } catch (error) {
      if (error instanceof GeminiAPIError || error instanceof JSONParseError) {
        throw error;
      }
      logger.error("Unexpected error in callStructuredAPI:", error);
      throw new GeminiAPIError("Failed to process structured API request", undefined, false, error);
    }
  }

  /**
   * Call Gemini API with optimized prompt for student marks sheets (text extraction)
   */
  async callTextExtractionAPI(base64Image: string): Promise<{ text: string }> {
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
            { text: prompt },
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
        temperature: 0.0,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 4096,
        candidateCount: 1,
      },
      safetySettings: API_CONFIG.safetySettings,
    } as const;

    try {
      const { data, model, base } = await this.generateContentWithFallback(requestBody);
      logger.info(`Using Gemini model: ${model} via ${base}`);
      logger.debug("GEMINI API - COMPLETE RAW RESPONSE:", JSON.stringify(data, null, 2));

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new GeminiAPIError("استجابة غير صحيحة من خدمة Gemini - missing candidates or content");
      }

      const parts = data.candidates[0].content.parts;
      if (!parts || parts.length === 0 || !parts[0].text) {
        throw new GeminiAPIError("No text content in API response");
      }

      const text = parts[0].text;
      logger.success(`Received text response: ${text.length} characters`);
      return { text };
    } catch (error) {
      if (error instanceof GeminiAPIError) {
        throw error;
      }
      logger.error("Unexpected error in callTextExtractionAPI:", error);
      throw new GeminiAPIError("Failed to process text API request", undefined, false, error);
    }
  }

  /**
   * Generic sender with model and endpoint fallbacks + retry mechanism
   */
  private async generateContentWithFallback(requestBody: any): Promise<{ data: any; model: string; base: string }> {
    const tried: Array<{ model: string; base: string; status?: number; error?: any; attempt: number }> = [];

    for (const base of getApiBases()) {
      for (const model of getModelCandidates()) {
        const apiUrl = `${base}/models/${model}:generateContent`;

        // Try with retry mechanism
        let lastError: any = null;
        for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              logger.info(`Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} for ${model}`);
              await exponentialBackoff(attempt - 1, RETRY_CONFIG);
            }

            const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              logger.warn(`API error (${response.status}):`, errorData);

              tried.push({ model, base, status: response.status, error: errorData, attempt });

              // Handle specific error codes
              if (response.status === 404 || response.status === 403) {
                logger.warn(`Model ${model} not available (${response.status}), trying next model`);
                break; // Break retry loop, try next model
              }

              if (response.status === 400) {
                throw new GeminiAPIError(
                  "فشل الاتصال بخدمة Gemini: خطأ في طلب API. يرجى التحقق من الصورة.",
                  400,
                  false
                );
              }

              // Retryable errors
              if (isRetryableError(null, response.status, RETRY_CONFIG.retryableStatusCodes)) {
                if (attempt < RETRY_CONFIG.maxRetries) {
                  logger.warn(`Retryable error ${response.status}, will retry...`);
                  lastError = new GeminiAPIError(`API returned ${response.status}`, response.status, true, errorData);
                  continue; // Retry this model
                } else {
                  logger.warn(`Max retries reached for ${model}, trying next model`);
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
              logger.success(`Successfully connected after ${attempt} retry attempts`);
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
              logger.warn(`Network error on attempt ${attempt + 1}, will retry...`, err);
              tried.push({ model, base, error: err, attempt });
              continue; // Retry
            }

            // Max retries reached or non-retryable error
            logger.warn(`Request failed for ${model} via ${base}:`, err);
            tried.push({ model, base, error: err, attempt });
            break; // Try next model
          }
        }

        // If we got here, all retries failed for this model - continue to next model
        if (lastError) {
          logger.warn(`All retry attempts failed for ${model}, trying next model`);
        }
      }
    }

    // All models and bases failed
    const attempted = tried
      .map((t) => `${t.base?.includes("/v1") ? "v1" : "v1beta"}/${t.model} (${t.attempt + 1} attempts)`)
      .join(", ");

    logger.error("All API attempts exhausted", { attemptCount: tried.length, attempted });

    throw new GeminiAPIError(
      `فشل الاتصال بخدمة Gemini: لم يتم العثور على نموذج متاح لهذا المشروع أو لا يوجد وصول. تأكد من صحة مفتاح API وتمكين خدمة Generative Language API. (تمت المحاولة: ${attempted})`,
      undefined,
      false
    );
  }
}

// Default instance
export const geminiApiClient = new GeminiAPIClient();

