/* Frontend License Service - Calls Backend API */

export interface LicenseValidationResult {
  valid: boolean;
  message: string;
  teacherName?: string;
  expiresAt?: string;
  daysRemaining?: number;
  devicesUsed?: number;
  maxDevices?: number;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenResolution: string;
}

class LicenseService {
  private readonly API_BASE_URL: string;
  private readonly STORAGE_KEY = "markfiller_license";
  private readonly DEVICE_ID_KEY = "markfiller_device_id";

  constructor() {
    // Backend API URL - configure in .env
    this.API_BASE_URL = process.env.BACKEND_API_URL || "http://localhost:3001";
  }

  /**
   * Generate a unique device ID for this installation
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem(this.DEVICE_ID_KEY);
    if (stored) return stored;

    // Create a unique device ID based on browser fingerprint
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx!.textBaseline = "top";
    ctx!.font = "14px Arial";
    ctx!.fillText("Device fingerprint", 2, 2);

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join("|");

    const deviceId = btoa(fingerprint)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 32);
    localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    return deviceId;
  }

  /**
   * Get device information for activation
   */
  private getDeviceInfo(): DeviceInfo {
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
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn("Could not fetch client IP:", error);
      return undefined;
    }
  }

  /**
   * Activate license with the backend
   */
  async activateLicense(
    licenseKey: string,
    teacherProfile?: {
      cin?: string;
      phone?: string;
      level?: "الإعدادي" | "الثانوي";
      subject?: string;
      classesCount?: number;
      testsPerTerm?: number;
    }
  ): Promise<LicenseValidationResult> {
    try {
      const deviceId = this.generateDeviceId();
      const deviceInfo = this.getDeviceInfo();
      const clientIP = await this.getClientIP();

      const response = await fetch(`${this.API_BASE_URL}/api/license/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          deviceId,
          deviceInfo,
          clientIP,
          teacherProfile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          valid: false,
          message: data.error || data.message || "فشل في تفعيل الترخيص",
        };
      }

      // Store the license key locally
      localStorage.setItem(this.STORAGE_KEY, licenseKey);

      return {
        valid: true,
        message: "تم تفعيل الترخيص بنجاح",
        expiresAt: data.expiresAt,
      };
    } catch (error) {
      console.error("License activation error:", error);
      return {
        valid: false,
        message: "خطأ في الاتصال بخادم التراخيص. تحقق من اتصالك بالإنترنت.",
      };
    }
  }

  /**
   * Validate existing license
   */
  async validateLicense(): Promise<LicenseValidationResult> {
    const storedLicense = localStorage.getItem(this.STORAGE_KEY);

    if (!storedLicense) {
      return {
        valid: false,
        message: "لم يتم العثور على ترخيص. يرجى إدخال مفتاح الترخيص.",
      };
    }

    try {
      const deviceId = this.generateDeviceId();
      const deviceInfo = this.getDeviceInfo();
      const clientIP = await this.getClientIP();

      const response = await fetch(`${this.API_BASE_URL}/api/license/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey: storedLicense,
          deviceId,
          deviceInfo,
          clientIP,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If license is invalid, remove it from storage
        if (response.status === 403 || response.status === 404) {
          localStorage.removeItem(this.STORAGE_KEY);
        }

        return {
          valid: false,
          message: data.error || data.message || "الترخيص غير صالح",
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
      console.error("License validation error:", error);
      return {
        valid: false,
        message: "خطأ في التحقق من الترخيص. تحقق من اتصالك بالإنترنت.",
      };
    }
  }

  /**
   * Remove license from local storage (logout)
   */
  removeLicense(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Check if license is stored locally
   */
  hasStoredLicense(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Get stored license key
   */
  getStoredLicenseKey(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Track usage events via backend
   */
  async trackUsage(eventType: string, metadata?: any): Promise<void> {
    const storedLicense = localStorage.getItem(this.STORAGE_KEY);
    if (!storedLicense) return;

    try {
      const deviceId = this.generateDeviceId();

      await fetch(`${this.API_BASE_URL}/api/license/track-usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey: storedLicense,
          deviceId,
          eventType,
          metadata,
        }),
      });
    } catch (error) {
      console.warn("Usage tracking failed:", error);
    }
  }
}

export const licenseService = new LicenseService();
