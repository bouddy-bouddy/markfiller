import React from "react";
import { Card, Text } from "@fluentui/react-components";
import { ErrorCircle24Regular, Info24Regular } from "@fluentui/react-icons";
import { getErrorSuggestions } from "../../utils/errorHandling";
import styled from "styled-components";

const ErrorCard = styled(Card)`
  padding: 20px;
  margin-bottom: 20px;
  background-color: #fff5f5;
  border: 1px solid #fed7d7;
`;

const SuggestionsList = styled.ul`
  margin: 8px 0 0 0;
  padding: 0 20px 0 0;
`;

interface OcrErrorDisplayProps {
  errorMessage: string;
  errorCode?: string;
}

const OcrErrorDisplay: React.FC<OcrErrorDisplayProps> = ({ errorMessage, errorCode = "UNKNOWN_ERROR" }) => {
  const suggestions = getErrorSuggestions(errorCode);

  return (
    <ErrorCard>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <ErrorCircle24Regular style={{ color: "#e53e3e", flexShrink: 0 }} />
        <div>
          <Text weight="semibold" style={{ color: "#e53e3e", marginBottom: "8px", display: "block" }}>
            حدث خطأ أثناء معالجة الصورة
          </Text>
          <Text style={{ color: "#742a2a" }}>{errorMessage}</Text>

          {suggestions.length > 0 && (
            <>
              <Text
                size={200}
                style={{ color: "#742a2a", marginTop: "12px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Info24Regular style={{ fontSize: "14px" }} />
                نصائح لحل المشكلة:
              </Text>
              <SuggestionsList>
                {suggestions.map((suggestion, index) => (
                  <li key={index} style={{ color: "#742a2a", marginBottom: "4px" }}>
                    {suggestion}
                  </li>
                ))}
              </SuggestionsList>
            </>
          )}
        </div>
      </div>
    </ErrorCard>
  );
};

export default OcrErrorDisplay;
