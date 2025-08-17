/**
 * Advanced Image Preprocessing Service for Enhanced OCR Accuracy
 *
 * This service implements multiple image enhancement techniques to improve
 * OCR accuracy before sending images to Google Vision API:
 * - Noise reduction and denoising
 * - Contrast and brightness optimization
 * - Deskewing and rotation correction
 * - Binarization and morphological operations
 * - Resolution enhancement
 */

export interface ImageQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  noise: number;
  skew: number;
  resolution: number;
  overallScore: number;
}

export interface PreprocessingOptions {
  enableNoiseReduction: boolean;
  enableContrastEnhancement: boolean;
  enableDeskewing: boolean;
  enableSharpening: boolean;
  enableBinarization: boolean;
  targetDPI: number;
  preserveOriginal: boolean;
}

export class ImagePreprocessingService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to get 2D rendering context");
    }
    this.ctx = context;
  }

  /**
   * Main preprocessing method that applies multiple enhancement techniques
   */
  async preprocessImage(
    imageFile: File,
    options: PreprocessingOptions = this.getDefaultOptions()
  ): Promise<{
    enhancedImage: Blob;
    originalImage: Blob;
    qualityMetrics: ImageQualityMetrics;
    appliedEnhancements: string[];
  }> {
    console.log("🔧 Starting image preprocessing for OCR enhancement...");

    const appliedEnhancements: string[] = [];

    // Load image
    const imageData = await this.loadImageData(imageFile);
    let processedData = imageData;

    // Calculate initial quality metrics
    const initialMetrics = this.calculateImageQuality(processedData);
    console.log("📊 Initial image quality metrics:", initialMetrics);

    // Apply preprocessing steps based on quality metrics and options
    if (options.enableNoiseReduction && initialMetrics.noise > 0.3) {
      processedData = this.reduceNoise(processedData);
      appliedEnhancements.push("Noise Reduction");
      console.log("✅ Applied noise reduction");
    }

    if (options.enableContrastEnhancement && initialMetrics.contrast < 0.6) {
      processedData = this.enhanceContrast(processedData, initialMetrics);
      appliedEnhancements.push("Contrast Enhancement");
      console.log("✅ Applied contrast enhancement");
    }

    if (options.enableSharpening && initialMetrics.sharpness < 0.7) {
      processedData = this.sharpenImage(processedData);
      appliedEnhancements.push("Image Sharpening");
      console.log("✅ Applied image sharpening");
    }

    if (options.enableDeskewing && Math.abs(initialMetrics.skew) > 0.5) {
      processedData = this.deskewImage(processedData, initialMetrics.skew);
      appliedEnhancements.push("Deskewing");
      console.log("✅ Applied deskewing correction");
    }

    if (options.enableBinarization) {
      processedData = this.binarizeImage(processedData);
      appliedEnhancements.push("Binarization");
      console.log("✅ Applied adaptive binarization");
    }

    // Resolution enhancement if needed
    if (initialMetrics.resolution < options.targetDPI) {
      processedData = this.enhanceResolution(processedData, options.targetDPI);
      appliedEnhancements.push("Resolution Enhancement");
      console.log("✅ Applied resolution enhancement");
    }

    // Calculate final quality metrics
    const finalMetrics = this.calculateImageQuality(processedData);
    console.log("📈 Final image quality metrics:", finalMetrics);
    console.log("🎯 Applied enhancements:", appliedEnhancements);

    // Convert processed image data to blob
    const enhancedImage = await this.imageDataToBlob(processedData);

    return {
      enhancedImage,
      originalImage: imageFile,
      qualityMetrics: finalMetrics,
      appliedEnhancements,
    };
  }

  /**
   * Load image file and convert to ImageData
   */
  private async loadImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate comprehensive image quality metrics
   */
  private calculateImageQuality(imageData: ImageData): ImageQualityMetrics {
    const { data, width, height } = imageData;

    // Calculate brightness
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
    }
    const brightness = totalBrightness / (width * height) / 255;

    // Calculate contrast using standard deviation
    const avgBrightness = brightness * 255;
    let variance = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const pixelBrightness = (r + g + b) / 3;
      variance += Math.pow(pixelBrightness - avgBrightness, 2);
    }
    const contrast = Math.sqrt(variance / (width * height)) / 255;

    // Calculate sharpness using Laplacian operator
    const sharpness = this.calculateSharpness(imageData);

    // Estimate noise level
    const noise = this.estimateNoise(imageData);

    // Estimate skew angle
    const skew = this.estimateSkew(imageData);

    // Estimate resolution (simplified)
    const resolution = Math.min(width, height);

    // Calculate overall quality score
    const overallScore =
      brightness * 0.15 +
      contrast * 0.25 +
      sharpness * 0.25 +
      (1 - noise) * 0.2 +
      (1 - Math.abs(skew) / 45) * 0.1 +
      Math.min(resolution / 300, 1) * 0.05;

    return {
      brightness,
      contrast,
      sharpness,
      noise,
      skew,
      resolution,
      overallScore,
    };
  }

  /**
   * Reduce image noise using bilateral filtering approach
   */
  private reduceNoise(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const newData = new Uint8ClampedArray(data);

    // Simple bilateral filter implementation
    const kernelSize = 3;
    const offset = Math.floor(kernelSize / 2);

    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        const centerIdx = (y * width + x) * 4;

        let totalR = 0,
          totalG = 0,
          totalB = 0;
        let totalWeight = 0;

        // Apply bilateral filter
        for (let ky = -offset; ky <= offset; ky++) {
          for (let kx = -offset; kx <= offset; kx++) {
            const neighborIdx = ((y + ky) * width + (x + kx)) * 4;

            // Spatial weight
            const spatialWeight = Math.exp(-(kx * kx + ky * ky) / (2 * 1.0));

            // Intensity weight
            const centerIntensity = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
            const neighborIntensity = (data[neighborIdx] + data[neighborIdx + 1] + data[neighborIdx + 2]) / 3;
            const intensityWeight = Math.exp(-Math.pow(centerIntensity - neighborIntensity, 2) / (2 * 25 * 25));

            const weight = spatialWeight * intensityWeight;

            totalR += data[neighborIdx] * weight;
            totalG += data[neighborIdx + 1] * weight;
            totalB += data[neighborIdx + 2] * weight;
            totalWeight += weight;
          }
        }

        if (totalWeight > 0) {
          newData[centerIdx] = totalR / totalWeight;
          newData[centerIdx + 1] = totalG / totalWeight;
          newData[centerIdx + 2] = totalB / totalWeight;
        }
      }
    }

    return new ImageData(newData, width, height);
  }

  /**
   * Enhance image contrast using adaptive histogram equalization
   */
  private enhanceContrast(imageData: ImageData, metrics: ImageQualityMetrics): ImageData {
    const { data, width, height } = imageData;
    const newData = new Uint8ClampedArray(data);

    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
      histogram[gray]++;
    }

    // Calculate cumulative distribution function
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // Normalize CDF
    const totalPixels = width * height;
    const cdfMin = cdf.find((val) => val > 0) || 0;

    // Apply contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale for enhancement calculation
      const gray = Math.round((r + g + b) / 3);
      const enhanced = Math.round(((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255);

      // Apply enhancement while preserving color ratios
      const ratio = enhanced / Math.max(gray, 1);
      newData[i] = Math.min(255, r * ratio);
      newData[i + 1] = Math.min(255, g * ratio);
      newData[i + 2] = Math.min(255, b * ratio);
      newData[i + 3] = data[i + 3]; // Alpha unchanged
    }

    return new ImageData(newData, width, height);
  }

  /**
   * Sharpen image using unsharp masking
   */
  private sharpenImage(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const newData = new Uint8ClampedArray(data);

    // Gaussian blur kernel for unsharp masking
    const kernel = [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1],
    ];
    const kernelWeight = 16;

    // Apply unsharp masking
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIdx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          // RGB channels
          let blurred = 0;

          // Apply Gaussian blur
          for (let ky = 0; ky < 3; ky++) {
            for (let kx = 0; kx < 3; kx++) {
              const neighborIdx = ((y - 1 + ky) * width + (x - 1 + kx)) * 4;
              blurred += data[neighborIdx + c] * kernel[ky][kx];
            }
          }
          blurred /= kernelWeight;

          // Unsharp masking: original + amount * (original - blurred)
          const original = data[centerIdx + c];
          const amount = 1.5; // Sharpening strength
          const sharpened = original + amount * (original - blurred);

          newData[centerIdx + c] = Math.max(0, Math.min(255, sharpened));
        }
        newData[centerIdx + 3] = data[centerIdx + 3]; // Alpha unchanged
      }
    }

    return new ImageData(newData, width, height);
  }

  /**
   * Correct image skew using detected angle
   */
  private deskewImage(imageData: ImageData, skewAngle: number): ImageData {
    if (Math.abs(skewAngle) < 0.1) return imageData; // Skip if angle is too small

    const { width, height } = imageData;

    // Set up canvas for rotation
    this.canvas.width = width;
    this.canvas.height = height;

    // Clear and draw original image
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.putImageData(imageData, 0, 0);

    // Create new canvas for rotated image
    const rotatedCanvas = document.createElement("canvas");
    const rotatedCtx = rotatedCanvas.getContext("2d")!;

    // Calculate new dimensions after rotation
    const angleRad = (skewAngle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const newWidth = Math.ceil(width * cos + height * sin);
    const newHeight = Math.ceil(width * sin + height * cos);

    rotatedCanvas.width = newWidth;
    rotatedCanvas.height = newHeight;

    // Apply rotation
    rotatedCtx.translate(newWidth / 2, newHeight / 2);
    rotatedCtx.rotate(-angleRad); // Negative to correct the skew
    rotatedCtx.drawImage(this.canvas, -width / 2, -height / 2);

    // Get rotated image data
    return rotatedCtx.getImageData(0, 0, newWidth, newHeight);
  }

  /**
   * Apply adaptive binarization for better text recognition
   */
  private binarizeImage(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const newData = new Uint8ClampedArray(data);

    // Convert to grayscale and apply adaptive thresholding
    const windowSize = 15;
    const offset = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerIdx = (y * width + x) * 4;

        // Calculate local mean in window
        let sum = 0;
        let count = 0;

        for (let wy = Math.max(0, y - offset); wy < Math.min(height, y + offset + 1); wy++) {
          for (let wx = Math.max(0, x - offset); wx < Math.min(width, x + offset + 1); wx++) {
            const windowIdx = (wy * width + wx) * 4;
            const gray = (data[windowIdx] + data[windowIdx + 1] + data[windowIdx + 2]) / 3;
            sum += gray;
            count++;
          }
        }

        const localMean = sum / count;
        const centerGray = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;

        // Apply adaptive threshold
        const threshold = localMean * 0.85; // Slightly below local mean
        const binaryValue = centerGray > threshold ? 255 : 0;

        newData[centerIdx] = binaryValue;
        newData[centerIdx + 1] = binaryValue;
        newData[centerIdx + 2] = binaryValue;
        newData[centerIdx + 3] = data[centerIdx + 3]; // Alpha unchanged
      }
    }

    return new ImageData(newData, width, height);
  }

  /**
   * Enhance image resolution using interpolation
   */
  private enhanceResolution(imageData: ImageData, targetDPI: number): ImageData {
    const { width, height } = imageData;
    const currentDPI = Math.min(width, height); // Simplified DPI estimation

    if (currentDPI >= targetDPI) return imageData;

    const scaleFactor = Math.min(2, targetDPI / currentDPI); // Limit scaling
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);

    // Use canvas scaling with bicubic interpolation
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.putImageData(imageData, 0, 0);

    const scaledCanvas = document.createElement("canvas");
    const scaledCtx = scaledCanvas.getContext("2d")!;
    scaledCanvas.width = newWidth;
    scaledCanvas.height = newHeight;

    // Enable image smoothing for better quality
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = "high";
    scaledCtx.drawImage(this.canvas, 0, 0, newWidth, newHeight);

    return scaledCtx.getImageData(0, 0, newWidth, newHeight);
  }

  /**
   * Calculate image sharpness using Laplacian operator
   */
  private calculateSharpness(imageData: ImageData): number {
    const { data, width, height } = imageData;

    // Laplacian kernel
    const kernel = [
      [0, -1, 0],
      [-1, 4, -1],
      [0, -1, 0],
    ];

    let totalVariance = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let laplacian = 0;

        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const idx = ((y - 1 + ky) * width + (x - 1 + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            laplacian += gray * kernel[ky][kx];
          }
        }

        totalVariance += laplacian * laplacian;
        count++;
      }
    }

    return Math.min(1, Math.sqrt(totalVariance / count) / 255);
  }

  /**
   * Estimate noise level in image
   */
  private estimateNoise(imageData: ImageData): number {
    const { data, width, height } = imageData;

    // Use high-pass filter to estimate noise
    let noiseSum = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIdx = (y * width + x) * 4;
        const centerGray = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;

        // Calculate local variance
        let localSum = 0;
        let localCount = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
            const neighborGray = (data[neighborIdx] + data[neighborIdx + 1] + data[neighborIdx + 2]) / 3;
            localSum += Math.abs(centerGray - neighborGray);
            localCount++;
          }
        }

        noiseSum += localSum / localCount;
        count++;
      }
    }

    return Math.min(1, noiseSum / count / 50); // Normalize to 0-1
  }

  /**
   * Estimate skew angle using Hough transform approach
   */
  private estimateSkew(imageData: ImageData): number {
    const { data, width, height } = imageData;

    // Simple edge detection first
    const edges: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIdx = (y * width + x) * 4;
        const rightIdx = (y * width + x + 1) * 4;
        const bottomIdx = ((y + 1) * width + x) * 4;

        const centerGray = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
        const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
        const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;

        const gradientX = Math.abs(centerGray - rightGray);
        const gradientY = Math.abs(centerGray - bottomGray);
        const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY);

        if (gradient > 50) {
          // Edge threshold
          edges.push(Math.atan2(gradientY, gradientX));
        }
      }
    }

    if (edges.length < 10) return 0; // Not enough edges

    // Find dominant angle
    const angleHistogram: { [key: number]: number } = {};
    edges.forEach((angle) => {
      const degreeAngle = Math.round((angle * 180) / Math.PI);
      angleHistogram[degreeAngle] = (angleHistogram[degreeAngle] || 0) + 1;
    });

    // Find most common angle
    let maxCount = 0;
    let dominantAngle = 0;
    Object.entries(angleHistogram).forEach(([angle, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantAngle = parseInt(angle);
      }
    });

    // Convert to skew angle (typically small angles)
    if (dominantAngle > 45 && dominantAngle < 135) {
      return dominantAngle - 90; // Vertical text skew
    } else if (dominantAngle > -45 && dominantAngle < 45) {
      return dominantAngle; // Horizontal text skew
    }

    return 0;
  }

  /**
   * Convert ImageData back to Blob
   */
  private async imageDataToBlob(imageData: ImageData): Promise<Blob> {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve) => {
      this.canvas.toBlob(
        (blob) => {
          resolve(blob!);
        },
        "image/png",
        1.0
      );
    });
  }

  /**
   * Get default preprocessing options
   */
  private getDefaultOptions(): PreprocessingOptions {
    return {
      enableNoiseReduction: true,
      enableContrastEnhancement: true,
      enableDeskewing: true,
      enableSharpening: true,
      enableBinarization: false, // Can interfere with color information
      targetDPI: 300,
      preserveOriginal: true,
    };
  }

  /**
   * Get preprocessing options optimized for handwritten text
   */
  getHandwrittenOptions(): PreprocessingOptions {
    return {
      enableNoiseReduction: true,
      enableContrastEnhancement: true,
      enableDeskewing: true,
      enableSharpening: false, // Avoid over-sharpening handwritten text
      enableBinarization: true, // Helpful for handwritten text
      targetDPI: 400,
      preserveOriginal: true,
    };
  }

  /**
   * Get preprocessing options optimized for printed text
   */
  getPrintedTextOptions(): PreprocessingOptions {
    return {
      enableNoiseReduction: true,
      enableContrastEnhancement: true,
      enableDeskewing: true,
      enableSharpening: true,
      enableBinarization: false,
      targetDPI: 300,
      preserveOriginal: true,
    };
  }
}

// Export singleton instance
export const imagePreprocessingService = new ImagePreprocessingService();
