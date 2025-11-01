/* global HTMLDivElement */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text } from "@fluentui/react-components";
import {
  ChartMultiple24Regular,
  DocumentAdd24Regular,
  DocumentPdf24Regular,
} from "@fluentui/react-icons";
import type { ChartData } from "chart.js";

import { DetectedMarkTypes, MarkType } from "../../types";
import { Statistics } from "../../types/statistics";
import excelService from "../../services/excel/excelService";
import { getMarkTypeName } from "../../utils/markTypeHelpers";
import { generatePdfReport } from "../../utils/pdfExport";
import * as S from "./StatisticsStep.styles";

// Import optimized sub-components
import {
  LazyCharts,
  KPISummary,
  GradeDistribution,
  TopPerformers,
  StudentsInDifficulty,
  Recommendations,
  StatisticsHeader,
} from "./StatisticsStep/index";

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

  // Fetch workbook metadata once on mount
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

  // Aggressively memoize shown types - only recalculate when detectedMarkTypes changes
  const shownTypes = useMemo<MarkType[]>(() => {
    const typeMap: Record<MarkType, boolean> = {
      fard1: detectedMarkTypes.hasFard1,
      fard2: detectedMarkTypes.hasFard2,
      fard3: detectedMarkTypes.hasFard3,
      fard4: detectedMarkTypes.hasFard4,
      activities: detectedMarkTypes.hasActivities,
    };

    return ALL_MARK_TYPES.filter((t) => typeMap[t] && statistics.markTypes[t].count > 0);
  }, [detectedMarkTypes, statistics.markTypes]);

  // Aggressively memoize chart data - deep compare to prevent unnecessary re-renders
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
  }, [shownTypes, statistics.markTypes]);

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
  }, [statistics.overall]);

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
          {/* Header - Optimized Component */}
          <StatisticsHeader level={meta.level} class={meta.class} />

          {/* KPI Summary - Optimized Component */}
          <KPISummary statistics={statistics} />

          {/* Charts - Lazy Loaded Component */}
          {isActive && <LazyCharts averagesBarData={averagesBarData} passFailDoughnutData={passFailDoughnutData} />}

          {/* Grade Distribution - Optimized Component */}
          <GradeDistribution statistics={statistics} detectedMarkTypes={detectedMarkTypes} markTypes={shownTypes} />

          {/* Top Performers - Optimized Component */}
          <TopPerformers statistics={statistics} shownTypes={shownTypes} />

          {/* Students in Difficulty - Optimized Component */}
          <StudentsInDifficulty statistics={statistics} shownTypes={shownTypes} />

          {/* Recommendations - Optimized Component */}
          <Recommendations recommendations={statistics.recommendations || []} />
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
