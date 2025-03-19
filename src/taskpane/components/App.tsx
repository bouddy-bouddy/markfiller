import React, { useState, useRef, useEffect } from "react";
import { FluentProvider, webLightTheme, Text, Card } from "@fluentui/react-components";
import { createGlobalStyle } from "styled-components";
import ocrService from "../services/ocrService";
import excelService from "../services/excelService";
import { Student, ExcelStatus, AppStep, DetectedMarkTypes, MarkType } from "../types";
import StatusAlert from "./shared/StatusAlert";
import FileAnalysisStep from "./steps/FileAnalysisStep";
import ImageProcessingStep from "./steps/ImageProcessingStep";
import ReviewConfirmStep from "./steps/ReviewConfirmStep";
import StatisticsStep from "./steps/StatisticsStep";
import IntelligentMarkTypeDialog from "./dialogs/IntelligentMarkTypeDialog";
import AppHeader from "./shared/AppHeader";
import StepNavigation from "./shared/StepNavigation";

// GlobalStyle for App.tsx
const GlobalStyle = createGlobalStyle`
  /* Base RTL Settings */
  html, body {
    direction: rtl;
    text-align: right;
    background-color: #f5f5f5;
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', sans-serif;
  }

  body {
    padding: 0;
    height: 100vh;
  }

  /* Container styles */
  .app-container {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    direction: rtl;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .app-content {
    padding: 0 24px 24px 24px;
    flex: 1;
    overflow-y: auto;
  }
  
  /* Step styling */
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 16px;
    padding-bottom: 16px;
  }

  .step {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 20px;
    background-color: white;
    transition: all 0.3s ease;
    text-align: right;
    direction: rtl;
  }
  
  .step.active {
    border-color: #0e7c42;
    box-shadow: 0 2px 8px rgba(14, 124, 66, 0.1);
  }
  
  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
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
  
  /* Progress bar container */
  .progress-container {
    margin-bottom: 24px;
    padding: 0 24px;
  }
  
  /* Progress pills */
  .progress-pills {
    display: flex;
    justify-content: space-between;
    position: relative;
    margin: 24px 0;
  }
  
  /* Line connecting pills */
  .progress-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #e0e0e0;
    transform: translateY(-50%);
    z-index: 1;
  }
  
  .progress-line-filled {
    position: absolute;
    top: 50%;
    left: 0;
    height: 2px;
    background-color: #0e7c42;
    transform: translateY(-50%);
    z-index: 2;
    transition: width 0.3s ease;
  }
  
  /* Individual pill */
  .progress-pill {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #666;
    position: relative;
    z-index: 3;
    border: 2px solid #e0e0e0;
    transition: all 0.3s ease;
  }
  
  .progress-pill.active {
    background-color: #0e7c42;
    color: white;
    border-color: #0e7c42;
  }
  
  .progress-pill.completed {
    background-color: #0e7c42;
    color: white;
    border-color: #0e7c42;
  }
  
  /* Pill label */
  .pill-label {
    position: absolute;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }
  
  .pill-label.active, .pill-label.completed {
    color: #0e7c42;
    font-weight: 600;
  }
`;

interface AppProps {
  title: string;
  isOfficeInitialized?: boolean;
}

// Type for mark statistics
interface MarkTypeStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

// Type for mark distribution
interface MarkDistribution {
  "0-5": number;
  "5-10": number;
  "10-15": number;
  "15-20": number;
}

// Type for suspicious mark
interface SuspiciousMark {
  student: string;
  type: string;
  value: number;
}

