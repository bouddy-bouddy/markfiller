/* global fetch, localStorage */

import { getLmsBaseUrl, API_ENDPOINTS, LICENSE_STATUS_CODES, STORAGE_KEYS } from "./config";
import { deviceFingerprint, DeviceInfo } from "./deviceFingerprint";
import { getIpLookupUrl } from "./config";
import { logger } from "../../utils/logger";

/**
 * License Validation Result
 */
export interface LicenseValidationResult {
  valid: boolean;
  message: string;
  teacherName?: string;
  expiresAt?: string;
  daysRemaining?: number;
  devicesUsed?: number;
  maxDevices?: number;
}

/**
 * Teacher Profile for License Activation
 */
export interface TeacherProfile {
  cin?: string;
  phone?: string;
  level?: "الإعدادي" | "الثانوي";
  subject?: string;
  classesCount?: number;
  testsPerTerm?: number;
}

/**
 * License API Client
 * Handles all communication with the LMS (License Management System)
 */
export class LicenseApiClient {
  private lmsBaseUrl: string;

  constructor() {
    this.lmsBaseUrl = getLmsBaseUrl();
  }

  /**
   * Activate a license with the LMS
   */
  async activateLicense(
    licenseKey: string,
    teacherProfile?: TeacherProfile
  ): Promise<LicenseValidationResult> {
    try {
      const deviceId = deviceFingerprint.generateDeviceId();
      const deviceInfo = deviceFingerprint.getDeviceInfo();
      const clientIP = await deviceFingerprint.getClientIP(getIpLookupUrl());

      const response = await fetch(`${this.lmsBaseUrl}${API_ENDPOINTS.ACTIVATE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: licenseKey.trim(),
          deviceId,
          userAgent: deviceInfo.userAgent,
          ip: clientIP,
          profile: teacherProfile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          valid: false,
          message: data.error || "فشل في تفعيل الترخيص",
        };
      }

      return {
        valid: true,
        message: "تم تفعيل الترخيص بنجاح",
        expiresAt: data.validUntil,
      };
    } catch (error) {
      logger.error("License activation error:", error);
      throw error;
    }
  }

  /**
   * Validate an existing license
   */
  async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
    try {
      const deviceId = deviceFingerprint.generateDeviceId();
      const clientIP = await deviceFingerprint.getClientIP(getIpLookupUrl());

      const response = await fetch(`${this.lmsBaseUrl}${API_ENDPOINTS.VALIDATE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: licenseKey,
          deviceId,
          ip: clientIP,
          userAgent: navigator.userAgent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If license is invalid, indicate it should be removed
        const shouldRemove = response.status === LICENSE_STATUS_CODES.INVALID || 
                           response.status === LICENSE_STATUS_CODES.NOT_FOUND;
        
        return {
          valid: false,
          message: data.message || "الترخيص غير صالح",
          ...(shouldRemove && { devicesUsed: -1 }), // Signal to remove license
        };
      }

      return {
        valid: true,
        message: data.message || "الترخيص صالح",
        teacherName: data.teacherName,
        expiresAt: data.expiresAt,
        daysRemaining: data.daysRemaining,
        devicesUsed: data.devicesUsed,
        maxDevices: data.maxDevices,
      };
    } catch (error) {
      logger.error("License validation error:", error);
      throw error;
    }
  }

  /**
   * Track usage events
   */
  async trackUsage(licenseKey: string, eventType: string, metadata?: any): Promise<void> {
    try {
      const deviceId = deviceFingerprint.generateDeviceId();

      await fetch(`${this.lmsBaseUrl}${API_ENDPOINTS.USAGE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: licenseKey,
          deviceId,
          eventType,
          metadata,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      // Silent fail for usage tracking
      logger.warn("Usage tracking failed:", error);
    }
  }
}

// Default instance
export const licenseApiClient = new LicenseApiClient();

