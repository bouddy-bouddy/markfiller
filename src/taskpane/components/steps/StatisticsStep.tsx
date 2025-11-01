/* global HTMLDivElement */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, Badge } from "@fluentui/react-components";
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

import { DetectedMarkTypes, MarkType } from "../../types";
import { Statistics } from "../../types/statistics";
import excelService from "../../services/excel/excelService";
import { getMarkTypeName, getMarkTypeColor, formatNumber } from "../../utils/markTypeHelpers";
import { generatePdfReport } from "../../utils/pdfExport";
import * as S from "./StatisticsStep.styles";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

interface StatisticsStepProps {
  isActive: boolean;
  isCompleted: boolean;
  statistics: Statistics;
  detectedMarkTypes: DetectedMarkTypes;
  onReset: () => void;
}

const ALL_MARK_TYPES: MarkType[] = ["fard1", "fard2", "fard3", "fard4", "activities"];

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

  const shownTypes = useMemo<MarkType[]>(() => {
    const typeMap: Record<MarkType, boolean> = {
      fard1: detectedMarkTypes.hasFard1,
      fard2: detectedMarkTypes.hasFard2,
      fard3: detectedMarkTypes.hasFard3,
      fard4: detectedMarkTypes.hasFard4,
      activities: detectedMarkTypes.hasActivities,
    };

    return ALL_MARK_TYPES.filter((t) => typeMap[t] && statistics.markTypes[t].count > 0);
  }, [detectedMarkTypes, statistics]);

  const shouldShowStat = (type: MarkType): boolean => {
    const typeMap: Record<MarkType, boolean> = {
      fard1: detectedMarkTypes.hasFard1,
      fard2: detectedMarkTypes.hasFard2,
      fard3: detectedMarkTypes.hasFard3,
      fard4: detectedMarkTypes.hasFard4,
      activities: detectedMarkTypes.hasActivities,
    };
    return typeMap[type] || false;
  };

  const getMaxDistribution = (type: MarkType): number => {
    const dist = statistics.distribution[type];
    return Math.max(dist["0-5"], dist["5-10"], dist["10-15"], dist["15-20"]);
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;

    await generatePdfReport(reportRef.current, {
      statistics,
      shownTypes,
      metadata: meta,
      barChartSrc: "",
      donutChartSrc: "",
    });
  };

  const averagesBarData = useMemo<ChartData<"bar">>(() => {
    const labels = shownTypes.map((t) => getMarkTypeName(t));
    const data = shownTypes.map((t) => statistics.markTypes[t].avg);
    return {
      labels,
      datasets: [
        {
          label: "متوسط العلامات",
          data,
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

  const iconStyle = {
    color: isActive || isCompleted ? "#0e7c42" : "#666",
    fontSize: "24px",
  };

  const textStyle = {
    color: isActive || isCompleted ? "#0e7c42" : "#333",
  };

  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <S.StepTitle>
        <ChartMultiple24Regular style={iconStyle} />
        <Text size={600} weight="semibold" style={textStyle}>
          إحصائيات وتحليل البيانات
        </Text>
      </S.StepTitle>

      <S.StepContent className="step-content">
        <S.DashboardContainer ref={reportRef}>
          {/* Header */}
          <S.StatsHeader>
            <S.MainTitle>MarkFiller - تقرير الإحصائيات</S.MainTitle>
            <S.Subtitle>تحليل شامل لنتائج التلاميذ</S.Subtitle>
            <S.MetaBar>
              <S.MetaItem>
                <S.MetaLabel>المستوى</S.MetaLabel>
                <span>:{meta.level || "غير محدد"}</span>
              </S.MetaItem>
              <S.MetaItem>
                <S.MetaLabel>القسم</S.MetaLabel>
                <span>:{meta.class || "غير محدد"}</span>
              </S.MetaItem>
            </S.MetaBar>
            <S.GeneratedDate>تم إنشاؤه في: {new Date().toLocaleDateString("ar-MA")}</S.GeneratedDate>
          </S.StatsHeader>

          {/* KPI Summary */}
          {statistics.overall && (
            <>
              <S.SectionHeader>
                <S.SectionIcon>
                  <DataTrending24Regular />
                </S.SectionIcon>
                <S.SectionTitle>ملخص الإحصائيات</S.SectionTitle>
              </S.SectionHeader>

              <S.KPIGrid>
                <S.KPICard>
                  <S.KPIIcon>
                    <DataTrending24Regular />
                  </S.KPIIcon>
                  <S.KPILabel>المتوسط العام</S.KPILabel>
                  <S.KPIValue>{formatNumber(statistics.overall.overallAverage)}</S.KPIValue>
                </S.KPICard>

                <S.KPICard>
                  <S.KPIIcon>
                    <Trophy24Regular />
                  </S.KPIIcon>
                  <S.KPILabel>نسبة النجاح</S.KPILabel>
                  <S.KPIValue>{Math.round((statistics.overall.passRate || 0) * 100)}%</S.KPIValue>
                </S.KPICard>

                <S.KPICard>
                  <S.KPIIcon>
                    <Warning24Regular />
                  </S.KPIIcon>
                  <S.KPILabel>نسبة الرسوب</S.KPILabel>
                  <S.KPIValue>{Math.round((statistics.overall.failRate || 0) * 100)}%</S.KPIValue>
                </S.KPICard>

                <S.KPICard>
                  <S.KPIIcon>
                    <ChartMultiple24Regular />
                  </S.KPIIcon>
                  <S.KPILabel>إجمالي النقاط</S.KPILabel>
                  <S.KPIValue>{statistics.totalStudents}</S.KPIValue>
                </S.KPICard>

                <S.KPICard>
                  <S.KPIIcon>
                    <DocumentAdd24Regular />
                  </S.KPIIcon>
                  <S.KPILabel>النقاط المحسوبة</S.KPILabel>
                  <S.KPIValue>{statistics.overall.totalMarksCounted}</S.KPIValue>
                </S.KPICard>

                {/* Mastery breakdown */}
                {statistics.mastery && (
                  <>
                    <S.KPICard>
                      <S.KPIIcon>
                        <CheckmarkCircle24Regular />
                      </S.KPIIcon>
                      <S.KPILabel>المتحكمون (≥ 15)</S.KPILabel>
                      <S.KPIValue>{statistics.mastery.masteredPct}%</S.KPIValue>
                      <Text size={200} style={{ color: "#64748b" }}>
                        {statistics.mastery.masteredCount} من {statistics.totalStudents}
                      </Text>
                    </S.KPICard>
                    <S.KPICard>
                      <S.KPIIcon>
                        <DataTrending24Regular />
                      </S.KPIIcon>
                      <S.KPILabel>في طور التحكم (10 - 14.99)</S.KPILabel>
                      <S.KPIValue>{statistics.mastery.inProgressPct}%</S.KPIValue>
                      <Text size={200} style={{ color: "#64748b" }}>
                        {statistics.mastery.inProgressCount} من {statistics.totalStudents}
                      </Text>
                    </S.KPICard>
                    <S.KPICard>
                      <S.KPIIcon>
                        <Warning24Regular />
                      </S.KPIIcon>
                      <S.KPILabel>غير متحكمين (&lt; 10)</S.KPILabel>
                      <S.KPIValue>{statistics.mastery.notMasteredPct}%</S.KPIValue>
                      <Text size={200} style={{ color: "#64748b" }}>
                        {statistics.mastery.notMasteredCount} من {statistics.totalStudents}
                      </Text>
                    </S.KPICard>
                  </>
                )}
              </S.KPIGrid>
            </>
          )}

          {/* Charts */}
          <S.SectionHeader>
            <S.SectionIcon>
              <ChartMultiple24Regular />
            </S.SectionIcon>
            <S.SectionTitle>الرسوم البيانية والتوزيعات</S.SectionTitle>
          </S.SectionHeader>

          <S.ChartsGrid>
            <S.ChartCard>
              <S.ChartTitle>متوسط العلامات حسب النوع</S.ChartTitle>
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
                      grid: { color: "rgba(14, 124, 66, 0.1)" },
                    },
                    x: {
                      grid: { display: false },
                    },
                  },
                }}
              />
            </S.ChartCard>

            <S.ChartCard>
              <S.ChartTitle>توزيع النجاح والرسوب</S.ChartTitle>
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
            </S.ChartCard>
          </S.ChartsGrid>

          {/* Grade Distribution */}
          <S.SectionHeader>
            <S.SectionIcon>
              <Star24Filled />
            </S.SectionIcon>
            <S.SectionTitle>توزيع الدرجات</S.SectionTitle>
          </S.SectionHeader>

          <S.DistributionGrid>
            {ALL_MARK_TYPES.map((type) => {
              if (!shouldShowStat(type) || statistics.markTypes[type].count === 0) return null;

              const maxValue = getMaxDistribution(type);
              const dist = statistics.distribution[type];
              const color = getMarkTypeColor(type);

              return (
                <S.DistributionCard key={type}>
                  <S.DistributionHeader>
                    <S.DistributionTitle color={color}>{getMarkTypeName(type)}</S.DistributionTitle>
                    <Badge appearance="outline" style={{ color }}>
                      {statistics.markTypes[type].count} تلميذ
                    </Badge>
                  </S.DistributionHeader>

                  <S.DistributionItem>
                    <S.DistributionRange>ممتاز (16-20)</S.DistributionRange>
                    <S.DistributionCount>{dist["15-20"]} تلميذ</S.DistributionCount>
                  </S.DistributionItem>
                  <S.DistributionBar>
                    <S.DistributionFill width={`${(dist["15-20"] / maxValue) * 100}%`} color="#10b981" />
                  </S.DistributionBar>

                  <S.DistributionItem>
                    <S.DistributionRange>جيد جداً (13-15.9)</S.DistributionRange>
                    <S.DistributionCount>{dist["10-15"]} تلميذ</S.DistributionCount>
                  </S.DistributionItem>
                  <S.DistributionBar>
                    <S.DistributionFill width={`${(dist["10-15"] / maxValue) * 100}%`} color="#3b82f6" />
                  </S.DistributionBar>

                  <S.DistributionItem>
                    <S.DistributionRange>مقبول (10-12.9)</S.DistributionRange>
                    <S.DistributionCount>{dist["5-10"]} تلميذ</S.DistributionCount>
                  </S.DistributionItem>
                  <S.DistributionBar>
                    <S.DistributionFill width={`${(dist["5-10"] / maxValue) * 100}%`} color="#f59e0b" />
                  </S.DistributionBar>

                  <S.DistributionItem>
                    <S.DistributionRange>ضعيف (0-9.9)</S.DistributionRange>
                    <S.DistributionCount>{dist["0-5"]} تلميذ</S.DistributionCount>
                  </S.DistributionItem>
                  <S.DistributionBar>
                    <S.DistributionFill width={`${(dist["0-5"] / maxValue) * 100}%`} color="#ef4444" />
                  </S.DistributionBar>
                </S.DistributionCard>
              );
            })}
          </S.DistributionGrid>

          {/* Top Performers */}
          <S.SectionHeader>
            <S.SectionIcon>
              <Trophy24Regular />
            </S.SectionIcon>
            <S.SectionTitle>المتفوقون الثلاثة الأوائل</S.SectionTitle>
          </S.SectionHeader>

          <S.PerformanceGrid>
            {shownTypes.map((type) => (
              <S.PerformanceCard key={`top-${type}`}>
                <S.PerformanceTable>
                  <S.TableHeader>{getMarkTypeName(type)} - المتفوقون</S.TableHeader>
                  {(statistics.topStudentsByType?.[type] || []).slice(0, 3).map((student, idx) => (
                    <S.TableRow key={idx}>
                      <S.RankBadge rank={idx + 1}>{idx + 1}</S.RankBadge>
                      <S.StudentName>{student.name}</S.StudentName>
                      <S.ScoreBadge score={student.value}>{formatNumber(student.value)}</S.ScoreBadge>
                      <div>
                        {idx === 0 && <Star24Filled style={{ color: "#fbbf24" }} />}
                        {idx === 1 && <Star24Filled style={{ color: "#9ca3af" }} />}
                        {idx === 2 && <Star24Filled style={{ color: "#cd7c0f" }} />}
                      </div>
                    </S.TableRow>
                  ))}
                </S.PerformanceTable>
              </S.PerformanceCard>
            ))}
          </S.PerformanceGrid>

          {/* Students in Difficulty */}
          <S.SectionHeader>
            <S.SectionIcon>
              <Warning24Regular />
            </S.SectionIcon>
            <S.SectionTitle>التلاميذ في صعوبة (متوسط أقل من 10)</S.SectionTitle>
          </S.SectionHeader>

          <S.PerformanceGrid>
            {shownTypes.map((type) => {
              const studentsInDifficulty = (statistics.bottomStudentsByType?.[type] || [])
                .filter((s) => s.value < 10)
                .slice(0, 10);

              if (studentsInDifficulty.length === 0) return null;

              return (
                <S.PerformanceCard key={`difficulty-${type}`}>
                  <S.PerformanceTable>
                    <S.TableHeader style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}>
                      {getMarkTypeName(type)} - التلاميذ في صعوبة
                    </S.TableHeader>
                    {studentsInDifficulty.map((student, idx) => (
                      <S.TableRow key={idx}>
                        <S.RankBadge rank={idx + 4}>{idx + 1}</S.RankBadge>
                        <S.StudentName>{student.name}</S.StudentName>
                        <S.ScoreBadge score={student.value}>{formatNumber(student.value)}</S.ScoreBadge>
                        <div>
                          <Warning24Regular style={{ color: "#ef4444" }} />
                        </div>
                      </S.TableRow>
                    ))}
                  </S.PerformanceTable>
                </S.PerformanceCard>
              );
            })}
          </S.PerformanceGrid>

          {/* Recommendations */}
          {statistics.recommendations && statistics.recommendations.length > 0 && (
            <>
              <S.SectionHeader>
                <S.SectionIcon>
                  <CheckmarkCircle24Regular />
                </S.SectionIcon>
                <S.SectionTitle>توصيات تحسين الأداء</S.SectionTitle>
              </S.SectionHeader>

              <S.RecommendationsCard>
                <S.RecommendationsList>
                  {statistics.recommendations.map((rec, idx) => (
                    <S.RecommendationItem key={idx}>
                      <S.RecommendationIcon>
                        <CheckmarkCircle24Regular />
                      </S.RecommendationIcon>
                      <S.RecommendationText size={300}>{rec}</S.RecommendationText>
                    </S.RecommendationItem>
                  ))}
                </S.RecommendationsList>
              </S.RecommendationsCard>
            </>
          )}
        </S.DashboardContainer>

        {/* Action Buttons */}
        <S.ActionButtonsContainer>
          <S.PrimaryActionButton appearance="primary" icon={<DocumentAdd24Regular />} onClick={onReset}>
            عملية استخراج جديدة
          </S.PrimaryActionButton>

          <S.SecondaryActionButton appearance="secondary" icon={<DocumentPdf24Regular />} onClick={handleExportPdf}>
            تصدير PDF
          </S.SecondaryActionButton>
        </S.ActionButtonsContainer>
      </S.StepContent>
    </div>
  );
};

export default StatisticsStep;
