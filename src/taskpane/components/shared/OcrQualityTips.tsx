import React from "react";
import { Card, Text } from "@fluentui/react-components";
import { Info24Regular } from "@fluentui/react-icons";
import styled from "styled-components";

const TipsCard = styled(Card)`
  padding: 16px;
  margin-top: 16px;
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
`;

const TipsList = styled.ul`
  margin: 8px 0 0 0;
  padding: 0 20px 0 0;
`;

const OcrQualityTips: React.FC = () => {
  return (
    <TipsCard>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <Info24Regular style={{ color: "#0284c7", flexShrink: 0 }} />
        <div>
          <Text weight="semibold" style={{ color: "#0284c7", display: "block", marginBottom: "8px" }}>
            نصائح للحصول على أفضل نتائج التعرف الضوئي:
          </Text>
          <TipsList>
            <li style={{ marginBottom: "8px", color: "#0c4a6e" }}>
              استخدم صورًا ذات دقة وضوح عالية، تأكد من أن جميع النصوص مقروءة بوضوح
            </li>
            <li style={{ marginBottom: "8px", color: "#0c4a6e" }}>تجنب الظلال والانعكاسات في الصورة</li>
            <li style={{ marginBottom: "8px", color: "#0c4a6e" }}>التقط الصورة بشكل متعامد (غير مائل) مع الورقة</li>
            <li style={{ marginBottom: "8px", color: "#0c4a6e" }}>
              تأكد من وجود إضاءة كافية ومتساوية في جميع أنحاء الصورة
            </li>
            <li style={{ color: "#0c4a6e" }}>حاول أن تكون حدود الجدول واضحة في الصورة للحصول على نتائج أفضل</li>
          </TipsList>
        </div>
      </div>
    </TipsCard>
  );
};

export default OcrQualityTips;
