import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  Button,
  Radio,
  RadioGroup,
  Text,
  Badge,
} from "@fluentui/react-components";
import { ClipboardTask24Regular, InfoRegular, CheckmarkCircle16Regular } from "@fluentui/react-icons";
import LoadingSpinner from "../shared/LoadingSpinner";
import { DetectedMarkTypes } from "../../types";
import styled from "styled-components";

interface IntelligentMarkTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (markType: string) => void;
  isSaving?: boolean;
  detectedMarkTypes: DetectedMarkTypes;
}

const StyledDialogSurface = styled(DialogSurface)`
  min-width: 500px !important;
  max-width: 600px !important;
  max-height: 80vh !important;
  min-height: 400px !important;
  border-radius: 20px !important;
  border: 2px solid rgba(14, 124, 66, 0.1) !important;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.1) !important;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
  position: relative !important;
  width: 100% !important;
  box-sizing: border-box !important;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    opacity: 0.8;
  }

  /* Global overrides for all children */
  * {
    box-sizing: border-box !important;
  }

  /* Override Fluent UI DialogSurface */
  .fui-DialogSurface {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box !important;
  }
`;

const StyledDialogTitle = styled(DialogTitle)`
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
  padding: 24px 24px 16px 24px !important;
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%) !important;
  border-bottom: 1px solid rgba(14, 124, 66, 0.1) !important;
`;

const TitleIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2);
`;

const TitleText = styled(Text)`
  font-weight: 700 !important;
  font-size: 18px !important;
  color: #0e7c42 !important;
  margin: 0 !important;
`;

const StyledDialogBody = styled(DialogBody)`
  padding: 24px !important;
  overflow-y: auto !important;
  max-height: calc(80vh - 200px) !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #0e7c42 0%, #10b981 100%);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #065f46 0%, #0e7c42 100%);
  }

  /* Override Fluent UI default styles */
  .fui-DialogBody {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box !important;
  }
`;

const ContentWrapper = styled.div`
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
`;

const DescriptionText = styled(Text)`
  display: block !important;
  margin-bottom: 24px !important;
  color: #0e7c42 !important;
  font-weight: 600 !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
  background: rgba(14, 124, 66, 0.05);
  padding: 16px !important;
  border-radius: 12px !important;
  border: 1px solid rgba(14, 124, 66, 0.1) !important;
  text-align: right !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
`;

const StyledRadioGroup = styled(RadioGroup)`
  display: block !important;
  margin-bottom: 24px !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;

  /* Override Fluent UI default styles */
  .fui-RadioGroup {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box !important;
  }

  /* Override individual radio items */
  .fui-Radio {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box !important;
  }
`;

const RadioOption = styled.div`
  display: block !important;
  margin-bottom: 16px !important;
  padding: 16px !important;
  border-radius: 12px !important;
  border: 2px solid transparent !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
  min-height: 60px !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  margin-right: 0 !important;

  &:hover {
    border-color: rgba(14, 124, 66, 0.2) !important;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%) !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
  }

  &:last-child {
    margin-bottom: 0 !important;
  }
`;

const RadioOptionContent = styled.div`
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  margin-bottom: 8px !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  justify-content: space-between !important;
  box-sizing: border-box !important;

  /* Override Fluent UI Radio component */
  .fui-Radio {
    width: auto !important;
    flex-shrink: 0 !important;
  }

  /* Override Fluent UI Radio label */
  .fui-Radio__label {
    flex: 1 !important;
    width: auto !important;
  }
`;

const RadioOptionBadge = styled.div`
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-top: 8px !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;
`;

const StyledBadge = styled(Badge)`
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  padding: 6px 12px !important;
  border-radius: 20px !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2) !important;
  width: fit-content !important;
  max-width: fit-content !important;
`;

const InfoBox = styled.div`
  display: block !important;
  padding: 16px !important;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
  border-radius: 12px !important;
  border: 2px solid rgba(14, 124, 66, 0.1) !important;
  margin-top: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
`;

const InfoIcon = styled.div`
  display: inline-block !important;
  width: 32px !important;
  height: 32px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border-radius: 8px !important;
  color: white !important;
  box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2) !important;
  margin-bottom: 12px !important;
  text-align: center !important;
  line-height: 32px !important;
`;

const InfoText = styled(Text)`
  color: #0e7c42 !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  margin: 0 !important;
  font-weight: 500 !important;
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
`;

const StyledDialogActions = styled(DialogActions)`
  padding: 24px !important;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
  border-top: 1px solid rgba(14, 124, 66, 0.1) !important;
  gap: 16px !important;
  justify-content: flex-end !important;
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
`;

const ConfirmButton = styled(Button)`
  min-width: 120px !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover:not(:disabled) {
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3) !important;
  }

  &:active:not(:disabled) {
    transform: translateY(0) !important;
  }
`;

const CancelButton = styled(Button)`
  min-width: 100px !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 20px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover:not(:disabled) {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
  }
