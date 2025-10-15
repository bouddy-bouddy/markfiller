/* global File, HTMLInputElement, FileReader, console */
/* eslint-disable no-console */
import React, { useState, useRef, useEffect, Suspense } from "react";
import { FluentProvider, webLightTheme, Spinner, Text } from "@fluentui/react-components";
import styled from "styled-components";
import TeacherGreeting from "./shared/TeacherGreeting";
import excelService from "../services/excelService";
import { licenseService } from "../services/licenseService";
import LicenseActivation from "./LicenseActivation";
import { Student, ExcelStatus, AppStep, DetectedMarkTypes } from "../types";
import { computeExtractionAccuracy } from "../utils/accuracy";
import { uploadWithTracking } from "../services/usageTracker";
import { GlobalStyle } from "../styles/globalStyles";
import { Statistics } from "../types/statistics";
import { generateMarkStatistics } from "../utils/statistics";
import DeveloperFooter from "./DeveloperFooter";

import OcrErrorDisplay from "./shared/OcrErrorDisplay";
const FileAnalysisStep = React.lazy(
  () => import(/* webpackChunkName: "step-file-analysis" */ "./steps/FileAnalysisStep")
);
const ImageProcessingStep = React.lazy(
  () => import(/* webpackChunkName: "step-image-processing" */ "./steps/ImageProcessingStep")
);
const ReviewConfirmStep = React.lazy(
  () => import(/* webpackChunkName: "step-review-confirm" */ "./steps/ReviewConfirmStep")
);
const MappingStep = React.lazy(() => import(/* webpackChunkName: "step-mapping" */ "./steps/MappingStep"));
const StatisticsStep = React.lazy(() => import(/* webpackChunkName: "step-statistics" */ "./steps/StatisticsStep"));
import AppHeader from "./shared/AppHeader";
import StepNavigation from "./shared/StepNavigation";
import NeedHelpSection from "./shared/NeedHelpSection";

interface AppProps {
  title: string;
  isOfficeInitialized?: boolean;
}

// Statistics types moved to ../types/statistics

