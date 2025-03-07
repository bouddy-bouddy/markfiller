import React, { useState } from "react";
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
} from "@fluentui/react-components";
import { ClipboardTask24Regular } from "@fluentui/react-icons";
import LoadingSpinner from "../shared/LoadingSpinner";

interface MarkTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (markType: string) => void;
  isSaving?: boolean;
}

const MarkTypeDialog: React.FC<MarkTypeDialogProps> = ({ isOpen, onClose, onConfirm, isSaving = false }) => {
  const [selectedType, setSelectedType] = useState<string>("الفرض 1");

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  return (
    <Dialog open={isOpen}>
      <DialogSurface style={{ minWidth: "400px" }}>
        <DialogTitle style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ClipboardTask24Regular />
          <Text size={500} weight="semibold">
            اختر نوع العلامات
          </Text>
        </DialogTitle>
        <DialogBody>
          {isSaving ? (
            <LoadingSpinner message="جاري إدخال العلامات في Excel..." />
          ) : (
            <RadioGroup
              value={selectedType}
              onChange={(e, data) => setSelectedType(data.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                padding: "12px 0",
              }}
            >
              <Radio value="الفرض 1" label="الفرض 1" />
              <Radio value="الفرض 2" label="الفرض 2" />
              <Radio value="الفرض 3" label="الفرض 3" />
              <Radio value="الأنشطة" label="الأنشطة" />
            </RadioGroup>
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

export default MarkTypeDialog;
