import React from "react";
import { Spinner, Text, Card } from "@fluentui/react-components";
import { CloudSync24Regular } from "@fluentui/react-icons";
import styled from "styled-components";

const SpinnerCard = styled(Card)`
  text-align: center;
  padding: 40px 32px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
  border: 2px solid rgba(14, 124, 66, 0.1);
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  backdrop-filter: blur(10px);
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

  &::after {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(14, 124, 66, 0.05) 0%, transparent 70%);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%,
    100% {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    50% {
      transform: translate(-50%, -50%) rotate(180deg);
    }
  }
`;

const SpinnerWrapper = styled.div`
  position: relative;
  z-index: 2;

  .fui-Spinner {
    --fui-Spinner--size: 48px;
    --fui-Spinner--color: #0e7c42;
  }
`;

const MessageText = styled(Text)`
  color: #1f2937 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  margin: 0 !important;
  position: relative;
  z-index: 2;
`;

const StageText = styled(Text)`
  color: #6b7280 !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  margin: 0 !important;
  position: relative;
  z-index: 2;
  background: rgba(14, 124, 66, 0.1);
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(14, 124, 66, 0.2);
`;

const ProgressContainer = styled.div`
  width: 100%;
  margin-top: 16px;
  height: 8px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 100%);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 2;
`;

const ProgressFill = styled.div<{ width: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
  width: ${(props) => props.width};
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 4px;
  box-shadow: 0 0 8px rgba(14, 124, 66, 0.3);
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
    animation: progressShine 2s ease-in-out infinite;
  }

  @keyframes progressShine {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
`;

const CloudProcessingText = styled(Text)`
  color: #4b5563 !important;
  font-size: 13px !important;
  margin-top: 12px !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: rgba(14, 124, 66, 0.05);
  padding: 12px 20px;
  border-radius: 16px;
  border: 1px solid rgba(14, 124, 66, 0.1);
  position: relative;
  z-index: 2;
  font-weight: 500 !important;
  line-height: 1.5 !important;
`;

const CloudIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 8px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2);
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
      <SpinnerWrapper>
        <Spinner size="large" />
      </SpinnerWrapper>

      <MessageText>{message}</MessageText>

      {stage && <StageText>{stage}</StageText>}

      {progress > 0 && (
        <ProgressContainer>
          <ProgressFill width={`${progress}%`} />
        </ProgressContainer>
      )}

      {isCloudProcessing && (
        <CloudProcessingText>
          <CloudIcon>
            <CloudSync24Regular style={{ fontSize: "18px" }} />
          </CloudIcon>
          يتم استخدام افضل التقنيات للحصول على دقة عالية في استخراج النقط
        </CloudProcessingText>
      )}
    </SpinnerCard>
  );
};

export default LoadingSpinner;
