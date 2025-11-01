import { useState, useEffect } from "react";
import excelService from "../services/excel/excelService";
import { ExcelStatus, AppStep } from "../types";

interface UseExcelValidationProps {
  isOfficeInitialized: boolean;
  isLicenseValid: boolean;
  completeStep: (step: AppStep) => void;
  advanceToStep: (step: AppStep) => void;
}

interface UseExcelValidationResult {
  excelStatus: ExcelStatus;
  validateExcel: () => Promise<void>;
}

export const useExcelValidation = ({
  isOfficeInitialized,
  isLicenseValid,
  completeStep,
  advanceToStep,
}: UseExcelValidationProps): UseExcelValidationResult => {
  const [excelStatus, setExcelStatus] = useState<ExcelStatus>({
    isValid: false,
    checked: false,
  });

  const validateExcel = async () => {
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

  // Check Excel file on initialization
  useEffect(() => {
    if (isOfficeInitialized && isLicenseValid) {
      validateExcel();
    }
  }, [isOfficeInitialized, isLicenseValid]);

  return {
    excelStatus,
    validateExcel,
  };
};
