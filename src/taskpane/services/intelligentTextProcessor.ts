/**
 * Intelligent Text Post-Processing Service
 *
 * This service applies advanced text processing techniques to improve
 * OCR accuracy through:
 * - Context-aware error correction
 * - Semantic validation
 * - Pattern-based corrections
 * - Machine learning-inspired heuristics
 */

import { Student, DetectedMarkTypes } from "../types";

export interface ProcessingContext {
  documentType: "marks_sheet" | "report_card" | "exam_results" | "handwritten" | "printed";
  language: "arabic" | "mixed";
  expectedStudentCount?: number;
  knownStudentNames?: string[];
  subjectName?: string;
  academicYear?: string;
}

export interface CorrectionRule {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  confidence: number;
  applicableContext: string[];
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  suggestedCorrection?: string;
  reasoning: string;
}

export class IntelligentTextProcessor {
  private readonly commonArabicNames: Set<string>;
  private readonly correctionRules: CorrectionRule[];
  private readonly markPatterns: RegExp[];

  constructor() {
    this.commonArabicNames = new Set([
      "محمد",
      "أحمد",
      "علي",
      "حسن",
      "حسين",
      "عمر",
      "خالد",
      "سعد",
      "فهد",
      "عبدالله",
      "فاطمة",
      "عائشة",
      "خديجة",
      "مريم",
      "زينب",
      "أسماء",
      "هند",
      "نور",
      "سارة",
      "ليلى",
      "عبدالرحمن",
      "عبدالعزيز",
      "عبدالله",
      "عبدالرحيم",
      "عبدالكريم",
      "أبو",
      "بن",
      "ابن",
    ]);

    this.correctionRules = this.initializeCorrectionRules();
    this.markPatterns = [
      /^\d{1,2}[.,]\d{1,2}$/, // 15.5, 12,75
      /^\d{1,2}$/, // 15, 8
      /^\d{1,2}\/20$/, // 15/20
      /^[0-9۰-۹]{1,2}[.,][0-9۰-۹]{1,2}$/, // Arabic numerals
    ];
  }

  /**
   * Main processing method for intelligent text correction
   */
  async processExtractedData(
    students: Student[],
    detectedMarkTypes: DetectedMarkTypes,
    context: ProcessingContext
  ): Promise<{
    correctedStudents: Student[];
    correctedMarkTypes: DetectedMarkTypes;
    corrections: Array<{ type: string; original: string; corrected: string; confidence: number }>;
    warnings: string[];
  }> {
    console.log("🧠 Starting intelligent text post-processing...");

    const corrections: Array<{ type: string; original: string; corrected: string; confidence: number }> = [];
    const warnings: string[] = [];

    // Step 1: Correct student names using context-aware techniques
    const nameCorrections = await this.correctStudentNames(students, context);
    corrections.push(...nameCorrections.corrections);
    let correctedStudents = nameCorrections.students;

    // Step 2: Validate and correct marks using intelligent patterns
    const markCorrections = await this.correctMarks(correctedStudents, context);
    corrections.push(...markCorrections.corrections);
    correctedStudents = markCorrections.students;

    // Step 3: Apply semantic validation
    const semanticValidation = await this.applySemanticValidation(correctedStudents, context);
    warnings.push(...semanticValidation.warnings);
    correctedStudents = semanticValidation.students;

    // Step 4: Correct mark type detection using content analysis
    const correctedMarkTypes = await this.correctMarkTypeDetection(correctedStudents, detectedMarkTypes, context);

    // Step 5: Apply final consistency checks
    const finalValidation = await this.applyConsistencyChecks(correctedStudents);
    warnings.push(...finalValidation.warnings);
    correctedStudents = finalValidation.students;

    console.log(`✅ Text processing completed. Applied ${corrections.length} corrections.`);
    console.log(`⚠️ Generated ${warnings.length} warnings.`);

    return {
      correctedStudents,
      correctedMarkTypes,
      corrections,
      warnings,
    };
  }

