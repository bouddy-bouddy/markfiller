// src/taskpane/services/usageTracker.ts
import { UsageCheckResponse, UsageTrackResponse } from "../types";

// Your backend API URL - UPDATE THIS!
const API_BASE_URL = process.env.REACT_APP_API_URL || "https://your-production-api.com";

/**
 * Check if upload is allowed BEFORE attempting upload
 */
export async function checkUploadAllowed(licenseKey: string): Promise<UsageCheckResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/usage/track?licenseKey=${encodeURIComponent(licenseKey)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to check usage");
    }

    return await response.json();
  } catch (error) {
    console.error("❌ Error checking upload allowance:", error);
    throw error;
  }
}

/**
 * Track an upload operation AFTER successful upload
 */
export async function trackUpload(
  licenseKey: string,
  metadata?: {
    fileName?: string;
    fileSize?: number;
    rowCount?: number;
  }
): Promise<UsageTrackResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/usage/track`, {
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
    console.error("❌ Error tracking upload:", error);
    throw error;
  }
}

/**
 * Main function: Upload with automatic usage tracking
 * Wraps your existing upload logic with usage checks
 */
export async function uploadWithTracking(
  licenseKey: string,
  uploadFunction: () => Promise<void>,
  metadata?: {
    fileName?: string;
    rowCount?: number;
  }
): Promise<UsageTrackResponse> {
  console.log("🔍 Step 1: Checking if upload is allowed...");

  // Step 1: Check if allowed
  const checkResult = await checkUploadAllowed(licenseKey);

  if (!checkResult.allowed) {
    console.error("🚫 Upload blocked:", checkResult.reason);
    throw new Error(checkResult.reason || "Upload not allowed");
  }

  console.log(`✅ Upload allowed. Remaining: ${checkResult.remainingUploads}`);

  // Step 2: Show warning if low
  if (checkResult.remainingUploads && checkResult.remainingUploads <= 5) {
    console.warn(`⚠️ Warning: Only ${checkResult.remainingUploads} uploads remaining!`);
  }

  console.log("📤 Step 2: Performing upload...");

  // Step 3: Do the actual upload
  await uploadFunction();

  console.log("✅ Upload complete!");
  console.log("📊 Step 3: Tracking upload...");

  // Step 4: Track it
  const trackResult = await trackUpload(licenseKey, metadata);

  console.log(`✅ Upload tracked! Remaining: ${trackResult.remainingUploads}`);

  // Step 5: Check if now suspended
  if (trackResult.suspended) {
    console.error("🚫 License suspended after this upload!");
    throw new Error(`تم تعليق الترخيص: لقد وصلت إلى الحد الأقصى من عمليات الرفع (${trackResult.uploadLimit})`);
  }

  return trackResult;
}
