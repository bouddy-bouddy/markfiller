import React from "react";
import { Text } from "@fluentui/react-components";
import { DocumentTable24Filled } from "@fluentui/react-icons";
import styled from "styled-components";

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: #0e7c42;
  color: white;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Version = styled.div`
  font-size: 12px;
  opacity: 0.8;
`;

interface AppHeaderProps {
  title: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title }) => {
  return (
    <HeaderContainer>
      <TitleContainer>
        <DocumentTable24Filled />
        <Text as="h1" size={600} weight="semibold" style={{ color: "white", margin: 0 }}>
          {title}
        </Text>
      </TitleContainer>
      <Version>إصدار 1.0.0</Version>
    </HeaderContainer>
  );
};

export default AppHeader;
