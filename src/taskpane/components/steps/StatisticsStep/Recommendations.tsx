import React, { memo } from "react";
import { CheckmarkCircle24Regular } from "@fluentui/react-icons";
import * as S from "../StatisticsStep.styles";

/**
 * Optimized Recommendations Component with React.memo
 */

interface RecommendationsProps {
  recommendations: string[];
}

export const Recommendations = memo<RecommendationsProps>(({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <>
      <S.SectionHeader>
        <S.SectionIcon>
          <CheckmarkCircle24Regular />
        </S.SectionIcon>
        <S.SectionTitle>توصيات تحسين الأداء</S.SectionTitle>
      </S.SectionHeader>

      <S.RecommendationsCard>
        <S.RecommendationsList>
          {recommendations.map((rec, idx) => (
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
  );
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.recommendations) === JSON.stringify(nextProps.recommendations);
});

Recommendations.displayName = "Recommendations";

