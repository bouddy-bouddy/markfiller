/**
 * Custom Error Types for OCR Service
 * Provides specialized error classes for different failure scenarios
 */

/**
 * Error thrown when Gemini API requests fail
 */
export class GeminiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public originalError?: any
  ) {
    super(message);
    this.name = "GeminiAPIError";
  }
}

/**
 * Error thrown when JSON parsing fails
 */
export class JSONParseError extends Error {
  constructor(
    message: string,
    public rawContent?: string
  ) {
    super(message);
    this.name = "JSONParseError";
  }
}

/**
 * Error thrown when data extraction fails
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public context?: any
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Check if an error is retryable based on status code or error type
 */
export function isRetryableError(error: any, statusCode?: number, retryableStatusCodes: readonly number[] = [429, 500, 502, 503, 504]): boolean {
  if (statusCode && retryableStatusCodes.includes(statusCode)) {
    return true;
  }
  if (error instanceof GeminiAPIError && error.retryable) {
    return true;
  }
  // Network errors are typically retryable
  if (error.name === "NetworkError" || error.message?.includes("network")) {
    return true;
  }
  return false;
}

