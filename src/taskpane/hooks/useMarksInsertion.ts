/* eslint-disable no-console */
import { useState } from "react";
import excelService from "../services/excel/excelService";
import { licenseService } from "../services/license/licenseService";
import { Student, DetectedMarkTypes, AppStep } from "../types";

interface UseMarksInsertionProps {
  completeStep: (step: AppStep) => void;
  advanceToStep: (step: AppStep) => void;
  onError: (message: string) => void;
}

interface UseMarksInsertionResult {
  isInserting: boolean;
  insertMarks: (extractedData: Student[], detectedMarkTypes: DetectedMarkTypes) => Promise<void>;
}

export const useMarksInsertion = ({
  completeStep,
  advanceToStep,
  onError,
}: UseMarksInsertionProps): UseMarksInsertionResult => {
  const [isInserting, setIsInserting] = useState<boolean>(false);

  const insertMarks = async (extractedData: Student[], detectedMarkTypes: DetectedMarkTypes) => {
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

      onError("فشل في إدراج العلامات. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsInserting(false);
    }
  };

  return {
    isInserting,
    insertMarks,
  };
};
