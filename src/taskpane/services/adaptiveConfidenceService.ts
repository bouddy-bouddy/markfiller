/**
 * Adaptive Confidence Threshold Service
 *
 * This service dynamically adjusts confidence thresholds based on:
 * - Image quality metrics
 * - Document type and complexity
 * - Historical accuracy patterns
 * - Context-specific requirements
 */

import { ImageQualityMetrics } from "./imagePreprocessingService";
import { Student, DetectedMarkTypes } from "../types";

export interface ConfidenceThresholds {
  ocrAccuracy: number;
  nameRecognition: number;
  markExtraction: number;
  overallProcessing: number;
  retryThreshold: number;
}

export interface AdaptiveContext {
  documentType: "marks_sheet" | "report_card" | "exam_results" | "handwritten" | "printed";
  imageQuality: ImageQualityMetrics;
  expectedComplexity: "low" | "medium" | "high";
  criticalAccuracy: boolean; // If true, use higher thresholds
  historicalAccuracy?: number; // Previous accuracy for this document type
  studentCount?: number;
  languageComplexity: "simple" | "mixed" | "complex";
}

export interface ThresholdAdjustment {
  originalThreshold: number;
  adjustedThreshold: number;
  adjustmentFactor: number;
  reasoning: string[];
}

export interface ConfidenceAssessment {
  thresholds: ConfidenceThresholds;
  adjustments: {
    ocrAccuracy: ThresholdAdjustment;
    nameRecognition: ThresholdAdjustment;
    markExtraction: ThresholdAdjustment;
    overallProcessing: ThresholdAdjustment;
    retryThreshold: ThresholdAdjustment;
  };
  recommendedStrategy: "standard" | "conservative" | "aggressive" | "multi_pass";
  qualityFactors: {
    imageQuality: number;
    documentComplexity: number;
    contextualReliability: number;
    overallReliability: number;
  };
}

export class AdaptiveConfidenceService {
  // Base confidence thresholds (these get adjusted based on context)
  private readonly baseThresholds: ConfidenceThresholds = {
    ocrAccuracy: 0.75,
    nameRecognition: 0.7,
    markExtraction: 0.8,
    overallProcessing: 0.75,
    retryThreshold: 0.6,
  };

  // Quality factor weights
  private readonly qualityWeights = {
    brightness: 0.15,
    contrast: 0.25,
    sharpness: 0.2,
    noise: 0.15,
    skew: 0.1,
    resolution: 0.15,
  };

  /**
   * Calculate adaptive confidence thresholds based on context
   */
  calculateAdaptiveThresholds(context: AdaptiveContext): ConfidenceAssessment {
    console.log("🎯 Calculating adaptive confidence thresholds...");

    // Calculate quality factors
    const qualityFactors = this.calculateQualityFactors(context);

    // Calculate threshold adjustments
    const adjustments = this.calculateThresholdAdjustments(context, qualityFactors);

    // Apply adjustments to base thresholds
    const adaptiveThresholds: ConfidenceThresholds = {
      ocrAccuracy: Math.max(
        0.3,
        Math.min(0.95, this.baseThresholds.ocrAccuracy * adjustments.ocrAccuracy.adjustmentFactor)
      ),
      nameRecognition: Math.max(
        0.3,
        Math.min(0.95, this.baseThresholds.nameRecognition * adjustments.nameRecognition.adjustmentFactor)
      ),
      markExtraction: Math.max(
        0.3,
        Math.min(0.95, this.baseThresholds.markExtraction * adjustments.markExtraction.adjustmentFactor)
      ),
      overallProcessing: Math.max(
        0.3,
        Math.min(0.95, this.baseThresholds.overallProcessing * adjustments.overallProcessing.adjustmentFactor)
      ),
      retryThreshold: Math.max(
        0.2,
        Math.min(0.8, this.baseThresholds.retryThreshold * adjustments.retryThreshold.adjustmentFactor)
      ),
    };

    // Determine recommended strategy
    const recommendedStrategy = this.determineProcessingStrategy(context, qualityFactors, adaptiveThresholds);

    const assessment: ConfidenceAssessment = {
      thresholds: adaptiveThresholds,
      adjustments,
      recommendedStrategy,
      qualityFactors,
    };

    console.log("✅ Adaptive thresholds calculated:", {
      strategy: recommendedStrategy,
      thresholds: adaptiveThresholds,
      qualityScore: qualityFactors.overallReliability.toFixed(3),
    });

    return assessment;
  }

