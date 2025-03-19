export const ocrConfig = {
  // API settings
  apiKey: process.env.GOOGLE_VISION_AI_API_KEY || process.env.GOOGLE_CLOUD_VISION_API_KEY,
  apiUrl: process.env.GOOGLE_CLOUD_VISION_API_URL || "https://vision.googleapis.com/v1/images:annotate",

  // Processing settings
  maxProcessingAttempts: 3,
  confidenceThreshold: 0.65,

  // File validation
  maxFileSize: 4 * 1024 * 1024, // 4MB
  supportedFileTypes: ["image/jpeg", "image/jpg", "image/png"],

  // Statistical validation
  outlierZScoreThreshold: 3.0,
  minStudentsForStats: 5,

  // Mark patterns
  markPatterns: {
    fard1: [/فرض.*?1/i, /الفرض.*?الأول/i, /الفرض.*?1/i, /فرض.*?١/i, /اختبار.*?1/i],
    fard2: [/فرض.*?2/i, /الفرض.*?الثاني/i, /الفرض.*?2/i, /فرض.*?٢/i, /اختبار.*?2/i],
    fard3: [/فرض.*?3/i, /الفرض.*?الثالث/i, /الفرض.*?3/i, /فرض.*?٣/i, /اختبار.*?3/i],
    fard4: [/فرض.*?3/i, /الفرض.*?الرابع/i, /الفرض.*?3/i, /فرض.*?٣/i, /اختبار.*?4/i],
    activities: [/أنشطة/i, /النشاط/i, /الأنشطة/i, /مراقبة/i, /مستمرة/i],
  },
};
