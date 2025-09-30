// src/taskpane/components/shared/TeacherGreeting.tsx
import React from "react";
import styled, { keyframes } from "styled-components";
import { Person24Regular, Sparkle24Filled } from "@fluentui/react-icons";

interface TeacherGreetingProps {
  teacherName: string;
}

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-3px);
  }
`;

const sparkle = keyframes`
  0%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
`;

const GreetingContainer = styled.div`
  position: relative;
  background: linear-gradient(135deg, #0f6cbd 0%, #1e3a8a 50%, #7c3aed 100%);
  padding: 20px 32px;
  margin: 0 -20px 16px -20px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(15, 108, 189, 0.25);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    animation: ${shimmer} 3s infinite;
  }

  &::after {
    content: "";
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
  }
`;

const ContentWrapper = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
`;

const AvatarContainer = styled.div`
  position: relative;
  animation: ${float} 3s ease-in-out infinite;
`;

const Avatar = styled.div`
  position: relative;
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  color: white;
  font-size: 24px;

  svg {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }
`;

const StatusDot = styled.div`
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.5);
`;

const SparkleIcon = styled(Sparkle24Filled)`
  position: absolute;
  top: -4px;
  right: -4px;
  color: #fbbf24;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.8));
  animation: ${sparkle} 2s ease-in-out infinite;
`;

const TextContainer = styled.div`
  flex: 1;
  direction: rtl;
`;

const WelcomeText = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.3px;
  margin-bottom: 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
`;

const TeacherName = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: "";
    display: inline-block;
    width: 3px;
    height: 18px;
    background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
    border-radius: 2px;
    box-shadow: 0 2px 4px rgba(251, 191, 36, 0.4);
  }
`;

const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  margin-right: auto;
  white-space: nowrap;
`;

const TeacherGreeting: React.FC<TeacherGreetingProps> = ({ teacherName }) => {
  return (
    <GreetingContainer>
      <ContentWrapper>
        <AvatarContainer>
          <Avatar>
            <Person24Regular />
            <SparkleIcon />
          </Avatar>
          <StatusDot />
        </AvatarContainer>

        <TextContainer>
          <WelcomeText>مرحباً بك👋</WelcomeText>
          <TeacherName>الأستاذ(ة) {teacherName}</TeacherName>
        </TextContainer>

        <Badge>✨ مفعّل</Badge>
      </ContentWrapper>
    </GreetingContainer>
  );
};

export default TeacherGreeting;
