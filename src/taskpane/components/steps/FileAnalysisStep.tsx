import React from "react";
import { Text, Button } from "@fluentui/react-components";
import { DocumentTable24Regular, CheckmarkCircle24Regular } from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import StatusAlert from "../shared/StatusAlert";
import { ExcelStatus } from "../../types";

interface FileAnalysisStepProps {
  isActive: boolean;
  isCompleted: boolean;
  excelStatus: ExcelStatus;
}

const FileAnalysisStep: React.FC<FileAnalysisStepProps> = ({ isActive, isCompleted, excelStatus }) => {
  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepIndicator
        stepNumber={2}
        title="تحليل ملف مسار"
        isActive={isActive}
        isCompleted={isCompleted || excelStatus.isValid}
      />

      <div className="step-content">
        <div style={{ marginBottom: "20px" }}>
          <Text>
            يجب فتح ملف مسار المناسب في Excel قبل استيراد العلامات. سيتم تحليل هيكل الملف للتأكد من وجود الأعمدة
            المطلوبة.
          </Text>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px",
            backgroundColor: excelStatus.isValid ? "#f0f9ff" : "#f9f9f9",
            borderRadius: "8px",
            border: `1px solid ${excelStatus.isValid ? "#bae6fd" : "#e0e0e0"}`,
            marginBottom: "16px",
          }}
        >
          {excelStatus.isValid ? (
            <CheckmarkCircle24Regular style={{ color: "#107C10", fontSize: "24px" }} />
          ) : (
            <DocumentTable24Regular style={{ color: "#666", fontSize: "24px" }} />
          )}

          <div>
            <Text weight="semibold" style={{ display: "block", marginBottom: "4px" }}>
              {excelStatus.isValid ? "تم التحقق من ملف مسار بنجاح" : "لم يتم التحقق من ملف مسار"}
            </Text>

            <Text size={200} style={{ color: "#666" }}>
              {excelStatus.isValid ? "ملف مسار جاهز لاستيراد العلامات" : "يرجى فتح ملف مسار المناسب في Excel"}
            </Text>
          </div>
        </div>

        {!excelStatus.isValid && (
          <div style={{ marginTop: "16px" }}>
            <Text weight="semibold" style={{ display: "block", marginBottom: "12px" }}>
              خطوات فتح ملف مسار:
            </Text>

            <ol style={{ paddingRight: "20px", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>قم بتسجيل الدخول إلى منصة مسار</li>
              <li style={{ marginBottom: "8px" }}>انتقل إلى قسم "النقط" وحدد القسم المطلوب</li>
              <li style={{ marginBottom: "8px" }}>اضغط على زر "تصدير إلى Excel"</li>
              <li style={{ marginBottom: "8px" }}>افتح الملف الذي تم تنزيله</li>
              <li>عد إلى هذا التطبيق للمتابعة</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileAnalysisStep;
