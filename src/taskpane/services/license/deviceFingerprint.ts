/* global document, navigator, screen, localStorage, btoa */

import { STORAGE_KEYS } from "./config";
import { logger } from "../../utils/logger";

/**
 * Device Information Interface
 */
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenResolution: string;
}

/**
 * Device Fingerprint Utility
 * Generates unique device identifiers and collects device information
 */
export class DeviceFingerprint {
  /**
   * Generate a unique device ID for this installation
   * Uses browser fingerprinting and stores in localStorage
   */
  generateDeviceId(): string {
    const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (stored) return stored;

    // Create a unique device ID based on browser fingerprint
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Device fingerprint", 2, 2);
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      `${screen.width}x${screen.height}`,
      new Date().getTimezoneOffset().toString(),
      canvas.toDataURL(),
    ].join("|");

    const deviceId = btoa(fingerprint)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 32);
    
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    return deviceId;
  }

  /**
   * Get comprehensive device information for activation
   */
  getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
    };
  }

  /**
   * Get client IP address (best effort)
   * Falls back gracefully if IP lookup fails
   */
  async getClientIP(ipLookupUrl: string): Promise<string | undefined> {
    try {
      const response = await fetch(ipLookupUrl);
      const data = await response.json();
      return data.ip;
    } catch (error) {
      logger.warn("Could not fetch client IP:", error);
      return undefined;
    }
  }
}

// Default instance
export const deviceFingerprint = new DeviceFingerprint();

