import React, { useState } from "react";
import { Button, Text } from "@fluentui/react-components";
import {
  Image24Regular,
  ArrowRight24Regular,
  CloudArrowUp24Regular,
  DocumentRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import LoadingSpinner from "../shared/LoadingSpinner";
import QrUploadButton from "../QrUploadButton";
import styled from "styled-components";

// ============= STYLED COMPONENTS =============
const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 0;
`;

const StepIcon = styled.div<{ $isActive: boolean; $isCompleted: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${(props) => {
    if (props.$isCompleted) return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    if (props.$isActive) return "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)";
    return "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)";
  }};
  color: ${(props) => {
    if (props.$isCompleted || props.$isActive) return "white";
    return "#6b7280";
  }};
  box-shadow: ${(props) => {
    if (props.$isCompleted || props.$isActive) {
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

  &:hover {
    border-color: #059669;
    background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
    transform: translateY(-2px);
    box-shadow: 0 12px 24px -8px rgba(14, 124, 66, 0.2);
  }

  &.drag-over {
    border-color: #059669;
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    transform: scale(1.02);
  }
`;

const DropZoneIcon = styled.div`
  color: #0e7c42;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(14, 124, 66, 0.1);
`;

const DropZoneText = styled(Text)`
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
  margin: 0 !important;
`;

const DropZoneSubtext = styled(Text)`
  font-size: 14px !important;
  color: #6b7280 !important;
  margin: 0 !important;
`;

const InfoCard = styled.div`
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border-right: 4px solid #f59e0b;
  box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.1);
`;

const InfoIcon = styled.div`
  color: #d97706;
  flex-shrink: 0;
`;

const InfoTitle = styled(Text)`
  font-weight: 700 !important;
  color: #92400e !important;
  font-size: 15px !important;
  margin-bottom: 12px !important;
  display: block !important;
`;

const InfoList = styled.ul`
  margin: 0;
  padding-right: 20px;
  list-style-type: disc;
  color: #92400e;
`;

const InfoListItem = styled.li`
  margin-bottom: 8px;
  line-height: 1.6;
  font-size: 14px;
`;

const PreviewContainer = styled.div`
  margin-top: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  border-radius: 16px;
  border: 2px solid rgba(14, 124, 66, 0.1);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
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

const UploadOptionsContainer = styled.div`
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-radius: 16px;
  padding: 24px;
  margin: 24px 0;
  border: 2px solid rgba(14, 124, 66, 0.2);
  box-shadow: 0 4px 12px -2px rgba(14, 124, 66, 0.1);
`;

const UploadOptionsTitle = styled(Text)`
  font-weight: 700 !important;
  color: #065f46 !important;
  font-size: 17px !important;
  margin-bottom: 16px !important;
  display: block !important;
  text-align: center !important;
`;

const UploadButtonsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const UploadMethodCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  border: 2px solid #e5e7eb;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    border-color: #0e7c42;
    transform: translateY(-2px);
    box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.2);
  }
`;

const MethodIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  color: white;
  font-size: 28px;
`;

const MethodTitle = styled(Text)`
  font-weight: 600 !important;
  color: #1f2937 !important;
  font-size: 15px !important;
  display: block !important;
  margin-bottom: 6px !important;
`;

const MethodDescription = styled(Text)`
  font-size: 13px !important;
  color: #6b7280 !important;
  display: block !important;
  line-height: 1.4 !important;
`;

// ============= COMPONENT PROPS =============
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
  children?: React.ReactNode;
}

// ============= MAIN COMPONENT =============
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
  children,
}) => {
  // State for processing stages
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);

  // Processing stages
  const stages = ["تحليل الصورة", "استخراج النص", "تحديد هيكل الجدول", "استخراج العلامات", "التحقق من الدقة"];

  // ============= QR IMAGE HANDLER =============
  const handleQrImageReceived = async (imageUrl: string) => {
    try {
      console.log("📱 Image received from QR upload:", imageUrl);

      // Check if it's a Cloudinary URL (starts with http/https)
      const isCloudinaryUrl = imageUrl.startsWith("http://") || imageUrl.startsWith("https://");

      // Use the URL directly if it's from Cloudinary, otherwise construct local URL
      const fullImageUrl = isCloudinaryUrl
        ? imageUrl
        : `${process.env.REACT_APP_API_URL || "http://localhost:3000"}${imageUrl}`;

      console.log("🌐 Fetching image from:", fullImageUrl);

      // Fetch the image
      const response = await fetch(fullImageUrl);

      if (!response.ok) {
        throw new Error(`فشل في تحميل الصورة: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log("✅ Image blob received, size:", blob.size, "bytes");

      // Convert to File object
      const filename = imageUrl.split("/").pop() || "marksheet.jpg";
      const file = new File([blob], filename, { type: blob.type });

      console.log("📄 File created:", file.name, file.type, file.size);

      // Call the parent's onImageUpload function
      onImageUpload(file);

      console.log("✅ Image successfully loaded from QR upload");
    } catch (error) {
      console.error("❌ Error loading QR image:", error);
      alert(`حدث خطأ أثناء تحميل الصورة: ${error instanceof Error ? error.message : "خطأ غير معروف"}`);
    }
  };

  // ============= DRAG & DROP HANDLERS =============
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

  // ============= PROCESS IMAGE WITH STAGES =============
  const processImageWithStages = async () => {
    if (!selectedImage) return;

    setProcessingStage(0);
    setProcessingProgress(0);

    const updateStage = (stage: number) => {
      setProcessingStage(stage);
      setProcessingProgress(((stage + 1) / stages.length) * 100);
    };

    updateStage(0);
    onProcessImage();

    const simulateStages = async () => {
      for (let i = 1; i < stages.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        updateStage(i);
      }
    };

    simulateStages();
  };

  // ============= RENDER =============
  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepTitle>
        <StepIcon $isActive={isActive} $isCompleted={isCompleted}>
          <Image24Regular style={{ fontSize: "24px" }} />
        </StepIcon>
        <StepTitleText>معالجة الصورة</StepTitleText>
      </StepTitle>

      <div className="step-content">
        {/* Info Card */}
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

        {/* Upload Options - Only show if no image selected */}
        {!selectedImage && (
          <UploadOptionsContainer>
            <UploadOptionsTitle>اختر طريقة رفع الصورة</UploadOptionsTitle>

            <UploadButtonsGrid>
              {/* Computer Upload Card */}
              <UploadMethodCard onClick={() => fileInputRef.current?.click()}>
                <MethodIcon>
                  <Image24Regular />
                </MethodIcon>
                <MethodTitle>رفع من الحاسوب</MethodTitle>
                <MethodDescription>اختر صورة محفوظة على جهاز الكمبيوتر</MethodDescription>
              </UploadMethodCard>

              {/* QR Upload Card */}
              <UploadMethodCard as="div" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <MethodIcon>📱</MethodIcon>
                <MethodTitle>رفع عبر الهاتف</MethodTitle>
                <MethodDescription>امسح رمز QR لرفع الصورة من هاتفك مباشرة</MethodDescription>
                <div style={{ marginTop: "12px" }}>
                  <QrUploadButton onImageReceived={handleQrImageReceived} disabled={isProcessing} />
                </div>
              </UploadMethodCard>
            </UploadButtonsGrid>
          </UploadOptionsContainer>
        )}

        {/* Drag and Drop Zone - Only show if no image selected */}
        {!selectedImage && (
          <DropZone
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <DropZoneIcon>
              <CloudArrowUp24Regular style={{ fontSize: "32px" }} />
            </DropZoneIcon>

            <DropZoneText>اسحب الصورة هنا أو انقر للاختيار</DropZoneText>

            <DropZoneSubtext>jpg, png, jpeg مدعومة، بحد أقصى 5 ميغابايت</DropZoneSubtext>
          </DropZone>
        )}

        {/* Hidden file input - Always present */}
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

        {/* Image Preview and Processing - Only show if image selected */}
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
          </PreviewContainer>
        )}

        {children}
      </div>
    </div>
  );
};

export default ImageProcessingStep;
