/**
 * Enhanced Google Vision Service with Advanced OCR Strategies
 *
 * This service implements multiple Google Vision API strategies to maximize
 * OCR accuracy through:
 * - Multiple detection types and configurations
 * - Confidence-based result fusion
 * - Context-aware post-processing
 * - Adaptive retry mechanisms
 */

import { Student, DetectedMarkTypes } from "../types";
import { imagePreprocessingService, ImageQualityMetrics } from "./imagePreprocessingService";

export interface VisionAPIResult {
  students: Student[];
  detectedMarkTypes: DetectedMarkTypes;
  confidence: number;
  strategy: string;
  processingTime: number;
  warnings: string[];
}

export interface OCRStrategy {
  name: string;
  features: any[];
  imageContext: any;
  priority: number;
  minConfidence: number;
}

export class EnhancedGoogleVisionService {
  private readonly strategies: OCRStrategy[] = [
    {
      name: "Document Text Detection - High Accuracy",
      features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 100 }],
      imageContext: {
        languageHints: ["ar", "en"],
        textDetectionParams: {
          enableTextDetectionConfidenceScore: true,
        },
      },
      priority: 1,
      minConfidence: 0.8,
    },
    {
      name: "Text Detection - Standard",
      features: [{ type: "TEXT_DETECTION", maxResults: 50 }],
      imageContext: {
        languageHints: ["ar", "en"],
      },
      priority: 2,
      minConfidence: 0.7,
    },
    {
      name: "Document Text Detection - Arabic Focused",
      features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 100 }],
      imageContext: {
        languageHints: ["ar"],
        textDetectionParams: {
          enableTextDetectionConfidenceScore: true,
        },
        cropHintsParams: {
          aspectRatios: [1.0, 1.77, 0.56], // Common document ratios
        },
      },
      priority: 3,
      minConfidence: 0.75,
    },
    {
      name: "Handwriting Detection",
      features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 100 }],
      imageContext: {
        languageHints: ["ar"],
        textDetectionParams: {
          enableTextDetectionConfidenceScore: true,
          advancedOcrOptions: ["LEGACY_CLOUD_TEXT"],
        },
      },
      priority: 4,
      minConfidence: 0.6,
    },
  ];

  /**
   * Process image with multiple strategies and return best result
   */
  async processImageWithMultipleStrategies(
    imageFile: File,
    usePreprocessing: boolean = true
  ): Promise<VisionAPIResult> {
    console.log("🚀 Starting enhanced Google Vision processing...");

    const startTime = Date.now();
    let preprocessedImage = imageFile;
    let qualityMetrics: ImageQualityMetrics | null = null;

    // Apply image preprocessing if enabled
    if (usePreprocessing) {
      try {
        const preprocessing = await imagePreprocessingService.preprocessImage(imageFile);
        preprocessedImage = new File([preprocessing.enhancedImage], imageFile.name, {
          type: "image/png",
        });
        qualityMetrics = preprocessing.qualityMetrics;
        console.log("✅ Image preprocessing completed:", preprocessing.appliedEnhancements);
      } catch (error) {
        console.warn("⚠️ Image preprocessing failed, using original:", error);
      }
    }

    const results: VisionAPIResult[] = [];
    const warnings: string[] = [];

    // Try each strategy
    for (const strategy of this.strategies) {
      try {
        console.log(`🔍 Trying strategy: ${strategy.name}`);

        const result = await this.executeStrategy(preprocessedImage, strategy, qualityMetrics);

        if (result.confidence >= strategy.minConfidence) {
          results.push(result);
          console.log(`✅ Strategy "${strategy.name}" succeeded with confidence: ${result.confidence.toFixed(3)}`);

          // If we get a high-confidence result early, we can stop
          if (result.confidence > 0.9 && result.students.length > 0) {
            console.log("🎯 High confidence result found, stopping early");
            break;
          }
        } else {
          console.log(`⚠️ Strategy "${strategy.name}" low confidence: ${result.confidence.toFixed(3)}`);
          warnings.push(`Strategy "${strategy.name}" had low confidence: ${result.confidence.toFixed(3)}`);
        }
      } catch (error) {
        console.error(`❌ Strategy "${strategy.name}" failed:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Strategy "${strategy.name}" failed: ${errorMessage}`);
      }
    }

    if (results.length === 0) {
      throw new Error("All OCR strategies failed. " + warnings.join("; "));
    }

    // Select best result or fuse multiple results
    const bestResult = await this.selectBestResult(results);
    bestResult.processingTime = Date.now() - startTime;
    bestResult.warnings = warnings;

    console.log(`🏆 Best result selected: ${bestResult.strategy} (confidence: ${bestResult.confidence.toFixed(3)})`);
    console.log(`⏱️ Total processing time: ${bestResult.processingTime}ms`);

    return bestResult;
  }

  /**
   * Execute a specific OCR strategy
   */
  private async executeStrategy(
    imageFile: File,
    strategy: OCRStrategy,
    qualityMetrics: ImageQualityMetrics | null
  ): Promise<VisionAPIResult> {
    const startTime = Date.now();

    // Convert image to base64
    const base64Image = await this.fileToBase64(imageFile);
    const base64Content = base64Image.split(",")[1];

    // Get API key
    const apiKey = process.env.GOOGLE_VISION_AI_API_KEY || process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw new Error("Google Vision API key not found");
    }

    // Prepare request
    const requestBody = {
      requests: [
        {
          image: { content: base64Content },
          features: strategy.features,
          imageContext: strategy.imageContext,
        },
      ],
    };

    // Make API call
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Vision API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log(`📊 ${strategy.name} - Raw API Response:`, JSON.stringify(data, null, 2));

    // Process response
    const extractedData = await this.processVisionResponse(data, strategy.name, qualityMetrics);

    return {
      ...extractedData,
      strategy: strategy.name,
      processingTime: Date.now() - startTime,
      warnings: [],
    };
  }

  /**
   * Process Google Vision API response and extract structured data
   */
  private async processVisionResponse(
    apiResponse: any,
    strategyName: string,
    qualityMetrics: ImageQualityMetrics | null
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes; confidence: number }> {
    if (!apiResponse.responses || !apiResponse.responses[0]) {
      return { students: [], detectedMarkTypes: this.getEmptyDetectedMarkTypes(), confidence: 0 };
    }

    const response = apiResponse.responses[0];

    // Handle different response types
    let textAnnotations = response.textAnnotations || [];
    let fullTextAnnotation = response.fullTextAnnotation;

    if (textAnnotations.length === 0 && !fullTextAnnotation) {
      return { students: [], detectedMarkTypes: this.getEmptyDetectedMarkTypes(), confidence: 0 };
    }

    // Extract text with confidence scores
    const extractedText = this.extractTextWithConfidence(textAnnotations, fullTextAnnotation);

    // Parse text into structured data
    const structuredData = await this.parseTextToStudentData(extractedText, qualityMetrics);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(extractedText, structuredData, qualityMetrics);

    return {
      students: structuredData.students,
      detectedMarkTypes: structuredData.detectedMarkTypes,
      confidence: overallConfidence,
    };
  }

  /**
   * Extract text with confidence scores from API response
   */
  private extractTextWithConfidence(
    textAnnotations: any[],
    fullTextAnnotation: any
  ): Array<{
    text: string;
    confidence: number;
    boundingBox: any;
    isLine: boolean;
  }> {
    const textBlocks: Array<{ text: string; confidence: number; boundingBox: any; isLine: boolean }> = [];

    // Process full text annotation if available (preferred)
    if (fullTextAnnotation && fullTextAnnotation.pages) {
      for (const page of fullTextAnnotation.pages) {
        for (const block of page.blocks || []) {
          for (const paragraph of block.paragraphs || []) {
            let paragraphText = "";
            let totalConfidence = 0;
            let wordCount = 0;

            for (const word of paragraph.words || []) {
              let wordText = "";
              let wordConfidence = 0;
              let symbolCount = 0;

              for (const symbol of word.symbols || []) {
                wordText += symbol.text;
                if (symbol.confidence !== undefined) {
                  wordConfidence += symbol.confidence;
                  symbolCount++;
                }
              }

              if (symbolCount > 0) {
                wordConfidence /= symbolCount;
                totalConfidence += wordConfidence;
                wordCount++;
              }

              paragraphText += wordText + " ";
            }

            if (wordCount > 0) {
              textBlocks.push({
                text: paragraphText.trim(),
                confidence: totalConfidence / wordCount,
                boundingBox: paragraph.boundingBox,
                isLine: true,
              });
            }
          }
        }
      }
    }

    // Fallback to text annotations
    if (textBlocks.length === 0 && textAnnotations.length > 0) {
      // Skip first annotation (full text) and process individual text blocks
      for (let i = 1; i < textAnnotations.length; i++) {
        const annotation = textAnnotations[i];
        textBlocks.push({
          text: annotation.description || "",
          confidence: annotation.confidence || 0.8, // Default confidence
          boundingBox: annotation.boundingPoly,
          isLine: false,
        });
      }
    }

    return textBlocks;
  }

  /**
   * Parse extracted text into student data structure
   */
  private async parseTextToStudentData(
    textBlocks: Array<{ text: string; confidence: number; boundingBox: any; isLine: boolean }>,
    qualityMetrics: ImageQualityMetrics | null
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Combine all text for comprehensive parsing
    const fullText = textBlocks.map((block) => block.text).join("\n");
    console.log("📝 Full extracted text for parsing:", fullText);

    // Enhanced parsing logic
    const students: Student[] = [];
    const detectedMarkTypes = this.getEmptyDetectedMarkTypes();

    // Split text into lines and process each line
    const lines = fullText.split("\n").filter((line) => line.trim().length > 0);

    // Detect mark type headers
    this.detectMarkTypes(lines, detectedMarkTypes);

    // Parse student data from lines
    let studentNumber = 1;

    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length === 0) continue;

      // Skip header lines
      if (this.isHeaderLine(cleanLine)) continue;

      // Try to parse as student data
      const studentData = this.parseStudentLine(cleanLine, studentNumber);
      if (studentData) {
        students.push(studentData);
        studentNumber++;
      }
    }

    // Apply intelligent corrections based on context
    const correctedStudents = await this.applyContextualCorrections(students, textBlocks, qualityMetrics);

    return {
      students: correctedStudents,
      detectedMarkTypes,
    };
  }

  /**
   * Detect mark types from header text
   */
  private detectMarkTypes(lines: string[], detectedMarkTypes: DetectedMarkTypes): void {
    const combinedText = lines.join(" ").toLowerCase();

    // Enhanced pattern matching for mark types
    const patterns = {
      fard1: [/فرض.*?1/i, /الفرض.*?الأول/i, /فرض.*?١/i, /اختبار.*?1/i, /test.*?1/i],
      fard2: [/فرض.*?2/i, /الفرض.*?الثاني/i, /فرض.*?٢/i, /اختبار.*?2/i, /test.*?2/i],
      fard3: [/فرض.*?3/i, /الفرض.*?الثالث/i, /فرض.*?٣/i, /اختبار.*?3/i, /test.*?3/i],
      activities: [/أنشطة/i, /النشاط/i, /الأنشطة/i, /مراقبة/i, /مستمرة/i, /activities/i, /homework/i],
    };

    for (const [markType, typePatterns] of Object.entries(patterns)) {
      for (const pattern of typePatterns) {
        if (pattern.test(combinedText)) {
          (detectedMarkTypes as any)[`has${markType.charAt(0).toUpperCase() + markType.slice(1)}`] = true;
          console.log(`✅ Detected mark type: ${markType}`);
          break;
        }
      }
    }
  }

  /**
   * Check if a line is a header line
   */
  private isHeaderLine(line: string): boolean {
    const headerPatterns = [
      /^(رقم|الرقم|number|#)/i,
      /^(اسم|الاسم|name)/i,
      /^(فرض|اختبار|test|exam)/i,
      /^(أنشطة|نشاط|activities)/i,
      /^(علامة|درجة|mark|grade)/i,
      /^\s*[-=_]+\s*$/, // Separator lines
      /^\s*\|\s*\|\s*\|/, // Table separators
    ];

    return headerPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Parse a single line as student data
   */
  private parseStudentLine(line: string, defaultNumber: number): Student | null {
    // Enhanced regex patterns for student data
    const patterns = [
      // Pattern: Number | Name | Mark1 | Mark2 | Mark3 | Activities
      /^(\d+)[\s|]+([^|]+?)[\s|]+([\d.,]+)[\s|]+([\d.,]+)[\s|]+([\d.,]+)[\s|]+([\d.,]+)/,
      // Pattern: Number Name Mark1 Mark2 Mark3 Activities (space separated)
      /^(\d+)\s+([^\d]+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/,
      // Pattern: Name Mark1 Mark2 Mark3 (no number)
      /^([^\d]+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s+([\d.,]+))?/,
      // Pattern: Number Name Mark (single mark)
      /^(\d+)\s+([^\d]+?)\s+([\d.,]+)$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return this.createStudentFromMatch(match, defaultNumber);
      }
    }

    return null;
  }

  /**
   * Create student object from regex match
   */
  private createStudentFromMatch(match: RegExpMatchArray, defaultNumber: number): Student {
    const hasNumber = /^\d+$/.test(match[1]);

    let number: number;
    let name: string;
    let markStartIndex: number;

    if (hasNumber) {
      number = parseInt(match[1]);
      name = match[2].trim();
      markStartIndex = 3;
    } else {
      number = defaultNumber;
      name = match[1].trim();
      markStartIndex = 2;
    }

    // Parse marks
    const marks = {
      fard1: this.parseMarkValue(match[markStartIndex]),
      fard2: this.parseMarkValue(match[markStartIndex + 1]),
      fard3: this.parseMarkValue(match[markStartIndex + 2]),
      fard4: null,
      activities: this.parseMarkValue(match[markStartIndex + 3]),
    };

    return {
      number,
      name: this.cleanStudentName(name),
      marks,
    };
  }

  /**
   * Parse and validate mark value
   */
  private parseMarkValue(markStr: string): number | null {
    if (!markStr || markStr.trim() === "") return null;

    // Clean the mark string
    let cleaned = markStr
      .trim()
      .replace(/[,،]/g, ".") // Replace Arabic/French commas with decimal point
      .replace(/[^\d.]/g, ""); // Remove non-numeric characters except decimal point

    if (cleaned === "") return null;

    const value = parseFloat(cleaned);

    // Validate range
    if (isNaN(value) || value < 0 || value > 20) return null;

    return Math.round(value * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Clean student name
   */
  private cleanStudentName(name: string): string {
    return name
      .replace(/[|]/g, "") // Remove table separators
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  /**
   * Apply contextual corrections to extracted student data
   */
  private async applyContextualCorrections(
    students: Student[],
    textBlocks: Array<{ text: string; confidence: number; boundingBox: any; isLine: boolean }>,
    qualityMetrics: ImageQualityMetrics | null
  ): Promise<Student[]> {
    let correctedStudents = [...students];

    // Sort by student number
    correctedStudents.sort((a, b) => a.number - b.number);

    // Fix sequential numbering
    correctedStudents = this.fixStudentNumbering(correctedStudents);

    // Apply statistical validation
    correctedStudents = this.validateMarksStatistically(correctedStudents);

    // Fix common OCR errors in names
    correctedStudents = this.fixNameOCRErrors(correctedStudents);

    // Apply confidence-based corrections
    if (qualityMetrics) {
      correctedStudents = this.applyQualityBasedCorrections(correctedStudents, qualityMetrics);
    }

    return correctedStudents;
  }

  /**
   * Fix student numbering sequence
   */
  private fixStudentNumbering(students: Student[]): Student[] {
    return students.map((student, index) => ({
      ...student,
      number: index + 1, // Ensure sequential numbering
    }));
  }

  /**
   * Validate marks using statistical analysis
   */
  private validateMarksStatistically(students: Student[]): Student[] {
    if (students.length < 3) return students;

    const markTypes: Array<keyof Student["marks"]> = ["fard1", "fard2", "fard3", "activities"];

    for (const markType of markTypes) {
      const values = students.map((s) => s.marks[markType]).filter((mark): mark is number => mark !== null);

      if (values.length < 3) continue;

      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Fix outliers
      students.forEach((student) => {
        const mark = student.marks[markType];
        if (mark !== null) {
          const zScore = Math.abs((mark - mean) / stdDev);

          if (zScore > 3) {
            // Outlier
            // Try common corrections
            if (mark < 3 && mean > 10) {
              // Likely decimal point error: 1.5 -> 15
              const corrected = mark * 10;
              if (corrected <= 20) {
                student.marks[markType] = corrected;
                console.log(`📊 Statistical correction: ${mark} -> ${corrected} for ${markType}`);
              }
            } else if (mark > 18 && mean < 10) {
              // Likely decimal point error: 19 -> 1.9
              const corrected = mark / 10;
              student.marks[markType] = corrected;
              console.log(`📊 Statistical correction: ${mark} -> ${corrected} for ${markType}`);
            }
          }
        }
      });
    }

    return students;
  }

  /**
   * Fix common OCR errors in student names
   */
  private fixNameOCRErrors(students: Student[]): Student[] {
    return students.map((student) => ({
      ...student,
      name: this.fixArabicNameOCRErrors(student.name),
    }));
  }

  /**
   * Fix Arabic name OCR errors
   */
  private fixArabicNameOCRErrors(name: string): string {
    const corrections: Array<[RegExp, string]> = [
      // Common OCR confusions in Arabic
      [/[رز]/g, "ر"], // OCR often confuses ر and ز
      [/[دذ]/g, "د"], // OCR often confuses د and ذ
      [/[صض]/g, "ص"], // OCR often confuses ص and ض
      [/[طظ]/g, "ط"], // OCR often confuses ط and ظ
      [/[عغ]/g, "ع"], // OCR often confuses ع and غ
      [/[فق]/g, "ف"], // OCR often confuses ف and ق
      [/[كک]/g, "ك"], // Normalize different forms of Kaf
      [/[يى]/g, "ي"], // Normalize different forms of Ya
      [/[هة]/g, "ه"], // Normalize different forms of Ha

      // Common OCR artifacts
      [/[0-9]/g, ""], // Remove stray numbers
      [/[.,;:]/g, ""], // Remove punctuation
      [/[()[\]{}]/g, ""], // Remove brackets
      [/[-_]/g, " "], // Convert dashes to spaces
      [/[|]/g, "ل"], // OCR sometimes reads ل as |
      [/[l1I]/g, "ل"], // Latin characters often misread as Arabic ل
      [/\s+/g, " "], // Multiple spaces to single space
    ];

    let corrected = name;
    for (const [pattern, replacement] of corrections) {
      corrected = corrected.replace(pattern, replacement);
    }

    return corrected.trim();
  }

  /**
   * Apply corrections based on image quality metrics
   */
  private applyQualityBasedCorrections(students: Student[], qualityMetrics: ImageQualityMetrics): Student[] {
    // If image quality is low, be more aggressive with corrections
    if (qualityMetrics.overallScore < 0.6) {
      console.log("📉 Low image quality detected, applying aggressive corrections");

      return students.map((student) => {
        const correctedMarks = { ...student.marks };

        // More aggressive mark corrections for low quality images
        Object.keys(correctedMarks).forEach((markType) => {
          const mark = correctedMarks[markType as keyof typeof correctedMarks];
          if (mark !== null) {
            // Round to nearest 0.5 for low quality images
            correctedMarks[markType as keyof typeof correctedMarks] = Math.round(mark * 2) / 2;
          }
        });

        return {
          ...student,
          marks: correctedMarks,
        };
      });
    }

    return students;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    textBlocks: Array<{ text: string; confidence: number; boundingBox: any; isLine: boolean }>,
    structuredData: { students: Student[]; detectedMarkTypes: DetectedMarkTypes },
    qualityMetrics: ImageQualityMetrics | null
  ): number {
    // Base confidence from OCR
    const avgOCRConfidence =
      textBlocks.length > 0 ? textBlocks.reduce((sum, block) => sum + block.confidence, 0) / textBlocks.length : 0;

    // Data structure confidence
    const dataConfidence = this.calculateDataStructureConfidence(structuredData);

    // Image quality factor
    const qualityFactor = qualityMetrics ? qualityMetrics.overallScore : 0.7;

    // Combined confidence
    const combinedConfidence = avgOCRConfidence * 0.4 + dataConfidence * 0.4 + qualityFactor * 0.2;

    return Math.max(0, Math.min(1, combinedConfidence));
  }

  /**
   * Calculate confidence based on data structure quality
   */
  private calculateDataStructureConfidence(structuredData: {
    students: Student[];
    detectedMarkTypes: DetectedMarkTypes;
  }): number {
    if (structuredData.students.length === 0) return 0;

    let score = 0;
    const students = structuredData.students;

    // Student count factor (reasonable number of students)
    if (students.length >= 5 && students.length <= 50) {
      score += 0.2;
    }

    // Name quality factor
    const validNames = students.filter((s) => s.name && s.name.length > 2).length;
    score += (validNames / students.length) * 0.3;

    // Mark availability factor
    const totalPossibleMarks = students.length * 4; // 4 mark types
    let totalActualMarks = 0;
    students.forEach((student) => {
      Object.values(student.marks).forEach((mark) => {
        if (mark !== null) totalActualMarks++;
      });
    });
    score += (totalActualMarks / totalPossibleMarks) * 0.3;

    // Sequential numbering factor
    const hasSequentialNumbers = students.every((student, index) => student.number === index + 1);
    if (hasSequentialNumbers) score += 0.1;

    // Mark type detection factor
    const detectedTypes = Object.values(structuredData.detectedMarkTypes).filter(Boolean).length;
    score += (detectedTypes / 4) * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Select best result from multiple strategy results
   */
  private async selectBestResult(results: VisionAPIResult[]): Promise<VisionAPIResult> {
    if (results.length === 1) return results[0];

    // Sort by confidence and student count
    results.sort((a, b) => {
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;
      return b.students.length - a.students.length;
    });

    // Consider result fusion if multiple high-confidence results
    const highConfidenceResults = results.filter((r) => r.confidence > 0.7);

    if (highConfidenceResults.length > 1) {
      console.log("🔄 Multiple high-confidence results found, attempting fusion...");
      const fusedResult = await this.fuseResults(highConfidenceResults);
      if (fusedResult) return fusedResult;
    }

    return results[0];
  }

  /**
   * Fuse multiple OCR results for better accuracy
   */
  private async fuseResults(results: VisionAPIResult[]): Promise<VisionAPIResult | null> {
    if (results.length < 2) return null;

    // Simple fusion strategy: take the result with most students and highest confidence
    const bestByStudents = results.reduce((best, current) =>
      current.students.length > best.students.length ? current : best
    );

    const bestByConfidence = results.reduce((best, current) => (current.confidence > best.confidence ? current : best));

    // If same result, return it
    if (bestByStudents === bestByConfidence) {
      return bestByStudents;
    }

    // Otherwise, merge complementary data
    const fusedStudents = [...bestByStudents.students];

    // Add missing students from other results
    for (const result of results) {
      for (const student of result.students) {
        const existingIndex = fusedStudents.findIndex(
          (s) => this.normalizeNameForComparison(s.name) === this.normalizeNameForComparison(student.name)
        );

        if (existingIndex === -1) {
          fusedStudents.push(student);
        } else {
          // Merge marks from different results
          const existing = fusedStudents[existingIndex];
          Object.keys(student.marks).forEach((markType) => {
            const key = markType as keyof typeof student.marks;
            if (existing.marks[key] === null && student.marks[key] !== null) {
              existing.marks[key] = student.marks[key];
            }
          });
        }
      }
    }

    // Calculate fused confidence
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      students: fusedStudents,
      detectedMarkTypes: bestByConfidence.detectedMarkTypes,
      confidence: avgConfidence,
      strategy: "Fused Results",
      processingTime: Math.max(...results.map((r) => r.processingTime)),
      warnings: results.flatMap((r) => r.warnings),
    };
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
   * Convert file to base64
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get empty detected mark types object
   */
  private getEmptyDetectedMarkTypes(): DetectedMarkTypes {
    return {
      hasFard1: false,
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    };
  }
}

// Export singleton instance
export const enhancedGoogleVisionService = new EnhancedGoogleVisionService();
