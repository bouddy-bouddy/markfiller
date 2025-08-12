import React from "react";
import { Text } from "@fluentui/react-components";
import { DocumentTable24Filled } from "@fluentui/react-icons";
import styled from "styled-components";

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  background: linear-gradient(135deg, #064e3b 0%, #0e7c42 40%, #065f46 70%, #047857 100%);
  color: white;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 10px 15px -3px rgba(14, 124, 66, 0.3),
    0 4px 6px -2px rgba(14, 124, 66, 0.2);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 50%,
      rgba(255, 255, 255, 0.1) 100%
    );
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
    animation: shimmer 8s ease-in-out infinite;
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

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 2;
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.05);
    background: rgba(255, 255, 255, 0.2);
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.06);
  }
`;

const TitleText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MainTitle = styled(Text)`
  color: white !important;
  margin: 0 !important;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-weight: 700 !important;
  letter-spacing: -0.025em;
`;

const Subtitle = styled(Text)`
  color: rgba(255, 255, 255, 0.9) !important;
  margin: 0 !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  opacity: 0.9;
`;

const Version = styled.div`
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.15);
  padding: 8px 16px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 2;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.2);
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.06);
  }
`;

interface AppHeaderProps {
  title: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title }) => {
  return (
    <HeaderContainer>
      <TitleContainer>
        <IconWrapper>
          <DocumentTable24Filled style={{ color: "white", fontSize: "24px" }} />
        </IconWrapper>
        <TitleText>
          <MainTitle as="h1" size={600}>
            {title}
          </MainTitle>
          <Subtitle>نظام ادخال النقط الذكي بدقة عالية الخاص بمسار</Subtitle>
        </TitleText>
      </TitleContainer>
      <Version>إصدار 1.0.0</Version>
    </HeaderContainer>
  );
};

export default AppHeader;
