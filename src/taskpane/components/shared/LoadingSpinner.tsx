import React from "react";
import { Spinner, Text, Card } from "@fluentui/react-components";

interface LoadingSpinnerProps {
  message?: string;
  isCloudProcessing?: boolean;
}

const LoadingSpinner = (props: LoadingSpinnerProps): JSX.Element => {
  const { message = "جاري المعالجة...", isCloudProcessing = false } = props;

  return (
    <Card
      style={{
        textAlign: "center",
        padding: "32px",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        border: "1px solid #e0e0e0",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        margin: "20px 0",
      }}
    >
      <Spinner size="large" />
      <Text
        style={{
          display: "block",
          marginTop: "16px",
          color: "#242424",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        {message}
      </Text>

      {isCloudProcessing && (
        <Text style={{ color: "#666", fontSize: "12px", marginTop: "8px" }}>
          نستخدم خدمة Google Cloud Vision للحصول على دقة أعلى في استخراج النقط
        </Text>
      )}
    </Card>
  );
};

export default LoadingSpinner;
