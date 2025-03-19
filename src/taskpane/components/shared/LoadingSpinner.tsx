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

// Progress bar container
const ProgressContainer = styled.div`
  width: 100%;
  margin-top: 12px;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
`;

// Progress bar fill
const ProgressFill = styled.div<{ width: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #0e7c42;
  width: ${(props) => props.width};
  transition: width 0.3s ease;
`;

interface LoadingSpinnerProps {
  message?: string;
  isCloudProcessing?: boolean;
  progress?: number;
  stage?: string;
}

const LoadingSpinner = (props: LoadingSpinnerProps): JSX.Element => {
  const { message = "جاري المعالجة...", isCloudProcessing = false, progress = 0, stage } = props;

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

      {stage && (
        <Text
          style={{
            color: "#666",
            fontSize: "12px",
          }}
        >
          {stage}
        </Text>
      )}

      {progress > 0 && (
        <ProgressContainer>
          <ProgressFill width={`${progress}%`} />
        </ProgressContainer>
      )}

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
