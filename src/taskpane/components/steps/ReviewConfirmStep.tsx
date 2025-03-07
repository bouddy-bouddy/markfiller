import React from "react";
import { Button, Text } from "@fluentui/react-components";
import { CheckmarkCircle24Regular, DismissCircle24Regular } from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import DataTable from "../shared/DataTable";
import { Student } from "../../types";

interface ReviewConfirmStepProps {
  isActive: boolean;
  isCompleted: boolean;
  data: Student[];
  onConfirm: () => void;
  onCancel: () => void;
  onDataUpdate: (newData: Student[]) => void;
}

const ReviewConfirmStep: React.FC<ReviewConfirmStepProps> = ({
  isActive,
  isCompleted,
  data,
  onConfirm,
  onCancel,
  onDataUpdate,
}) => {
  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepIndicator stepNumber={3} title="مراجعة وتأكيد" isActive={isActive} isCompleted={isCompleted} />

      <div className="step-content">
        <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
          <CheckmarkCircle24Regular style={{ marginLeft: "12px", color: "#0078D4" }} />
          <Text as="h3" size={500} weight="semibold">
            مراجعة البيانات المستخرجة
          </Text>
        </div>

        <Text size={300} style={{ marginBottom: "16px", color: "#666" }}>
          يمكنك تصحيح أي علامة غير صحيحة بالنقر عليها
        </Text>

        {data && data.length > 0 && (
          <>
            <DataTable data={data} onDataUpdate={onDataUpdate} />

            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <Button appearance="primary" onClick={onConfirm} icon={<CheckmarkCircle24Regular />}>
                تأكيد وإدخال في Excel
              </Button>

              <Button appearance="secondary" onClick={onCancel} icon={<DismissCircle24Regular />}>
                إلغاء
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewConfirmStep;
