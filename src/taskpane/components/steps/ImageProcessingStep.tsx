import React, { useState } from "react";
import { Button, Text, Badge, Card } from "@fluentui/react-components";
import {
  Image24Regular,
  ArrowRight24Regular,
  ListRegular,
  CloudArrowUp24Regular,
  DocumentRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import LoadingSpinner from "../shared/LoadingSpinner";
import { DetectedMarkTypes } from "../../types";
import styled from "styled-components";
import OcrQualityTips from "../shared/OcrQualityTips";

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 0;
`;

const StepIcon = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${(props) => {
    if (props.isCompleted) return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    if (props.isActive) return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    return "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)";
  }};
  color: ${(props) => {
    if (props.isCompleted || props.isActive) return "white";
    return "#6b7280";
  }};
  box-shadow: ${(props) => {
    if (props.isCompleted || props.isActive) {
      return "0 8px 16px -4px rgba(14, 124, 66, 0.3)";
    }
    return "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
  }};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

const StepTitleText = styled(Text)`
  font-weight: 700 !important;
  font-size: 20px !important;
  color: #1f2937 !important;
  margin: 0 !important;
  letter-spacing: -0.025em;
`;

const DropZone = styled.div`
  border: 3px dashed #0e7c42;
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  margin: 24px 0;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      45deg,
      rgba(14, 124, 66, 0.05) 0%,
      rgba(16, 185, 129, 0.05) 50%,
      rgba(14, 124, 66, 0.05) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    border-color: #10b981;
    transform: translateY(-2px);
    box-shadow:
      0 20px 25px -5px rgba(14, 124, 66, 0.1),
      0 10px 10px -5px rgba(14, 124, 66, 0.04);

    &::before {
      opacity: 1;
    }
  }

  &.drag-over {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    border-color: #10b981;
    box-shadow:
      0 0 0 6px rgba(14, 124, 66, 0.1),
      0 20px 25px -5px rgba(14, 124, 66, 0.1);
    transform: scale(1.02);
  }
`;

const DropZoneIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 16px;
  color: white;
  box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  ${DropZone}:hover & {
    transform: scale(1.1);
    box-shadow: 0 12px 20px -4px rgba(14, 124, 66, 0.4);
  }
`;

const DropZoneText = styled(Text)`
  font-weight: 700 !important;
  font-size: 18px !important;
  color: #1f2937 !important;
  margin: 0 !important;
`;

const DropZoneSubtext = styled(Text)`
  color: #6b7280 !important;
  font-size: 14px !important;
  margin: 0 !important;
  line-height: 1.5 !important;
`;

const InfoCard = styled(Card)`
  margin-bottom: 24px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 2px solid rgba(14, 124, 66, 0.2);
  padding: 24px;
  border-radius: 16px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
`;

const InfoIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 12px;
  color: white;
  flex-shrink: 0;
  margin-top: 2px;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2);
`;

const InfoTitle = styled(Text)`
  font-weight: 700 !important;
  color: #0e7c42 !important;
  display: block !important;
  margin-bottom: 12px !important;
  font-size: 16px !important;
`;

const InfoList = styled.ol`
  padding-right: 24px;
  margin: 0;
  counter-reset: tip-counter;
  list-style: none;
`;

const InfoListItem = styled.li`
  margin-bottom: 10px;
  position: relative;
  padding-right: 28px;
  line-height: 1.6;
  color: #4b5563;
  font-weight: 500;

  &::before {
    counter-increment: tip-counter;
    content: counter(tip-counter);
    position: absolute;
    right: 0;
    top: 0;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2);
  }
`;

const PreviewContainer = styled.div`
  margin-top: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  border: 2px solid rgba(14, 124, 66, 0.1);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const PreviewTitle = styled(Text)`
  font-weight: 700 !important;
  margin-bottom: 16px !important;
  display: block !important;
  color: #1f2937 !important;
  font-size: 16px !important;
`;

const ImagePreview = styled.img`
  max-width: 100%;
  max-height: 300px;
  border-radius: 12px;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.06);
  border: 2px solid rgba(14, 124, 66, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.02);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
`;

const ActionButtonsContainer = styled.div`
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`;

const PrimaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 16px 24px -4px rgba(14, 124, 66, 0.4) !important;
  }

  &:active {
    transform: translateY(0) !important;
  }
`;

const SecondaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 10px 20px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  }
`;

const DetectedTypesContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #f0fff4 0%, #ecfdf5 100%);
  border-radius: 12px;
  border: 2px solid rgba(14, 124, 66, 0.2);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const DetectedIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 12px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2);
`;

const DetectedTitle = styled(Text)`
  font-weight: 700 !important;
  color: #0e7c42 !important;
  display: block !important;
  margin-bottom: 8px !important;
  font-size: 16px !important;
`;

const BadgesContainer = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const StyledBadge = styled(Badge)`
  border-radius: 20px !important;
  font-weight: 600 !important;
  padding: 6px 16px !important;
  font-size: 13px !important;
  box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2) !important;