  /**
   * Correct student names using context-aware techniques
   */
  private async correctStudentNames(
    students: Student[],
    context: ProcessingContext
  ): Promise<{
    students: Student[];
    corrections: Array<{ type: string; original: string; corrected: string; confidence: number }>;
  }> {
    const corrections: Array<{ type: string; original: string; corrected: string; confidence: number }> = [];

    const correctedStudents = students.map((student) => {
      let correctedName = student.name;
      const originalName = student.name;

      // Apply correction rules
      for (const rule of this.correctionRules) {
        if (rule.applicableContext.includes(context.documentType) || rule.applicableContext.includes("all")) {
          if (rule.pattern.test(correctedName)) {
            const newName =
              typeof rule.replacement === "string"
                ? correctedName.replace(rule.pattern, rule.replacement)
                : correctedName.replace(rule.pattern, rule.replacement);

            if (newName !== correctedName) {
              corrections.push({
                type: "name_correction",
                original: correctedName,
                corrected: newName,
                confidence: rule.confidence,
              });
              correctedName = newName;
            }
          }
        }
      }

      // Apply intelligent name validation
      const validationResult = this.validateStudentName(correctedName, context);
      if (!validationResult.isValid && validationResult.suggestedCorrection) {
        corrections.push({
          type: "name_validation",
          original: correctedName,
          corrected: validationResult.suggestedCorrection,
          confidence: validationResult.confidence,
        });
        correctedName = validationResult.suggestedCorrection;
      }

      // Apply contextual corrections if known names are provided
      if (context.knownStudentNames && context.knownStudentNames.length > 0) {
        const bestMatch = this.findBestNameMatch(correctedName, context.knownStudentNames);
        if (bestMatch && bestMatch.similarity > 0.8) {
          corrections.push({
            type: "contextual_name_match",
            original: correctedName,
            corrected: bestMatch.name,
            confidence: bestMatch.similarity,
          });
          correctedName = bestMatch.name;
        }
      }

      return {
        ...student,
        name: correctedName,
      };
    });

    return { students: correctedStudents, corrections };
  }

  /**
   * Correct marks using intelligent pattern recognition
   */
  private async correctMarks(
    students: Student[],
    context: ProcessingContext
  ): Promise<{
    students: Student[];
    corrections: Array<{ type: string; original: string; corrected: string; confidence: number }>;
  }> {
    const corrections: Array<{ type: string; original: string; corrected: string; confidence: number }> = [];

    const correctedStudents = students.map((student) => {
      const correctedMarks = { ...student.marks };

      Object.keys(correctedMarks).forEach((markType) => {
        const mark = correctedMarks[markType as keyof typeof correctedMarks];
        if (mark !== null) {
          const correctedMark = this.intelligentMarkCorrection(mark, markType, students, context);
          if (correctedMark !== mark) {
            corrections.push({
              type: "mark_correction",
              original: mark.toString(),
              corrected: correctedMark.toString(),
              confidence: 0.8,
            });
            correctedMarks[markType as keyof typeof correctedMarks] = correctedMark;
          }
        }
      });

      return {
        ...student,
        marks: correctedMarks,
      };
    });

    return { students: correctedStudents, corrections };
  }

