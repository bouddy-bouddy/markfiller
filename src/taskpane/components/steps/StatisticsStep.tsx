/* global HTMLDivElement, console */
/* eslint-disable no-console */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, Card, Button, Badge } from "@fluentui/react-components";
import {
  ChartMultiple24Regular,
  DocumentAdd24Regular,
  Trophy24Regular,
  Warning24Regular,
  CheckmarkCircle24Regular,
  DocumentPdf24Regular,
  Star24Filled,
  DataTrending24Regular,
} from "@fluentui/react-icons";
import { DetectedMarkTypes, MarkType } from "../../types";
import styled from "styled-components";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";
import type { ChartData } from "chart.js";
import excelService from "../../services/excelService";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`;

// Enhanced Dashboard Layout
const DashboardContainer = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 20px;
  padding: 24px !important;
  margin-bottom: 20px;
`;

const MetaBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #ffffff;
  border: 1px dashed rgba(14, 124, 66, 0.35);
  border-radius: 10px;
`;

const MetaItem = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  color: #0f172a;
`;

const MetaLabel = styled.span`
  color: #64748b;
`;

const StatsHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  padding: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  border: 1px solid rgba(14, 124, 66, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const MainTitle = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #0e7c42;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: visible;
  text-align: right;
  line-height: 1.2;
`;

const Subtitle = styled.div`
  font-size: 16px;
  color: #64748b;
  margin-bottom: 16px;
`;

const GeneratedDate = styled.div`
  font-size: 14px;
  color: #94a3b8;
  font-style: italic;
`;

// Enhanced KPI Grid
const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const KPICard = styled(Card)`
  padding: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(14, 124, 66, 0.15);
    border-color: rgba(14, 124, 66, 0.2);
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
  }
`;

const KPIValue = styled.div`
  font-size: 36px;
  font-weight: 700;
  color: #0e7c42;
  margin: 12px 0 8px 0;
  line-height: 1;
`;

const KPILabel = styled.div`
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const KPIIcon = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  opacity: 0.1;
  font-size: 48px;
  color: #0e7c42;
`;

// Section Headers
const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 32px 0 20px 0;
  padding: 16px 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 12px;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

const SectionTitle = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
`;

const SectionIcon = styled.div`
  color: #0e7c42;
`;

// Enhanced Charts Grid
const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const ChartCard = styled(Card)`
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(14, 124, 66, 0.1);
  }
`;

const ChartTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
  text-align: center;
`;

// Performance Tables
const PerformanceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const PerformanceCard = styled(Card)`
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const PerformanceTable = styled.div`
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

const TableHeader = styled.div`
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  color: white;
  padding: 16px;
  font-weight: 600;
  text-align: center;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr 80px 80px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(14, 124, 66, 0.1);
  align-items: center;
  gap: 12px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(14, 124, 66, 0.02);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const RankBadge = styled.div<{ rank: number }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  background: ${(props) =>
    props.rank === 1
      ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
      : props.rank === 2
        ? "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)"
        : props.rank === 3
          ? "linear-gradient(135deg, #cd7c0f 0%, #92400e 100%)"
          : "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)"};
  color: ${(props) => (props.rank <= 3 ? "white" : "#64748b")};
`;

const StudentName = styled.div`
  font-weight: 500;
  color: #1e293b;
