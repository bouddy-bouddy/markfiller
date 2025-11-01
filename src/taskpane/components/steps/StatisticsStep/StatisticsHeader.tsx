import React, { memo } from "react";
import * as S from "../StatisticsStep.styles";

/**
 * Optimized Statistics Header Component with React.memo
 */

interface StatisticsHeaderProps {
  level?: string;
  class?: string;
}

export const StatisticsHeader = memo<StatisticsHeaderProps>(({ level, class: className }) => {
  return (
    <S.StatsHeader>
      <S.MainTitle>MarkFiller - تقرير الإحصائيات</S.MainTitle>
      <S.Subtitle>تحليل شامل لنتائج التلاميذ</S.Subtitle>
      <S.MetaBar>
        <S.MetaItem>
          <S.MetaLabel>المستوى</S.MetaLabel>
          <span>:{level || "غير محدد"}</span>
        </S.MetaItem>
        <S.MetaItem>
          <S.MetaLabel>القسم</S.MetaLabel>
          <span>:{className || "غير محدد"}</span>
        </S.MetaItem>
      </S.MetaBar>
      <S.GeneratedDate>تم إنشاؤه في: {new Date().toLocaleDateString("ar-MA")}</S.GeneratedDate>
    </S.StatsHeader>
  );
}, (prevProps, nextProps) => {
  return prevProps.level === nextProps.level && prevProps.class === nextProps.class;
});

StatisticsHeader.displayName = "StatisticsHeader";

