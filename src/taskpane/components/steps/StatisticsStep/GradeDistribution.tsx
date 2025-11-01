import React, { memo, useMemo } from "react";
import { Badge } from "@fluentui/react-components";
import { Star24Filled } from "@fluentui/react-icons";
import { MarkType, DetectedMarkTypes } from "../../../types";
import { Statistics } from "../../../types/statistics";
import { getMarkTypeName, getMarkTypeColor } from "../../../utils/markTypeHelpers";
import * as S from "../StatisticsStep.styles";

/**
 * Optimized Grade Distribution Component with React.memo
 * Uses useMemo for expensive calculations
 */

interface GradeDistributionProps {
  statistics: Statistics;
  detectedMarkTypes: DetectedMarkTypes;
  markTypes: MarkType[];
}

const ALL_MARK_TYPES: MarkType[] = ["fard1", "fard2", "fard3", "fard4", "activities"];

export const GradeDistribution = memo<GradeDistributionProps>(({ statistics, detectedMarkTypes, markTypes }) => {
  const shouldShowStat = useMemo(() => {
    const typeMap: Record<MarkType, boolean> = {
      fard1: detectedMarkTypes.hasFard1,
      fard2: detectedMarkTypes.hasFard2,
      fard3: detectedMarkTypes.hasFard3,
      fard4: detectedMarkTypes.hasFard4,
      activities: detectedMarkTypes.hasActivities,
    };
    return (type: MarkType) => typeMap[type] || false;
  }, [detectedMarkTypes]);

  const getMaxDistribution = useMemo(() => {
    return (type: MarkType): number => {
      const dist = statistics.distribution[type];
      return Math.max(dist["0-5"], dist["5-10"], dist["10-15"], dist["15-20"]);
    };
  }, [statistics.distribution]);

  return (
    <>
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
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.statistics === nextProps.statistics &&
    prevProps.detectedMarkTypes === nextProps.detectedMarkTypes &&
    JSON.stringify(prevProps.markTypes) === JSON.stringify(nextProps.markTypes)
  );
});

GradeDistribution.displayName = "GradeDistribution";

