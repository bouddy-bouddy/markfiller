export const LICENSE_CONFIG = {
  // Update this with your actual LMS domain
  LMS_BASE_URL:
    process.env.NODE_ENV === "production"
      ? "https://markfiller-lms.vercel.app" // Replace with your production LMS URL
      : "http://localhost:3000", // Your local LMS development URL

  // Storage keys
  STORAGE_KEYS: {
    LICENSE: "markfiller_license",
    DEVICE_ID: "markfiller_device_id",
    USER_PROFILE: "markfiller_user_profile",
  },

  // Validation settings
  VALIDATION: {
    AUTO_VALIDATE_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000, // 2 seconds
  },

  // Usage tracking events
  USAGE_EVENTS: {
    APP_LAUNCHED: "app_launched",
    LICENSE_ACTIVATED: "license_activated",
    LICENSE_VALIDATED: "license_validated",
    IMAGE_UPLOADED: "image_uploaded",
    OCR_STARTED: "ocr_started",
    OCR_COMPLETED: "ocr_completed",
    OCR_FAILED: "ocr_failed",
    MARKS_INSERTION_STARTED: "marks_insertion_started",
    MARKS_INSERTION_COMPLETED: "marks_insertion_completed",
    MARKS_INSERTION_FAILED: "marks_insertion_failed",
    APP_RESTARTED: "app_restarted",
    ERROR_OCCURRED: "error_occurred",
  },
};

// Environment-specific configurations
export const getApiEndpoint = (endpoint: string): string => {
  return `${LICENSE_CONFIG.LMS_BASE_URL}${endpoint}`;
};

// Validation helper
export const isValidLicenseKey = (key: string): boolean => {
  // Basic validation - adjust according to your license key format
  return key && key.length >= 10 && /^[A-Z0-9-]+$/i.test(key);
};
