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
            <li style={{ marginBottom: "8px" }}>التقط صورة لورقة النقط باستخدام تطبيق CamScanner</li>
            <li style={{ marginBottom: "8px" }}>تأكد من اختيار الوضع "أبيض وأسود" في CamScanner</li>
            <li style={{ marginBottom: "8px" }}>احرص على أن تكون الصورة واضحة وجميع الأرقام مقروءة</li>
            <li>قم برفع الصورة المعالجة من CamScanner هنا</li>
          </ol>
        </div>
      </div>
    </Card>
  );
};

export default UploadInstructions;