  /**
   * Apply semantic validation to the extracted data
   */
  private async applySemanticValidation(
    students: Student[],
    context: ProcessingContext
  ): Promise<{
    students: Student[];
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Check for reasonable student count
    if (context.expectedStudentCount && Math.abs(students.length - context.expectedStudentCount) > 5) {
      warnings.push(
        `Expected ~${context.expectedStudentCount} students but found ${students.length}. ` +
          `This might indicate incomplete extraction.`
      );
    }

    // Check for duplicate names
    const nameSet = new Set();
    const duplicates: string[] = [];
    students.forEach((student) => {
      const normalizedName = this.normalizeNameForComparison(student.name);
      if (nameSet.has(normalizedName)) {
        duplicates.push(student.name);
      } else {
        nameSet.add(normalizedName);
      }
    });

    if (duplicates.length > 0) {
      warnings.push(`Found duplicate student names: ${duplicates.join(", ")}`);
    }

    // Check for unrealistic mark distributions
    const markStats = this.calculateMarkStatistics(students);
    Object.entries(markStats).forEach(([markType, stats]) => {
      if (stats.count > 0) {
        if (stats.average > 18) {
          warnings.push(`${markType} marks are unusually high (avg: ${stats.average.toFixed(2)})`);
        } else if (stats.average < 5) {
          warnings.push(`${markType} marks are unusually low (avg: ${stats.average.toFixed(2)})`);
        }

        if (stats.stdDev > 8) {
          warnings.push(`${markType} marks show high variance (std: ${stats.stdDev.toFixed(2)})`);
        }
      }
    });

    // Check for missing sequential numbers
    const numbers = students.map((s) => s.number).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] - numbers[i - 1] > 1) {
        for (let gap = numbers[i - 1] + 1; gap < numbers[i]; gap++) {
          gaps.push(gap);
        }
      }
    }

    if (gaps.length > 0) {
      warnings.push(`Missing student numbers: ${gaps.join(", ")}`);
    }

    return { students, warnings };
  }

  /**
   * Correct mark type detection using content analysis
   */
  private async correctMarkTypeDetection(
    students: Student[],
    detectedMarkTypes: DetectedMarkTypes,
    context: ProcessingContext
  ): Promise<DetectedMarkTypes> {
    const corrected = { ...detectedMarkTypes };

    // Analyze mark distribution to infer types
    const markCounts = {
      fard1: students.filter((s) => s.marks.fard1 !== null).length,
      fard2: students.filter((s) => s.marks.fard2 !== null).length,
      fard3: students.filter((s) => s.marks.fard3 !== null).length,
      activities: students.filter((s) => s.marks.activities !== null).length,
    };

    const threshold = Math.floor(students.length * 0.3); // At least 30% of students

    // Enable mark types based on data presence
    if (markCounts.fard1 >= threshold) corrected.hasFard1 = true;
    if (markCounts.fard2 >= threshold) corrected.hasFard2 = true;
    if (markCounts.fard3 >= threshold) corrected.hasFard3 = true;
    if (markCounts.activities >= threshold) corrected.hasActivities = true;

    // Use statistical signatures to distinguish activities from tests
    const stats = this.calculateMarkStatistics(students);

    // Activities typically have higher averages and less variance
    if (stats.activities.count > 0 && stats.fard1.count > 0) {
      if (stats.activities.average > stats.fard1.average + 2 && stats.activities.stdDev < stats.fard1.stdDev) {
        corrected.hasActivities = true;
      }
    }

    return corrected;
  }

  /**
   * Apply final consistency checks
   */
  private async applyConsistencyChecks(students: Student[]): Promise<{
    students: Student[];
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Check for students with no marks at all
    const studentsWithNoMarks = students.filter((student) =>
      Object.values(student.marks).every((mark) => mark === null)
    );

    if (studentsWithNoMarks.length > 0) {
      warnings.push(
        `${studentsWithNoMarks.length} students have no marks: ` + studentsWithNoMarks.map((s) => s.name).join(", ")
      );
    }

    // Check for students with only one mark (might indicate parsing issues)
    const studentsWithOneMarkOnly = students.filter((student) => {
      const nonNullMarks = Object.values(student.marks).filter((mark) => mark !== null);
      return nonNullMarks.length === 1;
    });

    if (studentsWithOneMarkOnly.length > students.length * 0.5) {
      warnings.push(
        `Many students (${studentsWithOneMarkOnly.length}) have only one mark. ` +
          `This might indicate table structure parsing issues.`
      );
    }

    return { students, warnings };
  }

  /**
   * Initialize correction rules for common OCR errors
   */
  private initializeCorrectionRules(): CorrectionRule[] {
    return [
      // Arabic letter corrections
      {
        name: "Arabic Letter Confusion - ر/ز",
        pattern: /[رز]/g,
        replacement: "ر",
        confidence: 0.7,
        applicableContext: ["all"],
      },
      {
        name: "Arabic Letter Confusion - د/ذ",
        pattern: /[دذ]/g,
        replacement: "د",
        confidence: 0.7,
        applicableContext: ["all"],
      },
      {
        name: "Arabic Letter Confusion - ص/ض",
        pattern: /[صض]/g,
        replacement: "ص",
        confidence: 0.6,
        applicableContext: ["all"],
      },
      {
        name: "Arabic Letter Confusion - ط/ظ",
        pattern: /[طظ]/g,
        replacement: "ط",
        confidence: 0.6,
        applicableContext: ["all"],
      },
      {
        name: "Arabic Letter Confusion - ع/غ",
        pattern: /[عغ]/g,
        replacement: "ع",
        confidence: 0.6,
        applicableContext: ["all"],
      },
      {
        name: "Arabic Letter Confusion - ف/ق",
        pattern: /[فق]/g,
        replacement: "ف",
        confidence: 0.5,
        applicableContext: ["all"],
      },

      // Normalize different forms of the same letter
      {
        name: "Normalize Alif variants",
        pattern: /[أإآا]/g,
        replacement: "ا",
        confidence: 0.9,
        applicableContext: ["all"],
      },
      {
        name: "Normalize Ya variants",
        pattern: /[يىی]/g,
        replacement: "ي",
        confidence: 0.9,
        applicableContext: ["all"],
      },
      {
        name: "Normalize Ha variants",
        pattern: /[هة]/g,
        replacement: "ه",
        confidence: 0.8,
        applicableContext: ["all"],
      },

      // Remove common OCR artifacts
      {
        name: "Remove Latin characters in Arabic names",
        pattern: /[a-zA-Z]/g,
        replacement: "",
        confidence: 0.8,
        applicableContext: ["all"],
      },
      {
        name: "Remove numbers in names",
        pattern: /[0-9۰-۹]/g,
        replacement: "",
        confidence: 0.9,
        applicableContext: ["all"],
      },
      {
        name: "Remove punctuation in names",
        pattern: /[.,;:!?]/g,
        replacement: "",
        confidence: 0.8,
        applicableContext: ["all"],
      },
      {
        name: "Convert pipe to Lam",
        pattern: /\|/g,
        replacement: "ل",
        confidence: 0.7,
        applicableContext: ["all"],
      },
      {
        name: "Normalize spaces",
        pattern: /\s+/g,
        replacement: " ",
        confidence: 0.95,
        applicableContext: ["all"],
      },

      // Common name patterns
      {
        name: "Fix Abd prefix",
        pattern: /عبد\s*ال/g,
        replacement: "عبدال",
        confidence: 0.9,
        applicableContext: ["all"],
      },
      {
        name: "Fix Abu prefix",
        pattern: /أبو\s+/g,
        replacement: "أبو ",
        confidence: 0.9,
        applicableContext: ["all"],
      },
      {
        name: "Fix bin/ibn",
        pattern: /\s+(بن|ابن)\s+/g,
        replacement: " بن ",
        confidence: 0.8,
        applicableContext: ["all"],
      },
    ];
  }

  /**
   * Validate student name using intelligent heuristics
   */
  private validateStudentName(name: string, context: ProcessingContext): ValidationResult {
    // Basic validation
    if (!name || name.trim().length < 2) {
      return {
        isValid: false,
        confidence: 0,
        reasoning: "Name too short or empty",
      };
    }

    const cleanName = name.trim();

    // Check for non-Arabic characters in Arabic context
    if (context.language === "arabic") {
      const arabicPattern = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+$/;
      if (!arabicPattern.test(cleanName)) {
        // Try to suggest a correction by removing non-Arabic characters
        const corrected = cleanName
          .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, "")
          .trim();
        if (corrected.length >= 2) {
          return {
            isValid: false,
            confidence: 0.8,
            suggestedCorrection: corrected,
            reasoning: "Removed non-Arabic characters",
          };
        }
      }
    }

    // Check for reasonable name length
    if (cleanName.length > 50) {
      return {
        isValid: false,
        confidence: 0.6,
        reasoning: "Name unusually long, might contain extra text",
      };
    }

    // Check for common name patterns
    const hasCommonPrefix = /^(عبد|أبو|بن|ابن|ال)/i.test(cleanName);
    const hasCommonSuffix = this.commonArabicNames.has(cleanName.split(" ").pop() || "");

    let confidence = 0.5;
    if (hasCommonPrefix) confidence += 0.2;
    if (hasCommonSuffix) confidence += 0.3;

    return {
      isValid: confidence > 0.6,
      confidence,
      reasoning: confidence > 0.6 ? "Valid Arabic name pattern" : "Unusual name pattern",
    };
  }

  /**
   * Find best matching name from known names list
   */
  private findBestNameMatch(targetName: string, knownNames: string[]): { name: string; similarity: number } | null {
    const normalizedTarget = this.normalizeNameForComparison(targetName);
    let bestMatch: { name: string; similarity: number } | null = null;

    for (const knownName of knownNames) {
      const normalizedKnown = this.normalizeNameForComparison(knownName);
      const similarity = this.calculateStringSimilarity(normalizedTarget, normalizedKnown);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { name: knownName, similarity };
      }
    }

    return bestMatch && bestMatch.similarity > 0.6 ? bestMatch : null;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

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

    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  /**
   * Intelligent mark correction using context and patterns
   */
  private intelligentMarkCorrection(
    mark: number,
    markType: string,
    allStudents: Student[],
    context: ProcessingContext
  ): number {
    // Get statistics for this mark type across all students
    const markValues = allStudents
      .map((s) => s.marks[markType as keyof Student["marks"]])
      .filter((m): m is number => m !== null);

    if (markValues.length < 3) return mark; // Not enough data for statistical correction

    const mean = markValues.reduce((sum, val) => sum + val, 0) / markValues.length;
    const variance = markValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / markValues.length;
    const stdDev = Math.sqrt(variance);

    // Check if mark is a statistical outlier
    const zScore = Math.abs((mark - mean) / stdDev);

    if (zScore > 2.5) {
      // Significant outlier
      // Common OCR error corrections

      // Decimal point errors
      if (mark < 3 && mean > 10) {
        // Likely 1.5 read as 15 -> should be 15
        const corrected = mark * 10;
        if (corrected <= 20 && Math.abs(corrected - mean) < Math.abs(mark - mean)) {
          return Math.round(corrected * 100) / 100;
        }
      }

      if (mark > 18 && mean < 10) {
        // Likely 19 read as 1.9 -> should be 1.9
        const corrected = mark / 10;
        if (Math.abs(corrected - mean) < Math.abs(mark - mean)) {
          return Math.round(corrected * 100) / 100;
        }
      }

      // Digit confusion (6/9, 3/8, etc.)
      const possibleCorrections = [
        mark + 3,
        mark - 3, // 6 <-> 9
        mark + 5,
        mark - 5, // 3 <-> 8
        mark + 1,
        mark - 1, // Adjacent digits
      ].filter((val) => val >= 0 && val <= 20);

      for (const correction of possibleCorrections) {
        const correctionZScore = Math.abs((correction - mean) / stdDev);
        if (correctionZScore < zScore) {
          return Math.round(correction * 100) / 100;
        }
      }
    }

    // Round to reasonable precision
    return Math.round(mark * 100) / 100;
  }

  /**
   * Calculate mark statistics
   */
  private calculateMarkStatistics(students: Student[]): Record<
    string,
    {
      count: number;
      min: number;
      max: number;
      average: number;
      stdDev: number;
    }
  > {
    const stats: Record<string, any> = {
      fard1: { values: [] },
      fard2: { values: [] },
      fard3: { values: [] },
      activities: { values: [] },
    };

    // Collect values
    students.forEach((student) => {
      Object.keys(stats).forEach((markType) => {
        const mark = student.marks[markType as keyof Student["marks"]];
        if (mark !== null) {
          stats[markType].values.push(mark);
        }
      });
    });

    // Calculate statistics
    Object.keys(stats).forEach((markType) => {
      const values = stats[markType].values;
      if (values.length > 0) {
        stats[markType].count = values.length;
        stats[markType].min = Math.min(...values);
        stats[markType].max = Math.max(...values);
        stats[markType].average = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;

        const variance =
          values.reduce((sum: number, val: number) => sum + Math.pow(val - stats[markType].average, 2), 0) /
          values.length;
        stats[markType].stdDev = Math.sqrt(variance);
      } else {
        stats[markType] = { count: 0, min: 0, max: 0, average: 0, stdDev: 0 };
      }
      delete stats[markType].values;
    });

    return stats;
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
}

// Export singleton instance
export const intelligentTextProcessor = new IntelligentTextProcessor();
