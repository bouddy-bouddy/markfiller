/* global console, setTimeout, setInterval, clearInterval */
import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Spinner,
} from "@fluentui/react-components";
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
    console.log("🚀 Starting QR code generation...");
    setIsGenerating(true);
    setError(null);

    try {
      const licenseKey = licenseService.getStoredLicenseKey();
      console.log("🔑 License key:", licenseKey ? "Found" : "NOT FOUND");

      if (!licenseKey) {
        throw new Error("لم يتم العثور على مفتاح الترخيص");
      }

      // Get API base URL - try multiple sources
      const API_BASE_URL =
        process.env.REACT_APP_API_URL ||
        (typeof window !== "undefined" && (window as any).REACT_APP_API_URL) ||
        "http://localhost:3000";

      console.log("🌐 API Base URL:", API_BASE_URL);

      const sessionUrl = `${API_BASE_URL}/api/qr-upload/session`;
      console.log("📡 Creating session at:", sessionUrl);

      // Create session
      const response = await fetch(sessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseKey }),
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("❌ Session creation failed:", errorData);
        throw new Error(errorData.error || "فشل في إنشاء جلسة الرفع");
      }

      const data = await response.json();
      console.log("✅ Session created:", data);

      setSessionId(data.sessionId);
      setUploadUrl(data.uploadUrl);

      console.log("🎨 Generating QR code for URL:", data.uploadUrl);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(data.uploadUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0e7c42",
          light: "#ffffff",
        },
      });

      console.log("✅ QR code generated successfully");

      setQrCodeDataUrl(qrDataUrl);
      setIsGenerating(false);
      setIsWaiting(true);

      // Start polling for upload
      console.log("⏳ Starting polling for session:", data.sessionId);
      startPolling(data.sessionId, API_BASE_URL);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      console.error("❌ Error generating QR code:", errorMessage, err);
      setError(errorMessage);
      setIsGenerating(false);
    }
  };

  const startPolling = (sessionId: string, apiBaseUrl: string) => {
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes (every 10 seconds)

    console.log("🔄 Polling started for session:", sessionId);

    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`🔍 Poll attempt ${pollCount}/${maxPolls}`);

      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        console.error("⏰ Session timeout");
        setError("انتهت مهلة الجلسة. يرجى المحاولة مرة أخرى");
        setIsWaiting(false);
        return;
      }

      try {
        const checkUrl = `${apiBaseUrl}/api/qr-upload/session/${sessionId}`;
        console.log("📡 Checking status at:", checkUrl);

        const response = await fetch(checkUrl);
        const data = await response.json();

        console.log("📊 Status check result:", data);

        if (data.status === "completed" && data.imageUrl) {
          clearInterval(pollInterval);
          console.log("✅ Upload completed! Image URL:", data.imageUrl);
          setIsWaiting(false);
          setUploadSuccess(true);

          // Notify parent component
          onImageReceived(data.imageUrl);

          // Close dialog after 2 seconds
          setTimeout(() => {
            console.log("🔒 Closing dialog");
            handleClose();
          }, 2000);
        } else if (data.status === "expired") {
          clearInterval(pollInterval);
          console.error("⏰ Session expired");
          setError("انتهت صلاحية الجلسة");
          setIsWaiting(false);
        }
      } catch (err) {
        console.error("❌ Polling error:", err);
        // Don't stop polling on network errors, just log them
      }
    }, 10000); // Poll every 10 seconds
  };

  const handleOpen = () => {
    console.log("🔓 Opening QR dialog");
    setIsDialogOpen(true);
    generateQrCode();
  };

  const handleClose = () => {
    console.log("🔒 Closing QR dialog and resetting state");
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
          width: "100%",
          fontWeight: 600,
        }}
      >
        رفع عبر رمز QR 📱
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(_, data) => !data.open && handleClose()}>
        <DialogSurface style={{ maxWidth: "500px", textAlign: "center", direction: "rtl" }}>
          <DialogBody>
            <DialogTitle style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: "#1f2937" }}>
              رفع الصورة عبر الهاتف
            </DialogTitle>
            <DialogContent>
              {/* Loading State */}
              {isGenerating && (
                <div style={{ padding: "40px 0" }}>
                  <Spinner size="large" />
                  <p style={{ marginTop: "16px", color: "#64748b", fontSize: "15px" }}>جاري إنشاء رمز QR...</p>
                </div>
              )}

              {/* QR Code Display */}
              {qrCodeDataUrl && !uploadSuccess && !error && (
                <div>
                  {isWaiting && (
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "12px",
                        background: "#fef3c7",
                        borderRadius: "8px",
                        border: "1px solid #fde047",
                      }}
                    >
                      <p style={{ color: "#92400e", fontSize: "14px", margin: 0 }}>
                        ⏳ في انتظار رفع الصورة من هاتفك...
                      </p>
                    </div>
                  )}

                  <div
                    style={{
                      background: "#ffffff",
                      padding: "20px",
                      borderRadius: "12px",
                      border: "2px solid #e5e7eb",
                      marginBottom: "16px",
                    }}
                  >
                    <img src={qrCodeDataUrl} alt="QR Code" style={{ maxWidth: "100%", height: "auto" }} />
                  </div>

                  {uploadUrl && (
                    <div
                      style={{
                        marginTop: "16px",
                        padding: "12px",
                        background: "#f0f9ff",
                        borderRadius: "8px",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      <p style={{ fontSize: "12px", color: "#1e40af", margin: 0, wordBreak: "break-all" }}>
                        <strong>رابط الرفع:</strong> {uploadUrl}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Success State */}
              {uploadSuccess && (
                <div style={{ padding: "40px 20px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      background: "#d1fae5",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <Checkmark24Regular style={{ color: "#059669", fontSize: "32px" }} />
                  </div>
                  <h3 style={{ color: "#059669", fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
                    تم رفع الصورة بنجاح!
                  </h3>
                  <p style={{ color: "#64748b" }}>سيتم إغلاق هذه النافذة تلقائياً...</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div style={{ padding: "20px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      background: "#fee2e2",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <Dismiss24Regular style={{ color: "#dc2626", fontSize: "32px" }} />
                  </div>
                  <h3 style={{ color: "#dc2626", fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>
                    حدث خطأ
                  </h3>
                  <p style={{ color: "#64748b", marginBottom: "16px", fontSize: "14px" }}>{error}</p>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <Button onClick={generateQrCode} appearance="primary">
                      إعادة المحاولة
                    </Button>
                    <Button onClick={handleClose} appearance="secondary">
                      إغلاق
                    </Button>
                  </div>
                </div>
              )}

              {/* Close Button */}
              {!isGenerating && !uploadSuccess && !error && qrCodeDataUrl && (
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
