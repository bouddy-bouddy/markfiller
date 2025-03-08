import React from "react";
import { Text, Card } from "@fluentui/react-components";
import { Circle24Regular } from "@fluentui/react-icons";

const UploadInstructions: React.FC = () => {
  return (
    <Card style={{ marginBottom: "20px", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "start" }}>
        <Circle24Regular style={{ color: "#0284c7", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <Text weight="semibold" style={{ color: "#0284c7", display: "block", marginBottom: "8px" }}>
            للحصول على أفضل النتائج:
          </Text>
          <ol style={{ paddingRight: "20px", margin: 0 }}>
            <li style={{ marginBottom: "8px" }}>التقط صورة لورقة النقط باستخدام الهاتف أو ماسح ضوئي</li>
            <li style={{ marginBottom: "8px" }}>تأكد من أن الصورة واضحة وجميع الأرقام مقروءة</li>
            <li style={{ marginBottom: "8px" }}>تجنب الظلال والانعكاسات عند التقاط الصورة</li>
            <li style={{ marginBottom: "8px" }}>سيتم تحليل الصورة باستخدام تقنية Google Cloud Vision للدقة العالية</li>
            <li>قم برفع الصورة هنا</li>
          </ol>
        </div>
      </div>
    </Card>
  );
};

export default UploadInstructions;