  /**
   * Validate extraction results against adaptive thresholds
   */
  validateExtractionResults(
    students: Student[],
    detectedMarkTypes: DetectedMarkTypes,
    extractionConfidence: number,
    context: AdaptiveContext
  ): {
    isValid: boolean;
    confidence: number;
    issues: string[];
    recommendations: string[];
    requiresRetry: boolean;
  } {
    const assessment = this.calculateAdaptiveThresholds(context);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate overall extraction confidence
    let isValid = extractionConfidence >= assessment.thresholds.overallProcessing;

    if (extractionConfidence < assessment.thresholds.overallProcessing) {
      issues.push(
        `Overall confidence ${extractionConfidence.toFixed(3)} below threshold ${assessment.thresholds.overallProcessing.toFixed(3)}`
      );
    }

    // Validate student count reasonableness
    if (context.studentCount && Math.abs(students.length - context.studentCount) > context.studentCount * 0.3) {
      issues.push(`Student count mismatch: expected ~${context.studentCount}, found ${students.length}`);
      isValid = false;
    }

    // Validate name extraction quality
    const nameQuality = this.assessNameQuality(students);
    if (nameQuality < assessment.thresholds.nameRecognition) {
      issues.push(
        `Name recognition quality ${nameQuality.toFixed(3)} below threshold ${assessment.thresholds.nameRecognition.toFixed(3)}`
      );
      isValid = false;
    }

    // Validate mark extraction quality
    const markQuality = this.assessMarkQuality(students, detectedMarkTypes);
    if (markQuality < assessment.thresholds.markExtraction) {
      issues.push(
        `Mark extraction quality ${markQuality.toFixed(3)} below threshold ${assessment.thresholds.markExtraction.toFixed(3)}`
      );
      isValid = false;
    }

    // Generate recommendations
    if (!isValid) {
      if (extractionConfidence < assessment.thresholds.retryThreshold) {
        recommendations.push("Retry with different processing strategy");
      }

      if (assessment.qualityFactors.imageQuality < 0.6) {
        recommendations.push("Consider image preprocessing or quality enhancement");
      }

      if (nameQuality < 0.5) {
        recommendations.push("Apply aggressive name correction algorithms");
      }

      if (markQuality < 0.5) {
        recommendations.push("Use specialized mark extraction techniques");
      }
    }

    const requiresRetry =
      extractionConfidence < assessment.thresholds.retryThreshold && assessment.recommendedStrategy === "multi_pass";

    return {
      isValid,
      confidence: extractionConfidence,
      issues,
      recommendations,
      requiresRetry,
    };
  }

  /**
   * Calculate quality factors from context
   */
  private calculateQualityFactors(context: AdaptiveContext): {
    imageQuality: number;
    documentComplexity: number;
    contextualReliability: number;
    overallReliability: number;
  } {
    // Calculate image quality score
    const imageQuality =
      context.imageQuality.brightness * this.qualityWeights.brightness +
      context.imageQuality.contrast * this.qualityWeights.contrast +
      context.imageQuality.sharpness * this.qualityWeights.sharpness +
      (1 - context.imageQuality.noise) * this.qualityWeights.noise +
      (1 - Math.abs(context.imageQuality.skew) / 45) * this.qualityWeights.skew +
      Math.min(1, context.imageQuality.resolution / 300) * this.qualityWeights.resolution;

    // Calculate document complexity factor
    let documentComplexity = 0.5; // Base complexity

    switch (context.documentType) {
      case "printed":
        documentComplexity = 0.8; // Easier to process
        break;
      case "handwritten":
        documentComplexity = 0.3; // Much harder
        break;
      case "marks_sheet":
        documentComplexity = 0.6; // Medium complexity
        break;
      case "report_card":
        documentComplexity = 0.5; // Medium-high complexity
        break;
      case "exam_results":
        documentComplexity = 0.7; // Structured, easier
        break;
    }

    // Adjust for expected complexity
    switch (context.expectedComplexity) {
      case "low":
        documentComplexity += 0.2;
        break;
      case "high":
        documentComplexity -= 0.2;
        break;
    }

    // Adjust for language complexity
    switch (context.languageComplexity) {
      case "simple":
        documentComplexity += 0.1;
        break;
      case "complex":
        documentComplexity -= 0.1;
        break;
    }

    documentComplexity = Math.max(0.1, Math.min(0.9, documentComplexity));

    // Calculate contextual reliability
    let contextualReliability = 0.7; // Base reliability

    if (context.historicalAccuracy) {
      contextualReliability = context.historicalAccuracy * 0.7 + contextualReliability * 0.3;
    }

    if (context.criticalAccuracy) {
      contextualReliability *= 1.1; // Boost for critical contexts
    }

    if (context.studentCount && context.studentCount > 50) {
      contextualReliability *= 0.9; // Large documents are harder
    }

    contextualReliability = Math.max(0.3, Math.min(1.0, contextualReliability));

    // Calculate overall reliability
    const overallReliability = imageQuality * 0.4 + documentComplexity * 0.3 + contextualReliability * 0.3;

    return {
      imageQuality,
      documentComplexity,
      contextualReliability,
      overallReliability,
    };
  }

