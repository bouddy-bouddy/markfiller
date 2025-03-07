import React from "react";
import { Spinner, Text, Card } from "@fluentui/react-components";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => (
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
      {message || "جاري المعالجة..."}
    </Text>
  </Card>
);

export default LoadingSpinner;
