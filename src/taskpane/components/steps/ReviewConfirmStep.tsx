import React from "react";
import { Button, Text, Badge, Card } from "@fluentui/react-components";
import {
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  ListRegular,
  WarningRegular,
  Edit24Regular,
} from "@fluentui/react-icons";
import DataTable from "../shared/DataTable";
import { Student, DetectedMarkTypes } from "../../types";
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

const BadgesContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

const ButtonContainer = styled.div`
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-start;
`;

interface ReviewConfirmStepProps {
  isActive: boolean;
  isCompleted: boolean;
  data: Student[];
  onConfirm: () => void;
  onCancel: () => void;
  onDataUpdate: (data: Student[]) => void;
  suspiciousMarks: Student[];
  detectedMarkTypes: DetectedMarkTypes;
}

const ReviewConfirmStep: React.FC<ReviewConfirmStepProps> = ({
  isActive,
  isCompleted,
  data,
  onConfirm,
  onCancel,
  onDataUpdate,
  suspiciousMarks,
  detectedMarkTypes,
}) => {
  // Check if any mark type was detected
  const hasDetectedTypes =
    detectedMarkTypes.hasFard1 ||
    detectedMarkTypes.hasFard2 ||
    detectedMarkTypes.hasFard3 ||
    detectedMarkTypes.hasActivities;

  // Get detected mark types as string array
  const getDetectedTypesText = (): string[] => {
    const types: string[] = [];
    if (detectedMarkTypes.hasFard1) types.push("الفرض 1");
    if (detectedMarkTypes.hasFard2) types.push("الفرض 2");
    if (detectedMarkTypes.hasFard3) types.push("الفرض 3");
    if (detectedMarkTypes.hasActivities) types.push("الأنشطة");
    return types;
  };

  // Count non-null values for each mark type
  const getMarksCount = () => {
    const counts = {
      fard1: 0,
      fard2: 0,
      fard3: 0,
      activities: 0,
    };

    data.forEach((student) => {
      if (student.marks.fard1 !== null) counts.fard1++;
      if (student.marks.fard2 !== null) counts.fard2++;
      if (student.marks.fard3 !== null) counts.fard3++;
      if (student.marks.activities !== null) counts.activities++;
    });

    return counts;
  };

  const markCounts = getMarksCount();

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
        {/* Detected Mark Types */}
        {hasDetectedTypes && (
          <InfoCard type="success">
            <ListRegular style={{ color: "#38a169", flexShrink: 0, marginTop: "4px" }} />
            <div>
              <Text weight="semibold" style={{ color: "#38a169", display: "block", marginBottom: "8px" }}>
                تم اكتشاف أنواع العلامات التالية:
              </Text>
              <BadgesContainer>
                {getDetectedTypesText().map((type) => (
                  <Badge key={type} appearance="filled" color="success">
                    {type}
                  </Badge>
                ))}
              </BadgesContainer>
              <Text size={200} style={{ color: "#2f855a" }}>
                تم استخراج {data.length} طالب من الصورة.
                {markCounts.fard1 > 0 && ` الفرض 1: ${markCounts.fard1} علامة`}
                {markCounts.fard2 > 0 && ` | الفرض 2: ${markCounts.fard2} علامة`}
                {markCounts.fard3 > 0 && ` | الفرض 3: ${markCounts.fard3} علامة`}
                {markCounts.activities > 0 && ` | الأنشطة: ${markCounts.activities} علامة`}
              </Text>
            </div>
          </InfoCard>
        )}

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
              <Button appearance="primary" onClick={onConfirm} icon={<CheckmarkCircle24Regular />}>
                تأكيد وإدخال في Excel
              </Button>

              <Button appearance="secondary" onClick={onCancel} icon={<DismissCircle24Regular />}>
                إلغاء
              </Button>
            </ButtonContainer>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewConfirmStep;
