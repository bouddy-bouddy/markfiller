import React, { useState } from "react";
import { Card, Text, Button, Divider, Checkbox, Slider } from "@fluentui/react-components";
import { Bug24Regular, ImageStar24Regular } from "@fluentui/react-icons";
import styled from "styled-components";

const DebugCard = styled(Card)`
  padding: 16px;
  margin-top: 20px;
  background-color: #f8f9fa;
  border: 1px solid #e2e8f0;
`;

const DebugSection = styled.div`
  margin-bottom: 16px;
`;

interface OcrDebugModeProps {
  onSendFeedback: (feedback: any) => void;
  imagePreview: string | null;
}

const OcrDebugMode: React.FC<OcrDebugModeProps> = ({ onSendFeedback, imagePreview }) => {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [feedback, setFeedback] = useState({
    imageQuality: 3, // 1-5 scale
    tableStructure: true,
    nameDetection: true,
    markDetection: true,
    comments: "",
  });

  const handleSubmitFeedback = () => {
    onSendFeedback({
      ...feedback,
      timestamp: new Date().toISOString(),
      imageIncluded: !!imagePreview,
    });
    alert("تم إرسال الملاحظات بنجاح. شكرًا لمساعدتك في تحسين دقة التعرف الضوئي.");
  };

  if (!debugEnabled) {
    return (
      <Button
        appearance="subtle"
        icon={<Bug24Regular />}
        onClick={() => setDebugEnabled(true)}
        style={{ marginTop: "16px" }}
      >
        تفعيل وضع التصحيح للتعرف الضوئي
      </Button>
    );
  }

  return (
    <DebugCard>
      <Text
        as="h3"
        size={500}
        weight="semibold"
        style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <Bug24Regular />
        وضع التصحيح للتعرف الضوئي
      </Text>

      <Text size={200} style={{ marginBottom: "16px", color: "#666" }}>
        استخدم هذه الأداة للمساعدة في تحسين دقة التعرف الضوئي. يمكنك تقديم ملاحظات حول المشاكل التي واجهتها.
      </Text>

      <Divider style={{ margin: "16px 0" }} />

      <DebugSection>
        <Text weight="semibold" style={{ marginBottom: "8px" }}>
          كيف تقيم جودة الصورة؟
        </Text>
        <Slider
          min={1}
          max={5}
          step={1}
          value={feedback.imageQuality}
          onChange={(_, data) => setFeedback({ ...feedback, imageQuality: data.value })}
          style={{ maxWidth: "300px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "300px" }}>
          <Text size={100}>ضعيفة</Text>
          <Text size={100}>ممتازة</Text>
        </div>
      </DebugSection>

      <DebugSection>
        <Text weight="semibold" style={{ marginBottom: "8px" }}>
          أي من العناصر التالية تم التعرف عليها بشكل صحيح؟
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Checkbox
            label="هيكل الجدول"
            checked={feedback.tableStructure}
            onChange={(_, data) => setFeedback({ ...feedback, tableStructure: !!data.checked })}
          />
          <Checkbox
            label="أسماء الطلاب"
            checked={feedback.nameDetection}
            onChange={(_, data) => setFeedback({ ...feedback, nameDetection: !!data.checked })}
          />
          <Checkbox
            label="العلامات"
            checked={feedback.markDetection}
            onChange={(_, data) => setFeedback({ ...feedback, markDetection: !!data.checked })}
          />
        </div>
      </DebugSection>

      <DebugSection>
        <Text weight="semibold" style={{ marginBottom: "8px" }}>
          أية ملاحظات إضافية؟
        </Text>
        <textarea
          style={{
            width: "100%",
            height: "80px",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #e2e8f0",
            resize: "vertical",
          }}
          value={feedback.comments}
          onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
          placeholder="اكتب ملاحظاتك هنا..."
        />
      </DebugSection>

      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <Button appearance="primary" icon={<ImageStar24Regular />} onClick={handleSubmitFeedback}>
          إرسال الملاحظات
        </Button>
        <Button appearance="subtle" onClick={() => setDebugEnabled(false)}>
          إلغاء
        </Button>
      </div>
    </DebugCard>
  );
};

export default OcrDebugMode;
