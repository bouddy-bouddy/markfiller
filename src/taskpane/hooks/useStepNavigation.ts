import { useState } from "react";
import { AppStep } from "../types";

interface UseStepNavigationResult {
  currentStep: AppStep;
  completedSteps: Set<AppStep>;
  completeStep: (step: AppStep) => void;
  advanceToStep: (step: AppStep) => void;
  isStepCompleted: (step: AppStep) => boolean;
  resetSteps: () => void;
}

export const useStepNavigation = (): UseStepNavigationResult => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.FileAnalysis);
  const [completedSteps, setCompletedSteps] = useState<Set<AppStep>>(new Set());

  const completeStep = (step: AppStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const advanceToStep = (step: AppStep) => {
    setCurrentStep(step);
  };

  const isStepCompleted = (step: AppStep): boolean => {
    return completedSteps.has(step);
  };

  const resetSteps = () => {
    setCurrentStep(AppStep.ImageProcessing);
    setCompletedSteps(new Set([AppStep.FileAnalysis]));
  };

  return {
    currentStep,
    completedSteps,
    completeStep,
    advanceToStep,
    isStepCompleted,
    resetSteps,
  };
};

