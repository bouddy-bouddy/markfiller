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
import enhancedOcrService from "../../services/enhancedOcrService";
import OcrQualityTips from "../shared/OcrQualityTips";

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const DropZone = styled.div`
  border: 2px dashed #0e7c42;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  margin: 20px 0;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #f0f9ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;

  &:hover {
    background-color: #ecfdf5;
    border-color: #059669;
  }

  &.drag-over {
    background-color: #ecfdf5;
    border-color: #059669;
    box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.1);
  }
`;

const InfoCard = styled(Card)`
  margin-bottom: 20px;
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
  padding: 16px;
`;

const PreviewContainer = styled.div`
  margin-top: 20px;
`;

const ImagePreview = styled.img`
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const DetectedTypesContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
  background-color: #f0fff4;
  border-radius: 4px;
  border: 1px solid #c6f6d5;
`;

const BadgesContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
        <Image24Regular
          style={{
            color: isActive ? "#0e7c42" : isCompleted ? "#0e7c42" : "#666",
            fontSize: "24px",
          }}
        />
        <Text
          size={600}
          weight="semibold"
          style={{
            color: isActive ? "#0e7c42" : isCompleted ? "#0e7c42" : "#333",
          }}
        >
          معالجة الصورة
        </Text>
      </StepTitle>

      <div className="step-content">
        <InfoCard>
          <div style={{ display: "flex", gap: "12px", alignItems: "start" }}>
            <DocumentRegular style={{ color: "#0284c7", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <Text weight="semibold" style={{ color: "#0284c7", display: "block", marginBottom: "8px" }}>
                للحصول على أفضل النتائج:
              </Text>
              <ol style={{ paddingRight: "20px", margin: 0 }}>
                <li style={{ marginBottom: "8px" }}>التقط صورة لورقة النقط باستخدام الهاتف أو ماسح ضوئي</li>
                <li style={{ marginBottom: "8px" }}>تأكد من أن الصورة واضحة وجميع الأرقام مقروءة</li>
                <li style={{ marginBottom: "8px" }}>تجنب الظلال والانعكاسات عند التقاط الصورة</li>
                <li style={{ marginBottom: "8px" }}>سيتم تحليل الصورة باستخدام تقنية OCR للدقة العالية</li>
              </ol>
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
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onImageUpload(e.target.files[0]);
              }
            }}
          />

          <CloudArrowUp24Regular style={{ fontSize: "48px", color: "#0e7c42" }} />

          <Text weight="semibold">اسحب الصورة هنا أو انقر للاختيار</Text>

          <Text size={100} style={{ color: "#666" }}>
            jpg, png, jpeg مدعومة، بحد أقصى 5 ميغابايت
          </Text>
        </DropZone>

        {imagePreview && (
          <PreviewContainer>
            <Text weight="semibold" style={{ marginBottom: "12px", display: "block" }}>
              معاينة الصورة
            </Text>

            <ImagePreview src={imagePreview} alt="معاينة" />

            {isProcessing ? (
              <LoadingSpinner
                message="جاري معالجة الصورة وتحليل البيانات..."
                isCloudProcessing={true}
                progress={processingProgress}
                stage={stages[processingStage]}
              />
            ) : (
              <div
                style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <Button
                    appearance="primary"
                    onClick={processImageWithStages}
                    disabled={isProcessing}
                    icon={<ArrowRight24Regular />}
                  >
                    معالجة الصورة
                  </Button>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    appearance="subtle"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    icon={<Image24Regular />}
                  >
                    تغيير الصورة
                  </Button>

                  <Button
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
                  </Button>
                </div>
              </div>
            )}

            {/* Show detected mark types if completed and types were detected */}
            {isCompleted && hasDetectedTypes && (
              <DetectedTypesContainer>
                <ListRegular style={{ color: "#38a169" }} />
                <div>
                  <Text weight="semibold" style={{ color: "#38a169", display: "block", marginBottom: "4px" }}>
                    تم اكتشاف أنواع العلامات التالية:
                  </Text>
                  <BadgesContainer>
                    {getDetectedTypesText().map((type) => (
                      <Badge key={type} appearance="filled" color="success">
                        {type}
                      </Badge>
                    ))}
                  </BadgesContainer>
                </div>
              </DetectedTypesContainer>
            )}
          </PreviewContainer>
        )}

        {/* OCR Quality Tips added here */}
        {isActive && !isProcessing && !isCompleted && <OcrQualityTips />}

        {children}
      </div>
    </div>
  );
};

export default ImageProcessingStep;
