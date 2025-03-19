import React from "react";
import { Spinner, Text, Card } from "@fluentui/react-components";
import { CloudSync24Regular } from "@fluentui/react-icons";
import styled from "styled-components";

const SpinnerCard = styled(Card)`
  text-align: center;
  padding: 32px;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const CloudProcessingText = styled(Text)`
  color: #666;
  font-size: 12px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

interface LoadingSpinnerProps {
  message?: string;
  isCloudProcessing?: boolean;
}

const LoadingSpinner = (props: LoadingSpinnerProps): JSX.Element => {
  const { message = "جاري المعالجة...", isCloudProcessing = false } = props;

  return (
    <SpinnerCard>
      <Spinner size="large" />
      <Text
        style={{
          color: "#242424",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        {message}
      </Text>

      {isCloudProcessing && (
        <CloudProcessingText>
          <CloudSync24Regular style={{ fontSize: "14px" }} />
          نستخدم تقنية التعرف البصري على النصوص للحصول على دقة أعلى في استخراج النقط
        </CloudProcessingText>
      )}
    </SpinnerCard>
  );
};

export default LoadingSpinner;