`;

const ScoreBadge = styled(Badge)<{ score: number }>`
  background: ${(props) =>
    props.score >= 16
      ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
      : props.score >= 14
        ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
        : props.score >= 10
          ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"} !important;
  color: white !important;
  font-weight: 600 !important;
`;

// Distribution Components
const DistributionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const DistributionCard = styled(Card)`
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const DistributionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(14, 124, 66, 0.1);
`;

const DistributionTitle = styled.div<{ color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${(props) => props.color};
`;

const DistributionItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(14, 124, 66, 0.02);
  border-radius: 8px;
  border-left: 4px solid #0e7c42;
`;

const DistributionRange = styled.div`
  font-weight: 600;
  color: #1e293b;
`;

const DistributionCount = styled.div`
  font-weight: 700;
  color: #0e7c42;
`;

const DistributionBar = styled.div`
  height: 8px;
  background: rgba(14, 124, 66, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
`;

const DistributionFill = styled.div<{ width: string; color: string }>`
  height: 100%;
  background: ${(props) => props.color};
  width: ${(props) => props.width};
  transition: width 0.6s ease;
  border-radius: 4px;
`;

// Additional styled components for fixing inline styles
const StepContent = styled.div`
  width: 100%;
  max-width: 100%;
  padding: 0;
`;

const RecommendationsList = styled.ul`
  margin: 0;
  padding: 0 24px;
  list-style: none;
`;

const RecommendationItem = styled.li`
  margin-bottom: 16px;
  padding: 16px;
  background: rgba(14, 124, 66, 0.05);
  border-radius: 8px;
  border-left: 4px solid #0e7c42;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const RecommendationIcon = styled.div`
  color: #0e7c42;
  margin-top: 2px;
  flex-shrink: 0;
`;

const RecommendationText = styled(Text)`
  line-height: 1.6 !important;
`;

const RecommendationsCard = styled(PerformanceCard)`
  margin-bottom: 32px;
`;

// Enhanced Action Buttons
const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  margin: 40px 0;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

const PrimaryActionButton = styled(Button)`
  border-radius: 16px !important;
  font-weight: 700 !important;
  padding: 16px 32px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 24px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-size: 16px !important;
  min-width: 200px !important;

  &:hover:not(:disabled) {
    transform: translateY(-4px) !important;
    box-shadow: 0 16px 32px rgba(14, 124, 66, 0.4) !important;
  }

  &:active:not(:disabled) {
    transform: translateY(-2px) !important;
  }

  .fui-Button__icon {
    margin-left: 8px !important;
    font-size: 20px !important;
  }
`;

const SecondaryActionButton = styled(Button)`
  border-radius: 16px !important;
  font-weight: 600 !important;
  padding: 16px 32px !important;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
  border: 2px solid #0e7c42 !important;
  color: #0e7c42 !important;
  box-shadow: 0 4px 12px rgba(14, 124, 66, 0.1) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-size: 16px !important;
  min-width: 200px !important;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
    color: white !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 20px rgba(14, 124, 66, 0.2) !important;
  }

  .fui-Button__icon {
    margin-left: 8px !important;
    font-size: 20px !important;
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
  const [meta, setMeta] = useState<{ level?: string; class?: string }>({});

  useEffect(() => {
    let mounted = true;
    excelService
      .getWorkbookMetadata()
      .then((m) => {
        if (mounted) setMeta(m);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  const shownTypes: MarkType[] = useMemo(() => {
    const list: MarkType[] = [];
    if (detectedMarkTypes.hasFard1) list.push("fard1");
    if (detectedMarkTypes.hasFard2) list.push("fard2");
    if (detectedMarkTypes.hasFard3) list.push("fard3");
    if (detectedMarkTypes.hasFard4) list.push("fard4");
    if (detectedMarkTypes.hasActivities) list.push("activities");
    return list.filter((t) => statistics.markTypes[t].count > 0);
  }, [detectedMarkTypes, statistics]);
  // Derived set of shown types already handles detected types

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
        return "الفرض الأول";
      case "fard2":
        return "الفرض الثاني";
      case "fard3":
        return "الفرض الثالث";
      case "fard4":
        return "الفرض الرابع";
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

  // Enhanced PDF export with professional formatting
  const exportPdf = async () => {
    if (!reportRef.current) return;

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element as any, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      // Header
      pdf.setFontSize(22);
      pdf.setTextColor(14, 124, 66);
      pdf.text("MarkFiller - تقرير الإحصائيات", 200 - 15, 18, { align: "right" });

      // Sub header with metadata
      pdf.setFontSize(12);
      pdf.setTextColor(31, 41, 55);
      const currentDate = new Date().toLocaleDateString("ar-MA");
      const metaLineRight = `المستوى: ${meta.level || "غير محدد"}`;
      const metaLineLeft = `القسم: ${meta.class || "غير محدد"}`;
      pdf.text(metaLineRight, 200 - 15, 26, { align: "right" });
      pdf.text(metaLineLeft, 15, 26, { align: "left" });
      pdf.setTextColor(100, 116, 139);
      pdf.text(`تم إنشاؤه في: ${currentDate}`, 105, 34, { align: "center" });

      // Content image with margins
      const imgWidth = 180;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 44;

      pdf.addImage(imgData, "PNG", 15, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - position;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 15, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Add footer to each page
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`صفحة ${i} من ${totalPages}`, 105, 290, { align: "center" });
        pdf.text("تم إنشاؤه بواسطة MarkFiller Excel Add-in", 105, 285, { align: "center" });
      }

      pdf.save(`MarkFiller-Statistics-${currentDate}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
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

      <StepContent className="step-content">
        <DashboardContainer ref={reportRef}>
          {/* Professional Header */}
          <StatsHeader>
            <MainTitle>MarkFiller - تقرير الإحصائيات</MainTitle>
            <Subtitle>تحليل شامل لنتائج التلاميذ</Subtitle>
            <MetaBar>
              <MetaItem>
                <MetaLabel>المستوى</MetaLabel>
                <span>:{meta.level || "غير محدد"}</span>
              </MetaItem>
              <MetaItem>
                <MetaLabel>القسم</MetaLabel>
                <span>:{meta.class || "غير محدد"}</span>
              </MetaItem>
            </MetaBar>
            <GeneratedDate>تم إنشاؤه في: {new Date().toLocaleDateString("ar-MA")}</GeneratedDate>
          </StatsHeader>

          {/* Enhanced KPI Summary */}
          {statistics.overall && (
            <>
              <SectionHeader>
                <SectionIcon>
                  <DataTrending24Regular />
                </SectionIcon>
                <SectionTitle>ملخص الإحصائيات</SectionTitle>
              </SectionHeader>

              <KPIGrid>
                <KPICard>
                  <KPIIcon>
                    <DataTrending24Regular />
                  </KPIIcon>
                  <KPILabel>المتوسط العام</KPILabel>
                  <KPIValue>{formatNumber(statistics.overall.overallAverage)}</KPIValue>
                </KPICard>

                <KPICard>
                  <KPIIcon>
                    <Trophy24Regular />
                  </KPIIcon>
                  <KPILabel>نسبة النجاح</KPILabel>
                  <KPIValue>{Math.round((statistics.overall.passRate || 0) * 100)}%</KPIValue>
                </KPICard>

                <KPICard>
                  <KPIIcon>
                    <Warning24Regular />
                  </KPIIcon>
                  <KPILabel>نسبة الرسوب</KPILabel>
                  <KPIValue>{Math.round((statistics.overall.failRate || 0) * 100)}%</KPIValue>
                </KPICard>

                <KPICard>
                  <KPIIcon>
                    <ChartMultiple24Regular />
                  </KPIIcon>
                  <KPILabel>إجمالي النقاط</KPILabel>
                  <KPIValue>{statistics.totalStudents}</KPIValue>
                </KPICard>

                <KPICard>
                  <KPIIcon>
                    <DocumentAdd24Regular />
                  </KPIIcon>
                  <KPILabel>النقاط المحسوبة</KPILabel>
                  <KPIValue>{statistics.overall.totalMarksCounted}</KPIValue>
                </KPICard>
              </KPIGrid>
            </>
          )}

          {/* Enhanced Charts */}
          <SectionHeader>
            <SectionIcon>
              <ChartMultiple24Regular />
            </SectionIcon>
            <SectionTitle>الرسوم البيانية والتوزيعات</SectionTitle>
          </SectionHeader>

          <ChartsGrid>
            <ChartCard>
              <ChartTitle>متوسط العلامات حسب النوع</ChartTitle>
              <Bar
                data={averagesBarData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "rgba(14, 124, 66, 0.9)",
                      titleColor: "#ffffff",
                      bodyColor: "#ffffff",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 20,
                      grid: {
                        color: "rgba(14, 124, 66, 0.1)",
                      },
                    },
                    x: {
                      grid: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            </ChartCard>

            <ChartCard>
              <ChartTitle>توزيع النجاح والرسوب</ChartTitle>
              <Doughnut
                data={passFailDoughnutData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        padding: 20,
                        usePointStyle: true,
                        generateLabels: function (chart) {
                          const data = chart.data;
                          if (data.labels && data.datasets.length > 0) {
                            return data.labels.map((label, i) => {
                              const value = data.datasets[0].data[i] as number;
                              const backgroundColor = data.datasets[0].backgroundColor as string[];
                              return {
                                text: `${label}: ${value}%`,
                                fillStyle: backgroundColor[i],
                                strokeStyle: backgroundColor[i],
                                lineWidth: 0,
                                pointStyle: "circle",
                                hidden: false,
                                index: i,
                              };
                            });
                          }
                          return [];
                        },
                      },
                    },
                    tooltip: {
                      backgroundColor: "rgba(14, 124, 66, 0.9)",
                      titleColor: "#ffffff",
                      bodyColor: "#ffffff",
                      callbacks: {
                        label: function (context) {
                          return `${context.label}: ${context.parsed}%`;
                        },
                      },
                    },
                  },
                }}
              />
            </ChartCard>
          </ChartsGrid>

          {/* Grade Distribution */}
          <SectionHeader>
            <SectionIcon>
              <Star24Filled />
            </SectionIcon>
            <SectionTitle>توزيع الدرجات</SectionTitle>
          </SectionHeader>

          <DistributionGrid>
            {(["fard1", "fard2", "fard3", "fard4", "activities"] as MarkType[]).map((type) => {
              if (!shouldShowStat(type) || statistics.markTypes[type].count === 0) return null;

              const maxValue = getMaxDistribution(type);
              const dist = statistics.distribution[type];
              const color = getMarkTypeColor(type);

              return (
                <DistributionCard key={type}>
                  <DistributionHeader>
                    <DistributionTitle color={color}>{getMarkTypeName(type)}</DistributionTitle>
                    <Badge appearance="outline" style={{ color: color }}>
                      {statistics.markTypes[type].count} تلميذ
                    </Badge>
                  </DistributionHeader>

                  <DistributionItem>
                    <DistributionRange>ممتاز (16-20)</DistributionRange>
                    <DistributionCount>{dist["15-20"]} تلميذ</DistributionCount>
                  </DistributionItem>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["15-20"] / maxValue) * 100}%`} color="#10b981" />
                  </DistributionBar>

                  <DistributionItem>
                    <DistributionRange>جيد جداً (13-15.9)</DistributionRange>
                    <DistributionCount>{dist["10-15"]} تلميذ</DistributionCount>
                  </DistributionItem>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["10-15"] / maxValue) * 100}%`} color="#3b82f6" />
                  </DistributionBar>

                  <DistributionItem>
                    <DistributionRange>مقبول (10-12.9)</DistributionRange>
                    <DistributionCount>{dist["5-10"]} تلميذ</DistributionCount>
                  </DistributionItem>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["5-10"] / maxValue) * 100}%`} color="#f59e0b" />
                  </DistributionBar>

                  <DistributionItem>
                    <DistributionRange>ضعيف (0-9.9)</DistributionRange>
                    <DistributionCount>{dist["0-5"]} تلميذ</DistributionCount>
                  </DistributionItem>
                  <DistributionBar>
                    <DistributionFill width={`${(dist["0-5"] / maxValue) * 100}%`} color="#ef4444" />
                  </DistributionBar>
                </DistributionCard>
              );
            })}
          </DistributionGrid>

          {/* Top Performers */}
          <SectionHeader>
            <SectionIcon>
              <Trophy24Regular />
            </SectionIcon>
            <SectionTitle>المتفوقون الثلاثة الأوائل</SectionTitle>
          </SectionHeader>

          <PerformanceGrid>
            {shownTypes.map((type) => (
              <PerformanceCard key={`top-${type}`}>
                <PerformanceTable>
                  <TableHeader>{getMarkTypeName(type)} - المتفوقون</TableHeader>
                  {(statistics.topStudentsByType?.[type] || []).slice(0, 3).map((student, idx) => (
                    <TableRow key={idx}>
                      <RankBadge rank={idx + 1}>{idx + 1}</RankBadge>
                      <StudentName>{student.name}</StudentName>
                      <ScoreBadge score={student.value}>{formatNumber(student.value)}</ScoreBadge>
                      <div>
                        {idx === 0 && <Star24Filled style={{ color: "#fbbf24" }} />}
                        {idx === 1 && <Star24Filled style={{ color: "#9ca3af" }} />}
                        {idx === 2 && <Star24Filled style={{ color: "#cd7c0f" }} />}
                      </div>
                    </TableRow>
                  ))}
                </PerformanceTable>
              </PerformanceCard>
            ))}
          </PerformanceGrid>

          {/* Students in Difficulty */}
          <SectionHeader>
            <SectionIcon>
              <Warning24Regular />
            </SectionIcon>
            <SectionTitle>التلاميذ في صعوبة (متوسط أقل من 10)</SectionTitle>
          </SectionHeader>

          <PerformanceGrid>
            {shownTypes.map((type) => {
              const studentsInDifficulty = (statistics.bottomStudentsByType?.[type] || [])
                .filter((s) => s.value < 10)
                .slice(0, 10);

              if (studentsInDifficulty.length === 0) return null;

              return (
                <PerformanceCard key={`difficulty-${type}`}>
                  <PerformanceTable>
                    <TableHeader style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}>
                      {getMarkTypeName(type)} - التلاميذ في صعوبة
                    </TableHeader>
                    {studentsInDifficulty.map((student, idx) => (
                      <TableRow key={idx}>
                        <RankBadge rank={idx + 4}>{idx + 1}</RankBadge>
                        <StudentName>{student.name}</StudentName>
                        <ScoreBadge score={student.value}>{formatNumber(student.value)}</ScoreBadge>
                        <div>
                          <Warning24Regular style={{ color: "#ef4444" }} />
                        </div>
                      </TableRow>
                    ))}
                  </PerformanceTable>
                </PerformanceCard>
              );
            })}
          </PerformanceGrid>

          {/* Recommendations */}
          {statistics.recommendations && statistics.recommendations.length > 0 && (
            <>
              <SectionHeader>
                <SectionIcon>
                  <CheckmarkCircle24Regular />
                </SectionIcon>
                <SectionTitle>توصيات تحسين الأداء</SectionTitle>
              </SectionHeader>

              <RecommendationsCard>
                <RecommendationsList>
                  {statistics.recommendations.map((rec, idx) => (
                    <RecommendationItem key={idx}>
                      <RecommendationIcon>
                        <CheckmarkCircle24Regular />
                      </RecommendationIcon>
                      <RecommendationText size={300}>{rec}</RecommendationText>
                    </RecommendationItem>
                  ))}
                </RecommendationsList>
              </RecommendationsCard>
            </>
          )}
        </DashboardContainer>

        {/* Enhanced Action Buttons */}
        <ActionButtonsContainer>
          <PrimaryActionButton appearance="primary" icon={<DocumentAdd24Regular />} onClick={onReset}>
            إنشاء عملية استخراج جديدة
          </PrimaryActionButton>

          <SecondaryActionButton appearance="secondary" icon={<DocumentPdf24Regular />} onClick={exportPdf}>
            تصدير / طباعة PDF
          </SecondaryActionButton>
        </ActionButtonsContainer>
      </StepContent>
    </div>
  );
};

export default StatisticsStep;
