/* global File, HTMLInputElement, FileReader, console */
/* eslint-disable no-console */
import { useState, useRef } from "react";
import { licenseService } from "../services/licenseService";
import { uploadWithTracking } from "../services/usageTracker";
import { Student, DetectedMarkTypes, AppStep } from "../types";

interface UseImageProcessingProps {
  completeStep: (step: AppStep) => void;
  advanceToStep: (step: AppStep) => void;
  onDataExtracted: (students: Student[], detectedMarkTypes: DetectedMarkTypes) => void;
}

interface UseImageProcessingResult {
  selectedImage: File | null;
  imagePreview: string | null;
  isProcessing: boolean;
  error: string | null;
  errorCode: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageUpload: (file: File) => void;
  handleRemoveImage: () => void;
  processImage: () => Promise<void>;
}

export const useImageProcessing = ({
  completeStep,
  advanceToStep,
  onDataExtracted,
}: UseImageProcessingProps): UseImageProcessingResult => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string>("UNKNOWN_ERROR");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    if (file) {
      // Track image upload
      licenseService.trackUsage("image_uploaded", {
        fileSize: file.size,
        fileType: file.type,
      });

      // Check if file is an image
      if (!file.type.startsWith("image/")) {
        setError("الرجاء اختيار ملف صورة صالح");
        setErrorCode("UNSUPPORTED_FORMAT");
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة يجب أن يكون أقل من 5 ميغابايت");
        setErrorCode("IMAGE_TOO_LARGE");
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          setImagePreview(e.target.result);
        }
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setError(null);
  };

  const processImage = async (): Promise<void> => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Get license key
      const licenseKey = licenseService.getStoredLicenseKey();

      if (!licenseKey) {
        setError("لم يتم العثور على مفتاح الترخيص. يرجى تسجيل الدخول مرة أخرى.");
        setIsProcessing(false);
        return;
      }

      console.log("🚀 Starting OCR processing with usage tracking...");

      // Wrap OCR with usage tracking
      const trackResult = await uploadWithTracking(
        licenseKey,
        async () => {
          console.log("📸 Processing image with Gemini OCR...");

          // Track OCR start (for internal analytics)
          await licenseService.trackUsage("ocr_started", {
            imageSize: selectedImage.size,
            imageType: selectedImage.type,
          });

          // Process the image using enhanced OCR service (lazy-loaded)
          console.log("🚀 STARTING OCR PROCESSING - About to call Gemini OCR");
          console.log("📸 Image file details:", {
            name: selectedImage.name,
            size: selectedImage.size,
            type: selectedImage.type,
            lastModified: new Date(selectedImage.lastModified).toISOString(),
          });

          const { default: geminiOcrService } = await import("../services/ocr/geminiOcrService");
          const { students, detectedMarkTypes } = await geminiOcrService.processImageFast(selectedImage);

          console.log("✅ OCR PROCESSING COMPLETED SUCCESSFULLY");
          console.log("👥 Extracted students:", students.length);
          console.log("📊 Detected mark types:", detectedMarkTypes);

          // Notify parent of extracted data
          onDataExtracted(students, detectedMarkTypes);

          // Track successful OCR completion
          await licenseService.trackUsage("ocr_completed", {
            studentsExtracted: students.length,
            detectedMarkTypes,
            success: true,
          });

          completeStep(AppStep.ImageProcessing);
          advanceToStep(AppStep.ReviewConfirm);
        },
        {
          fileName: selectedImage.name,
          fileSize: selectedImage.size,
        }
      );

      // Success - Show usage info
      console.log(`✅ OCR tracked! Remaining uploads: ${trackResult.remainingUploads}`);

      // Warn if low
      if (trackResult.remainingUploads <= 5) {
        console.warn(`⚠️ Warning: Only ${trackResult.remainingUploads} uploads remaining!`);
        console.log(`📢 User has ${trackResult.remainingUploads} uploads left`);
      }
    } catch (error: any) {
      console.error("❌ OCR processing failed:", error);

      // Check if usage limit error
      if (
        error.message?.includes("تم تعليق الترخيص") ||
        error.message?.includes("Upload limit reached") ||
        error.message?.includes("suspended") ||
        error.message?.includes("blocked")
      ) {
        setError("🚫 " + error.message);
        setErrorCode("USAGE_LIMIT_EXCEEDED");

        // Track blocked upload
        await licenseService.trackUsage("ocr_blocked", {
          reason: "usage_limit_exceeded",
        });
      } else {
        // Track OCR failure
        await licenseService.trackUsage("ocr_failed", {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        });

        setError("فشل في معالجة الصورة. يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى.");
        setErrorCode("OCR_PROCESSING_FAILED");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    selectedImage,
    imagePreview,
    isProcessing,
    error,
    errorCode,
    fileInputRef,
    handleImageUpload,
    handleRemoveImage,
    processImage,
  };
};