  /**
   * Calculate threshold adjustments based on quality factors
   */
  private calculateThresholdAdjustments(
    context: AdaptiveContext,
    qualityFactors: {
      imageQuality: number;
      documentComplexity: number;
      contextualReliability: number;
      overallReliability: number;
    }
  ): {
    ocrAccuracy: ThresholdAdjustment;
    nameRecognition: ThresholdAdjustment;
    markExtraction: ThresholdAdjustment;
    overallProcessing: ThresholdAdjustment;
    retryThreshold: ThresholdAdjustment;
  } {
    // Base adjustment factor from overall reliability
    const baseAdjustment = 0.5 + qualityFactors.overallReliability * 0.5;

    // OCR Accuracy adjustments
    const ocrReasons: string[] = [];
    let ocrAdjustment = baseAdjustment;

    if (qualityFactors.imageQuality < 0.5) {
      ocrAdjustment *= 0.8;
      ocrReasons.push("Low image quality detected");
    }

    if (context.documentType === "handwritten") {
      ocrAdjustment *= 0.7;
      ocrReasons.push("Handwritten text is harder to recognize");
    }

    if (context.languageComplexity === "complex") {
      ocrAdjustment *= 0.9;
      ocrReasons.push("Complex language patterns");
    }

    // Name Recognition adjustments
    const nameReasons: string[] = [];
    let nameAdjustment = baseAdjustment;

    if (context.languageComplexity === "complex") {
      nameAdjustment *= 0.85;
      nameReasons.push("Complex Arabic name patterns");
    }

    if (qualityFactors.imageQuality < 0.6) {
      nameAdjustment *= 0.9;
      nameReasons.push("Image quality affects name clarity");
    }

    // Mark Extraction adjustments
    const markReasons: string[] = [];
    let markAdjustment = baseAdjustment;

    if (context.documentType === "handwritten") {
      markAdjustment *= 0.75;
      markReasons.push("Handwritten marks are harder to extract");
    }

    if (context.expectedComplexity === "high") {
      markAdjustment *= 0.85;
      markReasons.push("Complex document structure");
    }

    // Overall Processing adjustments
    const overallReasons: string[] = [];
    let overallAdjustment = baseAdjustment;

    if (context.criticalAccuracy) {
      overallAdjustment *= 1.15;
      overallReasons.push("Critical accuracy required");
    }

    if (qualityFactors.overallReliability < 0.5) {
      overallAdjustment *= 0.8;
      overallReasons.push("Low overall reliability");
    }

    // Retry Threshold adjustments
    const retryReasons: string[] = [];
    let retryAdjustment = baseAdjustment * 0.8; // Generally lower than other thresholds

    if (context.documentType === "handwritten") {
      retryAdjustment *= 0.7;
      retryReasons.push("Handwritten documents need more attempts");
    }

    if (qualityFactors.imageQuality < 0.4) {
      retryAdjustment *= 0.6;
      retryReasons.push("Very poor image quality requires multiple attempts");
    }

    return {
      ocrAccuracy: {
        originalThreshold: this.baseThresholds.ocrAccuracy,
        adjustedThreshold: this.baseThresholds.ocrAccuracy * ocrAdjustment,
        adjustmentFactor: ocrAdjustment,
        reasoning: ocrReasons,
      },
      nameRecognition: {
        originalThreshold: this.baseThresholds.nameRecognition,
        adjustedThreshold: this.baseThresholds.nameRecognition * nameAdjustment,
        adjustmentFactor: nameAdjustment,
        reasoning: nameReasons,
      },
      markExtraction: {
        originalThreshold: this.baseThresholds.markExtraction,
        adjustedThreshold: this.baseThresholds.markExtraction * markAdjustment,
        adjustmentFactor: markAdjustment,
        reasoning: markReasons,
      },
      overallProcessing: {
        originalThreshold: this.baseThresholds.overallProcessing,
        adjustedThreshold: this.baseThresholds.overallProcessing * overallAdjustment,
        adjustmentFactor: overallAdjustment,
        reasoning: overallReasons,
      },
      retryThreshold: {
        originalThreshold: this.baseThresholds.retryThreshold,
        adjustedThreshold: this.baseThresholds.retryThreshold * retryAdjustment,
        adjustmentFactor: retryAdjustment,
        reasoning: retryReasons,
      },
    };
  }

