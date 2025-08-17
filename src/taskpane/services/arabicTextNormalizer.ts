/**
 * Advanced Arabic Text Normalization Service
 *
 * This service provides comprehensive Arabic text normalization and OCR error correction:
 * - Unicode normalization and character variant handling
 * - OCR-specific error patterns for Arabic text
 * - Contextual corrections based on Arabic linguistics
 * - Name-specific normalization for student records
 */

export interface NormalizationOptions {
  normalizeAlif: boolean;
  normalizeYa: boolean;
  normalizeHa: boolean;
  removeDiacritics: boolean;
  fixOCRErrors: boolean;
  contextualCorrection: boolean;
  preserveOriginalSpacing: boolean;
}

export interface NormalizationResult {
  normalizedText: string;
  appliedCorrections: Array<{
    type: string;
    original: string;
    corrected: string;
    position: number;
    confidence: number;
  }>;
  confidence: number;
}

export class ArabicTextNormalizer {
  // Arabic character mappings and patterns
  private readonly alifVariants = ["أ", "إ", "آ", "ا"];
  private readonly yaVariants = ["ي", "ى", "ی"];
  private readonly haVariants = ["ه", "ة"];
  private readonly kafVariants = ["ك", "ک"];

  // Common OCR errors in Arabic
  private readonly ocrErrorPatterns: Array<{
    pattern: RegExp;
    replacement: string;
    confidence: number;
    description: string;
  }> = [
    // Letter confusion patterns
    { pattern: /ر/g, replacement: "ر", confidence: 0.9, description: "Normalize Ra" },
    { pattern: /ز/g, replacement: "ر", confidence: 0.7, description: "Za confused with Ra" },
    { pattern: /د/g, replacement: "د", confidence: 0.9, description: "Normalize Dal" },
    { pattern: /ذ/g, replacement: "د", confidence: 0.6, description: "Thal confused with Dal" },
    { pattern: /ص/g, replacement: "ص", confidence: 0.9, description: "Normalize Sad" },
    { pattern: /ض/g, replacement: "ص", confidence: 0.5, description: "Dad confused with Sad" },
    { pattern: /ط/g, replacement: "ط", confidence: 0.9, description: "Normalize Ta" },
    { pattern: /ظ/g, replacement: "ط", confidence: 0.5, description: "Za confused with Ta" },
    { pattern: /ع/g, replacement: "ع", confidence: 0.9, description: "Normalize Ain" },
    { pattern: /غ/g, replacement: "ع", confidence: 0.4, description: "Ghain confused with Ain" },
    { pattern: /ف/g, replacement: "ف", confidence: 0.9, description: "Normalize Fa" },
    { pattern: /ق/g, replacement: "ف", confidence: 0.3, description: "Qaf confused with Fa" },

    // Latin character contamination
    { pattern: /l/g, replacement: "ل", confidence: 0.8, description: "Latin l to Arabic Lam" },
    { pattern: /I/g, replacement: "ل", confidence: 0.7, description: "Latin I to Arabic Lam" },
    { pattern: /1/g, replacement: "ل", confidence: 0.6, description: "Digit 1 to Arabic Lam" },
    { pattern: /o/g, replacement: "", confidence: 0.5, description: "Remove Latin o" },
    { pattern: /O/g, replacement: "", confidence: 0.5, description: "Remove Latin O" },
    { pattern: /0/g, replacement: "", confidence: 0.4, description: "Remove digit 0" },
    { pattern: /\|/g, replacement: "ل", confidence: 0.7, description: "Pipe to Arabic Lam" },

    // Spacing and punctuation issues
    { pattern: /\s*\.\s*/g, replacement: " ", confidence: 0.8, description: "Remove dots between words" },
    { pattern: /\s*,\s*/g, replacement: " ", confidence: 0.8, description: "Remove commas between words" },
    { pattern: /\s*;\s*/g, replacement: " ", confidence: 0.8, description: "Remove semicolons" },
    { pattern: /\s*:\s*/g, replacement: " ", confidence: 0.8, description: "Remove colons" },
    { pattern: /\s*-\s*/g, replacement: " ", confidence: 0.6, description: "Replace dashes with spaces" },
    { pattern: /\s*_\s*/g, replacement: " ", confidence: 0.6, description: "Replace underscores with spaces" },

    // Bracket and symbol removal
    { pattern: /[()[\]{}]/g, replacement: "", confidence: 0.9, description: "Remove brackets" },
    { pattern: /[<>]/g, replacement: "", confidence: 0.8, description: "Remove angle brackets" },
    { pattern: /[!@#$%^&*]/g, replacement: "", confidence: 0.9, description: "Remove special symbols" },

    // Arabic-specific patterns
    { pattern: /عبد\s+ال/g, replacement: "عبدال", confidence: 0.9, description: "Fix Abd Allah pattern" },
    { pattern: /أبو\s+/g, replacement: "أبو ", confidence: 0.8, description: "Fix Abu pattern" },
    { pattern: /بن\s+/g, replacement: "بن ", confidence: 0.8, description: "Fix bin pattern" },
    { pattern: /ابن\s+/g, replacement: "ابن ", confidence: 0.8, description: "Fix ibn pattern" },
    { pattern: /ال\s+/g, replacement: "ال", confidence: 0.7, description: "Fix definite article" },
  ];

  // Common Arabic name patterns for validation
  private readonly namePatterns = [
    /^عبد(ال|الله|الرحمن|الرحيم|الكريم|العزيز|الحميد|المجيد)/,
    /^أبو\s+\w+/,
    /^بن\s+\w+/,
    /^ابن\s+\w+/,
    /^ال\w+/,
    /محمد|أحمد|علي|حسن|حسين|عمر|خالد|سعد|فهد|عبدالله/,
    /فاطمة|عائشة|خديجة|مريم|زينب|أسماء|هند|نور|سارة|ليلى/,
  ];

  /**
   * Main normalization method
   */
  normalize(text: string, options: NormalizationOptions = this.getDefaultOptions()): NormalizationResult {
    console.log("🔤 Starting Arabic text normalization...");

    const corrections: Array<{
      type: string;
      original: string;
      corrected: string;
      position: number;
      confidence: number;
    }> = [];

    let normalizedText = text;
    let currentPosition = 0;

    // Step 1: Unicode normalization
    normalizedText = normalizedText.normalize("NFKC");

    // Step 2: Remove or normalize diacritics
    if (options.removeDiacritics) {
      const beforeDiacritics = normalizedText;
      normalizedText = this.removeDiacritics(normalizedText);
      if (beforeDiacritics !== normalizedText) {
        corrections.push({
          type: "diacritics_removal",
          original: beforeDiacritics,
          corrected: normalizedText,
          position: 0,
          confidence: 0.95,
        });
      }
    }

    // Step 3: Normalize character variants
    if (options.normalizeAlif) {
      const { text: newText, corrections: alifCorrections } = this.normalizeAlifVariants(normalizedText);
      normalizedText = newText;
      corrections.push(...alifCorrections);
    }

    if (options.normalizeYa) {
      const { text: newText, corrections: yaCorrections } = this.normalizeYaVariants(normalizedText);
      normalizedText = newText;
      corrections.push(...yaCorrections);
    }

    if (options.normalizeHa) {
      const { text: newText, corrections: haCorrections } = this.normalizeHaVariants(normalizedText);
      normalizedText = newText;
      corrections.push(...haCorrections);
    }

    // Step 4: Fix OCR-specific errors
    if (options.fixOCRErrors) {
      const { text: newText, corrections: ocrCorrections } = this.fixOCRErrors(normalizedText);
      normalizedText = newText;
      corrections.push(...ocrCorrections);
    }

    // Step 5: Apply contextual corrections
    if (options.contextualCorrection) {
      const { text: newText, corrections: contextCorrections } = this.applyContextualCorrections(normalizedText);
      normalizedText = newText;
      corrections.push(...contextCorrections);
    }

    // Step 6: Clean up spacing
    if (!options.preserveOriginalSpacing) {
      const beforeSpacing = normalizedText;
      normalizedText = this.normalizeSpacing(normalizedText);
      if (beforeSpacing !== normalizedText) {
        corrections.push({
          type: "spacing_normalization",
          original: beforeSpacing,
          corrected: normalizedText,
          position: 0,
          confidence: 0.9,
        });
      }
    }

    // Calculate overall confidence
    const overallConfidence = this.calculateNormalizationConfidence(text, normalizedText, corrections);

    console.log(`✅ Arabic normalization completed: ${corrections.length} corrections applied`);
    console.log(`📊 Confidence: ${overallConfidence.toFixed(3)}`);

    return {
      normalizedText: normalizedText.trim(),
      appliedCorrections: corrections,
      confidence: overallConfidence,
    };
  }

  /**
   * Normalize Alif variants to standard Alif
   */
  private normalizeAlifVariants(text: string): {
    text: string;
    corrections: Array<{ type: string; original: string; corrected: string; position: number; confidence: number }>;
  } {
    const corrections: Array<{
      type: string;
      original: string;
      corrected: string;
      position: number;
      confidence: number;
    }> = [];
    let result = text;

    this.alifVariants.forEach((variant, index) => {
      if (index === 3) return; // Skip standard alif (ا)

      const pattern = new RegExp(variant, "g");
      let match;
      while ((match = pattern.exec(result)) !== null) {
        corrections.push({
          type: "alif_normalization",
          original: variant,
          corrected: "ا",
          position: match.index,
          confidence: 0.95,
        });
      }
      result = result.replace(pattern, "ا");
    });

    return { text: result, corrections };
  }

  /**
   * Normalize Ya variants to standard Ya
   */
  private normalizeYaVariants(text: string): {
    text: string;
    corrections: Array<{ type: string; original: string; corrected: string; position: number; confidence: number }>;
  } {
    const corrections: Array<{
      type: string;
      original: string;
      corrected: string;
      position: number;
      confidence: number;
    }> = [];
    let result = text;

    this.yaVariants.forEach((variant, index) => {
      if (index === 0) return; // Skip standard ya (ي)

      const pattern = new RegExp(variant, "g");
      let match;
      while ((match = pattern.exec(result)) !== null) {
        corrections.push({
          type: "ya_normalization",
          original: variant,
          corrected: "ي",
          position: match.index,
          confidence: 0.9,
        });
      }
      result = result.replace(pattern, "ي");
    });

    return { text: result, corrections };
  }

  /**
   * Normalize Ha variants
   */
  private normalizeHaVariants(text: string): {
    text: string;
    corrections: Array<{ type: string; original: string; corrected: string; position: number; confidence: number }>;
  } {
    const corrections: Array<{
      type: string;
      original: string;
      corrected: string;
      position: number;
      confidence: number;
    }> = [];
    let result = text;

    // Context-aware Ha normalization
    // ة at end of words should remain ة, elsewhere convert to ه
    result = result.replace(/ة(?=\s|$)/g, "ة"); // Keep ة at word end
    result = result.replace(/ة/g, "ه"); // Convert other ة to ه

    // Find all changes and record them
    let originalIndex = 0;
    for (let i = 0; i < result.length; i++) {
      if (text[originalIndex] === "ة" && result[i] === "ه") {
        corrections.push({
          type: "ha_normalization",
          original: "ة",
          corrected: "ه",
          position: originalIndex,
          confidence: 0.8,
        });
      }
      originalIndex++;
    }

    return { text: result, corrections };
  }

  /**
   * Fix common OCR errors
   */
  private fixOCRErrors(text: string): {
    text: string;
    corrections: Array<{ type: string; original: string; corrected: string; position: number; confidence: number }>;
  } {
    const corrections: Array<{
      type: string;
      original: string;
      corrected: string;
      position: number;
      confidence: number;
    }> = [];
    let result = text;

    for (const errorPattern of this.ocrErrorPatterns) {
      const originalResult = result;
      result = result.replace(errorPattern.pattern, (match, offset) => {
        corrections.push({
          type: "ocr_error_correction",
          original: match,
          corrected: errorPattern.replacement,
          position: offset,
          confidence: errorPattern.confidence,
        });
        return errorPattern.replacement;
      });
    }

    return { text: result, corrections };
  }

  /**
   * Apply contextual corrections based on Arabic linguistics
   */
  private applyContextualCorrections(text: string): {
    text: string;
    corrections: Array<{ type: string; original: string; corrected: string; position: number; confidence: number }>;
  } {
    const corrections: Array<{
      type: string;
      original: string;
      corrected: string;
      position: number;
      confidence: number;
    }> = [];
    let result = text;

    // Fix common name patterns
    const namePatternFixes = [
      { pattern: /عبد\s*ال\s*(\w+)/g, replacement: "عبدال$1", confidence: 0.95 },
      { pattern: /أبو\s+(\w+)/g, replacement: "أبو $1", confidence: 0.9 },
      { pattern: /بن\s+(\w+)/g, replacement: "بن $1", confidence: 0.9 },
      { pattern: /ابن\s+(\w+)/g, replacement: "ابن $1", confidence: 0.9 },
      { pattern: /ال\s+(\w+)/g, replacement: "ال$1", confidence: 0.8 },
    ];

    for (const fix of namePatternFixes) {
      const originalResult = result;
      result = result.replace(fix.pattern, (match, ...groups) => {
        const corrected = fix.replacement.replace(/\$(\d+)/g, (_, num) => groups[parseInt(num) - 1] || "");
        corrections.push({
          type: "contextual_correction",
          original: match,
          corrected: corrected,
          position: result.indexOf(match),
          confidence: fix.confidence,
        });
        return corrected;
      });
    }

    // Fix letter combinations that are unlikely in Arabic
    const unlikelyCombinations = [
      { pattern: /ءء+/g, replacement: "ء", confidence: 0.9 },
      { pattern: /لل+/g, replacement: "ل", confidence: 0.8 },
      { pattern: /اا+/g, replacement: "ا", confidence: 0.9 },
      { pattern: /وو+/g, replacement: "و", confidence: 0.8 },
      { pattern: /يي+/g, replacement: "ي", confidence: 0.8 },
    ];

    for (const combo of unlikelyCombinations) {
      result = result.replace(combo.pattern, (match, offset) => {
        corrections.push({
          type: "unlikely_combination_fix",
          original: match,
          corrected: combo.replacement,
          position: offset,
          confidence: combo.confidence,
        });
        return combo.replacement;
      });
    }

    return { text: result, corrections };
  }

  /**
   * Remove Arabic diacritics
   */
  private removeDiacritics(text: string): string {
    // Arabic diacritics range: U+064B to U+065F, U+0670, U+06D6 to U+06ED
    return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  }

  /**
   * Normalize spacing
   */
  private normalizeSpacing(text: string): string {
    return text
      .replace(/\s+/g, " ") // Multiple spaces to single space
      .replace(/^\s+|\s+$/g, "") // Trim leading/trailing spaces
      .replace(/\s*([.،؟!])\s*/g, "$1 ") // Normalize punctuation spacing
      .trim();
  }

  /**
   * Calculate normalization confidence
   */
  private calculateNormalizationConfidence(
    original: string,
    normalized: string,
    corrections: Array<{ confidence: number }>
  ): number {
    if (original === normalized) return 1.0;

    // Base confidence on the number and quality of corrections
    if (corrections.length === 0) return 0.9;

    const avgCorrectionConfidence = corrections.reduce((sum, corr) => sum + corr.confidence, 0) / corrections.length;
    const changeRatio = Math.abs(original.length - normalized.length) / Math.max(original.length, 1);

    // Lower confidence for major changes
    const changeImpact = Math.max(0, 1 - changeRatio * 2);

    return Math.min(1, avgCorrectionConfidence * changeImpact);
  }

  /**
   * Validate if text looks like an Arabic name
   */
  validateArabicName(text: string): {
    isValid: boolean;
    confidence: number;
    issues: string[];
    suggestions?: string;
  } {
    const issues: string[] = [];
    let confidence = 1.0;

    // Check if text is too short or too long
    if (text.length < 2) {
      issues.push("Name too short");
      confidence -= 0.5;
    } else if (text.length > 50) {
      issues.push("Name unusually long");
      confidence -= 0.3;
    }

    // Check for Arabic characters
    const arabicCharPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    if (!arabicCharPattern.test(text)) {
      issues.push("No Arabic characters found");
      confidence -= 0.8;
    }

    // Check for non-Arabic characters
    const nonArabicPattern = /[a-zA-Z0-9]/;
    if (nonArabicPattern.test(text)) {
      issues.push("Contains non-Arabic characters");
      confidence -= 0.4;
    }

    // Check for common name patterns
    let hasCommonPattern = false;
    for (const pattern of this.namePatterns) {
      if (pattern.test(text)) {
        hasCommonPattern = true;
        break;
      }
    }

    if (hasCommonPattern) {
      confidence += 0.2;
    } else {
      issues.push("No recognized name patterns");
      confidence -= 0.2;
    }

    // Check for reasonable word count (Arabic names typically 2-4 words)
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 2) {
      issues.push("Single word name (uncommon)");
      confidence -= 0.1;
    } else if (wordCount > 4) {
      issues.push("Too many words for a typical name");
      confidence -= 0.2;
    }

    confidence = Math.max(0, Math.min(1, confidence));

    return {
      isValid: confidence > 0.6 && issues.length < 3,
      confidence,
      issues,
      suggestions: confidence < 0.6 ? this.suggestNameCorrection(text) : undefined,
    };
  }

  /**
   * Suggest correction for invalid names
   */
  private suggestNameCorrection(text: string): string {
    // Apply aggressive normalization for suggestions
    const aggressiveOptions: NormalizationOptions = {
      normalizeAlif: true,
      normalizeYa: true,
      normalizeHa: true,
      removeDiacritics: true,
      fixOCRErrors: true,
      contextualCorrection: true,
      preserveOriginalSpacing: false,
    };

    const result = this.normalize(text, aggressiveOptions);
    return result.normalizedText;
  }

  /**
   * Get default normalization options
   */
  private getDefaultOptions(): NormalizationOptions {
    return {
      normalizeAlif: true,
      normalizeYa: true,
      normalizeHa: true,
      removeDiacritics: true,
      fixOCRErrors: true,
      contextualCorrection: true,
      preserveOriginalSpacing: false,
    };
  }

  /**
   * Get conservative normalization options (for high-confidence text)
   */
  getConservativeOptions(): NormalizationOptions {
    return {
      normalizeAlif: true,
      normalizeYa: false,
      normalizeHa: false,
      removeDiacritics: true,
      fixOCRErrors: false,
      contextualCorrection: false,
      preserveOriginalSpacing: true,
    };
  }

  /**
   * Get aggressive normalization options (for low-confidence text)
   */
  getAggressiveOptions(): NormalizationOptions {
    return {
      normalizeAlif: true,
      normalizeYa: true,
      normalizeHa: true,
      removeDiacritics: true,
      fixOCRErrors: true,
      contextualCorrection: true,
      preserveOriginalSpacing: false,
    };
  }

  /**
   * Batch normalize multiple texts
   */
  batchNormalize(texts: string[], options?: NormalizationOptions): NormalizationResult[] {
    return texts.map((text) => this.normalize(text, options));
  }
}

// Export singleton instance
export const arabicTextNormalizer = new ArabicTextNormalizer();
