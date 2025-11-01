import React, { memo } from "react";
import { Text } from "@fluentui/react-components";
import {
  DataTrending24Regular,
  Trophy24Regular,
  Warning24Regular,
  ChartMultiple24Regular,
  DocumentAdd24Regular,
  CheckmarkCircle24Regular,
} from "@fluentui/react-icons";
import { Statistics } from "../../../types/statistics";
import { formatNumber } from "../../../utils/markTypeHelpers";
import * as S from "../StatisticsStep.styles";

/**
 * Optimized KPI Summary Component with React.memo
 * Only re-renders when statistics change
 */

interface KPISummaryProps {
  statistics: Statistics;
}

export const KPISummary = memo<KPISummaryProps>(({ statistics }) => {
  if (!statistics.overall) return null;

  return (
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
  );
}, (prevProps, nextProps) => {
  // Only re-render if statistics reference changes
  return prevProps.statistics === nextProps.statistics;
});

KPISummary.displayName = "KPISummary";

