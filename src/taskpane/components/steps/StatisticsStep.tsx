import React, { useMemo, useRef } from "react";
import { Text, Card, Button, Badge } from "@fluentui/react-components";
import { ChartMultiple24Regular, DocumentAdd24Regular } from "@fluentui/react-icons";
import { DetectedMarkTypes, MarkType } from "../../types";
import styled from "styled-components";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import type { ChartData } from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

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

const ChartRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
`;

const ChartCard = styled(Card)`
  padding: 16px;
`;

const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 12px 0 20px;
`;

const KPIItem = styled(Card)`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
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

// Type for mark statistics
interface MarkTypeStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  median?: number;
  stdDev?: number;
  passCount?: number;
  failCount?: number;
  missingCount?: number;
}

// Type for mark distribution
interface MarkDistribution {
  "0-5": number;
  "5-10": number;
  "10-15": number;
  "15-20": number;
}

// Type for statistics object
interface Statistics {
  totalStudents: number;
  markTypes: Record<MarkType, MarkTypeStats>;
  distribution: Record<MarkType, MarkDistribution>;
  topStudentsByType?: Record<
    MarkType,
    Array<{
      name: string;
      value: number;
    }>
  >;
  bottomStudentsByType?: Record<
    MarkType,
    Array<{
      name: string;
      value: number;
    }>
  >;
  outliersByType?: Record<
    MarkType,
    {
      high: Array<{ name: string; value: number }>;
      low: Array<{ name: string; value: number }>;
    }
  >;
  overall?: {
    overallAverage: number;
    overallMedian: number;
    overallStdDev: number;
    passRate: number;
    failRate: number;
    missingRate: number;
    totalMarksCounted: number;
  };
  recommendations?: string[];
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
  const reportRef = useRef<HTMLDivElement>(null);
  const shownTypes: MarkType[] = useMemo(() => {
    const list: MarkType[] = [];
    if (detectedMarkTypes.hasFard1) list.push("fard1");
    if (detectedMarkTypes.hasFard2) list.push("fard2");
    if (detectedMarkTypes.hasFard3) list.push("fard3");
    if (detectedMarkTypes.hasFard4) list.push("fard4");
    if (detectedMarkTypes.hasActivities) list.push("activities");
    return list.filter((t) => statistics.markTypes[t].count > 0);
  }, [detectedMarkTypes, statistics]);
  // Check if any mark type was detected
  const hasDetectedTypes =
    detectedMarkTypes.hasFard1 ||
    detectedMarkTypes.hasFard2 ||
    detectedMarkTypes.hasFard3 ||
    detectedMarkTypes.hasFard4 ||
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
      case "fard4":
        return detectedMarkTypes.hasFard4;
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
      case "fard4":
        return "الفرض 4";
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
      case "fard4":
        return "#d53f8c";
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

  const exportPdf = async () => {
    if (!reportRef.current) return;
    const element = reportRef.current;
    const canvas = await html2canvas(element as HTMLDivElement, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("MarkFiller-Statistics.pdf");
  };

  // Chart datasets
  const averagesBarData = useMemo<ChartData<"bar">>(() => {
    const labels = shownTypes.map((t) => getMarkTypeName(t));
    const data = shownTypes.map((t) => statistics.markTypes[t].avg);
    return {
      labels: [...labels],
      datasets: [
        {
          label: "متوسط العلامات",
          data: [...data],
          backgroundColor: "rgba(14, 124, 66, 0.7)",
          borderRadius: 6,
        },
      ],
    };
  }, [shownTypes, statistics]);

  const passFailDoughnutData = useMemo<ChartData<"doughnut">>(() => {
    const pass = Math.round((statistics.overall?.passRate || 0) * 100);
    const fail = Math.round((statistics.overall?.failRate || 0) * 100);
    const missing = Math.round((statistics.overall?.missingRate || 0) * 100);
    return {
      labels: ["ناجح", "راسب", "مفقود"],
      datasets: [
        {
          label: "%",
          data: [pass, fail, missing],
          backgroundColor: ["#10b981", "#ef4444", "#94a3b8"],
          hoverOffset: 8,
        },
      ],
    };
  }, [statistics]);

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
        <div ref={reportRef}>
          <Text style={{ marginBottom: "20px", display: "block", width: "100%", textAlign: "right" }}>
            فيما يلي نظرة عامة عن البيانات المستخرجة من الصورة وتحليل إحصائي لها. يمكنك استخدام هذه المعلومات للتأكد من
            صحة البيانات قبل إدخالها في Excel.
          </Text>

          {/* KPI Summary */}
          {statistics.overall && (
            <KPIGrid>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  المتوسط العام
                </Text>
                <StatValue>{formatNumber(statistics.overall.overallAverage)}</StatValue>
              </KPIItem>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  الوسيط العام
                </Text>
                <StatValue>{formatNumber(statistics.overall.overallMedian)}</StatValue>
              </KPIItem>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  الانحراف المعياري
                </Text>
                <StatValue>{formatNumber(statistics.overall.overallStdDev)}</StatValue>
              </KPIItem>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  نسبة النجاح
                </Text>
                <StatValue>{Math.round((statistics.overall.passRate || 0) * 100)}%</StatValue>
              </KPIItem>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  نسبة الرسوب
                </Text>
                <StatValue>{Math.round((statistics.overall.failRate || 0) * 100)}%</StatValue>
              </KPIItem>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  نسبة المفقود
                </Text>
                <StatValue>{Math.round((statistics.overall.missingRate || 0) * 100)}%</StatValue>
              </KPIItem>
              <KPIItem>
                <Text size={200} style={{ color: "#64748b" }}>
                  عدد العلامات المحسوبة
                </Text>
                <StatValue>{statistics.overall.totalMarksCounted}</StatValue>
              </KPIItem>
            </KPIGrid>
          )}

          {/* Charts Row */}
          <ChartRow>
            <ChartCard>
              <Text size={400} weight="semibold" style={{ marginBottom: 8 }}>
                متوسط العلامات حسب النوع
              </Text>
              <Bar data={averagesBarData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </ChartCard>
            <ChartCard>
              <Text size={400} weight="semibold" style={{ marginBottom: 8 }}>
                توزيع النجاح والرسوب والقيم المفقودة
              </Text>
              <Doughnut data={passFailDoughnutData} />
            </ChartCard>
          </ChartRow>

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

            {(["fard1", "fard2", "fard3", "fard4", "activities"] as MarkType[]).map((type) => {
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
            {(["fard1", "fard2", "fard3", "fard4", "activities"] as MarkType[]).map((type) => {
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

          {/* Top and Bottom performers */}
          <Text
            size={500}
            weight="semibold"
            style={{ display: "block", marginBottom: "12px", marginTop: "24px", width: "100%", textAlign: "right" }}
          >
            المتفوقون والنتائج الأدنى
          </Text>
          <DistributionGrid>
            {shownTypes.map((type) => (
              <Card key={`perf-${type}`} style={{ padding: 16 }}>
                <Text size={400} weight="semibold" style={{ marginBottom: 12, color: getMarkTypeColor(type) }}>
                  {getMarkTypeName(type)}
                </Text>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 6 }}>
                      الأعلى (Top 5)
                    </Text>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(statistics.topStudentsByType?.[type] || []).slice(0, 5).map((s, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text size={200}>{s.name}</Text>
                          <Badge appearance="filled" color="success">
                            {formatNumber(s.value)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 6 }}>
                      الأدنى (Bottom 5)
                    </Text>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(statistics.bottomStudentsByType?.[type] || []).slice(0, 5).map((s, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text size={200}>{s.name}</Text>
                          <Badge appearance="outline">{formatNumber(s.value)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </DistributionGrid>

          {/* Outliers */}
          <Text
            size={500}
            weight="semibold"
            style={{ display: "block", marginBottom: "12px", marginTop: "24px", width: "100%", textAlign: "right" }}
          >
            القيم الشاذة (Outliers)
          </Text>
          <DistributionGrid>
            {shownTypes.map((type) => (
              <Card key={`outliers-${type}`} style={{ padding: 16 }}>
                <Text size={400} weight="semibold" style={{ marginBottom: 12, color: getMarkTypeColor(type) }}>
                  {getMarkTypeName(type)}
                </Text>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 6 }}>
                      أعلى من (+2σ)
                    </Text>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(statistics.outliersByType?.[type]?.high || []).map((s, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text size={200}>{s.name}</Text>
                          <Badge appearance="filled" color="success">
                            {formatNumber(s.value)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 6 }}>
                      أدنى من (-2σ)
                    </Text>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(statistics.outliersByType?.[type]?.low || []).map((s, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text size={200}>{s.name}</Text>
                          <Badge appearance="outline">{formatNumber(s.value)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </DistributionGrid>

          {/* Recommendations */}
          {statistics.recommendations && statistics.recommendations.length > 0 && (
            <Card style={{ padding: 16, marginTop: 16 }}>
              <Text size={400} weight="semibold" style={{ marginBottom: 8 }}>
                توصيات مبنية على النتائج
              </Text>
              <ul style={{ margin: 0, padding: "0 18px" }}>
                {statistics.recommendations.map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>
                    <Text size={300}>{rec}</Text>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

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
          <Button appearance="secondary" onClick={exportPdf}>
            تصدير PDF
          </Button>
        </ButtonContainer>
      </div>
    </div>
  );
};

export default StatisticsStep;
