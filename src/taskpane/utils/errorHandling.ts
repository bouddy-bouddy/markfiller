export const OCR_ERROR_CODES = {
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  NO_TEXT_DETECTED: "NO_TEXT_DETECTED",
  NO_MARKS_DETECTED: "NO_MARKS_DETECTED",
  API_ERROR: "API_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

export const getLocalizedErrorMessage = (errorCode: string, details?: string): string => {
  switch (errorCode) {
    case OCR_ERROR_CODES.IMAGE_TOO_LARGE:
      return "حجم الصورة كبير جدًا. يرجى استخدام صورة أقل من 4 ميغابايت.";
    case OCR_ERROR_CODES.UNSUPPORTED_FORMAT:
      return "تنسيق الصورة غير مدعوم. يرجى استخدام صور بتنسيق JPG أو PNG.";
    case OCR_ERROR_CODES.NO_TEXT_DETECTED:
      return "لم يتم التعرف على أي نص في الصورة. يرجى التأكد من وضوح الصورة.";
    case OCR_ERROR_CODES.NO_MARKS_DETECTED:
      return "تم العثور على أسماء الطلاب ولكن لم يتم التعرف على أي علامات.";
    case OCR_ERROR_CODES.API_ERROR:
      return `حدث خطأ في خدمة التعرف على النص. ${details || ""}`;
    default:
      return details || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
  }
};

export const getErrorSuggestions = (errorCode: string): string[] => {
  const commonSuggestions = [
    "تأكد من أن الصورة واضحة وذات إضاءة جيدة",
    "تجنب الصور المائلة أو المشوهة",
    "تأكد من أن النص في الصورة مقروء",
  ];

  switch (errorCode) {
    case OCR_ERROR_CODES.IMAGE_TOO_LARGE:
      return ["قم بتقليل حجم الصورة", "استخدم برنامج لضغط الصورة قبل الرفع", ...commonSuggestions];
    case OCR_ERROR_CODES.NO_TEXT_DETECTED:
      return [
        "تأكد من وجود نص واضح في الصورة",
        "حاول تحسين تباين الصورة",
        "التقط الصورة في وضع أفضل إضاءة",
        ...commonSuggestions,
      ];
    default:
      return commonSuggestions;
  }
};
