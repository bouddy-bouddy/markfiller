import React from "react";
import { Spinner, Text } from "@fluentui/react-components";
import styled from "styled-components";

const GreenSpinner = styled(Spinner)`
  color: #0e7c42;
`;

const LicenseCheckingScreen: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <GreenSpinner size="large" />
      <Text style={{ marginTop: "16px", textAlign: "center", fontWeight: "bold" }}>
        جاري التحقق من الترخيص
      </Text>
    </div>
  );
};

export default LicenseCheckingScreen;

