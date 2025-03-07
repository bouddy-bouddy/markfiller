import React from "react";
import { Card, Text } from "@fluentui/react-components";
import { ErrorCircle24Regular, Info24Regular, CheckmarkCircle24Regular, Warning24Regular } from "@fluentui/react-icons";
import { AlertType } from "../../types";

interface StatusAlertProps {
  type: AlertType;
  message: string;
}

const StatusAlert: React.FC<StatusAlertProps> = ({ type, message }) => {
  const getIcon = () => {
    switch (type) {
      case "error":
        return <ErrorCircle24Regular style={{ color: "#D92C2C" }} />;
      case "warning":
        return <Warning24Regular style={{ color: "#FFB900" }} />;
      case "success":
        return <CheckmarkCircle24Regular style={{ color: "#107C10" }} />;
      default:
        return <Info24Regular style={{ color: "#0078D4" }} />;
    }
  };

  const getStyles = () => {
    const baseStyles = {
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      padding: "16px",
      marginBottom: "16px",
      borderRadius: "4px",
    };

    switch (type) {
      case "error":
        return {
          ...baseStyles,
          backgroundColor: "#FDE7E9",
          border: "1px solid #F4C8C8",
        };
      case "warning":
        return {
          ...baseStyles,
          backgroundColor: "#FFF4CE",
          border: "1px solid #FFE7A1",
        };
      case "success":
        return {
          ...baseStyles,
          backgroundColor: "#E6F2D9",
          border: "1px solid #BAE0A2",
        };
      default:
        return {
          ...baseStyles,
          backgroundColor: "#F0F8FF",
          border: "1px solid #B3D7FF",
        };
    }
  };

  return (
    <Card style={getStyles()}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {getIcon()}
        <Text
          style={{
            color:
              type === "error"
                ? "#D92C2C"
                : type === "warning"
                  ? "#603B00"
                  : type === "success"
                    ? "#107C10"
                    : "#0078D4",
            flex: 1,
          }}
        >
          {message}
        </Text>
      </div>
    </Card>
  );
};

export default StatusAlert;
