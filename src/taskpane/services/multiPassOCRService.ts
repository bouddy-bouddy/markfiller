/**
 * Multi-Pass OCR Processing Service
 *
 * This service orchestrates multiple OCR processing passes to maximize accuracy:
 * - Pass 1: Standard processing with preprocessing
 * - Pass 2: Alternative strategies for failed extractions
 * - Pass 3: Specialized handwritten text processing
 * - Result fusion and confidence-based selection
 */

import { Student, DetectedMarkTypes } from "../types";
import { imagePreprocessingService, ImageQualityMetrics, PreprocessingOptions } from "./imagePreprocessingService";
import { enhancedGoogleVisionService, VisionAPIResult } from "./enhancedGoogleVisionService";
import { intelligentTextProcessor, ProcessingContext } from "./intelligentTextProcessor";

export interface MultiPassResult {
  students: Student[];
  detectedMarkTypes: DetectedMarkTypes;
  confidence: number;
  passesAttempted: number;
  successfulPass: number;
  processingTime: number;
  imageQuality: ImageQualityMetrics;
  corrections: Array<{ type: string; original: string; corrected: string; confidence: number }>;
  warnings: string[];
  debugInfo: {
    passResults: Array<{
      passNumber: number;
      strategy: string;
      confidence: number;
      studentCount: number;
      processingTime: number;
    }>;
    fusionApplied: boolean;
    preprocessingEnhancements: string[];
  };
}

export interface PassConfiguration {
  name: string;
  preprocessingOptions: PreprocessingOptions;
  useMultipleStrategies: boolean;
  minConfidence: number;
  maxRetries: number;
}

export class MultiPassOCRService {
  private readonly passConfigurations: PassConfiguration[] = [
    {
      name: "High Quality Standard Processing",
      preprocessingOptions: imagePreprocessingService.getPrintedTextOptions(),
      useMultipleStrategies: true,
      minConfidence: 0.8,
      maxRetries: 1,
    },
    {
      name: "Enhanced Processing with Aggressive Preprocessing",
      preprocessingOptions: {
        enableNoiseReduction: true,
        enableContrastEnhancement: true,
        enableDeskewing: true,
        enableSharpening: true,
        enableBinarization: true,
        targetDPI: 400,
        preserveOriginal: true,
      },
      useMultipleStrategies: true,
      minConfidence: 0.7,
      maxRetries: 2,
    },
    {
      name: "Handwritten Text Specialized Processing",
      preprocessingOptions: imagePreprocessingService.getHandwrittenOptions(),
      useMultipleStrategies: true,
      minConfidence: 0.6,
      maxRetries: 2,
    },
    {
      name: "Fallback Processing with Minimal Preprocessing",
      preprocessingOptions: {
        enableNoiseReduction: false,
        enableContrastEnhancement: true,
        enableDeskewing: false,
        enableSharpening: false,
        enableBinarization: false,
        targetDPI: 300,
        preserveOriginal: true,
      },
      useMultipleStrategies: false,
      minConfidence: 0.4,
      maxRetries: 1,
    },
  ];