`;

interface ImageProcessingStepProps {
  isActive: boolean;
  isCompleted: boolean;
  selectedImage: File | null;
  imagePreview: string | null;
  isProcessing: boolean;
  onImageUpload: (file: File) => void;
  onProcessImage: () => void;
  onRemoveImage?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  detectedMarkTypes: DetectedMarkTypes;
  children?: React.ReactNode;
}

const ImageProcessingStep: React.FC<ImageProcessingStepProps> = ({
  isActive,
  isCompleted,
  selectedImage,
  imagePreview,
  isProcessing,
  onImageUpload,
  onProcessImage,
  onRemoveImage,
  fileInputRef,
  detectedMarkTypes,
  children,
}) => {
  // State for processing stages
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);

  // Processing stages
  const stages = ["تحليل الصورة", "استخراج النص", "تحديد هيكل الجدول", "استخراج العلامات", "التحقق من الدقة"];

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      onImageUpload(file);
    }
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("drag-over");
  };

  // Enhanced processImage function that shows stages
  const processImageWithStages = async () => {
    if (!selectedImage) return;

    // Start processing
    setProcessingStage(0);
    setProcessingProgress(0);

    // Update progress through stages
    const updateStage = (stage: number) => {
      setProcessingStage(stage);
      setProcessingProgress(((stage + 1) / stages.length) * 100);
    };

    // Show initial stage
    updateStage(0);

    // Call the actual process function (which will show actual progress)
    onProcessImage();

    // In a real implementation, onProcessImage would update these stages
    // This is just a simulation for the UI
    const simulateStages = async () => {
      for (let i = 1; i < stages.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        updateStage(i);
      }
    };

    // Run the simulation in parallel with actual processing
    simulateStages();
  };

  // Check if any mark type was detected
  const hasDetectedTypes =
    detectedMarkTypes.hasFard1 ||
    detectedMarkTypes.hasFard2 ||
    detectedMarkTypes.hasFard3 ||
    detectedMarkTypes.hasActivities;

  // Get detected mark types as string array
  const getDetectedTypesText = (): string[] => {
    const types: string[] = [];
    if (detectedMarkTypes.hasFard1) types.push("الفرض 1");
    if (detectedMarkTypes.hasFard2) types.push("الفرض 2");
    if (detectedMarkTypes.hasFard3) types.push("الفرض 3");
    if (detectedMarkTypes.hasActivities) types.push("الأنشطة");
    return types;
  };

  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepTitle>
        <StepIcon isActive={isActive} isCompleted={isCompleted}>
          <Image24Regular style={{ fontSize: "24px" }} />
        </StepIcon>
        <StepTitleText>معالجة الصورة</StepTitleText>
      </StepTitle>

      <div className="step-content">
        <InfoCard>
          <div style={{ display: "flex", gap: "16px", alignItems: "start" }}>
            <InfoIcon>
              <DocumentRegular style={{ fontSize: "20px" }} />
            </InfoIcon>
            <div>
              <InfoTitle>للحصول على أفضل النتائج:</InfoTitle>
              <InfoList>
                <InfoListItem>
                  ينصح باستخدام <strong>CamScanner</strong> للتقاط الصورة
                </InfoListItem>
                <InfoListItem>تأكد من أن الصورة واضحة وجميع الأرقام مقروءة</InfoListItem>
                <InfoListItem>تجنب الظلال والانعكاسات عند التقاط الصورة</InfoListItem>
                <InfoListItem>سيتم تحليل الصورة بدقة عالية</InfoListItem>
              </InfoList>
            </div>
          </div>
        </InfoCard>

        <DropZone
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            title="اختيار ملف صورة"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onImageUpload(e.target.files[0]);
              }
            }}
          />

          <DropZoneIcon>
            <CloudArrowUp24Regular style={{ fontSize: "32px" }} />
          </DropZoneIcon>

          <DropZoneText>اسحب الصورة هنا أو انقر للاختيار</DropZoneText>

          <DropZoneSubtext>jpg, png, jpeg مدعومة، بحد أقصى 5 ميغابايت</DropZoneSubtext>
        </DropZone>

        {imagePreview && (
          <PreviewContainer>
            <PreviewTitle>معاينة الصورة</PreviewTitle>

            <ImagePreview src={imagePreview} alt="معاينة" />

            {isProcessing ? (
              <LoadingSpinner
                message="جاري معالجة الصورة وتحليل البيانات..."
                isCloudProcessing={true}
                progress={processingProgress}
                stage={stages[processingStage]}
              />
            ) : (
              <ActionButtonsContainer>
                <div>
                  <PrimaryButton
                    appearance="primary"
                    onClick={processImageWithStages}
                    disabled={isProcessing}
                    icon={<ArrowRight24Regular />}
                  >
                    معالجة الصورة
                  </PrimaryButton>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <SecondaryButton
                    appearance="subtle"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    icon={<Image24Regular />}
                  >
                    تغيير الصورة
                  </SecondaryButton>

                  <SecondaryButton
                    appearance="outline"
                    onClick={() => {
                      // Clear the selected image
                      if (typeof onRemoveImage === "function") {
                        onRemoveImage();
                      }
                    }}
                    icon={<DeleteRegular />}
                  >
                    حذف الصورة
                  </SecondaryButton>
                </div>
              </ActionButtonsContainer>
            )}

            {/* Show detected mark types if completed and types were detected */}
            {isCompleted && hasDetectedTypes && (
              <DetectedTypesContainer>
                <DetectedIcon>
                  <ListRegular style={{ fontSize: "20px" }} />
                </DetectedIcon>
                <div>
                  <DetectedTitle>تم اكتشاف أنواع العلامات التالية:</DetectedTitle>
                  <BadgesContainer>
                    {getDetectedTypesText().map((type) => (
                      <StyledBadge key={type} appearance="filled" color="success">
                        {type}
                      </StyledBadge>
                    ))}
                  </BadgesContainer>
                </div>
              </DetectedTypesContainer>
            )}
          </PreviewContainer>
        )}

        {/* OCR Quality Tips added here */}
        {/* {isActive && !isProcessing && !isCompleted && <OcrQualityTips />} */}

        {children}
      </div>
    </div>
  );
};

export default ImageProcessingStep;
