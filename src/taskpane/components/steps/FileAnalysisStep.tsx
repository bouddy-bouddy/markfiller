import React from "react";
import { Text, Button, Card } from "@fluentui/react-components";
import {
  DocumentTable24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import { ExcelStatus } from "../../types";
import styled from "styled-components";

interface StatusCardProps {
  $isValid: boolean;
}

const StatusCard = styled(Card)<StatusCardProps>`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  border-radius: 16px;
  margin-bottom: 24px;
  background: ${(props) =>
    props.$isValid
      ? "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)"
      : "linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)"};
  border: 2px solid ${(props) => (props.$isValid ? "rgba(14, 124, 66, 0.2)" : "rgba(239, 68, 68, 0.2)")};
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${(props) =>
      props.$isValid
        ? "linear-gradient(90deg, #0e7c42 0%, #10b981 100%)"
        : "linear-gradient(90deg, #ef4444 0%, #f87171 100%)"};
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
`;

const StatusIcon = styled.div<{ $isValid: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: ${(props) =>
    props.$isValid
      ? "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)"
      : "linear-gradient(135deg, #ef4444 0%, #f87171 100%)"};
  box-shadow: 0 8px 16px -4px ${(props) => (props.$isValid ? "rgba(14, 124, 66, 0.3)" : "rgba(239, 68, 68, 0.3)")};
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.05);
  }
`;

const StatusContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StatusTitle = styled(Text)`
  font-weight: 700 !important;
  font-size: 16px !important;
  color: #1f2937 !important;
  margin: 0 !important;
`;

const StatusMessage = styled(Text)`
  color: #6b7280 !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  margin: 0 !important;
`;

const ActionButton = styled(Button)`
  margin-right: auto !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 8px 20px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  }
`;

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 0;
`;

const StepIcon = styled.div<{ $isActive: boolean; $isCompleted: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${(props) => {
    if (props.$isCompleted) return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    if (props.$isActive) return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    return "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)";
  }};
  color: ${(props) => {
    if (props.$isCompleted || props.$isActive) return "white";
    return "#6b7280";
  }};
  box-shadow: ${(props) => {
    if (props.$isCompleted || props.$isActive) {
      return "0 8px 16px -4px rgba(14, 124, 66, 0.3)";
    }
    return "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
  }};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

const StepTitleText = styled(Text)`
  font-weight: 700 !important;
  font-size: 20px !important;
  color: #1f2937 !important;
  margin: 0 !important;
  letter-spacing: -0.025em;
`;

const InfoCard = styled(Card)`
  padding: 24px;
  border-radius: 16px;
  margin-top: 24px;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border: 2px solid rgba(14, 124, 66, 0.1);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
`;

const InfoTitle = styled(Text)`
  font-weight: 700 !important;
  font-size: 16px !important;
  color: #1f2937 !important;
  margin: 0 0 16px 0 !important;
  display: flex !important;
  align-items: center;
  gap: 8px;
`;

const InfoList = styled.ol`
  padding-right: 24px;
  margin: 16px 0;
  counter-reset: step-counter;
  list-style: none;
`;

const InfoListItem = styled.li`
  margin-bottom: 12px;
  position: relative;
  padding-right: 32px;
  line-height: 1.6;
  color: #4b5563;
  font-weight: 500;

  &::before {
    counter-increment: step-counter;
    content: counter(step-counter);
    position: absolute;
    right: 0;
    top: 0;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2);
  }
`;

const ContinueButton = styled(Button)`
  margin-top: 24px !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 32px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 16px 24px -4px rgba(14, 124, 66, 0.4) !important;
  }

  &:active {
    transform: translateY(0) !important;
  }
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
        <StepIcon $isActive={isActive} $isCompleted={isCompleted}>
          <DocumentTable24Regular style={{ fontSize: "24px" }} />
        </StepIcon>
        <StepTitleText>تحقق من ملف مسار</StepTitleText>
      </StepTitle>

      <div className="step-content">
        <Text style={{ marginBottom: "24px", display: "block", lineHeight: "1.6", color: "#4b5563" }}>
          يجب فتح ملف مسار المناسب في Excel قبل استيراد العلامات. سيتم تحليل هيكل الملف للتأكد من وجود الأعمدة المطلوبة.
        </Text>

        <StatusCard $isValid={excelStatus.isValid}>
          <StatusIcon $isValid={excelStatus.isValid}>
            {excelStatus.isValid ? (
              <CheckmarkCircle24Regular style={{ color: "white", fontSize: "28px" }} />
            ) : (
              <ErrorCircle24Regular style={{ color: "white", fontSize: "28px" }} />
            )}
          </StatusIcon>

          <StatusContent>
            <StatusTitle>
              {excelStatus.isValid ? "تم التحقق من ملف مسار بنجاح" : "لم يتم التحقق من ملف مسار"}
            </StatusTitle>

            <StatusMessage>
              {excelStatus.isValid ? "ملف مسار جاهز لاستيراد العلامات" : "يرجى فتح ملف مسار المناسب في Excel"}
            </StatusMessage>
          </StatusContent>

          <ActionButton appearance="subtle" icon={<ArrowSyncRegular />} onClick={onValidateExcel}>
            تحديث الحالة
          </ActionButton>
        </StatusCard>

        {!excelStatus.isValid && (
          <InfoCard>
            <InfoTitle>📋 خطوات فتح ملف مسار:</InfoTitle>

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
          <div style={{ marginTop: "24px", textAlign: "left" }}>
            <ContinueButton appearance="primary" onClick={() => onValidateExcel && onValidateExcel()}>
              متابعة
            </ContinueButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileAnalysisStep;
