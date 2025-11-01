/* global setTimeout, setInterval, clearInterval */
import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { licenseService } from "../services/license/licenseService";
import { logger } from "../utils/logger";

/**
 * Optimized QR Upload Button Component
 * Features:
 * - QR code caching (5-minute TTL)
 * - Exponential backoff polling
 * - Proper cleanup for intervals and timeouts
 */

interface QrUploadButtonProps {
  onImageReceived: (imageUrl: string) => void;
  disabled?: boolean;
}

interface CachedQrSession {
  qrCodeDataUrl: string;
  uploadUrl: string;
  sessionId: string;
  timestamp: number;
}

// QR session cache configuration
const QR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const INITIAL_POLL_INTERVAL = 2000; // Start with 2 seconds
const MAX_POLL_INTERVAL = 30000; // Max 30 seconds
const MAX_POLL_DURATION = 10 * 60 * 1000; // 10 minutes total
const BACKOFF_MULTIPLIER = 1.5; // Exponential backoff factor

const QrUploadButton: React.FC<QrUploadButtonProps> = ({ onImageReceived, disabled = false }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Refs for cleanup
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cachedSessionRef = useRef<CachedQrSession | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup function for all timers and intervals
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      logger.debug("🧹 Cleared poll interval");
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
      logger.debug("🧹 Cleared close timeout");
    }
  }, []);

  // Check if cached QR session is still valid
  const isCacheValid = useCallback((): boolean => {
    if (!cachedSessionRef.current) return false;
    const age = Date.now() - cachedSessionRef.current.timestamp;
    const isValid = age < QR_CACHE_TTL;
    logger.debug(`📦 Cache check: ${isValid ? "Valid" : "Expired"} (age: ${Math.round(age / 1000)}s)`);
    return isValid;
  }, []);

  // Polling with exponential backoff (declared early for loadCachedSession)
  const startPolling = useCallback(
    (sessionId: string, apiBaseUrl: string) => {
      // Clear any existing polling
      cleanup();

      let currentInterval = INITIAL_POLL_INTERVAL;
      const startTime = Date.now();

      logger.debug("🔄 Polling started with exponential backoff");
      logger.debug(`📊 Initial interval: ${currentInterval}ms, Max: ${MAX_POLL_INTERVAL}ms`);

      const scheduleNextPoll = () => {
        const elapsed = Date.now() - startTime;

        // Check if max duration exceeded
        if (elapsed > MAX_POLL_DURATION) {
          logger.warn("⏰ Session timeout - max duration exceeded");
          if (isMountedRef.current) {
            setError("انتهت مهلة الجلسة. يرجى المحاولة مرة أخرى");
            setIsWaiting(false);
          }
          return;
        }

        // Schedule next poll with current interval
        pollIntervalRef.current = setTimeout(async () => {
          try {
            const checkUrl = `${apiBaseUrl}/api/qr-upload/session/${sessionId}`;
            logger.debug(`🔍 Polling (interval: ${Math.round(currentInterval / 1000)}s, elapsed: ${Math.round(elapsed / 1000)}s)`);

            const response = await fetch(checkUrl);
            const data = await response.json();

            logger.debug("📊 Status check result:", data);

            if (!isMountedRef.current) {
              logger.debug("⚠️ Component unmounted, stopping poll");
              return;
            }

            if (data.status === "completed" && data.imageUrl) {
              cleanup();
              logger.info("✅ Upload completed! Image URL:", data.imageUrl);
              setIsWaiting(false);
              setUploadSuccess(true);

              // Notify parent component
              onImageReceived(data.imageUrl);

              // Close dialog after 2 seconds
              closeTimeoutRef.current = setTimeout(() => {
                logger.debug("🔒 Closing dialog");
                // Call handleClose directly to avoid circular dependency
                cleanup();
                setIsDialogOpen(false);
                setQrCodeDataUrl(null);
                setUploadUrl(null);
                setSessionId(null);
                setIsGenerating(false);
                setIsWaiting(false);
                setError(null);
                setUploadSuccess(false);
              }, 2000);
            } else if (data.status === "expired") {
              cleanup();
              logger.warn("⏰ Session expired");
              setError("انتهت صلاحية الجلسة");
              setIsWaiting(false);
            } else {
              // Still waiting, schedule next poll with exponential backoff
              currentInterval = Math.min(currentInterval * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL);
              scheduleNextPoll();
            }
          } catch (err) {
            logger.error("❌ Polling error:", err);
            // Continue polling on network errors
            if (isMountedRef.current) {
              scheduleNextPoll();
            }
          }
        }, currentInterval);
      };

      // Start first poll
      scheduleNextPoll();
    },
    [cleanup, onImageReceived]
  );

  // Load cached QR session
  const loadCachedSession = useCallback(() => {
    if (!cachedSessionRef.current) return;

    logger.info("♻️ Loading cached QR session");
    setQrCodeDataUrl(cachedSessionRef.current.qrCodeDataUrl);
    setUploadUrl(cachedSessionRef.current.uploadUrl);
    setSessionId(cachedSessionRef.current.sessionId);
    setIsWaiting(true);

    // Get API base URL
    const API_BASE_URL =
      process.env.REACT_APP_API_URL || (typeof window !== "undefined" && (window as any).REACT_APP_API_URL);

    // Restart polling for the cached session
    startPolling(cachedSessionRef.current.sessionId, API_BASE_URL);
  }, [startPolling]);

  const generateQrCode = useCallback(async () => {
    // Check cache first
    if (isCacheValid()) {
      logger.info("✅ Using cached QR code");
      loadCachedSession();
      return;
    }

    logger.info("🚀 Starting QR code generation...");
    setIsGenerating(true);
    setError(null);

    try {
      const licenseKey = licenseService.getStoredLicenseKey();
      logger.debug("🔑 License key:", licenseKey ? "Found" : "NOT FOUND");

      if (!licenseKey) {
        throw new Error("لم يتم العثور على مفتاح الترخيص");
      }

      // Get API base URL - try multiple sources
      const API_BASE_URL =
        process.env.REACT_APP_API_URL || (typeof window !== "undefined" && (window as any).REACT_APP_API_URL);

      logger.debug("🌐 API Base URL:", API_BASE_URL);

      const sessionUrl = `${API_BASE_URL}/api/qr-upload/session`;
      logger.debug("📡 Creating session at:", sessionUrl);

      // Create session
      const response = await fetch(sessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseKey }),
      });

      logger.debug("📥 Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        logger.error("❌ Session creation failed:", errorData);
        throw new Error(errorData.error || "فشل في إنشاء جلسة الرفع");
      }

      const data = await response.json();
      logger.info("✅ Session created:", data);

      if (!isMountedRef.current) return;

      logger.debug("🎨 Generating QR code for URL:", data.uploadUrl);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(data.uploadUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0e7c42",
          light: "#ffffff",
        },
      });

      logger.info("✅ QR code generated successfully");

      if (!isMountedRef.current) return;

      // Cache the session
      cachedSessionRef.current = {
        qrCodeDataUrl: qrDataUrl,
        uploadUrl: data.uploadUrl,
        sessionId: data.sessionId,
        timestamp: Date.now(),
      };

      setSessionId(data.sessionId);
      setUploadUrl(data.uploadUrl);
      setQrCodeDataUrl(qrDataUrl);
      setIsGenerating(false);
      setIsWaiting(true);

      // Start polling for upload
      logger.debug("⏳ Starting polling for session:", data.sessionId);
      startPolling(data.sessionId, API_BASE_URL);
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      logger.error("❌ Error generating QR code:", errorMessage, err);
      setError(errorMessage);
      setIsGenerating(false);
    }
  }, [isCacheValid, loadCachedSession, startPolling]);

  const handleOpen = useCallback(() => {
    logger.debug("🔓 Opening QR dialog");
    setIsDialogOpen(true);
    generateQrCode();
  }, [generateQrCode]);

  const handleClose = useCallback(() => {
    logger.debug("🔒 Closing QR dialog and resetting state");
    cleanup();
    setIsDialogOpen(false);
    setQrCodeDataUrl(null);
    setUploadUrl(null);
    setSessionId(null);
    setIsGenerating(false);
    setIsWaiting(false);
    setError(null);
    setUploadSuccess(false);
  }, [cleanup]);

  // Cleanup on component unmount
  useEffect(() => {
    isMountedRef.current = true;
    logger.debug("🏗️ QrUploadButton mounted");

    return () => {
      isMountedRef.current = false;
      cleanup();
      logger.debug("🔥 QrUploadButton unmounted - cleaned up all timers");
    };
  }, [cleanup]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      cleanup();
    }
  }, [isDialogOpen, cleanup]);

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
