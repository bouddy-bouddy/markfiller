import React from "react";
import styled from "styled-components";
import { Phone24Regular, Chat24Regular, QuestionCircle24Regular } from "@fluentui/react-icons";

const HelpSection = styled.div`
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  padding: 24px;
  margin: 16px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    border-radius: 16px 16px 0 0;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 20px 25px -5px rgba(14, 124, 66, 0.1),
      0 10px 10px -5px rgba(14, 124, 66, 0.04);
  }
`;

const HelpIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #0e7c42 100%, #10b981 0%);
  border-radius: 50%;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(14, 124, 66, 0.3);
  animation: pulse 2s infinite;

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
`;

const HelpTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: #0e7c42;
  margin: 0 0 8px 0;
`;

const HelpSubtitle = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px 0;
  line-height: 1.5;
`;

const ContactGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 20px;
`;

const ContactButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid rgba(14, 124, 66, 0.2);
  border-radius: 12px;
  text-decoration: none;
  color: #0e7c42;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(14, 124, 66, 0.1), transparent);
    transition: left 0.5s;
  }

  &:hover {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(14, 124, 66, 0.2);
    border-color: #0e7c42;

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0);
  }
`;

const ContactIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
`;

const ContactText = styled.span`
  font-weight: 600;
`;

const NeedHelpSection: React.FC = () => {
  return (
    <HelpSection>
      <HelpIcon>
        <QuestionCircle24Regular style={{ color: "white", fontSize: "24px" }} />
      </HelpIcon>

      <HelpTitle>بحاجة إلى مساعدة؟</HelpTitle>
      <HelpSubtitle>في حالة وجود أي مشكلة أو للحصول على الدعم التقني، تواصل معنا:</HelpSubtitle>

      <ContactGrid>
        <ContactButton href="tel:+212708033586">
          <ContactIcon>
            <Phone24Regular />
          </ContactIcon>
          <ContactText>0708-033-586</ContactText>
        </ContactButton>

        <ContactButton href="https://wa.me/212708033586" target="_blank" rel="noopener noreferrer">
          <ContactIcon>
            <Chat24Regular />
          </ContactIcon>
          <ContactText>0708-033-586</ContactText>
        </ContactButton>
      </ContactGrid>
    </HelpSection>
  );
};

export default NeedHelpSection;