  /**
   * Main multi-pass processing method
   */
  async processImage(imageFile: File, context?: ProcessingContext): Promise<MultiPassResult> {
    console.log("🔄 Starting multi-pass OCR processing...");
    const startTime = Date.now();

    const processingContext: ProcessingContext = context || {
      documentType: "marks_sheet",
      language: "arabic",
    };

    const passResults: Array<{
      passNumber: number;
      strategy: string;
      confidence: number;
      studentCount: number;
      processingTime: number;
    }> = [];

    const allResults: VisionAPIResult[] = [];
    let bestResult: VisionAPIResult | null = null;
    let imageQuality: ImageQualityMetrics | null = null;
    let preprocessingEnhancements: string[] = [];

    // Execute passes sequentially until we get a satisfactory result
    for (let passIndex = 0; passIndex < this.passConfigurations.length; passIndex++) {
      const passConfig = this.passConfigurations[passIndex];
      console.log(`🚀 Starting Pass ${passIndex + 1}: ${passConfig.name}`);

      try {
        const passResult = await this.executePass(imageFile, passConfig, passIndex + 1, processingContext);

        // Store image quality from first successful pass
        if (!imageQuality && passResult.imageQuality) {
          imageQuality = passResult.imageQuality;
        }

        // Store preprocessing enhancements
        if (passResult.preprocessingEnhancements) {
          preprocessingEnhancements = passResult.preprocessingEnhancements;
        }

        passResults.push({
          passNumber: passIndex + 1,
          strategy: passResult.strategy,
          confidence: passResult.confidence,
          studentCount: passResult.students.length,
          processingTime: passResult.processingTime,
        });

        allResults.push(passResult);

        console.log(
          `✅ Pass ${passIndex + 1} completed: confidence=${passResult.confidence.toFixed(3)}, students=${passResult.students.length}`
        );

        // Check if this result meets our confidence threshold
        if (passResult.confidence >= passConfig.minConfidence && passResult.students.length > 0) {
          bestResult = passResult;
          console.log(`🎯 Pass ${passIndex + 1} meets confidence threshold, using as primary result`);

          // If confidence is very high, we can stop here
          if (passResult.confidence > 0.9) {
            console.log("🏆 Very high confidence achieved, stopping early");
            break;
          }
        }
      } catch (error) {
        console.error(`❌ Pass ${passIndex + 1} failed:`, error);
        passResults.push({
          passNumber: passIndex + 1,
          strategy: passConfig.name,
          confidence: 0,
          studentCount: 0,
          processingTime: 0,
        });
      }
    }

    // If no single pass was satisfactory, try result fusion
    let fusionApplied = false;
    if (!bestResult && allResults.length > 1) {
      console.log("🔄 No single pass was satisfactory, attempting result fusion...");
      const fusedResult = await this.fuseResults(allResults);
      if (fusedResult) {
        bestResult = fusedResult;
        fusionApplied = true;
        console.log("✅ Result fusion successful");
      }
    }

    // Use best available result or throw error
    if (!bestResult) {
      if (allResults.length > 0) {
        bestResult = allResults.reduce((best, current) => (current.confidence > best.confidence ? current : best));
        console.log("⚠️ Using best available result despite low confidence");
      } else {
        throw new Error("All OCR processing passes failed");
      }
    }

    // Apply intelligent text post-processing
    console.log("🧠 Applying intelligent text post-processing...");
    const postProcessingResult = await intelligentTextProcessor.processExtractedData(
      bestResult.students,
      bestResult.detectedMarkTypes,
      processingContext
    );

    const totalProcessingTime = Date.now() - startTime;

    const result: MultiPassResult = {
      students: postProcessingResult.correctedStudents,
      detectedMarkTypes: postProcessingResult.correctedMarkTypes,
      confidence: bestResult.confidence,
      passesAttempted: passResults.length,
      successfulPass: passResults.findIndex((p) => p.confidence > 0) + 1,
      processingTime: totalProcessingTime,
      imageQuality: imageQuality || this.getDefaultQualityMetrics(),
      corrections: postProcessingResult.corrections,
      warnings: [...bestResult.warnings, ...postProcessingResult.warnings],
      debugInfo: {
        passResults,
        fusionApplied,
        preprocessingEnhancements,
      },
    };

    console.log(`🏁 Multi-pass processing completed in ${totalProcessingTime}ms`);
    console.log(`📊 Final result: ${result.students.length} students, confidence: ${result.confidence.toFixed(3)}`);
    console.log(`🔧 Applied ${result.corrections.length} corrections`);
    console.log(`⚠️ Generated ${result.warnings.length} warnings`);

    return result;
  }

