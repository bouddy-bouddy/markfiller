/* global localStorage */

import { STORAGE_KEYS } from "./config";
import { licenseApiClient, LicenseValidationResult, TeacherProfile } from "./apiClient";
import { getErrorMessage, SUCCESS_MESSAGES, ERROR_MESSAGES } from "./messages";

/**
 * License Service
 * Main orchestrator for license management operations
 *
 * Refactored into modular architecture:
 * - config.ts: Configuration and constants
 * - deviceFingerprint.ts: Device identification
 * - messages.ts: User-facing messages
 * - apiClient.ts: LMS API communication
 */
class LicenseService {
  /**
   * Activate license with the LMS
   */
  async activateLicense(licenseKey: string, teacherProfile?: TeacherProfile): Promise<LicenseValidationResult> {
    try {
      const result = await licenseApiClient.activateLicense(licenseKey, teacherProfile);

      if (result.valid) {
        // Store the license key locally for future validations
        localStorage.setItem(STORAGE_KEYS.LICENSE, licenseKey);
        result.message = SUCCESS_MESSAGES.LICENSE_ACTIVATED;
      } else {
        result.message = getErrorMessage(result.message);
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        message: ERROR_MESSAGES["Activation connection error"],
      };
    }
  }

  /**
   * Validate existing license
   */
  async validateLicense(): Promise<LicenseValidationResult> {
    const storedLicense = localStorage.getItem(STORAGE_KEYS.LICENSE);

    if (!storedLicense) {
      return {
        valid: false,
        message: ERROR_MESSAGES["License not found"],
      };
    }

    try {
      const result = await licenseApiClient.validateLicense(storedLicense);

      // If license is invalid and should be removed (indicated by devicesUsed: -1)
      if (!result.valid && result.devicesUsed === -1) {
        localStorage.removeItem(STORAGE_KEYS.LICENSE);
      }

      // Translate error messages
      if (!result.valid) {
        result.message = getErrorMessage(result.message);
      } else {
        result.message = result.message || SUCCESS_MESSAGES.LICENSE_VALID;
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        message: ERROR_MESSAGES["Validation error"],
      };
    }
  }

  /**
   * Remove license from local storage (logout)
   */
  removeLicense(): void {
    localStorage.removeItem(STORAGE_KEYS.LICENSE);
  }

  /**
   * Check if license is stored locally
   */
  hasStoredLicense(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.LICENSE);
  }

  /**
   * Get stored license key
   */
  getStoredLicenseKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LICENSE);
  }

  /**
   * Track usage events
   */
  async trackUsage(eventType: string, metadata?: any): Promise<void> {
    const storedLicense = localStorage.getItem(STORAGE_KEYS.LICENSE);
    if (!storedLicense) return;

    await licenseApiClient.trackUsage(storedLicense, eventType, metadata);
  }
}

export const licenseService = new LicenseService();

// Re-export types for convenience
export type { LicenseValidationResult, TeacherProfile };
export type { DeviceInfo } from "./deviceFingerprint";