// Type for statistics object
interface Statistics {
  totalStudents: number;
  markTypes: Record<MarkType, MarkTypeStats>;
  distribution: Record<MarkType, MarkDistribution>;
  suspiciousMarks: SuspiciousMark[];
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
    hasActivities: false,
  });

  // Dialog states
  const [showMarkTypeDialog, setShowMarkTypeDialog] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Statistics
  const [markStats, setMarkStats] = useState<Statistics | null>(null);

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
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null); // Clear any previous errors

    try {
      // Process the image using OCR
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

      // Generate some basic statistics for the data
      generateMarkStatistics(students);
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

    return;
  };

  // Generate statistics for the extracted marks
  const generateMarkStatistics = (students: Student[]) => {
    if (!students || students.length === 0) return;

    const stats: Statistics = {
      totalStudents: students.length,
      markTypes: {
        fard1: { count: 0, sum: 0, min: 20, max: 0, avg: 0 },
        fard2: { count: 0, sum: 0, min: 20, max: 0, avg: 0 },
        fard3: { count: 0, sum: 0, min: 20, max: 0, avg: 0 },
        activities: { count: 0, sum: 0, min: 20, max: 0, avg: 0 },
      },
      distribution: {
        fard1: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        fard2: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        fard3: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        activities: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
      },
      suspiciousMarks: [],
    };

    // Calculate basic statistics
    students.forEach((student) => {
      Object.entries(student.marks).forEach(([key, value]) => {
        // Skip if it's not a valid mark type
        if (!["fard1", "fard2", "fard3", "activities"].includes(key)) return;

        const markType = key as MarkType;
        if (value !== null) {
          stats.markTypes[markType].count++;
          stats.markTypes[markType].sum += value;
          stats.markTypes[markType].min = Math.min(stats.markTypes[markType].min, value);
          stats.markTypes[markType].max = Math.max(stats.markTypes[markType].max, value);

          // Calculate distribution
          if (value >= 0 && value < 5) stats.distribution[markType]["0-5"]++;
          else if (value >= 5 && value < 10) stats.distribution[markType]["5-10"]++;
          else if (value >= 10 && value < 15) stats.distribution[markType]["10-15"]++;
          else if (value >= 15 && value <= 20) stats.distribution[markType]["15-20"]++;

          // Check for suspicious marks (very low or very high)
          if (value < 3 || value > 18) {
            stats.suspiciousMarks.push({
              student: student.name,
              type: markType,
              value,
            });
          }
        }
      });
    });

    // Calculate averages
    Object.keys(stats.markTypes).forEach((type) => {
      const markType = type as MarkType;
      if (stats.markTypes[markType].count > 0) {
        stats.markTypes[markType].avg = stats.markTypes[markType].sum / stats.markTypes[markType].count;
      }
    });

    setMarkStats(stats);

    // Identify suspicious marks for UI highlighting
    const suspicious = students.filter((student) => {
      return (
        (student.marks.fard1 !== null && (student.marks.fard1 < 3 || student.marks.fard1 > 18)) ||
        (student.marks.fard2 !== null && (student.marks.fard2 < 3 || student.marks.fard2 > 18)) ||
        (student.marks.fard3 !== null && (student.marks.fard3 < 3 || student.marks.fard3 > 18)) ||
        (student.marks.activities !== null && (student.marks.activities < 3 || student.marks.activities > 18))
      );
    });

    setSuspiciousMarks(suspicious);
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

      // Close dialogs and mark step as completed
      setShowMarkTypeDialog(false);
      completeStep(AppStep.ReviewConfirm);
      advanceToStep(AppStep.Statistics);
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
    generateMarkStatistics(newData);
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
    setCurrentStep(AppStep.FileAnalysis);
    setCompletedSteps(new Set());
    setSuspiciousMarks([]);
    setMarkStats(null);
    // Keep detected mark types for the next run
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
          {error && <StatusAlert type="error" message={error} />}
          {successMessage && <StatusAlert type="success" message={successMessage} />}

          <div className="steps-container">
            {/* File Analysis Step */}
            <FileAnalysisStep
              isActive={currentStep === AppStep.FileAnalysis}
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

            {/* Statistics Step */}
            {markStats && (
              <StatisticsStep
                isActive={currentStep === AppStep.Statistics}
                isCompleted={isStepCompleted(AppStep.Statistics)}
                statistics={markStats}
                detectedMarkTypes={detectedMarkTypes}
                onReset={resetApp}
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
        </div>
      </div>
    </FluentProvider>
  );
};

export default App;
