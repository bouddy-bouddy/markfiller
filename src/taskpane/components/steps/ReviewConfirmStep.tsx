import React from "react";
import { Button, Text, Card } from "@fluentui/react-components";
import { CheckmarkCircle24Regular, DismissCircle24Regular, WarningRegular, Edit24Regular } from "@fluentui/react-icons";
import DataTable from "../shared/DataTable";
import { Student } from "../../types";
import styled from "styled-components";

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

interface InfoCardProps {
  type: "success" | "warning";
}

const InfoCard = styled(Card)<InfoCardProps>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background-color: ${(props) => (props.type === "success" ? "#f0fff4" : "#fff5f5")};
  border-radius: 8px;
  border: 1px solid ${(props) => (props.type === "success" ? "#c6f6d5" : "#fed7d7")};
`;

const ButtonContainer = styled.div`
  margin-top: 20px;
  display: flex;
  gap: 16px;
  justify-content: flex-start;
`;

const PrimaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  min-width: 140px !important;

  &:hover:not(:disabled) {
    transform: translateY(-2px) !important;
    box-shadow: 0 16px 24px -4px rgba(14, 124, 66, 0.4) !important;
  }

  &:active:not(:disabled) {
    transform: translateY(0) !important;
  }

  .fui-Button__icon {
    margin-left: 8px !important;
  }
`;

const SecondaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  min-width: 100px !important;

  &:hover:not(:disabled) {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  }

  .fui-Button__icon {
    margin-left: 8px !important;
  }
`;

interface ReviewConfirmStepProps {
  isActive: boolean;
  isCompleted: boolean;
  data: Student[];
  onConfirm: () => void;
  onCancel: () => void;
  onDataUpdate: (data: Student[]) => void;
  suspiciousMarks: Student[];
}

const ReviewConfirmStep: React.FC<ReviewConfirmStepProps> = ({
  isActive,
  isCompleted,
  data,
  onConfirm,
  onCancel,
  onDataUpdate,
  suspiciousMarks,
}) => {
  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepTitle>
        <Edit24Regular
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
          مراجعة وتأكيد
        </Text>
      </StepTitle>

      <div className="step-content">
        {/* Statistics & Potential Issues */}
        {suspiciousMarks.length > 0 && (
          <InfoCard type="warning">
            <WarningRegular style={{ color: "#e53e3e", flexShrink: 0, marginTop: "4px" }} />
            <div>
              <Text weight="semibold" style={{ color: "#e53e3e", display: "block", marginBottom: "8px" }}>
                تم اكتشاف علامات غير معتادة:
              </Text>
              <Text size={200} style={{ color: "#c53030" }}>
                هناك {suspiciousMarks.length} علامة تبدو خارج النطاق المعتاد. يرجى مراجعتها قبل التأكيد.
              </Text>
              <Text size={200} style={{ color: "#c53030", marginTop: "8px" }}>
                العلامات المشكوك فيها مميزة بخلفية حمراء خفيفة في الجدول. انقر على أي علامة لتعديلها.
              </Text>
            </div>
          </InfoCard>
        )}

        <Text size={300} style={{ marginBottom: "16px", color: "#666", display: "block" }}>
          يمكنك تصحيح أي علامة غير صحيحة بالنقر عليها
        </Text>

        {data && data.length > 0 && (
          <>
            <DataTable data={data} onDataUpdate={onDataUpdate} suspiciousMarks={suspiciousMarks} />

            <ButtonContainer>
              <PrimaryButton appearance="primary" onClick={onConfirm} icon={<CheckmarkCircle24Regular />}>
                تأكيد وإدخال في Excel
              </PrimaryButton>

              <SecondaryButton appearance="secondary" onClick={onCancel} icon={<DismissCircle24Regular />}>
                إلغاء
              </SecondaryButton>
            </ButtonContainer>

            {/* Additional helping text */}
            <Text size={200} style={{ color: "#666", marginTop: "16px", display: "block" }}>
              * تم استخدام خوارزميات التعلم الآلي المتقدمة للتعرف على العلامات. إذا وجدت أي أخطاء، يمكنك تصحيحها بالنقر
              على العلامة المعنية.
            </Text>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewConfirmStep;