  /**
   * Execute a single processing pass
   */
  private async executePass(
    imageFile: File,
    config: PassConfiguration,
    passNumber: number,
    context: ProcessingContext
  ): Promise<
    VisionAPIResult & {
      imageQuality?: ImageQualityMetrics;
      preprocessingEnhancements?: string[];
    }
  > {
    const passStartTime = Date.now();

    // Apply image preprocessing
    console.log(`🔧 Pass ${passNumber}: Applying preprocessing...`);
    const preprocessing = await imagePreprocessingService.preprocessImage(imageFile, config.preprocessingOptions);

    const preprocessedImageFile = new File([preprocessing.enhancedImage], imageFile.name, {
      type: "image/png",
    });

    console.log(`✅ Pass ${passNumber}: Preprocessing completed - ${preprocessing.appliedEnhancements.join(", ")}`);

    // Perform OCR with multiple strategies if configured
    let ocrResult: VisionAPIResult;

    if (config.useMultipleStrategies) {
      ocrResult = await enhancedGoogleVisionService.processImageWithMultipleStrategies(
        preprocessedImageFile,
        false // Preprocessing already applied
      );
    } else {
      // Use single strategy for fallback pass
      ocrResult = await enhancedGoogleVisionService.processImageWithMultipleStrategies(preprocessedImageFile, false);
    }

    const passProcessingTime = Date.now() - passStartTime;

    return {
      ...ocrResult,
      processingTime: passProcessingTime,
      imageQuality: preprocessing.qualityMetrics,
      preprocessingEnhancements: preprocessing.appliedEnhancements,
    };
  }

  /**
   * Fuse results from multiple passes for better accuracy
   */
  private async fuseResults(results: VisionAPIResult[]): Promise<VisionAPIResult | null> {
    if (results.length < 2) return null;

    console.log("🔄 Fusing results from multiple passes...");

    // Sort results by confidence
    const sortedResults = [...results].sort((a, b) => b.confidence - a.confidence);

    // Start with the highest confidence result
    const baseResult = sortedResults[0];
    let fusedStudents = [...baseResult.students];

    // Merge students from other results
    for (let i = 1; i < sortedResults.length; i++) {
      const currentResult = sortedResults[i];

      for (const student of currentResult.students) {
        // Try to find matching student in fused results
        const matchIndex = fusedStudents.findIndex((fusedStudent) => this.studentsMatch(fusedStudent, student));

        if (matchIndex === -1) {
          // New student, add to fused results
          fusedStudents.push(student);
        } else {
          // Merge marks from matching student
          const fusedStudent = fusedStudents[matchIndex];
          fusedStudents[matchIndex] = this.mergeStudentData(fusedStudent, student);
        }
      }
    }

    // Sort by student number
    fusedStudents.sort((a, b) => a.number - b.number);

    // Calculate fused confidence (weighted average)
    const totalConfidence = results.reduce((sum, result, index) => {
      const weight = 1 / (index + 1); // Higher weight for better results
      return sum + result.confidence * weight;
    }, 0);

    const totalWeight = results.reduce((sum, _, index) => sum + 1 / (index + 1), 0);
    const fusedConfidence = totalConfidence / totalWeight;

    // Merge detected mark types (union)
    const fusedMarkTypes: DetectedMarkTypes = {
      hasFard1: results.some((r) => r.detectedMarkTypes.hasFard1),
      hasFard2: results.some((r) => r.detectedMarkTypes.hasFard2),
      hasFard3: results.some((r) => r.detectedMarkTypes.hasFard3),
      hasFard4: results.some((r) => r.detectedMarkTypes.hasFard4),
      hasActivities: results.some((r) => r.detectedMarkTypes.hasActivities),
    };

    console.log(
      `✅ Result fusion completed: ${fusedStudents.length} students, confidence: ${fusedConfidence.toFixed(3)}`
    );

    return {
      students: fusedStudents,
      detectedMarkTypes: fusedMarkTypes,
      confidence: fusedConfidence,
      strategy: "Multi-Pass Fusion",
      processingTime: Math.max(...results.map((r) => r.processingTime)),
      warnings: results.flatMap((r) => r.warnings),
    };
  }

