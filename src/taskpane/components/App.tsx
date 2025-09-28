/* global File, HTMLInputElement, FileReader, console */
/* eslint-disable no-console */
import React, { useState, useRef, useEffect, Suspense } from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import excelService from "../services/excelService";
import { Student, ExcelStatus, AppStep, DetectedMarkTypes } from "../types";
import { computeExtractionAccuracy } from "../utils/accuracy";
import { GlobalStyle } from "../styles/globalStyles";
import { Statistics } from "../types/statistics";
import { generateMarkStatistics } from "../utils/statistics";

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

// Global styles moved to ../styles/globalStyles

interface AppProps {
  title: string;
  isOfficeInitialized?: boolean;
}

// Statistics types moved to ../types/statistics

const App: React.FC<AppProps> = ({ title, isOfficeInitialized = true }) => {
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

  // Dialog states removed

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

  // Check Excel file on initialization
  useEffect(() => {
    const checkExcelFile = async () => {
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

    if (isOfficeInitialized) {
      checkExcelFile();
    }
  }, [isOfficeInitialized]);

  // Handle image upload
  const handleImageUpload = (file: File) => {
    if (file) {
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

  // Process image with enhanced OCR
  const processImage = async (): Promise<void> => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);
    setProcessingStage(0);
    setProcessingProgress(0);

    try {
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

      console.log("✅ OCR PROCESSING COMPLETED - Gemini OCR results processed");
      console.log("📊 Extracted data summary:", {
        studentsCount: students.length,
        detectedMarkTypes,
        sampleStudent: students[0] || null,
      });

      setProcessingStage(4);
      setProcessingProgress(100);

      // Results are already processed by Gemini service
      const enhancedResults = { students, detectedMarkTypes };

      // Proceed directly with extracted data (name correction removed)
      setExtractedData(enhancedResults.students);
      setDetectedMarkTypes(enhancedResults.detectedMarkTypes);
      // Compute heuristic extraction accuracy
      const accuracy = computeExtractionAccuracy(enhancedResults.students, enhancedResults.detectedMarkTypes);
      setExtractionAccuracy(accuracy);
      completeStep(AppStep.ImageProcessing);
      advanceToStep(AppStep.ReviewConfirm);
      setMarkStats(generateMarkStatistics(enhancedResults.students, enhancedResults.detectedMarkTypes));
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "حدث خطأ أثناء معالجة الصورة. الرجاء المحاولة مرة أخرى.");

        // Try to extract error code
        if (err.message.includes("حجم الصورة")) {
          setErrorCode("IMAGE_TOO_LARGE");
        } else if (err.message.includes("تنسيق الصورة")) {
          setErrorCode("UNSUPPORTED_FORMAT");
        } else if (err.message.includes("لم يتم التعرف على أي نص")) {
          setErrorCode("NO_TEXT_DETECTED");
        } else if (err.message.includes("لم يتم العثور على أي بيانات")) {
          setErrorCode("NO_MARKS_DETECTED");
        } else if (err.message.includes("API")) {
          setErrorCode("API_ERROR");
        } else {
          setErrorCode("UNKNOWN_ERROR");
        }
      } else {
        setError("حدث خطأ غير معروف أثناء معالجة الصورة");
        setErrorCode("UNKNOWN_ERROR");
      }
      console.error(err);
    } finally {
      setIsProcessing(false);
    }

    return;
  };

  // Statistics generation moved to ../utils/statistics

  // Handle image removal
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setError(null);
  };

  const handleConfirmData = async () => {
    try {
      const isValidFile = await excelService.validateExcelFile();
      if (!isValidFile) {
        setError("يرجى التأكد من فتح ملف مسار صحيح في Excel");
        return;
      }

      if (!extractedData) {
        setError("لا توجد بيانات لإدخالها");
        return;
      }

      // After reviewing the data, proceed to mapping step
      completeStep(AppStep.ReviewConfirm);
      advanceToStep(AppStep.MappingPreview);
    } catch (err) {
      setError("حدث خطأ أثناء التحقق من البيانات");
      console.error(err);
    }
  };

  // NEW: Handle mapping confirmation and actual Excel insertion
  const handleConfirmMapping = async () => {
    try {
      setIsInserting(true);
      setError(null);

      const isValidFile = await excelService.validateExcelFile();
      if (!isValidFile) {
        setError("يرجى التأكد من فتح ملف مسار صحيح في Excel");
        return;
      }

      if (!extractedData) {
        setError("لا توجد بيانات لإدخالها");
        return;
      }

      console.log("🚀 Starting Excel insertion with enhanced mapping...");

      // Use the new insertAllMarks method for comprehensive mapping
      const results = await excelService.insertAllMarks(extractedData, detectedMarkTypes);

      console.log("📊 Insertion results:", results);

      if (results.notFound > 0) {
        setError(
          `تم إدخال ${results.success} علامة بنجاح. ${results.notFound} تلميذ لم يتم العثور عليهم في ملف Excel.`
        );
      } else {
        setError(null);
      }

      // Move to statistics step
      completeStep(AppStep.MappingPreview);
      // Ensure statistics are recalculated with latest detected types before showing the step
      generateMarkStatistics(extractedData, detectedMarkTypes);
      advanceToStep(AppStep.Statistics);
    } catch (err) {
      setError("حدث خطأ أثناء إدخال البيانات في Excel");
      console.error(err);
    } finally {
      setIsInserting(false);
    }
  };

  // Dialog handler removed

  // Update extracted data
  const handleDataUpdate = (newData: Student[]) => {
    setExtractedData(newData);
    generateMarkStatistics(newData, detectedMarkTypes);
    // Recompute accuracy after manual edits
    try {
      const updated = computeExtractionAccuracy(newData, detectedMarkTypes);
      setExtractionAccuracy(updated);
    } catch (e) {
      // noop
    }
  };

  // Name correction handlers removed

  // Step navigation helpers
  const advanceToStep = (step: AppStep) => {
    setCurrentStep(step);
  };

  const completeStep = (step: AppStep) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      newSet.add(step);
      return newSet;
    });
  };

  const isStepCompleted = (step: AppStep): boolean => {
    return completedSteps.has(step);
  };

  const resetApp = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setExtractedData(null);
    setCurrentStep(AppStep.FileAnalysis);
    setCompletedSteps(new Set());
    setIsInserting(false);

    setMarkStats(null);
    setExtractionAccuracy(null);
  };

  return (
    <FluentProvider theme={webLightTheme}>
      <GlobalStyle />
      <div className="app-container">
        <AppHeader title={title || "استيراد النقط - مسار"} />

        <div className="progress-container">
          <StepNavigation currentStep={currentStep} completedSteps={completedSteps} onStepClick={advanceToStep} />
        </div>

        <div className="app-content">
          {error && <OcrErrorDisplay errorMessage={error} errorCode={errorCode} />}

          <div className="steps-container">
            {/* Conditionally render the step that is currently active */}
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
                ></ImageProcessingStep>
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
        <div className="developer-footer">
          <div className="developer-name">تم تطوير هذه الأداة من طرف أمين الخالدي - Amine Elkhalidy</div>
          <div className="copyright-text">جميع الحقوق محفوظة</div>
        </div>
      </div>
    </FluentProvider>
  );
};

export default App;
