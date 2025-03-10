import React from "react";
import { Button, Text, Badge } from "@fluentui/react-components";
import { CheckmarkCircle24Regular, DismissCircle24Regular, ListRegular, WarningRegular } from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import DataTable from "../shared/DataTable";
import { Student, DetectedMarkTypes } from "../../types";

interface ReviewConfirmStepProps {
  isActive: boolean;
  isCompleted: boolean;
  data: Student[];
  onConfirm: () => void;
  onCancel: () => void;
  onDataUpdate: (newData: Student[]) => void;
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
      <StepIndicator stepNumber={3} title="مراجعة وتأكيد" isActive={isActive} isCompleted={isCompleted} />

      <div className="step-content">
        <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
          <CheckmarkCircle24Regular style={{ marginLeft: "12px", color: "#0078D4" }} />
          <Text as="h3" size={500} weight="semibold">
            مراجعة البيانات المستخرجة
          </Text>
        </div>

        {/* Detected Mark Types */}
        {hasDetectedTypes && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: "20px",
              padding: "12px",
              backgroundColor: "#f0fff4",
              borderRadius: "4px",
              border: "1px solid #c6f6d5",
            }}
          >
            <ListRegular style={{ color: "#38a169", flexShrink: 0, marginTop: "4px" }} />
            <div>
              <Text weight="semibold" style={{ color: "#38a169", display: "block", marginBottom: "8px" }}>
                تم اكتشاف أنواع العلامات التالية:
              </Text>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                {getDetectedTypesText().map((type) => (
                  <Badge key={type} appearance="filled" color="success">
                    {type}
                  </Badge>
                ))}
              </div>
              <Text size={200} style={{ color: "#2f855a" }}>
                تم استخراج {data.length} طالب من الصورة.
                {markCounts.fard1 > 0 && ` الفرض 1: ${markCounts.fard1} علامة`}
                {markCounts.fard2 > 0 && ` | الفرض 2: ${markCounts.fard2} علامة`}
                {markCounts.fard3 > 0 && ` | الفرض 3: ${markCounts.fard3} علامة`}
                {markCounts.activities > 0 && ` | الأنشطة: ${markCounts.activities} علامة`}
              </Text>
            </div>
          </div>
        )}

        {/* Statistics & Potential Issues */}
        {suspiciousMarks.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: "20px",
              padding: "12px",
              backgroundColor: "#fff5f5",
              borderRadius: "4px",
              border: "1px solid #fed7d7",
            }}
          >
            <WarningRegular style={{ color: "#e53e3e", flexShrink: 0, marginTop: "4px" }} />
            <div>
              <Text weight="semibold" style={{ color: "#e53e3e", display: "block", marginBottom: "8px" }}>
                تم اكتشاف علامات غير معتادة:
              </Text>
              <Text size={200} style={{ color: "#c53030" }}>
                هناك {suspiciousMarks.length} علامة تبدو خارج النطاق المعتاد. يرجى مراجعتها قبل التأكيد.
              </Text>
            </div>
          </div>
        )}

        <Text size={300} style={{ marginBottom: "16px", color: "#666" }}>
          يمكنك تصحيح أي علامة غير صحيحة بالنقر عليها
        </Text>

        {data && data.length > 0 && (
          <>
            <DataTable data={data} onDataUpdate={onDataUpdate} suspiciousMarks={suspiciousMarks} />

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