const App: React.FC<AppProps> = ({ title, isOfficeInitialized = true }) => {
  // License state
  const [isLicenseValid, setIsLicenseValid] = useState<boolean>(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState<boolean>(true);

  const [teacherName, setTeacherName] = useState<string | null>(null);

  // State for selected image
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string>("UNKNOWN_ERROR");

  // Data and steps
  const [extractedData, setExtractedData] = useState<Student[] | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.FileAnalysis);
  const [completedSteps, setCompletedSteps] = useState<Set<AppStep>>(new Set());

  // Excel status
  const [excelStatus, setExcelStatus] = useState<ExcelStatus>({
    isValid: false,
    checked: false,
  });

  // Mark detection
  const [detectedMarkTypes, setDetectedMarkTypes] = useState<DetectedMarkTypes>({
    hasFard1: false,
    hasFard2: false,
    hasFard3: false,
    hasFard4: false,
    hasActivities: false,
  });

  // Student name correction states
  const [tableKey] = useState<number>(0); // Force re-render key

  // Statistics
  const [markStats, setMarkStats] = useState<Statistics | null>(null);
  // Extraction accuracy (percentage 0-100)
  const [extractionAccuracy, setExtractionAccuracy] = useState<number | null>(null);

  // Processing stages (UI progress only)
  const [, setProcessingStage] = useState<number>(0);
  const [, setProcessingProgress] = useState<number>(0);

  // Mapping state
  const [isInserting, setIsInserting] = useState<boolean>(false);

  // Reference for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Spinner with brand color
  const GreenSpinner = styled(Spinner)`
    color: #0e7c42;
  `;

  // Check license on app initialization
  useEffect(() => {
    checkLicenseOnStartup();
  }, []);

  const checkLicenseOnStartup = async () => {
    setIsCheckingLicense(true);

    try {
      if (licenseService.hasStoredLicense()) {
        const result = await licenseService.validateLicense();

        if (result.valid) {
          setIsLicenseValid(true);
          if (result.teacherName) {
            setTeacherName(result.teacherName);
          }
          // Track app launch
          await licenseService.trackUsage("app_launched");
        } else {
          // License invalid, show activation screen
          setIsLicenseValid(false);
        }
      } else {
        // No license stored, show activation screen
        setIsLicenseValid(false);
      }
    } catch (error) {
      console.error("License check failed:", error);
      setIsLicenseValid(false);
    } finally {
      setIsCheckingLicense(false);
    }
  };

  const handleLicenseValidated = () => {
    setIsLicenseValid(true);
    // Track successful license validation
    licenseService.trackUsage("license_validated");
  };

  // Check Excel file on initialization
  useEffect(() => {
    const checkExcelFile = async () => {
      if (!isLicenseValid) return; // Don't check Excel if no license

      try {
        const isValid = await excelService.validateExcelFile();
        setExcelStatus({
          isValid,
          checked: true,
          message: isValid ? "تم التحقق من ملف مسار بنجاح" : "يرجى فتح ملف مسار المناسب في Excel",
        });

        if (isValid) {
          completeStep(AppStep.FileAnalysis);
          advanceToStep(AppStep.ImageProcessing);
        }
      } catch (error) {
        console.error("Excel validation error:", error);
        setExcelStatus({
          isValid: false,
          checked: true,
          message: "حدث خطأ أثناء التحقق من ملف Excel",
        });
      }
    };

    if (isOfficeInitialized && isLicenseValid) {
      checkExcelFile();
    }
  }, [isOfficeInitialized, isLicenseValid]);

  // Handle image upload
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

  // Process image with enhanced OCR
  // const processImage = async (): Promise<void> => {
  //   if (!selectedImage) return;

  //   // Track OCR processing start
  //   await licenseService.trackUsage("ocr_started", {
  //     imageSize: selectedImage.size,
  //     imageType: selectedImage.type,
  //   });

  //   setIsProcessing(true);
  //   setError(null);
  //   setProcessingStage(0);
  //   setProcessingProgress(0);

  //   try {
  //     // Process the image using enhanced OCR service (lazy-loaded)
  //     console.log("🚀 STARTING OCR PROCESSING - About to call Gemini OCR");
  //     console.log("📸 Image file details:", {
  //       name: selectedImage.name,
  //       size: selectedImage.size,
  //       type: selectedImage.type,
  //       lastModified: new Date(selectedImage.lastModified).toISOString(),
  //     });

  //     const { default: geminiOcrService } = await import("../services/geminiOcrService");
  //     const { students, detectedMarkTypes } = await geminiOcrService.processImageFast(selectedImage);

  //     console.log("✅ OCR PROCESSING COMPLETED SUCCESSFULLY");
  //     console.log("👥 Extracted students:", students.length);
  //     console.log("📊 Detected mark types:", detectedMarkTypes);

  //     setExtractedData(students);
  //     setDetectedMarkTypes(detectedMarkTypes);

  //     // Track successful OCR completion
  //     await licenseService.trackUsage("ocr_completed", {
  //       studentsExtracted: students.length,
  //       detectedMarkTypes,
  //       success: true,
  //     });

  //     // Calculate statistics
  //     const stats = generateMarkStatistics(students, detectedMarkTypes);
  //     setMarkStats(stats);

  //     // Estimate extraction accuracy
  //     const accuracy = computeExtractionAccuracy(students, detectedMarkTypes);
  //     setExtractionAccuracy(accuracy);

  //     completeStep(AppStep.ImageProcessing);
  //     advanceToStep(AppStep.ReviewConfirm);
  //   } catch (error) {
  //     console.error("OCR processing failed:", error);

  //     // Track OCR failure
  //     await licenseService.trackUsage("ocr_failed", {
  //       error: error instanceof Error ? error.message : "Unknown error",
  //       success: false,
  //     });

  //     setError("فشل في معالجة الصورة. يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى.");
  //     setErrorCode("OCR_PROCESSING_FAILED");
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // };

  const processImage = async (): Promise<void> => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);
    setProcessingStage(0);
    setProcessingProgress(0);

    try {
      // 🔑 Get license key
      const licenseKey = licenseService.getStoredLicenseKey();

      if (!licenseKey) {
        setError("لم يتم العثور على مفتاح الترخيص. يرجى تسجيل الدخول مرة أخرى.");
        setIsProcessing(false);
        return;
      }

      console.log("🚀 Starting OCR processing with usage tracking...");

      // 🎯 WRAP OCR WITH USAGE TRACKING
      const trackResult = await uploadWithTracking(
        licenseKey,
        async () => {
          // ✅ YOUR EXISTING OCR LOGIC
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

          const { default: geminiOcrService } = await import("../services/geminiOcrService");
          const { students, detectedMarkTypes } = await geminiOcrService.processImageFast(selectedImage);

          console.log("✅ OCR PROCESSING COMPLETED SUCCESSFULLY");
          console.log("👥 Extracted students:", students.length);
          console.log("📊 Detected mark types:", detectedMarkTypes);

          setExtractedData(students);
          setDetectedMarkTypes(detectedMarkTypes);

          // Track successful OCR completion
          await licenseService.trackUsage("ocr_completed", {
            studentsExtracted: students.length,
            detectedMarkTypes,
            success: true,
          });

          // Calculate statistics
          const stats = generateMarkStatistics(students, detectedMarkTypes);
          setMarkStats(stats);

          // Estimate extraction accuracy
          const accuracy = computeExtractionAccuracy(students, detectedMarkTypes);
          setExtractionAccuracy(accuracy);

          completeStep(AppStep.ImageProcessing);
          advanceToStep(AppStep.ReviewConfirm);
        },
        {
          fileName: selectedImage.name,
          fileSize: selectedImage.size,
        }
      );

      // ✅ SUCCESS - Show usage info
      console.log(`✅ OCR tracked! Remaining uploads: ${trackResult.remainingUploads}`);

      // ⚠️ WARN IF LOW
      if (trackResult.remainingUploads <= 5) {
        console.warn(`⚠️ Warning: Only ${trackResult.remainingUploads} uploads remaining!`);
        // Show a non-blocking warning (don't use setError as it blocks the flow)
        console.log(`📢 User has ${trackResult.remainingUploads} uploads left`);
      }
    } catch (error: any) {
      console.error("❌ OCR processing failed:", error);

      // 🚫 CHECK IF USAGE LIMIT ERROR
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

  // Step helpers
  const completeStep = (step: AppStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const advanceToStep = (step: AppStep) => {
    setCurrentStep(step);
  };

  const isStepCompleted = (step: AppStep): boolean => {
    return completedSteps.has(step);
  };

  const resetApp = () => {
    setCurrentStep(AppStep.ImageProcessing);
    setCompletedSteps(new Set([AppStep.FileAnalysis]));
    setExtractedData(null);
    setSelectedImage(null);
    setImagePreview(null);
    setMarkStats(null);
    setExtractionAccuracy(null);
    setError(null);
    setIsInserting(false);

    // Track restart
    licenseService.trackUsage("app_restarted");
  };

  const handleDataUpdate = (updatedData: Student[]) => {
    setExtractedData(updatedData);
    const stats = generateMarkStatistics(updatedData, detectedMarkTypes);
    setMarkStats(stats);
    const accuracy = computeExtractionAccuracy(updatedData, detectedMarkTypes);
    setExtractionAccuracy(accuracy);
  };

  const handleConfirmData = () => {
    completeStep(AppStep.ReviewConfirm);
    advanceToStep(AppStep.MappingPreview);
  };

  const handleConfirmMapping = async () => {
    if (!extractedData) return;

    setIsInserting(true);

    try {
      // Track marks insertion start
      await licenseService.trackUsage("marks_insertion_started", {
        studentsCount: extractedData.length,
      });

      const results = await excelService.insertAllMarks(extractedData, detectedMarkTypes);

      // Track successful insertion
      await licenseService.trackUsage("marks_insertion_completed", {
        successful: results.success,
        notFound: results.notFound,
        totalStudents: extractedData.length,
      });

      completeStep(AppStep.MappingPreview);
      advanceToStep(AppStep.Statistics);
    } catch (error) {
      console.error("Marks insertion failed:", error);

      // Track insertion failure
      await licenseService.trackUsage("marks_insertion_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      setError("فشل في إدراج العلامات. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsInserting(false);
    }
  };

  // Show loading spinner while checking license
  if (isCheckingLicense) {
    return (
      <FluentProvider theme={webLightTheme}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <GreenSpinner size="large" />
          <Text style={{ marginTop: "16px", textAlign: "center", fontWeight: "bold", color: "" }}>
            جاري التحقق من الترخيص
          </Text>
        </div>
      </FluentProvider>
    );
  }

  // Show license activation if not valid
  if (!isLicenseValid) {
    return (
      <FluentProvider theme={webLightTheme}>
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            background: "#ffffff",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            width: "100vw",
            height: "100vh",
            overflowY: "auto",
            padding: "24px 0",
          }}
        >
          <LicenseActivation onLicenseValidated={handleLicenseValidated} />
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <GlobalStyle />
      <div style={{ height: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <AppHeader title={title} />

        {/* Add TeacherGreeting here */}
        {teacherName && <TeacherGreeting teacherName={teacherName} />}

        {/* Step Navigation */}
        <StepNavigation currentStep={currentStep} completedSteps={completedSteps} onStepClick={advanceToStep} />

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            padding: "0 16px",
          }}
        >
          {/* Error Display */}
          {error && <OcrErrorDisplay errorMessage={error} errorCode={errorCode} />}

          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {/* File Analysis Step */}
            {currentStep === AppStep.FileAnalysis && (
              <Suspense fallback={null}>
                <FileAnalysisStep
                  isActive={true}
                  isCompleted={isStepCompleted(AppStep.FileAnalysis)}
                  excelStatus={excelStatus}
                  onValidateExcel={async () => {
                    try {
                      const isValid = await excelService.validateExcelFile();
                      setExcelStatus({
                        isValid,
                        checked: true,
                        message: isValid ? "تم التحقق من ملف مسار بنجاح" : "يرجى فتح ملف مسار المناسب في Excel",
                      });

                      if (isValid) {
                        completeStep(AppStep.FileAnalysis);
                        advanceToStep(AppStep.ImageProcessing);
                      }
                    } catch (error) {
                      console.error("Excel validation error:", error);
                      setExcelStatus({
                        isValid: false,
                        checked: true,
                        message: "حدث خطأ أثناء التحقق من ملف Excel",
                      });
                    }
                  }}
                />
              </Suspense>
            )}

            {/* Image Processing Step */}
            {currentStep === AppStep.ImageProcessing && (
              <Suspense fallback={null}>
                <ImageProcessingStep
                  isActive={true}
                  isCompleted={isStepCompleted(AppStep.ImageProcessing)}
                  selectedImage={selectedImage}
                  imagePreview={imagePreview}
                  isProcessing={isProcessing}
                  onImageUpload={handleImageUpload}
                  onProcessImage={processImage}
                  onRemoveImage={handleRemoveImage}
                  fileInputRef={fileInputRef}
                />
              </Suspense>
            )}

            {/* Review and Confirm Step */}
            {currentStep === AppStep.ReviewConfirm && extractedData && (
              <Suspense fallback={null}>
                <ReviewConfirmStep
                  key={`review-${tableKey}`}
                  isActive={true}
                  isCompleted={isStepCompleted(AppStep.ReviewConfirm)}
                  data={extractedData}
                  onConfirm={handleConfirmData}
                  onCancel={resetApp}
                  onDataUpdate={handleDataUpdate}
                  tableKey={tableKey}
                  detectedMarkTypes={detectedMarkTypes}
                  accuracyPercent={extractionAccuracy ?? undefined}
                />
              </Suspense>
            )}

            {/* NEW: Mapping Preview Step */}
            {currentStep === AppStep.MappingPreview && extractedData && (
              <Suspense fallback={null}>
                <MappingStep
                  isActive={true}
                  isCompleted={isStepCompleted(AppStep.MappingPreview)}
                  extractedData={extractedData}
                  detectedMarkTypes={detectedMarkTypes}
                  onConfirmMapping={handleConfirmMapping}
                  onCancel={resetApp}
                  isInserting={isInserting}
                />
              </Suspense>
            )}

            {/* Statistics Step */}
            {currentStep === AppStep.Statistics && markStats && (
              <Suspense fallback={null}>
                <StatisticsStep
                  isActive={true}
                  isCompleted={isStepCompleted(AppStep.Statistics)}
                  statistics={markStats}
                  detectedMarkTypes={detectedMarkTypes}
                  onReset={resetApp}
                />
              </Suspense>
            )}
          </div>
        </div>

        {/* Persistent Need Help Section */}
        <NeedHelpSection />

        {/* Global Developer Footer */}
        <DeveloperFooter />
      </div>
    </FluentProvider>
  );
};

export default App;
