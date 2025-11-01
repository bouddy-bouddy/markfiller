/* global File, FileReader, Image, document, createImageBitmap, OffscreenCanvas */

import { IMAGE_CONFIG } from "./config";
import { logger } from "../../utils/logger";

/**
 * Image Processing Utilities (Optimized)
 * Handles image validation, optimization, and base64 conversion
 * Features: caching, capability detection, canvas reuse
 */

interface ProcessedImageCache {
  data: string;
  timestamp: number;
}

type OptimizationMethod = "offscreen" | "canvas" | "image";

export class ImageProcessor {
  // Image processing cache with LRU eviction
  private cache: Map<string, ProcessedImageCache> = new Map();
  private readonly CACHE_MAX_SIZE = 10;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Browser capability detection (done once at initialization)
  private optimizationMethod: OptimizationMethod;
  private supportsOffscreenCanvas: boolean;
  private supportsImageBitmap: boolean;

  // Canvas pool for reuse (avoid repeated allocations)
  private canvasPool: HTMLCanvasElement[] = [];
  private readonly MAX_POOL_SIZE = 2;

  constructor() {
    // Detect browser capabilities once at initialization
    this.supportsOffscreenCanvas = typeof OffscreenCanvas !== "undefined";
    this.supportsImageBitmap = typeof createImageBitmap === "function";

    // Determine optimal processing method
    if (this.supportsOffscreenCanvas && this.supportsImageBitmap) {
      this.optimizationMethod = "offscreen";
      logger.info("🚀 Using OffscreenCanvas for image optimization");
    } else if (this.supportsImageBitmap) {
      this.optimizationMethod = "canvas";
      logger.info("🎨 Using Canvas for image optimization");
    } else {
      this.optimizationMethod = "image";
      logger.info("📷 Using Image element for image optimization (legacy)");
    }
  }
  /**
   * Generate cache key for a file
   */
  private getCacheKey(file: File): string {
    return `${file.name}_${file.size}_${file.lastModified}`;
  }

  /**
   * Get cached image if available and not expired
   */
  private getCachedImage(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.cache.delete(cacheKey);
      return null;
    }

    logger.debug("✅ Cache hit for image");
    return cached.data;
  }

  /**
   * Cache processed image with LRU eviction
   */
  private cacheImage(cacheKey: string, data: string): void {
    // LRU eviction: remove oldest if cache is full
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug("🗑️ Evicted oldest cache entry");
      }
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get canvas from pool or create new one
   */
  private getCanvas(): HTMLCanvasElement {
    const canvas = this.canvasPool.pop();
    if (canvas) {
      logger.debug("♻️ Reusing canvas from pool");
      return canvas;
    }
    return document.createElement("canvas");
  }

  /**
   * Return canvas to pool for reuse
   */
  private returnCanvas(canvas: HTMLCanvasElement): void {
    if (this.canvasPool.length < this.MAX_POOL_SIZE) {
      // Clear canvas before returning to pool
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      this.canvasPool.push(canvas);
    }
  }

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
   * Convert file to base64 and opportunistically downscale (optimized with caching)
   * - Keeps width up to 2000px to preserve numbers/names clarity but reduces huge photos
   * - Uses JPEG at 0.9 quality for balanced size/quality
   * - Caches processed images to avoid re-processing
   * - Uses single optimized path based on browser capability
   */
  async fileToOptimizedBase64(file: File): Promise<string> {
    // Check cache first
    const cacheKey = this.getCacheKey(file);
    const cached = this.getCachedImage(cacheKey);
    if (cached) {
      logger.info(`📦 Using cached optimized image: ${(cached.length / 1024).toFixed(1)} KB`);
      return cached;
    }

    // Fast path for small files - no optimization needed
    if (file.size <= IMAGE_CONFIG.optimizationThreshold) {
      const result = await this.fileToBase64(file);
      this.cacheImage(cacheKey, result);
      return result;
    }

    // Single optimized path based on detected browser capability
    let result: string;
    try {
      switch (this.optimizationMethod) {
        case "offscreen":
          result = await this.optimizeWithOffscreenCanvas(file);
          break;
        case "canvas":
          result = await this.optimizeWithCanvas(file);
          break;
        case "image":
          result = await this.optimizeWithImageElement(file);
          break;
        default:
          result = await this.fileToBase64(file);
      }

      logger.info(`🎨 Optimized image: ${(result.length / 1024).toFixed(1)} KB (method: ${this.optimizationMethod})`);
      
      // Cache the result
      this.cacheImage(cacheKey, result);
      return result;
    } catch (error) {
      logger.error("Image optimization failed, using original:", error);
      const fallback = await this.fileToBase64(file);
      this.cacheImage(cacheKey, fallback);
      return fallback;
    }
  }

  /**
   * Optimize using OffscreenCanvas (modern browsers, most efficient)
   */
  private async optimizeWithOffscreenCanvas(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    
    const scale = bitmap.width > IMAGE_CONFIG.maxWidth ? IMAGE_CONFIG.maxWidth / bitmap.width : 1;
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    // @ts-ignore OffscreenCanvas may not be typed
    const offscreen: any = new OffscreenCanvas(targetW, targetH);
    const ctx = offscreen.getContext("2d");
    if (!ctx) throw new Error("Failed to get OffscreenCanvas context");

    // @ts-ignore drawImage on OffscreenCanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    
    // Close bitmap to free memory immediately
    bitmap.close();

    const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
    // @ts-ignore convertToBlob is available on OffscreenCanvas
    const blob = await offscreen.convertToBlob({ type: mime, quality: IMAGE_CONFIG.compressionQuality });
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Optimize using regular Canvas with canvas pool reuse
   */
  private async optimizeWithCanvas(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    
    const scale = bitmap.width > IMAGE_CONFIG.maxWidth ? IMAGE_CONFIG.maxWidth / bitmap.width : 1;
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    // Get canvas from pool or create new
    const canvas = this.getCanvas();
    canvas.width = targetW;
    canvas.height = targetH;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // @ts-ignore drawImage accepts ImageBitmap
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    
    // Close bitmap to free memory immediately
    bitmap.close();

    const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
    const result = canvas.toDataURL(mime, IMAGE_CONFIG.compressionQuality);
    
    // Return canvas to pool for reuse
    this.returnCanvas(canvas);
    
    return result;
  }

  /**
   * Optimize using Image element (legacy fallback with canvas pool)
   */
  private async optimizeWithImageElement(file: File): Promise<string> {
    const imgDataUrl = await this.fileToBase64(file);
    
    // Load image
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = imgDataUrl;
    });

    const scale = img.width > IMAGE_CONFIG.maxWidth ? IMAGE_CONFIG.maxWidth / img.width : 1;
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    // Get canvas from pool or create new
    const canvas = this.getCanvas();
    canvas.width = targetW;
    canvas.height = targetH;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      this.returnCanvas(canvas);
      return imgDataUrl;
    }
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const mime = file.type && /image\/(png|jpeg|webp)/.test(file.type) ? file.type : "image/jpeg";
    const result = canvas.toDataURL(mime, IMAGE_CONFIG.compressionQuality);
    
    // Return canvas to pool for reuse
    this.returnCanvas(canvas);
    
    return result;
  }

  /**
   * Clear cache (useful for memory management)
   */
  clearCache(): void {
    this.cache.clear();
    logger.info("🗑️ Image cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.CACHE_MAX_SIZE,
      ttlMs: this.CACHE_TTL_MS,
    };
  }
}

// Default instance
export const imageProcessor = new ImageProcessor();

