import React, { memo } from "react";
import { Trophy24Regular, Warning24Regular, Star24Filled } from "@fluentui/react-icons";
import { MarkType } from "../../../types";
import { Statistics } from "../../../types/statistics";
import { getMarkTypeName, formatNumber } from "../../../utils/markTypeHelpers";
import * as S from "../StatisticsStep.styles";

/**
 * Optimized Performance Tables Component with React.memo
 */

interface PerformanceTablesProps {
  statistics: Statistics;
  shownTypes: MarkType[];
}

export const TopPerformers = memo<PerformanceTablesProps>(({ statistics, shownTypes }) => {
  return (
    <>
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
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.statistics === nextProps.statistics &&
    JSON.stringify(prevProps.shownTypes) === JSON.stringify(nextProps.shownTypes)
  );
});

TopPerformers.displayName = "TopPerformers";

export const StudentsInDifficulty = memo<PerformanceTablesProps>(({ statistics, shownTypes }) => {
  return (
    <>
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
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.statistics === nextProps.statistics &&
    JSON.stringify(prevProps.shownTypes) === JSON.stringify(nextProps.shownTypes)
  );
});

StudentsInDifficulty.displayName = "StudentsInDifficulty";

