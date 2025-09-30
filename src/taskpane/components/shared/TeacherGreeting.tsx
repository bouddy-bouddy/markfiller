import React from "react";
import styled from "styled-components";
import { Person24Regular } from "@fluentui/react-icons";

interface TeacherGreetingProps {
  teacherName: string;
}

const GreetingContainer = styled.div`
  background: linear-gradient(135deg, #0f6cbd 0%, #115ea3 100%);
  padding: 12px 20px;
  margin: 0 -20px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: white;
`;

const GreetingText = styled.div`
  flex: 1;
  color: white;
`;

const GreetingTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
  direction: rtl;
`;

const TeacherNameText = styled.div`
  font-size: 13px;
  opacity: 0.9;
  direction: rtl;
`;

const TeacherGreeting: React.FC<TeacherGreetingProps> = ({ teacherName }) => {
  return (
    <GreetingContainer>
      <IconWrapper>
        <Person24Regular />
      </IconWrapper>
      <GreetingText>
        <GreetingTitle>مرحبا بك</GreetingTitle>
        <TeacherNameText>الأستاذ(ة): {teacherName}</TeacherNameText>
      </GreetingText>
    </GreetingContainer>
  );
};

export default TeacherGreeting;
