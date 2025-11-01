/* global File, FileReader, Image, document, createImageBitmap, OffscreenCanvas */

import { IMAGE_CONFIG } from "./config";
import { logger } from "../../utils/logger";

/**
 * Image Processing Utilities
 * Handles image validation, optimization, and base64 conversion
 */

export class ImageProcessor {
  /**
   * Validate image file type and size
   */
  isValidImageFile(file: File): boolean {
    const fileType = file.type.toLowerCase();
    const validTypes = IMAGE_CONFIG.validTypes as readonly string[];
    
    if (!validTypes.includes(fileType)) {
      logger.error(`Invalid file type: ${file.type}`);
      return false;
    }

    if (file.size > IMAGE_CONFIG.maxSize) {
      logger.error(`File too large: ${file.size} bytes (max: ${IMAGE_CONFIG.maxSize})`);
      return false;
    }

    return true;
  }

  /**
   * Convert file to base64 string with error handling
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        logger.info(`📷 Image converted to base64: ${(result.length / 1024).toFixed(1)} KB`);
        resolve(result);
      };

      reader.onerror = (error) => {
        logger.error("Error reading file:", error);
        reject(new Error("فشل في قراءة ملف الصورة"));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert file to base64 and opportunistically downscale to speed up OCR without losing precision
   * - Keeps width up to 2000px to preserve numbers/names clarity but reduces huge photos
   * - Uses JPEG at 0.9 quality for balanced size/quality
   */
  async fileToOptimizedBase64(file: File): Promise<string> {
    // Fast path for small files
    if (file.size <= IMAGE_CONFIG.optimizationThreshold) {
      return this.fileToBase64(file);
    }

    try {
      const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(file) : null;
      if (bitmap) {
        const result = await this.optimizeWithOffscreenCanvas(bitmap, file.type);
        if (result) return result;

        const result2 = await this.optimizeWithCanvas(bitmap, file.type);
        if (result2) return result2;
      }
    } catch (_e) {
      // Fallback below
    }

    // Fallback: Draw into canvas to downscale
    return this.optimizeWithImageElement(file);
  }

  /**
   * Optimize using OffscreenCanvas (modern browsers)
   */
  private async optimizeWithOffscreenCanvas(bitmap: ImageBitmap, fileType: string): Promise<string | null> {
    try {
      const scale = bitmap.width > IMAGE_CONFIG.maxWidth ? IMAGE_CONFIG.maxWidth / bitmap.width : 1;
      const targetW = Math.max(1, Math.round(bitmap.width * scale));
      const targetH = Math.max(1, Math.round(bitmap.height * scale));

      // @ts-ignore OffscreenCanvas may not be typed
      const off: any = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(targetW, targetH) : null;
      if (!off) return null;

      const ctx = off.getContext("2d");
      if (!ctx) return null;

      // @ts-ignore drawImage on OffscreenCanvasRenderingContext2D
      ctx.drawImage(bitmap as any, 0, 0, targetW, targetH);
      const mime = fileType && /image\/(png|jpeg|webp)/.test(fileType) ? fileType : "image/jpeg";
      // @ts-ignore convertToBlob is available on OffscreenCanvas
      const blob = await off.convertToBlob({ type: mime, quality: IMAGE_CONFIG.compressionQuality });
      
      return await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  /**
   * Optimize using regular Canvas
   */
  private async optimizeWithCanvas(bitmap: ImageBitmap, fileType: string): Promise<string | null> {
    try {
      const scale = bitmap.width > IMAGE_CONFIG.maxWidth ? IMAGE_CONFIG.maxWidth / bitmap.width : 1;
      const targetW = Math.max(1, Math.round(bitmap.width * scale));
      const targetH = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // @ts-ignore drawImage accepts ImageBitmap
      ctx.drawImage(bitmap as any, 0, 0, targetW, targetH);
      const mime = fileType && /image\/(png|jpeg|webp)/.test(fileType) ? fileType : "image/jpeg";
      return canvas.toDataURL(mime, IMAGE_CONFIG.compressionQuality);
    } catch {
      return null;
    }
  }

  /**
   * Optimize using Image element (fallback)
   */
  private async optimizeWithImageElement(file: File): Promise<string> {
    const imgDataUrl = await this.fileToBase64(file);
    const img = (await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = imgDataUrl;
    })) as any;

    const scale = img.width > IMAGE_CONFIG.maxWidth ? IMAGE_CONFIG.maxWidth / img.width : 1;
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imgDataUrl;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img as any, 0, 0, targetW, targetH);

    const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
    return canvas.toDataURL(mime, IMAGE_CONFIG.compressionQuality);
  }
}

// Default instance
export const imageProcessor = new ImageProcessor();

