/* global console */
import React, { Suspense } from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { GlobalStyle } from "../styles/globalStyles";
import { AppStep } from "../types";

// Hooks
import { useLicense } from "../hooks/useLicense";
import { useStepNavigation } from "../hooks/useStepNavigation";
import { useMarkData } from "../hooks/useMarkData";
import { useExcelValidation } from "../hooks/useExcelValidation";
import { useImageProcessing } from "../hooks/useImageProcessing";
import { useMarksInsertion } from "../hooks/useMarksInsertion";
import { licenseService } from "../services/license/licenseService";

// Components
import LicenseActivation from "./LicenseActivation";
import TeacherGreeting from "./shared/TeacherGreeting";
import AppHeader from "./shared/AppHeader";
import StepNavigation from "./shared/StepNavigation";
import NeedHelpSection from "./shared/NeedHelpSection";
import DeveloperFooter from "./DeveloperFooter";
import OcrErrorDisplay from "./shared/OcrErrorDisplay";
import LicenseCheckingScreen from "./shared/LicenseCheckingScreen";

// Lazy-loaded step components
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

interface AppProps {
  title: string;
  isOfficeInitialized?: boolean;
}

const App: React.FC<AppProps> = ({ title, isOfficeInitialized = true }) => {
  // Custom hooks for business logic
  const { isLicenseValid, isCheckingLicense, teacherName, handleLicenseValidated } = useLicense();

  const { currentStep, completedSteps, completeStep, advanceToStep, isStepCompleted, resetSteps } = useStepNavigation();

  const {
    extractedData,
    detectedMarkTypes,
    markStats,
    extractionAccuracy,
    setExtractedStudents,
    updateStudentData,
    resetData,
  } = useMarkData();

  const { excelStatus, validateExcel } = useExcelValidation({
    isOfficeInitialized,
    isLicenseValid,
    completeStep,
    advanceToStep,
  });

  const {
    selectedImage,
    imagePreview,
    isProcessing,
    error,
    errorCode,
    fileInputRef,
    handleImageUpload,
    handleRemoveImage,
    processImage,
  } = useImageProcessing({
    completeStep,
    advanceToStep,
    onDataExtracted: setExtractedStudents,
  });

  const { isInserting, insertMarks } = useMarksInsertion({
    completeStep,
    advanceToStep,
    onError: (message: string) => {
      // eslint-disable-next-line no-console
      console.error(message);
    },
  });

  // Combined reset function
  const resetApp = () => {
    resetSteps();
    resetData();
    handleRemoveImage();
    // Track restart
    licenseService.trackUsage("app_restarted");
  };

  // Handler functions
  const handleConfirmData = () => {
    completeStep(AppStep.ReviewConfirm);
    advanceToStep(AppStep.MappingPreview);
  };

  const handleConfirmMapping = async () => {
    if (extractedData) {
      await insertMarks(extractedData, detectedMarkTypes);
    }
  };

  // Show loading spinner while checking license
  if (isCheckingLicense) {
    return (
      <FluentProvider theme={webLightTheme}>
        <LicenseCheckingScreen />
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
                  onValidateExcel={validateExcel}
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
                  isActive={true}
                  isCompleted={isStepCompleted(AppStep.ReviewConfirm)}
                  data={extractedData}
                  onConfirm={handleConfirmData}
                  onCancel={resetApp}
                  onDataUpdate={updateStudentData}
                  tableKey={0}
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
