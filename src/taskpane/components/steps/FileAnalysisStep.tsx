import React from "react";
import { Text, Button, Card } from "@fluentui/react-components";
import {
  DocumentTable24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import StatusAlert from "../shared/StatusAlert";
import { ExcelStatus } from "../../types";
import styled from "styled-components";

interface StatusCardProps {
  isValid: boolean;
}

const StatusCard = styled(Card)<StatusCardProps>`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  background-color: ${(props) => (props.isValid ? "#f0f9ff" : "#fff5f5")};
  border: 1px solid ${(props) => (props.isValid ? "#bae6fd" : "#fed7d7")};
`;

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const InfoCard = styled(Card)`
  padding: 16px;
  border-radius: 8px;
  margin-top: 20px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
`;

const InfoList = styled.ol`
  padding-right: 20px;
  margin: 12px 0;
`;

const InfoListItem = styled.li`
  margin-bottom: 8px;
`;

interface FileAnalysisStepProps {
  isActive: boolean;
  isCompleted: boolean;
  excelStatus: ExcelStatus;
  onValidateExcel?: () => void;
}

const FileAnalysisStep: React.FC<FileAnalysisStepProps> = ({ isActive, isCompleted, excelStatus, onValidateExcel }) => {
  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepTitle>
        <DocumentTable24Regular
          style={{
            color: isActive ? "#0e7c42" : isCompleted ? "#0e7c42" : "#666",
            fontSize: "24px",
          }}
        />
        <Text
          size={600}
          weight="semibold"
          style={{
            color: isActive ? "#0e7c42" : isCompleted ? "#0e7c42" : "#333",
          }}
        >
          تحقق من ملف مسار
        </Text>
      </StepTitle>

      <div className="step-content">
        <Text style={{ marginBottom: "20px", display: "block" }}>
          يجب فتح ملف مسار المناسب في Excel قبل استيراد العلامات. سيتم تحليل هيكل الملف للتأكد من وجود الأعمدة المطلوبة.
        </Text>

        <StatusCard isValid={excelStatus.isValid}>
          {excelStatus.isValid ? (
            <CheckmarkCircle24Regular style={{ color: "#0e7c42", fontSize: "24px", flexShrink: 0 }} />
          ) : (
            <ErrorCircle24Regular style={{ color: "#e53e3e", fontSize: "24px", flexShrink: 0 }} />
          )}

          <div>
            <Text weight="semibold" style={{ display: "block", marginBottom: "4px" }}>
              {excelStatus.isValid ? "تم التحقق من ملف مسار بنجاح" : "لم يتم التحقق من ملف مسار"}
            </Text>

            <Text size={200} style={{ color: excelStatus.isValid ? "#0e7c42" : "#e53e3e" }}>
              {excelStatus.isValid ? "ملف مسار جاهز لاستيراد العلامات" : "يرجى فتح ملف مسار المناسب في Excel"}
            </Text>
          </div>

          <div style={{ marginRight: "auto" }}>
            <Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={onValidateExcel}>
              تحديث الحالة
            </Button>
          </div>
        </StatusCard>

        {!excelStatus.isValid && (
          <InfoCard>
            <Text weight="semibold" style={{ display: "block", marginBottom: "12px" }}>
              خطوات فتح ملف مسار:
            </Text>

            <InfoList>
              <InfoListItem>قم بتسجيل الدخول إلى منصة مسار</InfoListItem>
              <InfoListItem>انتقل إلى قسم "النقط" وحدد القسم المطلوب</InfoListItem>
              <InfoListItem>اضغط على زر "تصدير إلى Excel"</InfoListItem>
              <InfoListItem>افتح الملف الذي تم تنزيله</InfoListItem>
              <InfoListItem>اضغط على زر "تحديث الحالة" للتحقق مرة أخرى</InfoListItem>
            </InfoList>
          </InfoCard>
        )}

        {isActive && excelStatus.isValid && (
          <div style={{ marginTop: "20px", textAlign: "left" }}>
            <Button appearance="primary" onClick={() => onValidateExcel && onValidateExcel()}>
              متابعة
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileAnalysisStep;
