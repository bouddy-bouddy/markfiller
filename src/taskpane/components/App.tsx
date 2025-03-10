import React, { useState, useRef, useEffect } from "react";
import { FluentProvider, webLightTheme, Text, Card } from "@fluentui/react-components";
import { createGlobalStyle } from "styled-components";
import ocrService from "../services/ocrService";
import excelService from "../services/excelService";
import { Student, ExcelStatus, AppStep, DetectedMarkTypes } from "../types";
import StatusAlert from "./shared/StatusAlert";
import ImageProcessingStep from "./steps/ImageProcessingStep";
import FileAnalysisStep from "./steps/FileAnalysisStep";
import ReviewConfirmStep from "./steps/ReviewConfirmStep";
import IntelligentMarkTypeDialog from "./dialogs/IntelligentMarkTypeDialog";

// GlobalStyle for App.tsx
const GlobalStyle = createGlobalStyle`
  /* Base RTL Settings */
  html, body {
    direction: rtl;
    text-align: right;
    background-color: #f5f5f5;
    margin: 0;
    padding: 0;
  }

  body {
    padding: 16px;
  }

  /* Container styles */
  .ms-welcome {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 24px;
    direction: rtl;
  }

  .ms-welcome__header {
    color: #242424;
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 20px;
    text-align: right;
  }
  
  /* Step styling */
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 24px;
  }

  .step {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 24px;
    background-color: white;
    transition: all 0.3s ease;
    text-align: right;
    direction: rtl;
  }
  
  .step.active {
    border-color: #0e7c42; /* Changed to green */
    box-shadow: 0 2px 8px rgba(14, 124, 66, 0.1); /* Changed to green */
  }
  
  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #666;
  }
  
  .step.active .step-number {
    background-color: #0e7c42; /* Changed to green */
    color: white;
  }
  
  .step-title {
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }
  
  .step-content {
    padding-right: 44px;
  }

  /* Force RTL for all elements with text */
  input, button, select, textarea, div, span, p, h1, h2, h3, h4, h5, h6 {
    text-align: right;
  }

  /* Override Fluent UI RTL */
  .fui-FluentProvider {
    direction: rtl;
  }
`;

interface AppProps {
  title: string;
  isOfficeInitialized?: boolean;
}

