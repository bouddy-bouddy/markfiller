/**
 * OCR Service Logger
 * Uses centralized logger with OCR-specific prefixes
 */

import { logger as baseLogger } from "../../utils/logger";

/**
 * Enhanced logging utility for OCR service with prefixes
 */
class OcrLogger {
  private prefix: string;

  constructor(prefix: string = "🔍 [GeminiOCR]") {
    this.prefix = prefix;
  }

  info(message: string, data?: any): void {
    if (data !== undefined && data !== "") {
      baseLogger.info(`${this.prefix} ${message}`, data);
    } else {
      baseLogger.info(`${this.prefix} ${message}`);
    }
  }

  warn(message: string, data?: any): void {
    if (data !== undefined && data !== "") {
      baseLogger.warn(`${this.prefix} ⚠️ ${message}`, data);
    } else {
      baseLogger.warn(`${this.prefix} ⚠️ ${message}`);
    }
  }

  error(message: string, error?: any): void {
    if (error !== undefined && error !== "") {
      baseLogger.error(`${this.prefix} ❌ ${message}`, error);
    } else {
      baseLogger.error(`${this.prefix} ❌ ${message}`);
    }
  }

  success(message: string, data?: any): void {
    if (data !== undefined && data !== "") {
      baseLogger.info(`${this.prefix} ✅ ${message}`, data);
    } else {
      baseLogger.info(`${this.prefix} ✅ ${message}`);
    }
  }

  debug(message: string, data?: any): void {
    if (data !== undefined && data !== "") {
      baseLogger.debug(`${this.prefix} 🐛 ${message}`, data);
    } else {
      baseLogger.debug(`${this.prefix} 🐛 ${message}`);
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

