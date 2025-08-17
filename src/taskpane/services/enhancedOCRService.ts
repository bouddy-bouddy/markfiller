/**
 * Enhanced OCR Service - Integrated Advanced Processing Pipeline
 *
 * This service combines all advanced OCR enhancements:
 * - Multi-pass processing with result fusion
 * - Image preprocessing and quality assessment
 * - Intelligent text post-processing
 * - Arabic text normalization
 * - Adaptive confidence thresholds
 * - Context-aware error correction
 */

import { Student, DetectedMarkTypes } from "../types";
import { multiPassOCRService, MultiPassResult } from "./multiPassOCRService";
import { adaptiveConfidenceService, AdaptiveContext } from "./adaptiveConfidenceService";
import { arabicTextNormalizer } from "./arabicTextNormalizer";
import { OCREdgeCasesHandler } from "./ocrEdgeCaseHandler";

// Import the existing OCR service as fallback
import ocrService from "./ocrService";

export interface EnhancedOCRResult {
  students: Student[];
  detectedMarkTypes: DetectedMarkTypes;
  confidence: number;
  processingStats: {
    totalTime: number;
    passesUsed: number;
    successfulPass: number;
    imageQuality: number;
    correctionsApplied: number;
    warningsGenerated: number;
  };
  qualityAssessment: {
    imageQuality: number;
    extractionReliability: number;
    dataCompleteness: number;
    overallScore: number;
  };
  recommendations: string[];
  warnings: string[];
  debugInfo?: {
    multiPassResult?: MultiPassResult;
    confidenceAssessment?: any;
    appliedCorrections?: any[];
  };
}

export interface ProcessingOptions {
  enableMultiPass: boolean;
  enablePreprocessing: boolean;
  enableIntelligentCorrections: boolean;
  enableArabicNormalization: boolean;
  criticalAccuracy: boolean;
  expectedStudentCount?: number;
  documentType?: "marks_sheet" | "report_card" | "exam_results" | "handwritten" | "printed";
  knownStudentNames?: string[];
  includeDebugInfo: boolean;
}

class EnhancedOCRService {
  private readonly defaultOptions: ProcessingOptions = {
    enableMultiPass: true,
    enablePreprocessing: true,
    enableIntelligentCorrections: true,
    enableArabicNormalization: true,
    criticalAccuracy: false,
    documentType: "marks_sheet",
    includeDebugInfo: false,
  };