  /**
   * Determine the recommended processing strategy
   */
  private determineProcessingStrategy(
    context: AdaptiveContext,
    qualityFactors: {
      imageQuality: number;
      documentComplexity: number;
      contextualReliability: number;
      overallReliability: number;
    },
    thresholds: ConfidenceThresholds
  ): "standard" | "conservative" | "aggressive" | "multi_pass" {
    // Multi-pass for challenging conditions
    if (
      qualityFactors.overallReliability < 0.6 ||
      context.documentType === "handwritten" ||
      context.expectedComplexity === "high"
    ) {
      return "multi_pass";
    }

    // Conservative for critical accuracy requirements
    if (context.criticalAccuracy || qualityFactors.imageQuality < 0.5) {
      return "conservative";
    }

    // Aggressive for very high quality, simple documents
    if (
      qualityFactors.overallReliability > 0.8 &&
      context.documentType === "printed" &&
      context.expectedComplexity === "low"
    ) {
      return "aggressive";
    }

    // Standard for most cases
    return "standard";
  }

  /**
   * Assess the quality of extracted names
   */
  private assessNameQuality(students: Student[]): number {
    if (students.length === 0) return 0;

    let qualityScore = 0;
    let validNameCount = 0;

    for (const student of students) {
      if (!student.name || student.name.trim().length < 2) {
        continue; // Skip invalid names
      }

      let nameScore = 0.5; // Base score

      // Check for Arabic characters
      const arabicPattern = /[\u0600-\u06FF]/;
      if (arabicPattern.test(student.name)) {
        nameScore += 0.3;
      }

      // Check for reasonable length
      if (student.name.length >= 4 && student.name.length <= 30) {
        nameScore += 0.1;
      }

      // Check for multiple words (typical for Arabic names)
      const wordCount = student.name.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 4) {
        nameScore += 0.1;
      }

      // Penalize for suspicious characters
      if (/[0-9]/.test(student.name)) {
        nameScore -= 0.2;
      }

      if (/[a-zA-Z]/.test(student.name)) {
        nameScore -= 0.1;
      }

      qualityScore += Math.max(0, Math.min(1, nameScore));
      validNameCount++;
    }

    return validNameCount > 0 ? qualityScore / validNameCount : 0;
  }

  /**
   * Assess the quality of extracted marks
   */
  private assessMarkQuality(students: Student[], detectedMarkTypes: DetectedMarkTypes): number {
    if (students.length === 0) return 0;

    let totalMarks = 0;
    let validMarks = 0;

    for (const student of students) {
      Object.values(student.marks).forEach((mark) => {
        if (mark !== null) {
          totalMarks++;

          // Valid mark range
          if (mark >= 0 && mark <= 20) {
            validMarks++;
          }
        }
      });
    }

    const markExtractionRatio = totalMarks > 0 ? validMarks / totalMarks : 0;

    // Factor in mark type detection
    const detectedTypeCount = Object.values(detectedMarkTypes).filter(Boolean).length;
    const typeDetectionScore = detectedTypeCount / 4; // Assuming 4 possible mark types

    // Factor in data completeness
    const expectedMarks = students.length * detectedTypeCount;
    const completenessScore = expectedMarks > 0 ? totalMarks / expectedMarks : 0;

    return markExtractionRatio * 0.5 + typeDetectionScore * 0.3 + completenessScore * 0.2;
  }

  /**
   * Get confidence thresholds for specific document types
   */
  getDocumentTypeThresholds(documentType: string): Partial<ConfidenceThresholds> {
    const adjustments: Record<string, Partial<ConfidenceThresholds>> = {
      handwritten: {
        ocrAccuracy: 0.6,
        nameRecognition: 0.55,
        markExtraction: 0.65,
        overallProcessing: 0.6,
        retryThreshold: 0.45,
      },
      printed: {
        ocrAccuracy: 0.85,
        nameRecognition: 0.8,
        markExtraction: 0.85,
        overallProcessing: 0.8,
        retryThreshold: 0.7,
      },
      marks_sheet: {
        ocrAccuracy: 0.75,
        nameRecognition: 0.7,
        markExtraction: 0.8,
        overallProcessing: 0.75,
        retryThreshold: 0.6,
      },
    };

    return adjustments[documentType] || {};
  }

  /**
   * Update base thresholds based on historical performance
   */
  updateBaseThresholds(documentType: string, actualAccuracy: number, processingContext: AdaptiveContext): void {
    // This would typically update a persistent store
    // For now, we'll just log the update
    console.log(`📊 Threshold update for ${documentType}: accuracy=${actualAccuracy.toFixed(3)}`);

    // In a real implementation, you would:
    // 1. Store this data in a database or local storage
    // 2. Calculate running averages
    // 3. Adjust base thresholds over time
    // 4. Use machine learning to optimize thresholds
  }
}

// Export singleton instance
export const adaptiveConfidenceService = new AdaptiveConfidenceService();
