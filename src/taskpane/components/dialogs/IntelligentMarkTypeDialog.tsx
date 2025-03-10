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

interface IntelligentMarkTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (markType: string) => void;
  isSaving?: boolean;
  detectedMarkTypes: DetectedMarkTypes;
}

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
      <DialogSurface style={{ minWidth: "450px" }}>
        <DialogTitle style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ClipboardTask24Regular />
          <Text size={500} weight="semibold">
            اختر نوع العلامات للإدخال
          </Text>
        </DialogTitle>
        <DialogBody>
          {isSaving ? (
            <LoadingSpinner message="جاري إدخال العلامات في Excel..." />
          ) : (
            <>
              <Text
                style={{
                  display: "block",
                  marginBottom: "16px",
                  color: "#0e7c42",
                  fontWeight: "500",
                }}
              >
                لقد قمنا بتحليل الصورة واكتشاف أنواع العلامات الموجودة فيها تلقائيًا. الأنواع المكتشفة مميزة بإشارة
                خضراء.
              </Text>
              <RadioGroup
                value={selectedType}
                onChange={(e, data) => setSelectedType(data.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "12px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio value="الفرض 1" label="الفرض 1" />
                  {isDetected("الفرض 1") && (
                    <Badge
                      appearance="filled"
                      color="success"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </Badge>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio value="الفرض 2" label="الفرض 2" />
                  {isDetected("الفرض 2") && (
                    <Badge
                      appearance="filled"
                      color="success"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </Badge>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio value="الفرض 3" label="الفرض 3" />
                  {isDetected("الفرض 3") && (
                    <Badge
                      appearance="filled"
                      color="success"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </Badge>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio value="الأنشطة" label="الأنشطة" />
                  {isDetected("الأنشطة") && (
                    <Badge
                      appearance="filled"
                      color="success"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CheckmarkCircle16Regular />
                      <span>تم الكشف</span>
                    </Badge>
                  )}
                </div>
              </RadioGroup>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "12px",
                  backgroundColor: "#f0f9ff",
                  borderRadius: "4px",
                  marginTop: "16px",
                }}
              >
                <InfoRegular style={{ color: "#0078d4", flexShrink: 0, marginTop: "2px" }} />
                <Text size={200} style={{ color: "#0078d4" }}>
                  نوصي باختيار أحد أنواع العلامات التي تم اكتشافها تلقائيًا للحصول على أفضل النتائج. في حال اخترت نوعًا
                  مختلفًا، سنحاول ملاءمة العلامات المستخرجة مع العمود المطلوب.
                </Text>
              </div>
            </>
          )}
        </DialogBody>
        <DialogActions style={{ padding: "20px" }}>
          <Button appearance="primary" onClick={handleConfirm} style={{ minWidth: "100px" }} disabled={isSaving}>
            تأكيد
          </Button>
          <Button appearance="secondary" onClick={onClose} style={{ minWidth: "80px" }} disabled={isSaving}>
            إلغاء
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
};

export default IntelligentMarkTypeDialog;
