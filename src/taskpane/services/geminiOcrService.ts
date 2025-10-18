/* Frontend OCR Service - Calls Backend API */
/* global File, FileReader */
import { Student, DetectedMarkTypes } from "../types";

class GeminiOCRService {
  private readonly API_BASE_URL: string;

  constructor() {
    // Backend API URL - configure in .env
    this.API_BASE_URL = process.env.BACKEND_API_URL || "http://localhost:3001";
  }

  /**
   * Main method to process an image and extract student marks
   * Now calls backend API instead of processing locally
   */
  async processImage(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    try {
      // Validate image file
      if (!this.isValidImageFile(imageFile)) {
        throw new Error("نوع الملف غير مدعوم. يرجى استخدام صور بصيغة JPG, PNG, أو WebP");
      }

      console.log("🚀 STARTING OCR PROCESSING VIA BACKEND");
      console.log("📸 Image file details:", {
        name: imageFile.name,
        size: `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`,
        type: imageFile.type,
      });

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);

      // Get license key from storage
      const licenseKey = localStorage.getItem("markfiller_license");
      if (!licenseKey) {
        throw new Error("لم يتم العثور على ترخيص. يرجى تسجيل الدخول أولاً.");
      }

      // Call backend API
      const response = await fetch(`${this.API_BASE_URL}/api/ocr/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-License-Key": licenseKey,
        },
        body: JSON.stringify({
          base64Image,
          mimeType: imageFile.type || "image/jpeg",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "فشلت معالجة الصورة");
      }

      const data = await response.json();

      console.log(`✅ OCR completed: ${data.students.length} students found`);

      return {
        students: data.students,
        detectedMarkTypes: data.detectedMarkTypes,
      };
    } catch (error) {
      console.error("OCR processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : "فشلت معالجة الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى."
      );
    }
  }

  /**
   * Fast path: single structured call (kept for compatibility)
   */
  async processImageFast(imageFile: File): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // Use the same method as processImage - backend handles optimization
    return this.processImage(imageFile);
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
   * Convert file to base64 string
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
}

export default new GeminiOCRService();
