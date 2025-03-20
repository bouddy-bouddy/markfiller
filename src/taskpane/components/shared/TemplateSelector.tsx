import React from "react";
import { Card, Text, RadioGroup, Radio } from "@fluentui/react-components";
import { DocumentText24Regular } from "@fluentui/react-icons";
import styled from "styled-components";
import { documentTemplates } from "../../config/documentTemplates";

const TemplateCard = styled(Card)`
  padding: 16px;
  margin: 16px 0;
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
`;

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ selectedTemplate, onSelectTemplate }) => {
  return (
    <TemplateCard>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <DocumentText24Regular style={{ color: "#0284c7", flexShrink: 0 }} />
        <div>
          <Text weight="semibold" style={{ color: "#0284c7", display: "block", marginBottom: "12px" }}>
            اختر نوع المستند للحصول على نتائج أفضل:
          </Text>

          <RadioGroup
            value={selectedTemplate}
            onChange={(_, data) => onSelectTemplate(data.value)}
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {documentTemplates.map((template) => (
              <div key={template.id} style={{ marginBottom: "8px" }}>
                <Radio value={template.id} label={template.name} />
                <Text size={200} style={{ color: "#64748b", marginRight: "24px" }}>
                  {template.description}
                </Text>
              </div>
            ))}
            <div>
              <Radio value="auto" label="اكتشاف تلقائي" />
              <Text size={200} style={{ color: "#64748b", marginRight: "24px" }}>
                سيحاول النظام اكتشاف نوع المستند تلقائيًا (الخيار الافتراضي)
              </Text>
            </div>
          </RadioGroup>
        </div>
      </div>
    </TemplateCard>
  );
};

export default TemplateSelector;
