import React from "react";
import { Text, Card, Button, Badge } from "@fluentui/react-components";
import { ChartMultiple24Regular, DocumentAdd24Regular } from "@fluentui/react-icons";
import { DetectedMarkTypes, MarkType } from "../../types";
import styled from "styled-components";

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
  width: 100%;
`;

const StatCard = styled(Card)`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: #0e7c42;
`;

const DistributionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
  width: 100%;
`;

const DistributionBar = styled.div`
  height: 24px;
  border-radius: 4px;
  background-color: #e0e0e0;
  position: relative;
  margin-top: 4px;
  overflow: hidden;
`;

const DistributionFill = styled.div<{ width: string; color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: ${(props) => props.color};
  width: ${(props) => props.width};
  transition: width 0.6s ease;
`;

const ButtonContainer = styled.div`
  margin-top: 24px;
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
`;

const PrimaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  width: 100% !important;
  max-width: 400px !important;

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

const SuspiciousMarksCard = styled(Card)`
  margin-top: 20px;
  padding: 16px;
  background-color: #fff5f5;
  width: 100%;
  border: 1px solid #fed7d7;
`;

// Type for mark statistics
interface MarkTypeStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

// Type for mark distribution
interface MarkDistribution {
  "0-5": number;
  "5-10": number;
  "10-15": number;
  "15-20": number;
}

// Type for suspicious mark
interface SuspiciousMark {
  student: string;
  type: string;
  value: number;
}

// Type for statistics object
interface Statistics {
  totalStudents: number;
  markTypes: Record<MarkType, MarkTypeStats>;
  distribution: Record<MarkType, MarkDistribution>;
  suspiciousMarks: SuspiciousMark[];
}

interface StatisticsStepProps {
  isActive: boolean;
  isCompleted: boolean;
  statistics: Statistics;
  detectedMarkTypes: DetectedMarkTypes;
  onReset: () => void;
}

const StatisticsStep: React.FC<StatisticsStepProps> = ({
  isActive,
  isCompleted,
  statistics,
  detectedMarkTypes,
  onReset,
}) => {
  // Check if any mark type was detected
  const hasDetectedTypes =
    detectedMarkTypes.hasFard1 ||
    detectedMarkTypes.hasFard2 ||
    detectedMarkTypes.hasFard3 ||
    detectedMarkTypes.hasActivities;

  // Helper to determine which stats to display based on detected types
  const shouldShowStat = (type: MarkType): boolean => {
    switch (type) {
      case "fard1":
        return detectedMarkTypes.hasFard1;
      case "fard2":
        return detectedMarkTypes.hasFard2;
      case "fard3":
        return detectedMarkTypes.hasFard3;
      case "activities":
        return detectedMarkTypes.hasActivities;
      default:
        return true;
    }
  };

  // Helper to get Arabic name for mark type
  const getMarkTypeName = (type: string): string => {
    switch (type) {
      case "fard1":
        return "الفرض 1";
      case "fard2":
        return "الفرض 2";
      case "fard3":
        return "الفرض 3";
      case "activities":
        return "الأنشطة";
      default:
        return type;
    }
  };

  // Helper to get a color for each mark type
  const getMarkTypeColor = (type: string): string => {
    switch (type) {
      case "fard1":
        return "#3182ce";
      case "fard2":
        return "#38a169";
      case "fard3":
        return "#805ad5";
      case "activities":
        return "#dd6b20";
      default:
        return "#718096";
    }
  };

  // Helper to format a number to 2 decimal places
  const formatNumber = (num: number): string => {
    return num.toFixed(2);
  };

  // Helper to calculate maximum value for a distribution category
  const getMaxDistribution = (type: MarkType): number => {
    const dist = statistics.distribution[type];
    return Math.max(dist["0-5"], dist["5-10"], dist["10-15"], dist["15-20"]);
  };

  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepTitle>
        <ChartMultiple24Regular
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
          إحصائيات وتحليل البيانات
        </Text>
      </StepTitle>

      <div className="step-content" style={{ width: "100%", maxWidth: "100%" }}>
        <Text style={{ marginBottom: "20px", display: "block", width: "100%", textAlign: "right" }}>
          فيما يلي نظرة عامة عن البيانات المستخرجة من الصورة وتحليل إحصائي لها. يمكنك استخدام هذه المعلومات للتأكد من
          صحة البيانات قبل إدخالها في Excel.
        </Text>

        {/* Summary Stats */}
        <Text
          size={500}
          weight="semibold"
          style={{ display: "block", marginBottom: "12px", width: "100%", textAlign: "right" }}
        >
          ملخص البيانات
        </Text>

        <StatsGrid>
          <StatCard>
            <StatHeader>
              <Text size={300} weight="semibold">
                عدد الطلاب
              </Text>
            </StatHeader>
            <StatValue>{statistics.totalStudents}</StatValue>
          </StatCard>

          {(["fard1", "fard2", "fard3", "activities"] as MarkType[]).map((type) => {
            if (!shouldShowStat(type) || statistics.markTypes[type].count === 0) return null;

            return (
              <StatCard key={type}>
                <StatHeader>
                  <Text size={300} weight="semibold">
                    {getMarkTypeName(type)}
                  </Text>
                  <Badge appearance="outline" style={{ color: getMarkTypeColor(type) }}>
                    {statistics.markTypes[type].count} طالب
                  </Badge>
                </StatHeader>
                <StatValue>{formatNumber(statistics.markTypes[type].avg)}</StatValue>
                <Text size={200} style={{ color: "#666" }}>
                  الحد الأدنى: {formatNumber(statistics.markTypes[type].min)} | الحد الأقصى:{" "}
                  {formatNumber(statistics.markTypes[type].max)}
                </Text>
              </StatCard>
            );
          })}
        </StatsGrid>

        {/* Distribution */}
        <Text
          size={500}
          weight="semibold"
          style={{ display: "block", marginBottom: "12px", marginTop: "24px", width: "100%", textAlign: "right" }}
        >
          توزيع العلامات
        </Text>

        <DistributionGrid>
          {(["fard1", "fard2", "fard3", "activities"] as MarkType[]).map((type) => {
            if (!shouldShowStat(type) || statistics.markTypes[type].count === 0) return null;

            const maxValue = getMaxDistribution(type);
            const dist = statistics.distribution[type];
            const color = getMarkTypeColor(type);

            return (
              <Card key={type} style={{ padding: "16px" }}>
                <Text size={400} weight="semibold" style={{ marginBottom: "12px", color: color }}>
                  {getMarkTypeName(type)}
                </Text>

                <div style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <Text size={200}>0-5</Text>
                    <Text size={200}>{dist["0-5"]} طالب</Text>
                  </div>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["0-5"] / maxValue) * 100}%`} color={color} />
                  </DistributionBar>
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <Text size={200}>5-10</Text>
                    <Text size={200}>{dist["5-10"]} طالب</Text>
                  </div>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["5-10"] / maxValue) * 100}%`} color={color} />
                  </DistributionBar>
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <Text size={200}>10-15</Text>
                    <Text size={200}>{dist["10-15"]} طالب</Text>
                  </div>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["10-15"] / maxValue) * 100}%`} color={color} />
                  </DistributionBar>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <Text size={200}>15-20</Text>
                    <Text size={200}>{dist["15-20"]} طالب</Text>
                  </div>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["15-20"] / maxValue) * 100}%`} color={color} />
                  </DistributionBar>
                </div>
              </Card>
            );
          })}
        </DistributionGrid>

        {/* Suspicious Marks */}
        {statistics.suspiciousMarks && statistics.suspiciousMarks.length > 0 && (
          <SuspiciousMarksCard>
            <Text
              size={400}
              weight="semibold"
              style={{ marginBottom: "12px", color: "#e53e3e", width: "100%", textAlign: "right" }}
            >
              علامات مشكوك فيها ({statistics.suspiciousMarks.length})
            </Text>

            <Text size={300} style={{ marginBottom: "12px", width: "100%", textAlign: "right" }}>
              تم اكتشاف العلامات التالية كعلامات غير معتادة (أقل من 3 أو أكثر من 18). يمكنك الرجوع للخطوة السابقة للتحقق
              من صحتها.
            </Text>

            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                padding: "8px",
                backgroundColor: "#fff8f8",
                borderRadius: "4px",
              }}
            >
              {statistics.suspiciousMarks.map((mark, index) => (
                <div key={index} style={{ marginBottom: "8px", padding: "4px", borderBottom: "1px solid #fee2e2" }}>
                  <Text weight="semibold">{mark.student}</Text>
                  <Text size={200}>
                    {getMarkTypeName(mark.type)}:{" "}
                    <span style={{ color: "#e53e3e", fontWeight: "bold" }}>{mark.value}</span>
                  </Text>
                </div>
              ))}
            </div>
          </SuspiciousMarksCard>
        )}

        <ButtonContainer>
          <PrimaryButton
            appearance="primary"
            icon={<DocumentAdd24Regular />}
            onClick={() => {
              // Reset for new data
              onReset();
            }}
          >
            إنشاء عملية استخراج بيانات جديدة
          </PrimaryButton>
        </ButtonContainer>
      </div>
    </div>
  );
};

export default StatisticsStep;