  /**
   * Main enhanced OCR processing method
   */
  async processImage(imageFile: File, options: Partial<ProcessingOptions> = {}): Promise<EnhancedOCRResult> {
    const startTime = Date.now();
    const processingOptions = { ...this.defaultOptions, ...options };

    console.log("🚀 Starting Enhanced OCR Processing Pipeline...");
    console.log("📋 Processing Options:", processingOptions);

    try {
      // Step 1: Validate input
      this.validateInput(imageFile);

      // Step 2: Determine processing context
      const context = this.createProcessingContext(imageFile, processingOptions);
      console.log("🎯 Processing Context:", context);

      // Step 3: Calculate adaptive confidence thresholds
      const confidenceAssessment = adaptiveConfidenceService.calculateAdaptiveThresholds(context);
      console.log("📊 Adaptive Thresholds:", confidenceAssessment.thresholds);
      console.log("🎲 Recommended Strategy:", confidenceAssessment.recommendedStrategy);

      let result: EnhancedOCRResult;

      // Step 4: Choose processing strategy based on assessment
      if (processingOptions.enableMultiPass && confidenceAssessment.recommendedStrategy === "multi_pass") {
        result = await this.processWithMultiPass(imageFile, context, processingOptions);
      } else {
        result = await this.processWithSinglePass(imageFile, context, processingOptions);
      }

      // Step 5: Validate results against adaptive thresholds
      const validation = adaptiveConfidenceService.validateExtractionResults(
        result.students,
        result.detectedMarkTypes,
        result.confidence,
        context
      );

      if (!validation.isValid && validation.requiresRetry && processingOptions.enableMultiPass) {
        console.log("⚠️ Initial processing failed validation, attempting multi-pass retry...");
        result = await this.processWithMultiPass(imageFile, context, processingOptions);
      }

      // Step 6: Apply final enhancements and validations
      result = await this.applyFinalEnhancements(result, context, processingOptions);

      // Step 7: Generate quality assessment and recommendations
      result.qualityAssessment = this.generateQualityAssessment(result, context);
      result.recommendations = this.generateRecommendations(result, validation);

      // Add debug info if requested
      if (processingOptions.includeDebugInfo) {
        result.debugInfo = {
          confidenceAssessment,
          appliedCorrections: result.debugInfo?.appliedCorrections || [],
        };
      }

      const totalTime = Date.now() - startTime;
      result.processingStats.totalTime = totalTime;

      console.log(`✅ Enhanced OCR Processing Completed in ${totalTime}ms`);
      console.log(`📈 Final Quality Score: ${result.qualityAssessment.overallScore.toFixed(3)}`);
      console.log(
        `👥 Extracted ${result.students.length} students with ${result.processingStats.correctionsApplied} corrections`
      );

      return result;
    } catch (error) {
      console.error("❌ Enhanced OCR Processing Failed:", error);

      // Fallback to basic OCR service
      console.log("🔄 Attempting fallback to basic OCR service...");
      try {
        const fallbackResult = await this.fallbackToBasicOCR(imageFile, processingOptions);
        const totalTime = Date.now() - startTime;
        fallbackResult.processingStats.totalTime = totalTime;
        return fallbackResult;
      } catch (fallbackError) {
        console.error("❌ Fallback OCR also failed:", fallbackError);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`OCR processing failed: ${errorMessage}. Fallback also failed: ${fallbackErrorMessage}`);
      }
    }
  }

  /**
   * Process with multi-pass strategy
   */
  private async processWithMultiPass(
    imageFile: File,
    context: AdaptiveContext,
    options: ProcessingOptions
  ): Promise<EnhancedOCRResult> {
    console.log("🔄 Processing with Multi-Pass Strategy...");

    const multiPassResult = await multiPassOCRService.processImage(imageFile, {
      documentType: context.documentType,
      language: "arabic",
      expectedStudentCount: context.studentCount,
      knownStudentNames: options.knownStudentNames,
    });

    return this.convertMultiPassResult(multiPassResult, options);
  }

  /**
   * Process with single pass strategy
   */
  private async processWithSinglePass(
    imageFile: File,
    context: AdaptiveContext,
    options: ProcessingOptions
  ): Promise<EnhancedOCRResult> {
    console.log("⚡ Processing with Single Pass Strategy...");

    // Use existing OCR service with enhancements
    const basicResult = await ocrService.processImage(imageFile);

    // Apply edge case handling
    const enhancedResult = OCREdgeCasesHandler.enhanceExtractedData(
      basicResult.students,
      basicResult.detectedMarkTypes
    );

    // Apply Arabic normalization if enabled
    let finalStudents = enhancedResult.students;
    const corrections: any[] = [];

    if (options.enableArabicNormalization) {
      finalStudents = finalStudents.map((student) => {
        const normalizationResult = arabicTextNormalizer.normalize(student.name);

        if (normalizationResult.appliedCorrections.length > 0) {
          corrections.push(
            ...normalizationResult.appliedCorrections.map((corr) => ({
              ...corr,
              type: "arabic_normalization",
              studentName: student.name,
            }))
          );
        }

        return {
          ...student,
          name: normalizationResult.normalizedText,
        };
      });
    }

    return {
      students: finalStudents,
      detectedMarkTypes: enhancedResult.detectedMarkTypes,
      confidence: 0.75, // Default confidence for single pass
      processingStats: {
        totalTime: 0, // Will be set later
        passesUsed: 1,
        successfulPass: 1,
        imageQuality: context.imageQuality.overallScore,
        correctionsApplied: corrections.length,
        warningsGenerated: 0,
      },
      qualityAssessment: {
        imageQuality: 0,
        extractionReliability: 0,
        dataCompleteness: 0,
        overallScore: 0,
      },
      recommendations: [],
      warnings: [],
      debugInfo: {
        appliedCorrections: corrections,
      },
    };
  }

  /**
   * Convert multi-pass result to enhanced OCR result
   */
  private convertMultiPassResult(multiPassResult: MultiPassResult, options: ProcessingOptions): EnhancedOCRResult {
    return {
      students: multiPassResult.students,
      detectedMarkTypes: multiPassResult.detectedMarkTypes,
      confidence: multiPassResult.confidence,
      processingStats: {
        totalTime: multiPassResult.processingTime,
        passesUsed: multiPassResult.passesAttempted,
        successfulPass: multiPassResult.successfulPass,
        imageQuality: multiPassResult.imageQuality.overallScore,
        correctionsApplied: multiPassResult.corrections.length,
        warningsGenerated: multiPassResult.warnings.length,
      },
      qualityAssessment: {
        imageQuality: 0,
        extractionReliability: 0,
        dataCompleteness: 0,
        overallScore: 0,
      },
      recommendations: [],
      warnings: multiPassResult.warnings,
      debugInfo: options.includeDebugInfo
        ? {
            multiPassResult,
            appliedCorrections: multiPassResult.corrections,
          }
        : undefined,
    };
  }

  /**
   * Apply final enhancements to the result
   */
  private async applyFinalEnhancements(
    result: EnhancedOCRResult,
    context: AdaptiveContext,
    options: ProcessingOptions
  ): Promise<EnhancedOCRResult> {
    console.log("✨ Applying final enhancements...");

    // Apply additional Arabic normalization if not already done
    if (
      options.enableArabicNormalization &&
      !result.debugInfo?.appliedCorrections?.some((c) => c.type === "arabic_normalization")
    ) {
      const normalizedStudents = result.students.map((student) => {
        const normalizationResult = arabicTextNormalizer.normalize(student.name);
        return {
          ...student,
          name: normalizationResult.normalizedText,
        };
      });
      result.students = normalizedStudents;
    }

    // Remove duplicates
    result.students = this.removeDuplicateStudents(result.students);

    // Fix sequential numbering
    result.students = this.fixStudentNumbering(result.students);

    // Validate names
    result.students.forEach((student) => {
      const validation = arabicTextNormalizer.validateArabicName(student.name);
      if (!validation.isValid && validation.suggestions) {
        result.warnings.push(`Student name "${student.name}" may have issues: ${validation.issues.join(", ")}`);
      }
    });

    return result;
  }

  /**
   * Generate quality assessment
   */
  private generateQualityAssessment(
    result: EnhancedOCRResult,
    context: AdaptiveContext
  ): { imageQuality: number; extractionReliability: number; dataCompleteness: number; overallScore: number } {
    const imageQuality = context.imageQuality.overallScore;

    // Calculate extraction reliability based on confidence and consistency
    const extractionReliability = result.confidence;

    // Calculate data completeness
    const totalPossibleMarks = result.students.length * 4; // Assuming 4 mark types
    let actualMarks = 0;
    result.students.forEach((student) => {
      Object.values(student.marks).forEach((mark) => {
        if (mark !== null) actualMarks++;
      });
    });
    const dataCompleteness = totalPossibleMarks > 0 ? actualMarks / totalPossibleMarks : 0;

    // Calculate overall score
    const overallScore = imageQuality * 0.3 + extractionReliability * 0.4 + dataCompleteness * 0.3;

    return {
      imageQuality,
      extractionReliability,
      dataCompleteness,
      overallScore,
    };
  }

  /**
   * Generate recommendations based on processing results
   */
  private generateRecommendations(result: EnhancedOCRResult, validation: any): string[] {
    const recommendations: string[] = [];

    if (result.qualityAssessment.imageQuality < 0.6) {
      recommendations.push("Consider improving image quality: ensure good lighting, focus, and minimal skew");
    }

    if (result.qualityAssessment.dataCompleteness < 0.7) {
      recommendations.push("Some student marks may be missing - review the extracted data carefully");
    }

    if (result.confidence < 0.7) {
      recommendations.push("Low confidence extraction - manual review recommended");
    }

    if (result.warnings.length > 3) {
      recommendations.push("Multiple warnings detected - consider preprocessing the image");
    }

    if (validation && validation.recommendations) {
      recommendations.push(...validation.recommendations);
    }

    return recommendations;
  }

  /**
   * Create processing context from input parameters
   */
  private createProcessingContext(imageFile: File, options: ProcessingOptions): AdaptiveContext {
    // Basic image quality assessment (simplified)
    const imageQuality = {
      brightness: 0.7,
      contrast: 0.7,
      sharpness: 0.7,
      noise: 0.3,
      skew: 0,
      resolution: Math.min(1, imageFile.size / (1024 * 1024)), // Rough size-based estimate
      overallScore: 0.7,
    };

    return {
      documentType: options.documentType || "marks_sheet",
      imageQuality,
      expectedComplexity: "medium",
      criticalAccuracy: options.criticalAccuracy,
      studentCount: options.expectedStudentCount,
      languageComplexity: "mixed",
    };
  }

  /**
   * Validate input parameters
   */
  private validateInput(imageFile: File): void {
    if (!imageFile) {
      throw new Error("No image file provided");
    }

    // Check file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(imageFile.type)) {
      throw new Error(`Unsupported file type: ${imageFile.type}. Supported types: ${validTypes.join(", ")}`);
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      throw new Error(`File too large: ${(imageFile.size / (1024 * 1024)).toFixed(1)}MB. Maximum size: 10MB`);
    }

    if (imageFile.size < 1024) {
      throw new Error("File too small - may not contain valid image data");
    }
  }

  /**
   * Fallback to basic OCR service
   */
  private async fallbackToBasicOCR(imageFile: File, options: ProcessingOptions): Promise<EnhancedOCRResult> {
    console.log("🔄 Using fallback OCR service...");

    const basicResult = await ocrService.processImage(imageFile);

    return {
      students: basicResult.students,
      detectedMarkTypes: basicResult.detectedMarkTypes,
      confidence: 0.6, // Lower confidence for fallback
      processingStats: {
        totalTime: 0,
        passesUsed: 1,
        successfulPass: 1,
        imageQuality: 0.5,
        correctionsApplied: 0,
        warningsGenerated: 1,
      },
      qualityAssessment: {
        imageQuality: 0.5,
        extractionReliability: 0.6,
        dataCompleteness: 0.5,
        overallScore: 0.5,
      },
      recommendations: ["Fallback OCR was used - consider improving image quality for better results"],
      warnings: ["Advanced OCR processing failed, using basic fallback service"],
    };
  }

  /**
   * Remove duplicate students
   */
  private removeDuplicateStudents(students: Student[]): Student[] {
    const uniqueStudents: Student[] = [];
    const seenNames = new Set<string>();

    for (const student of students) {
      const normalizedName = this.normalizeNameForComparison(student.name);

      if (!seenNames.has(normalizedName)) {
        uniqueStudents.push(student);
        seenNames.add(normalizedName);
      }
    }

    return uniqueStudents;
  }

  /**
   * Fix student numbering to be sequential
   */
  private fixStudentNumbering(students: Student[]): Student[] {
    return students.map((student, index) => ({
      ...student,
      number: index + 1,
    }));
  }

  /**
   * Normalize name for comparison
   */
  private normalizeNameForComparison(name: string): string {
    return name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[أإآا]/g, "ا")
      .replace(/[ةه]/g, "ه")
      .replace(/[ىيی]/g, "ي")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim();
  }

  /**
   * Get processing statistics for analysis
   */
  getProcessingStats(result: EnhancedOCRResult): {
    efficiency: number;
    reliability: number;
    accuracy: number;
    recommendations: string[];
  } {
    return {
      efficiency: Math.max(0, 1 - (result.processingStats.passesUsed - 1) / 3),
      reliability: result.qualityAssessment.extractionReliability,
      accuracy: result.confidence,
      recommendations: result.recommendations,
    };
  }

  /**
   * Get default processing options
   */
  getDefaultOptions(): ProcessingOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Get high accuracy processing options
   */
  getHighAccuracyOptions(): ProcessingOptions {
    return {
      ...this.defaultOptions,
      enableMultiPass: true,
      criticalAccuracy: true,
      includeDebugInfo: true,
    };
  }

  /**
   * Get fast processing options
   */
  getFastProcessingOptions(): ProcessingOptions {
    return {
      ...this.defaultOptions,
      enableMultiPass: false,
      enablePreprocessing: false,
      includeDebugInfo: false,
    };
  }
}

// Export singleton instance
const enhancedOcrService = new EnhancedOCRService();
export default enhancedOcrService;
