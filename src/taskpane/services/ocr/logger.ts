/* global console, process */

/**
 * Enhanced logging utility for OCR service
 * Provides consistent logging with prefixes and development mode support
 */

export class OcrLogger {
  private prefix: string;

  constructor(prefix: string = "🔍 [GeminiOCR]") {
    this.prefix = prefix;
  }

  info(message: string, data?: any): void {
    console.log(`${this.prefix} ${message}`, data !== undefined ? data : "");
  }

  warn(message: string, data?: any): void {
    console.warn(`${this.prefix} ⚠️ ${message}`, data !== undefined ? data : "");
  }

  error(message: string, error?: any): void {
    console.error(`${this.prefix} ❌ ${message}`, error !== undefined ? error : "");
  }

  success(message: string, data?: any): void {
    console.log(`${this.prefix} ✅ ${message}`, data !== undefined ? data : "");
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === "development") {
      console.log(`${this.prefix} 🐛 ${message}`, data !== undefined ? data : "");
    }
  }
}

// Default logger instance
export const logger = new OcrLogger();

/**
 * Exponential backoff utility for retrying operations
 */
export async function exponentialBackoff(attempt: number, config: { initialDelayMs: number; maxDelayMs: number; backoffMultiplier: number }): Promise<void> {
  const delay = Math.min(config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt), config.maxDelayMs);
  const jitter = Math.random() * 0.3 * delay; // Add 0-30% jitter
  await new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

