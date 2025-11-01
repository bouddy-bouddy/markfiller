/* global File */

import { Student, DetectedMarkTypes } from "../../types";
import { ExtractionError, GeminiAPIError, JSONParseError } from "./errors";
import { logger } from "./logger";
import { imageProcessor } from "./imageProcessor";
import { geminiApiClient } from "./apiClient";
import { dataExtractor } from "./dataExtractor";

/**
 * Gemini OCR Service - Main Orchestrator
 * Coordinates all OCR operations using specialized modules
 */

class GeminiOCRService {
  /**
   * Main method to process an image and extract student marks
   */
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    const startTime = Date.now();

    try {
      // Validate image file
      if (!imageProcessor.isValidImageFile(imageFile)) {
        throw new ExtractionError("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
      }

      logger.info("🚀 STARTING ENHANCED GEMINI PRO OCR PROCESSING");
      logger.info("📸 Image file details:", {
        name: imageFile.name,
        size: `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`,
        type: imageFile.type,
        lastModified: new Date(imageFile.lastModified).toISOString(),
      });

      // Convert image to base64 with optimization
      const base64Image = await imageProcessor.fileToOptimizedBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      // Run structured and text extraction in parallel
      logger.info("🚀 Launching parallel OCR extractions (structured + text)…");
      const structuredPromise = geminiApiClient.callStructuredAPI(base64Content, imageFile.type || "image/jpeg");
      const textPromise = geminiApiClient.callTextExtractionAPI(base64Content);

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
        logger.success("Structured extraction completed successfully");
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
        logger.debug("Structured extraction found:", {
          students: structuredStudents.length,
          markTypes: structuredDetected,
        });
      } else {
        logger.warn("Structured extraction failed:", structuredOutcome.reason);
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
        logger.success("Text extraction completed successfully");
        try {
          const extracted = dataExtractor.extractStudentData(textOutcome.value.text);
          textStudents = extracted.students;
          textDetected = extracted.detectedMarkTypes;
          logger.debug("Text extraction found:", {
            students: textStudents.length,
            markTypes: textDetected,
          });
        } catch (extractError) {
          logger.warn("Text extraction parsing failed:", extractError);
        }
      } else {
        logger.warn(
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
        logger.info("Merging structured and text extraction results…");
        students = dataExtractor.mergeStudentsByName(structuredStudents, textStudents);
        logger.success(`Merged results: ${students.length} students`);
      }

      if (students.length === 0) {
        throw new ExtractionError("لم يتم العثور على أي بيانات طلاب في الصورة");
      }

      const postProcessed = dataExtractor.postProcessStudents(students, detectedMarkTypes);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.success(`✨ Processing complete in ${elapsed}s: ${postProcessed.length} students extracted`);

      return { students: postProcessed, detectedMarkTypes };
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`Processing failed after ${elapsed}s:`, error);

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
   * Fast path: single structured Gemini Pro call with text fallback for merging
   */
  async processImageFast(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    const startTime = Date.now();

    try {
      if (!imageProcessor.isValidImageFile(imageFile)) {
        throw new ExtractionError("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
      }

      logger.info("🚀 STARTING FAST OCR PROCESSING");

      // Use optimized base64
      const base64Image = await imageProcessor.fileToOptimizedBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      let structuredResult: { students: any[]; markTypes: any };
      const textPromise = geminiApiClient.callTextExtractionAPI(base64Content);

      try {
        structuredResult = await geminiApiClient.callStructuredAPI(base64Content, imageFile.type || "image/jpeg");
      } catch (e) {
        logger.warn("Structured parse failed, falling back to text extraction once.", e);
        const response = await textPromise.catch(() => null as any);
        if (!response || !response.text) {
          throw new ExtractionError("لم يتم التعرف على أي نص في الصورة");
        }
        const fallback = dataExtractor.extractStudentData(response.text);
        const postProcessed = dataExtractor.postProcessStudents(fallback.students, fallback.detectedMarkTypes);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.success(`✨ Fast processing complete (fallback) in ${elapsed}s: ${postProcessed.length} students`);
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

      // Try to merge with text extraction
      try {
        const response = await textPromise;
        if (response && response.text) {
          const fallback = dataExtractor.extractStudentData(response.text);

          const mergedStudents = dataExtractor.mergeStudentsByName(students, fallback.students);
          const mergedDetected: DetectedMarkTypes = {
            hasFard1: detectedMarkTypes.hasFard1 || fallback.detectedMarkTypes.hasFard1,
            hasFard2: detectedMarkTypes.hasFard2 || fallback.detectedMarkTypes.hasFard2,
            hasFard3: detectedMarkTypes.hasFard3 || fallback.detectedMarkTypes.hasFard3,
            hasFard4: detectedMarkTypes.hasFard4 || fallback.detectedMarkTypes.hasFard4,
            hasActivities: detectedMarkTypes.hasActivities || fallback.detectedMarkTypes.hasActivities,
          };

          logger.info("🤝 Hybrid OCR merge complete:", {
            structuredCount: students.length,
            fallbackCount: fallback.students.length,
            mergedCount: mergedStudents.length,
          });

          const postProcessed = dataExtractor.postProcessStudents(mergedStudents, mergedDetected);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.success(`✨ Fast processing complete (merged) in ${elapsed}s: ${postProcessed.length} students`);
          return { students: postProcessed, detectedMarkTypes: mergedDetected };
        }
      } catch (mergeError) {
        logger.warn("Hybrid merge step failed; returning structured results only.", mergeError);
      }

      const postProcessed = dataExtractor.postProcessStudents(students, detectedMarkTypes);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.success(`✨ Fast processing complete in ${elapsed}s: ${postProcessed.length} students`);
      return { students: postProcessed, detectedMarkTypes };
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`Fast processing failed after ${elapsed}s:`, error);

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
}

export default new GeminiOCRService();
