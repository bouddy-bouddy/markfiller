import React, { useState, useEffect } from "react";
import { Spinner, Text, Card } from "@fluentui/react-components";

interface LoadingSpinnerProps {
  message?: string;
  isCloudProcessing?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, isCloudProcessing = false }) => {
  const [progressMessage, setProgressMessage] = useState<string>(message || "جاري المعالجة...");

  // For cloud processing, show a sequence of steps to indicate progress
  useEffect(() => {
    if (isCloudProcessing) {
      const messages = [
        "جاري تحضير الصورة للتحليل...",
        "جاري رفع الصورة إلى خدمة Google Cloud Vision...",
        "جاري تحليل النص باستخدام الذكاء الاصطناعي...",
        "جاري استخراج النقط من النص المحلل...",
      ];

      let currentIndex = 0;
      const intervalId = setInterval(() => {
        currentIndex = (currentIndex + 1) % messages.length;
        setProgressMessage(messages[currentIndex]);
      }, 3000);

      return () => clearInterval(intervalId);
    }
  }, [isCloudProcessing]);

  return (
    <Card
      style={{
        textAlign: "center",
        padding: "32px",
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(8px)",
        border: "1px solid #e0e0e0",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        margin: "20px 0",
      }}
    >
      <Spinner
        size="large"
        style={{
          color: "#0078d4",
        }}
      />
      <Text
        style={{
          display: "block",
          marginTop: "16px",
          color: "#242424",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        {progressMessage}
      </Text>

      {isCloudProcessing && (
        <Text
          style={{
            display: "block",
            marginTop: "8px",
            color: "#666",
            fontSize: "12px",
          }}
        >
          نستخدم خدمة Google Cloud Vision للحصول على دقة أعلى في استخراج النقط
        </Text>
      )}
    </Card>
  );
};

export default LoadingSpinner;
