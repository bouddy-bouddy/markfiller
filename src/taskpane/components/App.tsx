import React, { useState, useRef, useEffect } from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { createGlobalStyle } from "styled-components";
import geminiOcrService from "../services/geminiOcrService";
import excelService from "../services/excelService";
import { Student, ExcelStatus, AppStep, DetectedMarkTypes, MarkType } from "../types";

import OcrErrorDisplay from "./shared/OcrErrorDisplay";
import FileAnalysisStep from "./steps/FileAnalysisStep";
import ImageProcessingStep from "./steps/ImageProcessingStep";
import ReviewConfirmStep from "./steps/ReviewConfirmStep";
import MappingStep from "./steps/MappingStep";
import StatisticsStep from "./steps/StatisticsStep";
// IntelligentMarkTypeDialog removed
import AppHeader from "./shared/AppHeader";
import StepNavigation from "./shared/StepNavigation";

// GlobalStyle for App.tsx
const GlobalStyle = createGlobalStyle`
  /* Base RTL Settings */
  html, body {
    direction: rtl;
    text-align: right;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
    font-feature-settings: 'ss01', 'ss02', 'cv01', 'cv02';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    padding: 0;
    height: 100vh;
    overflow-x: hidden;
  }

  /* Container styles */
  .app-container {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    box-shadow: 
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04),
      0 0 0 1px rgba(0, 0, 0, 0.05);
    direction: rtl;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .app-content {
    padding: 0 32px 32px 32px;
    flex: 1;
    overflow-y: auto;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.6) 100%);
  }
  
  /* Step styling */
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 32px;
    margin-top: 24px;
    padding-bottom: 24px;
  }

  .step {
    border: 1px solid rgba(14, 124, 66, 0.1);
    border-radius: 16px;
    padding: 28px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: right;
    direction: rtl;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    position: relative;
    overflow: hidden;
  }

  .step::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .step.active {
    border-color: rgba(14, 124, 66, 0.3);
    box-shadow: 
      0 20px 25px -5px rgba(14, 124, 66, 0.1),
      0 10px 10px -5px rgba(14, 124, 66, 0.04),
      0 0 0 1px rgba(14, 124, 66, 0.1);
    transform: translateY(-2px);
  }

  .step.active::before {
    opacity: 1;
  }

  .step.completed {
    border-color: rgba(14, 124, 66, 0.2);
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  }
  
  .step-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  
  .step-content {
    padding-right: 48px;
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
    margin-bottom: 32px;
    padding: 0 32px;
  }
  
  /* Progress pills */
  .progress-pills {
    display: flex;
    justify-content: space-between;
    position: relative;
    margin: 32px 0;
    padding: 16px 0;
  }
  
  /* Line connecting pills */
  .progress-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 100%);
    transform: translateY(-50%);
    z-index: 1;
    border-radius: 2px;
  }
  
  .progress-line-filled {
    position: absolute;
    top: 50%;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    transform: translateY(-50%);
    z-index: 2;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(14, 124, 66, 0.3);
  }
  
  /* Individual pill */
  .progress-pill {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #64748b;
    position: relative;
    z-index: 3;
    border: 3px solid #e2e8f0;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .progress-pill:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  
  .progress-pill.active {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-color: #0e7c42;
    box-shadow: 
      0 0 0 4px rgba(14, 124, 66, 0.1),
      0 10px 15px -3px rgba(14, 124, 66, 0.2),
      0 4px 6px -2px rgba(14, 124, 66, 0.1);
    transform: scale(1.1);
  }
  
  .progress-pill.completed {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-color: #0e7c42;
    box-shadow: 
      0 0 0 4px rgba(14, 124, 66, 0.1),
      0 10px 15px -3px rgba(14, 124, 66, 0.2),
      0 4px 6px -2px rgba(14, 124, 66, 0.1);
  }
  
  /* Pill label */
  .pill-label {
    position: absolute;
    top: 48px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 13px;
    color: #64748b;
    font-weight: 600;
    transition: all 0.3s ease;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  }
  
  .pill-label.active, .pill-label.completed {
    color: #0e7c42;
    font-weight: 700;
    text-shadow: none;
  }

  /* Enhanced button styles */
  .fui-Button {
    border-radius: 12px !important;
    font-weight: 600 !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
  }

  .fui-Button:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  }

  .fui-Button:active {
    transform: translateY(0) !important;
  }

  /* Enhanced card styles */
  .fui-Card {
    border-radius: 16px !important;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  .fui-Card:hover {
    transform: translateY(-2px) !important;
    box-shadow: 
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
  }

  /* Enhanced text styles */
  .fui-Text {
    line-height: 1.6 !important;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #0e7c42 0%, #10b981 100%);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #065f46 0%, #0e7c42 100%);
  }

  /* Animation keyframes */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
    }
  }

  /* Apply animations to steps */
  .step {
    animation: fadeInUp 0.6s ease-out;
  }

  .step:nth-child(1) { animation-delay: 0.1s; }
  .step:nth-child(2) { animation-delay: 0.2s; }
  .step:nth-child(3) { animation-delay: 0.3s; }
  .step:nth-child(4) { animation-delay: 0.4s; }

  /* Enhanced focus states */
  .fui-Button:focus-visible,
  .fui-Card:focus-visible,
  .progress-pill:focus-visible {
    outline: 2px solid #0e7c42 !important;
    outline-offset: 2px !important;
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
  median?: number;
  stdDev?: number;
  passCount?: number;
  failCount?: number;
  missingCount?: number;
}

// Type for mark distribution
interface MarkDistribution {
  "0-5": number;
  "5-10": number;
  "10-15": number;
  "15-20": number;
}

// Type for statistics object
interface Statistics {
  totalStudents: number;
  markTypes: Record<MarkType, MarkTypeStats>;
  distribution: Record<MarkType, MarkDistribution>;
  topStudentsByType?: Record<
    MarkType,
    Array<{
      name: string;
      value: number;
    }>
  >;
  bottomStudentsByType?: Record<
    MarkType,
    Array<{
      name: string;
      value: number;
    }>
  >;
  outliersByType?: Record<
    MarkType,
    {
      high: Array<{ name: string; value: number }>;
      low: Array<{ name: string; value: number }>;
    }
  >;
  overall?: {
    overallAverage: number;
    overallMedian: number;
    overallStdDev: number;
    passRate: number; // 0..1
    failRate: number; // 0..1
    missingRate: number; // 0..1
    totalMarksCounted: number;
  };
  recommendations?: string[];
}

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
  const [tableKey, setTableKey] = useState<number>(0); // Force re-render key

  // Statistics
  const [markStats, setMarkStats] = useState<Statistics | null>(null);

  // Processing stages
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);

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
      // Process the image using enhanced OCR service
      console.log("🚀 STARTING OCR PROCESSING - About to call Google Vision API");
      console.log("📸 Image file details:", {
        name: selectedImage.name,
        size: selectedImage.size,
        type: selectedImage.type,
        lastModified: new Date(selectedImage.lastModified).toISOString(),
      });

      const { students, detectedMarkTypes } = await geminiOcrService.processImageFast(selectedImage);

      console.log("✅ OCR PROCESSING COMPLETED - Google Vision API response processed");
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
      completeStep(AppStep.ImageProcessing);
      advanceToStep(AppStep.ReviewConfirm);
      generateMarkStatistics(enhancedResults.students);
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

  // Generate statistics for the extracted marks
  const generateMarkStatistics = (students: Student[]) => {
    if (!students || students.length === 0) return;

    const stats: Statistics = {
      totalStudents: students.length,
      markTypes: {
        fard1: {
          count: 0,
          sum: 0,
          min: 20,
          max: 0,
          avg: 0,
          median: 0,
          stdDev: 0,
          passCount: 0,
          failCount: 0,
          missingCount: 0,
        },
        fard2: {
          count: 0,
          sum: 0,
          min: 20,
          max: 0,
          avg: 0,
          median: 0,
          stdDev: 0,
          passCount: 0,
          failCount: 0,
          missingCount: 0,
        },
        fard3: {
          count: 0,
          sum: 0,
          min: 20,
          max: 0,
          avg: 0,
          median: 0,
          stdDev: 0,
          passCount: 0,
          failCount: 0,
          missingCount: 0,
        },
        fard4: {
          count: 0,
          sum: 0,
          min: 20,
          max: 0,
          avg: 0,
          median: 0,
          stdDev: 0,
          passCount: 0,
          failCount: 0,
          missingCount: 0,
        },
        activities: {
          count: 0,
          sum: 0,
          min: 20,
          max: 0,
          avg: 0,
          median: 0,
          stdDev: 0,
          passCount: 0,
          failCount: 0,
          missingCount: 0,
        },
      },
      distribution: {
        fard1: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        fard2: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        fard3: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        fard4: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
        activities: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
      },
      topStudentsByType: {
        fard1: [],
        fard2: [],
        fard3: [],
        fard4: [],
        activities: [],
      },
      bottomStudentsByType: {
        fard1: [],
        fard2: [],
        fard3: [],
        fard4: [],
        activities: [],
      },
      outliersByType: {
        fard1: { high: [], low: [] },
        fard2: { high: [], low: [] },
        fard3: { high: [], low: [] },
        fard4: { high: [], low: [] },
        activities: { high: [], low: [] },
      },
      overall: {
        overallAverage: 0,
        overallMedian: 0,
        overallStdDev: 0,
        passRate: 0,
        failRate: 0,
        missingRate: 0,
        totalMarksCounted: 0,
      },
      recommendations: [],
    };

    // Calculate basic statistics
    students.forEach((student) => {
      Object.entries(student.marks).forEach(([key, value]) => {
        // Skip if it's not a valid mark type
        if (!["fard1", "fard2", "fard3", "fard4", "activities"].includes(key)) return;

        const markType = key as MarkType;
        if (value !== null) {
          stats.markTypes[markType].count++;
          stats.markTypes[markType].sum += value;
          stats.markTypes[markType].min = Math.min(stats.markTypes[markType].min, value);
          stats.markTypes[markType].max = Math.max(stats.markTypes[markType].max, value);
          if (value >= 10) stats.markTypes[markType].passCount! += 1;
          else stats.markTypes[markType].failCount! += 1;
          // collect for median/stdDev/top
          (stats.topStudentsByType![markType] as Array<{ name: string; value: number }>).push({
            name: student.name,
            value,
          });

          // Calculate distribution
          if (value >= 0 && value < 5) stats.distribution[markType]["0-5"]++;
          else if (value >= 5 && value < 10) stats.distribution[markType]["5-10"]++;
          else if (value >= 10 && value < 15) stats.distribution[markType]["10-15"]++;
          else if (value >= 15 && value <= 20) stats.distribution[markType]["15-20"]++;
        } else {
          stats.markTypes[markType].missingCount! += 1;
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

    // Calculate median and stdDev and top/bottom students and outliers
    const overallValues: number[] = [];
    let totalMissing = 0;
    (Object.keys(stats.markTypes) as MarkType[]).forEach((type) => {
      const arr = (stats.topStudentsByType![type] as Array<{ name: string; value: number }>).map((s) => s.value);
      arr.sort((a, b) => a - b);
      if (arr.length > 0) {
        const mid = Math.floor(arr.length / 2);
        stats.markTypes[type].median = arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        const mean = stats.markTypes[type].avg;
        const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
        stats.markTypes[type].stdDev = Math.sqrt(variance);

        // Outliers (±2σ)
        const highThreshold = mean + 2 * (stats.markTypes[type].stdDev || 0);
        const lowThreshold = mean - 2 * (stats.markTypes[type].stdDev || 0);
        const sortedPairs = (stats.topStudentsByType![type] as Array<{ name: string; value: number }>).slice();
        stats.outliersByType![type].high = sortedPairs.filter((p) => p.value >= highThreshold);
        stats.outliersByType![type].low = sortedPairs.filter((p) => p.value <= lowThreshold);

        // Bottom students (ascending)
        stats.bottomStudentsByType![type] = sortedPairs
          .slice()
          .sort((a, b) => a.value - b.value)
          .slice(0, 5);

        // Accumulate for overall
        overallValues.push(...arr);
      } else {
        totalMissing += stats.markTypes[type].missingCount || 0;
      }
      // sort top students list descending by value
      stats.topStudentsByType![type] = (stats.topStudentsByType![type] as Array<{ name: string; value: number }>).sort(
        (a, b) => b.value - a.value
      );
    });

    // Overall stats
    overallValues.sort((a, b) => a - b);
    const overallCount = overallValues.length;
    if (overallCount > 0) {
      const mid = Math.floor(overallCount / 2);
      const overallMedian =
        overallCount % 2 !== 0 ? overallValues[mid] : (overallValues[mid - 1] + overallValues[mid]) / 2;
      const overallAverage = overallValues.reduce((s, v) => s + v, 0) / overallCount;
      const overallVariance = overallValues.reduce((s, v) => s + Math.pow(v - overallAverage, 2), 0) / overallCount;
      const overallStdDev = Math.sqrt(overallVariance);
      const pass = overallValues.filter((v) => v >= 10).length;
      stats.overall = {
        overallAverage,
        overallMedian,
        overallStdDev,
        passRate: pass / overallCount,
        failRate: 1 - pass / overallCount,
        missingRate: totalMissing / (overallCount + totalMissing || 1),
        totalMarksCounted: overallCount,
      };
    }

    // Recommendations
    const recs: string[] = [];
    if (stats.overall && stats.overall.passRate < 0.6) {
      recs.push("نسبة النجاح العامة منخفضة. قد تحتاج لتقوية الدعم للتلاميذ ذوي النتائج الضعيفة.");
    }
    (Object.keys(stats.markTypes) as MarkType[]).forEach((type) => {
      const s = stats.markTypes[type];
      if (s.count > 0 && s.avg < 10) {
        recs.push(`متوسط ${type} أقل من المعدل (10). جرّب مراجعة هذا المحور مع المتعلمين.`);
      }
      if ((s.stdDev || 0) > 4) {
        recs.push(
          `تشتت عالٍ في ${type} (انحراف معياري ${(s.stdDev || 0).toFixed(2)}). قد توجد فوارق كبيرة بين التلاميذ.`
        );
      }
      if ((s.missingCount || 0) / (s.count + (s.missingCount || 0) || 1) > 0.1) {
        recs.push(`نسبة القيم المفقودة مرتفعة في ${type}. تحقق من اكتمال الإدخال أو وضوح الصورة.`);
      }
    });
    stats.recommendations = recs;

    setMarkStats(stats);
  };

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
        setError(`تم إدخال ${results.success} علامة بنجاح. ${results.notFound} طالب لم يتم العثور عليهم في ملف Excel.`);
      } else {
        setError(null);
      }

      // Move to statistics step
      completeStep(AppStep.MappingPreview);
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
    generateMarkStatistics(newData);
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
    // Name correction states removed
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
            )}

            {/* Image Processing Step */}
            {currentStep === AppStep.ImageProcessing && (
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
            )}

            {/* Review and Confirm Step */}
            {currentStep === AppStep.ReviewConfirm && extractedData && (
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
              />
            )}

            {/* NEW: Mapping Preview Step */}
            {currentStep === AppStep.MappingPreview && extractedData && (
              <MappingStep
                isActive={true}
                isCompleted={isStepCompleted(AppStep.MappingPreview)}
                extractedData={extractedData}
                detectedMarkTypes={detectedMarkTypes}
                onConfirmMapping={handleConfirmMapping}
                onCancel={resetApp}
                isInserting={isInserting}
              />
            )}

            {/* Statistics Step */}
            {currentStep === AppStep.Statistics && markStats && (
              <StatisticsStep
                isActive={true}
                isCompleted={isStepCompleted(AppStep.Statistics)}
                statistics={markStats}
                detectedMarkTypes={detectedMarkTypes}
                onReset={resetApp}
              />
            )}
          </div>

          {/* Intelligent Mark Type Dialog removed */}

          {/* Student Name Correction Dialog */}
        </div>
      </div>
    </FluentProvider>
  );
};

export default App;
