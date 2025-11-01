/**
 * OCR Service Configuration
 * Contains all configuration constants for the Gemini OCR service
 */

/** Retry configuration for API calls */
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
} as const;

/** Gemini API configuration */
export const API_CONFIG = {
  defaultBases: [
    "https://generativelanguage.googleapis.com/v1",
    "https://generativelanguage.googleapis.com/v1beta",
  ],
  defaultModels: [
    // Prefer the latest Pro family first (newest to oldest)
    "gemini-2.5-pro-latest",
    "gemini-2.5-pro",
    "gemini-2.0-pro-latest",
    "gemini-2.0-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    // Secondary fallbacks
    "gemini-2.5-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    // Vision legacy
    "gemini-pro-vision",
  ],
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
  ],
} as const;

/** Image processing configuration */
export const IMAGE_CONFIG = {
  validTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxSize: 10 * 1024 * 1024, // 10MB
  optimizationThreshold: 1.5 * 1024 * 1024, // 1.5MB
  maxWidth: 2000,
  compressionQuality: 0.9,
} as const;

/**
 * Get model candidates with environment variable override
 */
export function getModelCandidates(): string[] {
  const envModel = (process.env.GEMINI_MODEL || "").trim();
  if (envModel) {
    return [envModel, ...API_CONFIG.defaultModels.filter((m) => m !== envModel)];
  }
  return [...API_CONFIG.defaultModels];
}

/**
 * Get API base URLs with environment variable override
 */
export function getApiBases(): string[] {
  const envBase = (process.env.GEMINI_API_BASE || "").trim();
  if (envBase) {
    return [envBase, ...API_CONFIG.defaultBases.filter((b) => b !== envBase)];
  }
  return [...API_CONFIG.defaultBases];
}

/**
 * Get Gemini API key from environment
 */
export function getApiKey(): string {
  return process.env.GEMINI_API_KEY || "";
}

