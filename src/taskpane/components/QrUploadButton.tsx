import React, { useState } from "react";
import { Button, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, Spinner } from "@fluentui/react-components";
import { QrCode24Regular, Checkmark24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import QRCode from "qrcode";
import { licenseService } from "../services/licenseService";

interface QrUploadButtonProps {
  onImageReceived: (imageUrl: string) => void;
  disabled?: boolean;
}

const QrUploadButton: React.FC<QrUploadButtonProps> = ({ onImageReceived, disabled = false }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const generateQrCode = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const licenseKey = licenseService.getStoredLicenseKey();
      if (!licenseKey) {
        throw new Error("لم يتم العثور على مفتاح الترخيص");
      }

      // Create session
      const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_BASE_URL}/api/qr-upload/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseKey }),
      });

      if (!response.ok) {
        throw new Error("فشل في إنشاء جلسة الرفع");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setUploadUrl(data.uploadUrl);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(data.uploadUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0e7c42",
          light: "#ffffff",
        },
      });

      setQrCodeDataUrl(qrDataUrl);
      setIsGenerating(false);
      setIsWaiting(true);

      // Start polling for upload
      startPolling(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
      setIsGenerating(false);
    }
  };

  const startPolling = (sessionId: string) => {
    const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes (every 10 seconds)

    const pollInterval = setInterval(async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        setError("انتهت مهلة الجلسة. يرجى المحاولة مرة أخرى");
        setIsWaiting(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/qr-upload/session/${sessionId}`);
        const data = await response.json();

        if (data.status === "completed" && data.imageUrl) {
          clearInterval(pollInterval);
          setIsWaiting(false);
          setUploadSuccess(true);
          
          // Notify parent component
          onImageReceived(data.imageUrl);

          // Close dialog after 2 seconds
          setTimeout(() => {
            handleClose();
          }, 2000);
        } else if (data.status === "expired") {
          clearInterval(pollInterval);
          setError("انتهت صلاحية الجلسة");
          setIsWaiting(false);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 10000); // Poll every 10 seconds
  };

  const handleOpen = () => {
    setIsDialogOpen(true);
    generateQrCode();
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setQrCodeDataUrl(null);
    setUploadUrl(null);
    setSessionId(null);
    setIsGenerating(false);
    setIsWaiting(false);
    setError(null);
    setUploadSuccess(false);
  };

  return (
    <>
      <Button
        appearance="primary"
        icon={<QrCode24Regular />}
        onClick={handleOpen}
        disabled={disabled}
        style={{
          background: "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)",
          border: "none",
          color: "#ffffff",
        }}
      >
        رفع عبر رمز QR
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(_, data) => data.open ? handleOpen() : handleClose()}>
        <DialogSurface style={{ maxWidth: "500px", textAlign: "center" }}>
          <DialogBody>
            <DialogTitle style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold" }}>
              رفع الصورة عبر الهاتف
            </DialogTitle>
            <DialogContent>
              {isGenerating && (
                <div style={{ padding: "40px 0" }}>
                  <Spinner size="large" />
                  <p style={{ marginTop: "16px", color: "#64748b" }}>
                    جاري إنشاء رمز QR...
                  </p>
                </div>
              )}

              {qrCodeDataUrl && !uploadSuccess && !error && (
                <div>
                  {isWaiting && (
                    <div style={{ marginBottom: "16px", padding: "12px", background: "#fef3c7", borderRadius: "8px" }}>
                      <p style={{ color: "#92400e", fontSize: "14px" }}>
                        ⏳ في انتظار رفع الصورة من هاتفك...
                      </p>
                    </div>
                  )}
                  
                  <div style={{ 
                    background: "#ffffff", 
                    padding: "20px", 
                    borderRadius: "12px",
                    border: "2px solid #e5e7eb",
                    marginBottom: "16px"
                  }}>
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code" 
                      style={{ maxWidth: "100%", height: "auto" }} 
                    />
                  </div>

                  <div style={{ textAlign: "right", padding: "0 16px" }}>
                    <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#1f2937" }}>
                      خطوات الرفع:
                    </p>
                    <ol style={{ 
                      textAlign: "right", 
                      fontSize: "14px", 
                      color: "#4b5563",
                      lineHeight: "1.8",
                      paddingRight: "20px"
                    }}>
                      <li>افتح كاميرا هاتفك أو تطبيق قارئ QR</li>
                      <li>قم بمسح الرمز أعلاه</li>
                      <li>اختر صورة لائحة النقط من هاتفك</li>
                      <li>انتظر حتى يتم رفع الصورة تلقائياً</li>
                    </ol>
                  </div>
                </div>
              )}

              {uploadSuccess && (
                <div style={{ padding: "40px 20px" }}>
                  <div style={{ 
                    width: "64px", 
                    height: "64px", 
                    background: "#d1fae5",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px"
                  }}>
                    <Dismiss24Regular style={{ color: "#dc2626", fontSize: "32px" }} />
                  </div>
                  <h3 style={{ color: "#dc2626", fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>
                    حدث خطأ
                  </h3>
                  <p style={{ color: "#64748b", marginBottom: "16px" }}>
                    {error}
                  </p>
                  <Button onClick={generateQrCode} appearance="primary">
                    إعادة المحاولة
                  </Button>
                </div>
              )}

              {!isGenerating && !uploadSuccess && (
                <div style={{ marginTop: "20px" }}>
                  <Button onClick={handleClose} appearance="secondary">
                    إغلاق
                  </Button>
                </div>
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};

export default QrUploadButton;