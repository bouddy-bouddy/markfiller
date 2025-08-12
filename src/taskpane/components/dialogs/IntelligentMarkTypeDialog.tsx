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
  Tooltip,
} from "@fluentui/react-components";
import { ClipboardTask24Regular, InfoRegular, CheckmarkCircle16Regular } from "@fluentui/react-icons";
import LoadingSpinner from "../shared/LoadingSpinner";
import { DetectedMarkTypes, markTypeNames } from "../../types";
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
  border-radius: 20px !important;
  border: 2px solid rgba(14, 124, 66, 0.1) !important;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.1) !important;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
  overflow: hidden !important;

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
`;

const DescriptionText = styled(Text)`
  display: block !important;
  margin-bottom: 24px !important;
  color: #0e7c42 !important;
  font-weight: 600 !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
  background: rgba(14, 124, 66, 0.05);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

const StyledRadioGroup = styled(RadioGroup)`
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
  padding: 16px 0 !important;
`;

const RadioOption = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);

  &:hover {
    border-color: rgba(14, 124, 66, 0.2);
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
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
`;

const InfoBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 12px;
  margin-top: 20px;
  border: 2px solid rgba(14, 124, 66, 0.1);
`;

const InfoIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 8px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2);
`;

const InfoText = styled(Text)`
  color: #0e7c42 !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  margin: 0 !important;
  font-weight: 500 !important;
`;

const StyledDialogActions = styled(DialogActions)`
  padding: 24px !important;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
  border-top: 1px solid rgba(14, 124, 66, 0.1) !important;
  gap: 12px !important;
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
            <>
              <DescriptionText>
                لقد قمنا بتحليل الصورة واكتشاف أنواع العلامات الموجودة فيها تلقائيًا. الأنواع المكتشفة مميزة بإشارة
                خضراء.
              </DescriptionText>

              <StyledRadioGroup value={selectedType} onChange={(e, data) => setSelectedType(data.value)}>
                <RadioOption>
                  <Radio value="الفرض 1" label="الفرض 1" />
                  {isDetected("الفرض 1") && (
                    <StyledBadge appearance="filled" color="success">
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </StyledBadge>
                  )}
                </RadioOption>

                <RadioOption>
                  <Radio value="الفرض 2" label="الفرض 2" />
                  {isDetected("الفرض 2") && (
                    <StyledBadge appearance="filled" color="success">
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </StyledBadge>
                  )}
                </RadioOption>

                <RadioOption>
                  <Radio value="الفرض 3" label="الفرض 3" />
                  {isDetected("الفرض 3") && (
                    <StyledBadge appearance="filled" color="success">
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </StyledBadge>
                  )}
                </RadioOption>

                <RadioOption>
                  <Radio value="الأنشطة" label="الأنشطة" />
                  {isDetected("الأنشطة") && (
                    <StyledBadge appearance="filled" color="success">
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </StyledBadge>
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
            </>
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
