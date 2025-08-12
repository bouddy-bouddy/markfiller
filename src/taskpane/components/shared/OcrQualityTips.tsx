import React from "react";
import { Card, Text } from "@fluentui/react-components";
import { Info24Regular } from "@fluentui/react-icons";
import styled from "styled-components";

const TipsCard = styled(Card)`
  padding: 24px;
  margin-top: 24px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 2px solid rgba(14, 124, 66, 0.2);
  border-radius: 16px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    opacity: 0.8;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
`;

const TipsHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
`;

const TipsIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 12px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2);
`;

const TipsTitle = styled(Text)`
  color: #0e7c42 !important;
  font-weight: 700 !important;
  font-size: 16px !important;
  margin: 0 !important;
  line-height: 1.4 !important;
`;

const TipsList = styled.ul`
  margin: 0;
  padding: 0 24px 0 0;
  counter-reset: tip-counter;
`;

const TipsListItem = styled.li`
  margin-bottom: 12px;
  position: relative;
  padding-right: 32px;
  line-height: 1.6;
  color: #1e40af;
  font-weight: 500;
  font-size: 14px;

  &:last-child {
    margin-bottom: 0;
  }

  &::before {
    counter-increment: tip-counter;
    content: counter(tip-counter);
    position: absolute;
    right: 0;
    top: 0;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2);
  }
`;

const OcrQualityTips: React.FC = () => {
  return (
    <TipsCard>
      <TipsHeader>
        <TipsIcon>
          <Info24Regular style={{ fontSize: "20px" }} />
        </TipsIcon>
        <TipsTitle>نصائح للحصول على أفضل نتائج التعرف الضوئي:</TipsTitle>
      </TipsHeader>

      <TipsList>
        <TipsListItem>استخدم صورًا ذات دقة وضوح عالية، تأكد من أن جميع النصوص مقروءة بوضوح</TipsListItem>
        <TipsListItem>تجنب الظلال والانعكاسات في الصورة</TipsListItem>
        <TipsListItem>التقط الصورة بشكل متعامد (غير مائل) مع الورقة</TipsListItem>
        <TipsListItem>تأكد من وجود إضاءة كافية ومتساوية في جميع أنحاء الصورة</TipsListItem>
        <TipsListItem>حاول أن تكون حدود الجدول واضحة في الصورة للحصول على نتائج أفضل</TipsListItem>
      </TipsList>
    </TipsCard>
  );
};

export default OcrQualityTips;
