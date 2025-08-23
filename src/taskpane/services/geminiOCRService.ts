/**
 * Gemini OCR Service for Advanced Image Data Extraction
 *
 * This service uses Google's Gemini AI model for sophisticated image processing
 * and data extraction with higher accuracy than traditional OCR.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Student, DetectedMarkTypes } from "../types";

export interface GeminiOCRResult {
  students: Student[];
  detectedMarkTypes: DetectedMarkTypes;
  confidence: number;
  processingTime: number;
  rawResponse?: string;
  warnings: string[];
}

export class GeminiOCRService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not found. Please set GEMINI_API_KEY environment variable.");
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Using Gemini 1.5 Flash for faster responses
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * Process image using Gemini AI
   */
  async processImage(imageFile: File): Promise<GeminiOCRResult> {
    console.log("🚀 Starting Gemini AI image processing...");
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      const base64Content = base64Image.split(",")[1];

      // Create the prompt for Gemini
      const prompt = this.createExtractionPrompt();

      // Prepare the image part
      const imagePart = {
        inlineData: {
          data: base64Content,
          mimeType: imageFile.type || "image/jpeg"
        }
      };

      // Generate content with Gemini
      console.log("📤 Sending image to Gemini AI...");
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      console.log("📥 Received response from Gemini");
      console.log("Raw response:", text);

      // Parse the response
      const extractedData = this.parseGeminiResponse(text);
      
      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Processing completed in ${processingTime}ms`);

      return {
        ...extractedData,
        processingTime,
        rawResponse: text,
        warnings
      };

    } catch (error) {
      console.error("❌ Gemini processing error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`فشل معالجة الصورة باستخدام Gemini: ${errorMessage}`);
    }
  }

  /**
   * Create a detailed prompt for Gemini to extract data
   */
  private createExtractionPrompt(): string {
    return `You are an expert at extracting student marks data from Arabic educational documents.

Analyze this image of a student marks sheet and extract the following information:

1. **Student Data**: Extract each student's information including:
   - Student number (رقم)
   - Student name in Arabic (اسم التلميذ)
   - Marks for different assessments

2. **Mark Types**: Identify which types of marks are present:
   - الفرض الأول (Fard 1 / First Test)
   - الفرض الثاني (Fard 2 / Second Test)
   - الفرض الثالث (Fard 3 / Third Test)
   - الأنشطة (Activities)
   - Any other mark types

3. **Important Instructions**:
   - Be extremely careful with Arabic names - preserve them exactly as written
   - Convert Arabic numerals (٠-٩) to Western numerals (0-9)
   - Handle marks with commas (e.g., "15,50") correctly as decimal values
   - If a mark is missing or unclear, return null for that field
   - Ensure student numbers are sequential starting from 1

Please return the data in the following JSON format ONLY (no additional text):

{
  "students": [
    {
      "number": 1,
      "name": "اسم الطالب",
      "marks": {
        "fard1": 15.5,
        "fard2": null,
        "fard3": null,
        "activities": null
      }
    }
  ],
  "detectedMarkTypes": {
    "hasFard1": true,
    "hasFard2": false,
    "hasFard3": false,
    "hasFard4": false,
    "hasActivities": false
  },
  "confidence": 0.95
}

Return ONLY the JSON object, no markdown formatting, no code blocks, just pure JSON.`;
  }

  /**
   * Parse Gemini's response and extract structured data
   */
  private parseGeminiResponse(responseText: string): Omit<GeminiOCRResult, 'processingTime' | 'rawResponse'> {
    try {
      // Clean the response text - remove any markdown formatting if present
      let cleanedText = responseText.trim();
      
      // Remove code blocks if present
      cleanedText = cleanedText.replace(/```json\n?/gi, '');
      cleanedText = cleanedText.replace(/```\n?/g, '');
      
      // Try to find JSON object in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in Gemini response");
      }

      // Parse the JSON
      const data = JSON.parse(jsonMatch[0]);
      
      // Validate and process the data
      const students = this.validateAndProcessStudents(data.students || []);
      const detectedMarkTypes = this.validateMarkTypes(data.detectedMarkTypes || {});
      const confidence = this.calculateConfidence(data.confidence, students);

      console.log(`✅ Successfully parsed ${students.length} students from Gemini response`);

      return {
        students,
        detectedMarkTypes,
        confidence,
        warnings: []
      };

    } catch (error) {
      console.error("❌ Error parsing Gemini response:", error);
      
      // Fallback: Try to extract data using patterns
      return this.fallbackExtraction(responseText);
    }
  }

  /**
   * Validate and process student data
   */
  private validateAndProcessStudents(studentsData: any[]): Student[] {
    if (!Array.isArray(studentsData)) {
      console.warn("Students data is not an array");
      return [];
    }

    const students: Student[] = [];
    
    for (let i = 0; i < studentsData.length; i++) {
      const studentData = studentsData[i];
      
      if (!studentData || typeof studentData !== 'object') {
        console.warn(`Invalid student data at index ${i}`);
        continue;
      }

      const student: Student = {
        number: studentData.number || (i + 1),
        name: this.cleanStudentName(studentData.name || ""),
        marks: {
          fard1: this.parseMarkValue(studentData.marks?.fard1),
          fard2: this.parseMarkValue(studentData.marks?.fard2),
          fard3: this.parseMarkValue(studentData.marks?.fard3),
          fard4: this.parseMarkValue(studentData.marks?.fard4),
          activities: this.parseMarkValue(studentData.marks?.activities)
        }
      };

      if (student.name && student.name.length > 0) {
        students.push(student);
      }
    }

    // Ensure sequential numbering
    return students.map((student, index) => ({
      ...student,
      number: index + 1
    }));
  }

  /**
   * Validate mark types
   */
  private validateMarkTypes(markTypesData: any): DetectedMarkTypes {
    return {
      hasFard1: Boolean(markTypesData.hasFard1),
      hasFard2: Boolean(markTypesData.hasFard2),
      hasFard3: Boolean(markTypesData.hasFard3),
      hasFard4: Boolean(markTypesData.hasFard4),
      hasActivities: Boolean(markTypesData.hasActivities)
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(providedConfidence: any, students: Student[]): number {
    let confidence = 0.5; // Base confidence

    // Use provided confidence if valid
    if (typeof providedConfidence === 'number' && providedConfidence >= 0 && providedConfidence <= 1) {
      confidence = providedConfidence;
    }

    // Adjust based on data quality
    if (students.length === 0) {
      return 0;
    }

    // Check data completeness
    let completenessScore = 0;
    let totalChecks = 0;

    students.forEach(student => {
      if (student.name && student.name.length > 2) {
        completenessScore++;
      }
      totalChecks++;

      // Check if at least one mark is present
      const hasMarks = Object.values(student.marks).some(mark => mark !== null);
      if (hasMarks) {
        completenessScore++;
      }
      totalChecks++;
    });

    const dataQuality = totalChecks > 0 ? completenessScore / totalChecks : 0;
    
    // Weighted average of provided confidence and data quality
    return Math.min(1, confidence * 0.7 + dataQuality * 0.3);
  }

  /**
   * Fallback extraction when JSON parsing fails
   */
  private fallbackExtraction(text: string): Omit<GeminiOCRResult, 'processingTime' | 'rawResponse'> {
    console.log("⚠️ Using fallback extraction method");
    
    const students: Student[] = [];
    const lines = text.split('\n');
    let studentNumber = 1;

    // Try to extract student data from lines
    for (const line of lines) {
      // Look for patterns that might be student data
      const arabicNamePattern = /[\u0600-\u06FF\s]+/g;
      const numberPattern = /\d+([.,]\d+)?/g;
      
      const names = line.match(arabicNamePattern);
      const numbers = line.match(numberPattern);
      
      if (names && names.length > 0) {
        const name = names[0].trim();
        if (name.length > 2 && !this.isHeaderText(name)) {
          const marks = numbers ? numbers.map(n => this.parseMarkValue(n)) : [];
          
          students.push({
            number: studentNumber++,
            name: this.cleanStudentName(name),
            marks: {
              fard1: marks[0] || null,
              fard2: marks[1] || null,
              fard3: marks[2] || null,
              fard4: null,
              activities: marks[3] || null
            }
          });
        }
      }
    }

    // Default mark types detection
    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: students.some(s => s.marks.fard1 !== null),
      hasFard2: students.some(s => s.marks.fard2 !== null),
      hasFard3: students.some(s => s.marks.fard3 !== null),
      hasFard4: false,
      hasActivities: students.some(s => s.marks.activities !== null)
    };

    return {
      students,
      detectedMarkTypes,
      confidence: students.length > 0 ? 0.6 : 0,
      warnings: ["Fallback extraction was used due to response parsing issues"]
    };
  }

  /**
   * Check if text is likely a header
   */
  private isHeaderText(text: string): boolean {
    const headerKeywords = [
      'اسم', 'التلميذ', 'رقم', 'الفرض', 'علامة', 'درجة',
      'الأنشطة', 'المجموع', 'الملاحظات'
    ];
    
    return headerKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Clean student name
   */
  private cleanStudentName(name: string): string {
    if (!name) return "";
    
    return name
      .trim()
      .replace(/[|]/g, "") // Remove table separators
      .replace(/[:؛]$/g, "") // Remove trailing colons/semicolons
      .replace(/^\d+[\s\-\.]+/, "") // Remove leading numbers
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  /**
   * Parse mark value
   */
  private parseMarkValue(value: any): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    // If already a number
    if (typeof value === 'number') {
      if (value >= 0 && value <= 20) {
        return Math.round(value * 100) / 100;
      }
      return null;
    }

    // Convert to string and clean
    const str = String(value).trim();
    if (!str) return null;

    // Replace Arabic/French decimal separators
    const cleaned = str
      .replace(/[,،]/g, ".")
      .replace(/[^\d.]/g, "");

    if (!cleaned) return null;

    const num = parseFloat(cleaned);
    
    // Validate range
    if (isNaN(num) || num < 0 || num > 20) {
      return null;
    }

    return Math.round(num * 100) / 100;
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
   * Process with advanced options
   */
  async processWithOptions(
    imageFile: File,
    options: {
      useVisionModel?: boolean;
      customPrompt?: string;
      maxRetries?: number;
    } = {}
  ): Promise<GeminiOCRResult> {
    const { useVisionModel = false, customPrompt, maxRetries = 3 } = options;

    // Use Gemini Pro Vision for better accuracy if requested
    if (useVisionModel) {
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt} of ${maxRetries}`);
        
        // Use custom prompt if provided
        if (customPrompt) {
          const originalPrompt = this.createExtractionPrompt;
          this.createExtractionPrompt = () => customPrompt;
          const result = await this.processImage(imageFile);
          this.createExtractionPrompt = originalPrompt;
          return result;
        }
        
        return await this.processImage(imageFile);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error("Failed to process image after multiple attempts");
  }
}

// Export singleton instance
export const geminiOCRService = new GeminiOCRService();