const App: React.FC<AppProps> = ({ title, isOfficeInitialized = true }) => {
  // State for selected image
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data and steps
  const [extractedData, setExtractedData] = useState<Student[] | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.ImageProcessing);
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
    hasActivities: false,
  });

  // Dialog states
  const [showMarkTypeDialog, setShowMarkTypeDialog] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Suspicious marks detection
  const [suspiciousMarks, setSuspiciousMarks] = useState<Student[]>([]);

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

  // Clear success message after 5 seconds
  // useEffect(() => {
  //   if (successMessage) {
  //     const timeout = setTimeout(() => {
  //       setSuccessMessage(null);
  //     }, 5000);

  //     return () => clearTimeout(timeout);
  //   }
  // }, [successMessage]);

  // Handle image upload
  const handleImageUpload = (file: File) => {
    if (file) {
      // Check if file is an image
      if (!file.type.startsWith("image/")) {
        setError("الرجاء اختيار ملف صورة صالح");
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة يجب أن يكون أقل من 5 ميغابايت");
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

  // Process image with OCR
  const processImage = async (): Promise<void> => {
    if (!selectedImage) return; // This line needs an explicit return type

    setIsProcessing(true);
    setError(null); // Clear any previous errors

    try {
      // Process the image using Google Cloud Vision OCR with enhanced detection
      const { students, detectedMarkTypes } = await ocrService.processImage(selectedImage);

      // Show preview of extracted data
      setExtractedData(students);
      setDetectedMarkTypes(detectedMarkTypes);
      completeStep(AppStep.ImageProcessing);
      advanceToStep(AppStep.ReviewConfirm);

      // Log detected mark types for debugging
      console.log("Detected mark types:", detectedMarkTypes);

      // Show success message with intelligent mark detection
      const detectedTypes = [];
      if (detectedMarkTypes.hasFard1) detectedTypes.push("الفرض 1");
      if (detectedMarkTypes.hasFard2) detectedTypes.push("الفرض 2");
      if (detectedMarkTypes.hasFard3) detectedTypes.push("الفرض 3");
      if (detectedMarkTypes.hasActivities) detectedTypes.push("الأنشطة");

      if (detectedTypes.length > 0) {
        setSuccessMessage(`تم اكتشاف العلامات التالية: ${detectedTypes.join("، ")}`);
      } else {
        setSuccessMessage("تم استخراج البيانات بنجاح");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "حدث خطأ أثناء معالجة الصورة. الرجاء المحاولة مرة أخرى.");
      } else {
        setError("حدث خطأ غير معروف أثناء معالجة الصورة");
      }
      console.error(err);
    } finally {
      setIsProcessing(false);
    }

    // Add this explicit return
    return;
  };

  // Handle mark data confirmation
  const handleConfirmData = async () => {
    try {
      // First validate Excel file
      const isValidFile = await excelService.validateExcelFile();
      if (!isValidFile) {
        setError("يرجى التأكد من فتح ملف مسار صحيح في Excel");
        return;
      }

      // Show mark type selection dialog with intelligent recommendations
      setShowMarkTypeDialog(true);
    } catch (err) {
      setError("حدث خطأ أثناء التحقق من ملف Excel");
      console.error(err);
    }
  };

  // Handle mark type selection
  const handleMarkTypeSelected = async (markType: string) => {
    setIsSaving(true);
    try {
      if (!extractedData) {
        throw new Error("No data to save");
      }

      // Insert marks with detected mark types information
      const results = await excelService.insertMarks(extractedData, markType, detectedMarkTypes);

      // Show results
      if (results.notFound > 0) {
        setError(`تم إدخال ${results.success} علامة بنجاح. ${results.notFound} طالب لم يتم العثور عليهم.`);

        if (results.notFoundStudents.length > 0) {
          console.log("Students not found:", results.notFoundStudents);
        }
      } else {
        setSuccessMessage(`تم إدخال ${results.success} علامة بنجاح في عمود "${markType}"`);
        setError(null);
      }

      // Close dialogs and reset state
      setShowMarkTypeDialog(false);
      resetApp();
    } catch (err) {
      setError("حدث خطأ أثناء إدخال البيانات في Excel");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Update extracted data
  const handleDataUpdate = (newData: Student[]) => {
    setExtractedData(newData);
  };

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
    setCurrentStep(AppStep.ImageProcessing);
    setCompletedSteps(new Set());
    setSuspiciousMarks([]);
    // Keep detected mark types for the next run
  };

  return (
    <FluentProvider theme={webLightTheme}>
      <GlobalStyle />
      <Card className="ms-welcome">
        <Text as="h1" className="ms-welcome__header">
          {title || "استيراد النقط - مسار"}
        </Text>

        {excelStatus.checked && !excelStatus.isValid && (
          <StatusAlert
            type="error"
            message="يرجى فتح ملف مسار المُصدَّر من النظام قبل البدء في معالجة الصور. للمتابعة:
            ١. افتح ملف مسار الخاص بالقسم المطلوب
            ٢. تأكد من أن الملف يحتوي على أعمدة العلامات (الفرض ١، الفرض ٢، إلخ)
            ٣. ثم قم برفع صورة كشف النقط"
          />
        )}

        {error && <StatusAlert type="error" message={error} />}
        {successMessage && <StatusAlert type="success" message={successMessage} />}

        <div className="steps-container">
          {/* Image Processing Step */}
          <ImageProcessingStep
            isActive={currentStep === AppStep.ImageProcessing}
            isCompleted={isStepCompleted(AppStep.ImageProcessing)}
            selectedImage={selectedImage}
            imagePreview={imagePreview}
            isProcessing={isProcessing}
            onImageUpload={handleImageUpload}
            onProcessImage={processImage}
            fileInputRef={fileInputRef}
            detectedMarkTypes={detectedMarkTypes}
          />

          {/* File Analysis Step */}
          <FileAnalysisStep
            isActive={currentStep === AppStep.FileAnalysis}
            isCompleted={isStepCompleted(AppStep.FileAnalysis)}
            excelStatus={excelStatus}
          />

          {/* Review and Confirm Step */}
          {extractedData && (
            <ReviewConfirmStep
              isActive={currentStep === AppStep.ReviewConfirm}
              isCompleted={isStepCompleted(AppStep.ReviewConfirm)}
              data={extractedData}
              onConfirm={handleConfirmData}
              onCancel={resetApp}
              onDataUpdate={handleDataUpdate}
              suspiciousMarks={suspiciousMarks}
              detectedMarkTypes={detectedMarkTypes}
            />
          )}
        </div>

        {/* Intelligent Mark Type Dialog */}
        <IntelligentMarkTypeDialog
          isOpen={showMarkTypeDialog}
          onClose={() => setShowMarkTypeDialog(false)}
          onConfirm={handleMarkTypeSelected}
          isSaving={isSaving}
          detectedMarkTypes={detectedMarkTypes}
        />
      </Card>
    </FluentProvider>
  );
};

export default App;