`;

const IntelligentMarkTypeDialog: React.FC<IntelligentMarkTypeDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSaving = false,
  detectedMarkTypes,
}) => {
  const [selectedType, setSelectedType] = useState<string>("");

  // Find the recommended mark type based on detected types
  useEffect(() => {
    if (detectedMarkTypes.hasFard1) {
      setSelectedType("الفرض 1");
    } else if (detectedMarkTypes.hasFard2) {
      setSelectedType("الفرض 2");
    } else if (detectedMarkTypes.hasFard3) {
      setSelectedType("الفرض 3");
    } else if (detectedMarkTypes.hasActivities) {
      setSelectedType("الأنشطة");
    } else {
      setSelectedType("الفرض 1"); // Default
    }
  }, [detectedMarkTypes]);

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  // Check if a mark type was detected
  const isDetected = (markType: string): boolean => {
    switch (markType) {
      case "الفرض 1":
        return detectedMarkTypes.hasFard1;
      case "الفرض 2":
        return detectedMarkTypes.hasFard2;
      case "الفرض 3":
        return detectedMarkTypes.hasFard3;
      case "الأنشطة":
        return detectedMarkTypes.hasActivities;
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen}>
      <StyledDialogSurface>
        <StyledDialogTitle>
          <TitleIcon>
            <ClipboardTask24Regular style={{ fontSize: "24px" }} />
          </TitleIcon>
          <TitleText>اختر نوع العلامات للإدخال</TitleText>
        </StyledDialogTitle>

        <StyledDialogBody>
          {isSaving ? (
            <LoadingSpinner message="جاري إدخال العلامات في Excel..." />
          ) : (
            <ContentWrapper>
              <DescriptionText>
                لقد قمنا بتحليل الصورة واكتشاف أنواع العلامات الموجودة فيها تلقائيًا. الأنواع المكتشفة مميزة بإشارة
                خضراء.
              </DescriptionText>

              <StyledRadioGroup value={selectedType} onChange={(e, data) => setSelectedType(data.value)}>
                <RadioOption>
                  <RadioOptionContent>
                    <Radio value="الفرض 1" label="الفرض 1" />
                  </RadioOptionContent>
                  {isDetected("الفرض 1") && (
                    <RadioOptionBadge>
                      <StyledBadge appearance="filled" color="success">
                        <CheckmarkCircle16Regular />
                        <span>تم الكشف</span>
                      </StyledBadge>
                    </RadioOptionBadge>
                  )}
                </RadioOption>

                <RadioOption>
                  <RadioOptionContent>
                    <Radio value="الفرض 2" label="الفرض 2" />
                  </RadioOptionContent>
                  {isDetected("الفرض 2") && (
                    <RadioOptionBadge>
                      <StyledBadge appearance="filled" color="success">
                        <CheckmarkCircle16Regular />
                        <span>تم الكشف</span>
                      </StyledBadge>
                    </RadioOptionBadge>
                  )}
                </RadioOption>

                <RadioOption>
                  <RadioOptionContent>
                    <Radio value="الفرض 3" label="الفرض 3" />
                  </RadioOptionContent>
                  {isDetected("الفرض 3") && (
                    <RadioOptionBadge>
                      <StyledBadge appearance="filled" color="success">
                        <CheckmarkCircle16Regular />
                        <span>تم الكشف</span>
                      </StyledBadge>
                    </RadioOptionBadge>
                  )}
                </RadioOption>

                <RadioOption>
                  <RadioOptionContent>
                    <Radio value="الأنشطة" label="الأنشطة" />
                  </RadioOptionContent>
                  {isDetected("الأنشطة") && (
                    <RadioOptionBadge>
                      <StyledBadge appearance="filled" color="success">
                        <CheckmarkCircle16Regular />
                        <span>تم الكشف</span>
                      </StyledBadge>
                    </RadioOptionBadge>
                  )}
                </RadioOption>
              </StyledRadioGroup>

              <InfoBox>
                <InfoIcon>
                  <InfoRegular style={{ fontSize: "18px" }} />
                </InfoIcon>
                <InfoText>
                  نوصي باختيار أحد أنواع العلامات التي تم اكتشافها تلقائيًا للحصول على أفضل النتائج. في حال اخترت نوعًا
                  مختلفًا، سنحاول ملاءمة العلامات المستخرجة مع العمود المطلوب.
                </InfoText>
              </InfoBox>
            </ContentWrapper>
          )}
        </StyledDialogBody>

        <StyledDialogActions>
          <ConfirmButton appearance="primary" onClick={handleConfirm} disabled={isSaving}>
            تأكيد
          </ConfirmButton>
          <CancelButton appearance="secondary" onClick={onClose} disabled={isSaving}>
            إلغاء
          </CancelButton>
        </StyledDialogActions>
      </StyledDialogSurface>
    </Dialog>
  );
};

export default IntelligentMarkTypeDialog;
