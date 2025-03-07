import React from "react";
import { Button, Text } from "@fluentui/react-components";
import { Image24Regular, ArrowRight24Regular } from "@fluentui/react-icons";
import StepIndicator from "../shared/StepIndicator";
import LoadingSpinner from "../shared/LoadingSpinner";
import UploadInstructions from "../shared/UploadInstructions";

interface ImageProcessingStepProps {
  isActive: boolean;
  isCompleted: boolean;
  selectedImage: File | null;
  imagePreview: string | null;
  isProcessing: boolean;
  onImageUpload: (file: File) => void;
  onProcessImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ImageProcessingStep: React.FC<ImageProcessingStepProps> = ({
  isActive,
  isCompleted,
  selectedImage,
  imagePreview,
  isProcessing,
  onImageUpload,
  onProcessImage,
  fileInputRef,
}) => {
  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("drag-over");
  };

  return (
    <div className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
      <StepIndicator stepNumber={1} title="معالجة الصورة" isActive={isActive} isCompleted={isCompleted} />

      <div className="step-content">
        <UploadInstructions />

        <div
          className="drop-zone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: "2px dashed #0078d4",
            borderRadius: "8px",
            padding: "32px",
            textAlign: "center",
            margin: "20px 0",
            cursor: "pointer",
            transition: "all 0.3s ease",
            backgroundColor: "#f0f8ff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
          }}
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

          <Image24Regular style={{ fontSize: "48px", color: "#0078d4" }} />

          <Text>اسحب الصورة هنا أو انقر للاختيار</Text>

          <Text size={100} style={{ color: "#666" }}>
            jpg, png, jpeg مدعومة، بحد أقصى 5 ميغابايت
          </Text>
        </div>

        {imagePreview && (
          <div style={{ marginTop: "20px" }}>
            <Text weight="semibold" style={{ marginBottom: "12px", display: "block" }}>
              معاينة الصورة
            </Text>

            <img
              src={imagePreview}
              alt="معاينة"
              style={{
                maxWidth: "100%",
                maxHeight: "300px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            />

            {isProcessing ? (
              <LoadingSpinner message="جاري معالجة الصورة وتحليل البيانات..." />
            ) : (
              <Button
                appearance="primary"
                onClick={onProcessImage}
                disabled={isProcessing}
                icon={<ArrowRight24Regular />}
                style={{ marginTop: "16px" }}
              >
                معالجة الصورة
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageProcessingStep;
