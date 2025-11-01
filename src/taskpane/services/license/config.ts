/**
 * License Service Configuration
 * Contains all configuration constants for the license management system
 */

/**
 * Get LMS base URL from environment or use default
 */
export function getLmsBaseUrl(): string {
  return process.env.LMS_BASE_URL || "https://markfiller-lms.vercel.app";
}

/**
 * Get IP lookup service URL
 */
export function getIpLookupUrl(): string {
  return process.env.IP_LOOKUP_URL || "https://api.ipify.org?format=json";
}

/**
 * Storage keys for license data
 */
export const STORAGE_KEYS = {
  LICENSE: "markfiller_license",
  DEVICE_ID: "markfiller_device_id",
} as const;

/**
 * API endpoints (relative to LMS base URL)
 */
export const API_ENDPOINTS = {
  ACTIVATE: "/api/activate",
  VALIDATE: "/api/licenses/validate",
  USAGE: "/api/usage",
} as const;

/**
 * HTTP status codes for license validation
 */
export const LICENSE_STATUS_CODES = {
  INVALID: 403,
  NOT_FOUND: 404,
} as const;

