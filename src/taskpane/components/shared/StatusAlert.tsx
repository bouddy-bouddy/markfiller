import React from "react";
import { Card, Text } from "@fluentui/react-components";
import { ErrorCircle24Regular, Info24Regular, CheckmarkCircle24Regular, Warning24Regular } from "@fluentui/react-icons";
import { AlertType } from "../../types";
import styled from "styled-components";

interface AlertCardProps {
  type: AlertType;
}

const AlertCard = styled(Card)<AlertCardProps>`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 16px;
  border: 2px solid;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  ${(props) => {
    switch (props.type) {
      case "error":
        return `
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-color: rgba(239, 68, 68, 0.3);
          
          &:hover {
            transform: translateY(-2px);
            box-shadow: 
              0 20px 25px -5px rgba(239, 68, 68, 0.1),
              0 10px 10px -5px rgba(239, 68, 68, 0.04);
          }
        `;
      case "warning":
        return `
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-color: rgba(245, 158, 11, 0.3);
          
          &:hover {
            transform: translateY(-2px);
            box-shadow: 
              0 20px 25px -5px rgba(245, 158, 11, 0.1),
              0 10px 10px -5px rgba(245, 158, 11, 0.04);
          }
        `;
      case "success":
        return `
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-color: rgba(14, 124, 66, 0.3);
          
          &:hover {
            transform: translateY(-2px);
            box-shadow: 
              0 20px 25px -5px rgba(14, 124, 66, 0.1),
              0 10px 10px -5px rgba(14, 124, 66, 0.04);
          }
        `;
      default:
        return `
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-color: rgba(14, 124, 66, 0.3);
          
          &:hover {
            transform: translateY(-2px);
            box-shadow: 
              0 20px 25px -5px rgba(14, 124, 66, 0.1),
              0 10px 10px -5px rgba(14, 124, 66, 0.04);
          }
        `;
    }
  }}

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${(props) => {
      switch (props.type) {
        case "error":
          return "linear-gradient(90deg, #ef4444 0%, #f87171 100%)";
        case "warning":
          return "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)";
        case "success":
          return "linear-gradient(90deg, #0e7c42 0%, #10b981 100%)";
        default:
          return "linear-gradient(90deg, #0e7c42 0%, #10b981 100%)";
      }
    }};
    opacity: 0.8;
  }
`;

const IconWrapper = styled.div<{ $type: AlertType }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${(props) => {
    switch (props.$type) {
      case "error":
        return "linear-gradient(135deg, #ef4444 0%, #f87171 100%)";
      case "warning":
        return "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)";
      case "success":
        return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
      default:
        return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    }
  }};
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.05);
  }
`;

const MessageText = styled(Text)<{ $type: AlertType }>`
  flex: 1 !important;
  color: ${(props) => {
    switch (props.$type) {
      case "error":
        return "#991b1b !important";
      case "warning":
        return "#92400e !important";
      case "success":
        return "#065f46 !important";
      default:
        return "#1f2937 !important";
    }
  }};
  font-weight: 600 !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
  margin: 0 !important;
`;

interface StatusAlertProps {
  type: AlertType;
  message: string;
}

const StatusAlert: React.FC<StatusAlertProps> = ({ type, message }) => {
  const getIcon = () => {
    switch (type) {
      case "error":
        return <ErrorCircle24Regular style={{ fontSize: "24px" }} />;
      case "warning":
        return <Warning24Regular style={{ fontSize: "24px" }} />;
      case "success":
        return <CheckmarkCircle24Regular style={{ fontSize: "24px" }} />;
      default:
        return <Info24Regular style={{ fontSize: "24px" }} />;
    }
  };

  return (
    <AlertCard type={type}>
      <IconWrapper $type={type}>{getIcon()}</IconWrapper>
      <MessageText $type={type}>{message}</MessageText>
    </AlertCard>
  );
};

export default StatusAlert;
