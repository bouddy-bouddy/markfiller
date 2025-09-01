import React from "react";
import { Text } from "@fluentui/react-components";
import { TableLink24Regular } from "@fluentui/react-icons";
import styled from "styled-components";
import MappingPreview from "../shared/MappingPreview";
import { Student, DetectedMarkTypes } from "../../types";

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

interface MappingStepProps {
  isActive: boolean;
  isCompleted: boolean;
  extractedData: Student[];
  detectedMarkTypes: DetectedMarkTypes;
  onConfirmMapping: () => Promise<void>;
  onCancel: () => void;
  isInserting?: boolean;
}

const MappingStep: React.FC<MappingStepProps> = ({
  isActive,
  isCompleted,
  extractedData,
  detectedMarkTypes,
  onConfirmMapping,
  onCancel,
  isInserting = false,
}) => {
  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepTitle>
        <TableLink24Regular
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
          تطابق العلامات مع ملف مسار
        </Text>
      </StepTitle>

      <div className="step-content">
        <Text size={300} style={{ marginBottom: "20px", color: "#666", display: "block" }}>
          تحقق من تطابق الطلاب والعلامات مع ملف Excel قبل الإدخال النهائي
        </Text>

        <MappingPreview
          extractedData={extractedData}
          detectedMarkTypes={detectedMarkTypes}
          onConfirmMapping={onConfirmMapping}
          onCancel={onCancel}
          isInserting={isInserting}
        />
      </div>
    </div>
  );
};

export default MappingStep;
