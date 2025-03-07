import React from "react";
import { Text } from "@fluentui/react-components";
import { CheckmarkCircle24Regular } from "@fluentui/react-icons";

interface StepIndicatorProps {
  stepNumber: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ stepNumber, title, isActive, isCompleted }) => {
  return (
    <div className="step-header">
      <div
        className="step-number"
        style={{
          backgroundColor: isActive ? "#0078d4" : isCompleted ? "#107C10" : "#f0f0f0",
          color: isActive || isCompleted ? "white" : "#666",
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
        }}
      >
        {isCompleted ? <CheckmarkCircle24Regular style={{ width: "20px", height: "20px" }} /> : stepNumber}
      </div>

      <Text
        className="step-title"
        style={{
          fontSize: "18px",
          fontWeight: 600,
          color: isActive ? "#0078d4" : isCompleted ? "#107C10" : "#333",
        }}
      >
        {title}
      </Text>
    </div>
  );
};

export default StepIndicator;
