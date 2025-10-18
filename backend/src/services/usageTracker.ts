/* Backend Usage Tracker Service - Protected logic */

export interface UsageCheckResponse {
  allowed: boolean;
  reason?: string;
  remainingUploads?: number;
  uploadLimit?: number;
}

export interface UsageTrackResponse {
  success: boolean;
  uploadCount: number;
  remainingUploads: number;
  uploadLimit: number;
  suspended: boolean;
  error?: string;
  blocked?: boolean;
}

class UsageTrackerService {
  private readonly API_BASE_URL: string;

  constructor() {
    // This would be YOUR backend API that manages usage tracking
    // For now, pointing to the LMS
    this.API_BASE_URL = process.env.LMS_BASE_URL || "https://markfiller-lms.vercel.app";
  }

  /**
   * Check if upload is allowed BEFORE attempting upload
   */
  async checkUploadAllowed(licenseKey: string): Promise<UsageCheckResponse> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/api/usage/track?licenseKey=${encodeURIComponent(licenseKey)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          allowed: false,
          reason: error.error || "Failed to check usage",
        };
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking upload allowance:", error);
      throw error;
    }
  }

  /**
   * Track an upload operation AFTER successful upload
   */
  async trackUpload(
    licenseKey: string,
    metadata?: {
      fileName?: string;
      fileSize?: number;
      rowCount?: number;
    }
  ): Promise<UsageTrackResponse> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/usage/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey,
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.blocked) {
          throw new Error(data.error || "Upload blocked: Usage limit reached");
        }
        throw new Error(data.error || "Failed to track usage");
      }

      return data;
    } catch (error) {
      console.error("Error tracking upload:", error);
      throw error;
    }
  }
}

export const usageTrackerService = new UsageTrackerService();