  /**
   * Check if two students match (same person)
   */
  private studentsMatch(student1: Student, student2: Student): boolean {
    // First check by student number
    if (student1.number === student2.number && student1.number > 0) {
      return true;
    }

    // Then check by name similarity
    const name1 = this.normalizeNameForComparison(student1.name);
    const name2 = this.normalizeNameForComparison(student2.name);

    if (name1 === name2) return true;

    // Check similarity for partial matches
    const similarity = this.calculateStringSimilarity(name1, name2);
    return similarity > 0.85;
  }

  /**
   * Merge data from two student records
   */
  private mergeStudentData(primary: Student, secondary: Student): Student {
    // Use primary student as base
    const merged: Student = { ...primary };

    // Use the better name (longer, more complete)
    if (secondary.name.length > primary.name.length) {
      merged.name = secondary.name;
    }

    // Merge marks - prefer non-null values
    Object.keys(merged.marks).forEach((markType) => {
      const key = markType as keyof typeof merged.marks;
      if (merged.marks[key] === null && secondary.marks[key] !== null) {
        merged.marks[key] = secondary.marks[key];
      }
    });

    return merged;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);

    return (maxLength - distance) / maxLength;
  }

  /**
   * Normalize name for comparison
   */
  private normalizeNameForComparison(name: string): string {
    return name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[أإآا]/g, "ا") // Normalize alif variants
      .replace(/[ةه]/g, "ه") // Normalize taa marbouta and haa
      .replace(/[ىيی]/g, "ي") // Normalize yaa variants
      .replace(/\s+/g, " ") // Normalize spaces
      .toLowerCase()
      .trim();
  }

  /**
   * Get default quality metrics for fallback
   */
  private getDefaultQualityMetrics(): ImageQualityMetrics {
    return {
      brightness: 0.5,
      contrast: 0.5,
      sharpness: 0.5,
      noise: 0.3,
      skew: 0,
      resolution: 300,
      overallScore: 0.5,
    };
  }

  /**
   * Get processing statistics for analysis
   */
  getProcessingStats(result: MultiPassResult): {
    efficiency: number;
    reliability: number;
    accuracy: number;
    recommendations: string[];
  } {
    const stats = {
      efficiency: 0,
      reliability: 0,
      accuracy: 0,
      recommendations: [] as string[],
    };

    // Calculate efficiency (fewer passes = better)
    stats.efficiency = Math.max(0, 1 - (result.passesAttempted - 1) / this.passConfigurations.length);

    // Calculate reliability (consistent results across passes)
    const passConfidences = result.debugInfo.passResults.filter((p) => p.confidence > 0).map((p) => p.confidence);

    if (passConfidences.length > 1) {
      const avgConfidence = passConfidences.reduce((sum, conf) => sum + conf, 0) / passConfidences.length;
      const variance =
        passConfidences.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / passConfidences.length;
      stats.reliability = Math.max(0, 1 - Math.sqrt(variance));
    } else {
      stats.reliability = passConfidences.length > 0 ? passConfidences[0] : 0;
    }

    // Use final confidence as accuracy measure
    stats.accuracy = result.confidence;

    // Generate recommendations
    if (result.confidence < 0.7) {
      stats.recommendations.push("Consider improving image quality before scanning");
    }

    if (result.imageQuality.overallScore < 0.6) {
      stats.recommendations.push("Image quality is low - ensure good lighting and focus");
    }

    if (result.warnings.length > 3) {
      stats.recommendations.push("Multiple warnings detected - manual review recommended");
    }

    if (result.passesAttempted > 2) {
      stats.recommendations.push("Multiple processing passes required - consider image preprocessing");
    }

    return stats;
  }
}

// Export singleton instance
export const multiPassOCRService = new MultiPassOCRService();
