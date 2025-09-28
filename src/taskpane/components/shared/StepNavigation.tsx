import React from "react";
import { CheckmarkCircle24Filled } from "@fluentui/react-icons";
import { AppStep } from "../../types";

interface StepNavigationProps {
  currentStep: AppStep;
  completedSteps: Set<AppStep>;
  onStepClick: (step: AppStep) => void;
}

const StepNavigation: React.FC<StepNavigationProps> = ({ currentStep, completedSteps, onStepClick }) => {
  const steps = [
    { id: AppStep.FileAnalysis, label: "ملف مسار" },
    { id: AppStep.ImageProcessing, label: "معالجة الصورة" },
    { id: AppStep.ReviewConfirm, label: "مراجعة وتأكيد" },
    { id: AppStep.MappingPreview, label: "تطابق العلامات" },
    { id: AppStep.Statistics, label: "إحصائيات" },
  ];

  const getStepClassName = (stepId: AppStep) => {
    if (completedSteps.has(stepId)) return "progress-pill completed";
    if (stepId === currentStep) return "progress-pill active";
    return "progress-pill";
  };

  const getLabelClassName = (stepId: AppStep) => {
    if (completedSteps.has(stepId)) return "pill-label completed";
    if (stepId === currentStep) return "pill-label active";
    return "pill-label";
  };

  // Calculate progress line width
  const calculateProgressWidth = () => {
    const totalSteps = steps.length;
    const stepWidth = 100 / (totalSteps - 1);

    let width = 0;
    if (currentStep === AppStep.FileAnalysis) width = 0;
    else if (currentStep === AppStep.ImageProcessing) width = stepWidth;
    else if (currentStep === AppStep.ReviewConfirm) width = stepWidth * 2;
    else if (currentStep === AppStep.MappingPreview) width = stepWidth * 3;
    else if (currentStep === AppStep.Statistics) width = stepWidth * 4;

    // If we're on step 2-5 and the previous step is completed, make sure
    // the progress line reflects that
    if (currentStep === AppStep.ImageProcessing && completedSteps.has(AppStep.FileAnalysis)) {
      width = stepWidth;
    } else if (currentStep === AppStep.ReviewConfirm && completedSteps.has(AppStep.ImageProcessing)) {
      width = stepWidth * 2;
    } else if (currentStep === AppStep.MappingPreview && completedSteps.has(AppStep.ReviewConfirm)) {
      width = stepWidth * 3;
    } else if (currentStep === AppStep.Statistics && completedSteps.has(AppStep.MappingPreview)) {
      width = stepWidth * 4;
    }

    return `${width}%`;
  };

  const handleStepClick = (stepId: AppStep) => {
    // Only allow clicking on completed steps or the current active step
    if (completedSteps.has(stepId) || stepId === currentStep) {
      onStepClick(stepId);
    }
  };

  return (
    <div className="progress-pills">
      <div className="progress-line"></div>
      <div className="progress-line-filled" style={{ width: calculateProgressWidth() }}></div>

      {steps.map((step, index) => (
        <div key={step.id} style={{ position: "relative" }}>
          <div
            className={getStepClassName(step.id)}
            onClick={() => handleStepClick(step.id)}
            style={{ cursor: completedSteps.has(step.id) || step.id === currentStep ? "pointer" : "default" }}
          >
            {completedSteps.has(step.id) ? (
              <CheckmarkCircle24Filled style={{ width: "16px", height: "16px" }} />
            ) : (
              index + 1
            )}
          </div>
          <div className={getLabelClassName(step.id)}>{step.label}</div>
        </div>
      ))}
    </div>
  );
};

export default StepNavigation;
