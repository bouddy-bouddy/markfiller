/**
 * License Service Messages
 * All user-facing messages in Arabic
 */

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  LICENSE_ACTIVATED: "تم تفعيل الترخيص بنجاح",
  LICENSE_VALID: "الترخيص صالح",
} as const;

/**
 * Error messages mapping from English error codes to Arabic
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // API error codes
  "Invalid key": "مفتاح الترخيص غير صحيح",
  "License expired": "انتهت صلاحية الترخيص",
  "License suspended": "تم تعليق الترخيص",
  "Device limit exceeded": "تم تجاوز الحد الأقصى للأجهزة المسموح بها",
  "Device not activated": "الجهاز غير مفعل",
  "Activation failed": "فشل في التفعيل",
  
  // Generic errors
  "License not found": "لم يتم العثور على ترخيص. يرجى إدخال مفتاح الترخيص.",
  "License invalid": "الترخيص غير صالح",
  "Connection error": "خطأ في الاتصال بخادم التراخيص. تحقق من اتصالك بالإنترنت.",
  "Validation error": "خطأ في التحقق من الترخيص. تحقق من اتصالك بالإنترنت.",
  "Activation connection error": "خطأ في الاتصال بخادم التراخيص. تحقق من اتصالك بالإنترنت.",
} as const;

/**
 * Get localized error message
 * Falls back to the original error if no translation is found
 */
export function getErrorMessage(errorKey: string): string {
  return ERROR_MESSAGES[errorKey] || errorKey;
}

