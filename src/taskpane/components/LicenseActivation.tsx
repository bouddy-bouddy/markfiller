import React, { useState, useEffect } from "react";
import { Button, Input, Text, Spinner, Field } from "@fluentui/react-components";
import {
  Shield24Regular,
  ShieldCheckmark24Filled,
  Key24Regular,
  Person24Regular,
  Calendar24Regular,
  DeviceEq24Regular,
  CheckmarkCircle24Filled,
  DismissCircle24Filled,
} from "@fluentui/react-icons";
import { licenseService, LicenseValidationResult } from "../services/licenseService";

interface LicenseActivationProps {
  onLicenseValidated: () => void;
}

const LicenseActivation: React.FC<LicenseActivationProps> = ({ onLicenseValidated }) => {
  const [licenseKey, setLicenseKey] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [validationResult, setValidationResult] = useState<LicenseValidationResult | null>(null);

  useEffect(() => {
    checkExistingLicense();
  }, []);

  const checkExistingLicense = async () => {
    setIsLoading(true);

    if (licenseService.hasStoredLicense()) {
      const result = await licenseService.validateLicense();
      setValidationResult(result);

      if (result.valid) {
        setTimeout(() => {
          onLicenseValidated();
        }, 1500);
      }
    }

    setIsLoading(false);
  };

  const handleValidateLicense = async () => {
    if (!licenseKey.trim()) {
      setValidationResult({
        valid: false,
        message: "يرجى إدخال مفتاح الترخيص",
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await licenseService.activateLicense(licenseKey.trim());
      setValidationResult(result);

      if (result.valid) {
        await licenseService.trackUsage("license_activated");

        setTimeout(() => {
          onLicenseValidated();
        }, 2000);
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        message: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveLicense = () => {
    licenseService.removeLicense();
    setValidationResult(null);
    setLicenseKey("");
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <Spinner size="extra-large" />
          <Text size={400} style={styles.loadingText}>
            جاري التحقق من الترخيص...
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.backgroundDecoration} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.iconContainer}>
            <Shield24Regular style={styles.headerIcon} />
          </div>
          <Text size={800} weight="bold" style={styles.title}>
            تفعيل MarkFiller
          </Text>
          <br />
          <Text size={300} style={styles.subtitle}>
            يرجى إدخال مفتاح الترخيص الخاص بك للمتابعة
          </Text>
        </div>

        <div style={styles.content}>
          {/* License Key Input */}
          <div style={styles.inputSection}>
            <Field
              label={
                <span style={styles.label}>
                  <Key24Regular style={styles.labelIcon} />
                  مفتاح الترخيص *
                </span>
              }
              required
            >
              <div style={styles.inputWrapper}>
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Insert license key here..."
                  disabled={isValidating}
                  style={styles.input}
                  className="rtlPlaceholder"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleValidateLicense();
                    }
                  }}
                />
              </div>
            </Field>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div style={validationResult.valid ? styles.successMessage : styles.errorMessage}>
              <div style={styles.messageContent}>
                {validationResult.valid ? (
                  <CheckmarkCircle24Filled style={styles.successIcon} />
                ) : (
                  <DismissCircle24Filled style={styles.errorIcon} />
                )}
                <Text weight="semibold">{validationResult.message}</Text>
              </div>

              {validationResult.valid && (
                <div style={styles.licenseInfo}>
                  {validationResult.teacherName && (
                    <div style={styles.infoItem}>
                      <Person24Regular style={styles.infoIcon} />
                      <Text size={300}>{validationResult.teacherName}</Text>
                    </div>
                  )}

                  {validationResult.daysRemaining !== undefined && (
                    <div style={styles.infoItem}>
                      <Calendar24Regular style={styles.infoIcon} />
                      <Text size={300}>
                        {validationResult.daysRemaining > 0
                          ? `${validationResult.daysRemaining} يوم متبقي`
                          : "ينتهي اليوم"}
                      </Text>
                    </div>
                  )}

                  {validationResult.devicesUsed !== undefined && validationResult.maxDevices && (
                    <div style={styles.infoItem}>
                      <DeviceEq24Regular style={styles.infoIcon} />
                      <Text size={300}>
                        الأجهزة: {validationResult.devicesUsed} من {validationResult.maxDevices}
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={styles.actionButtons}>
            <Button
              appearance="primary"
              onClick={handleValidateLicense}
              disabled={isValidating || validationResult?.valid}
              style={styles.primaryButton}
              size="large"
            >
              {isValidating ? (
                <>
                  <Spinner size="tiny" />
                  <span>جاري التحقق...</span>
                </>
              ) : validationResult?.valid ? (
                <>
                  <ShieldCheckmark24Filled />
                  <span>تم التفعيل بنجاح</span>
                </>
              ) : (
                <>
                  <Shield24Regular />
                  <span>تفعيل الترخيص</span>
                </>
              )}
            </Button>

            {validationResult?.valid && (
              <Button
                appearance="subtle"
                onClick={handleRemoveLicense}
                disabled={isValidating}
                style={styles.secondaryButton}
              >
                إلغاء
              </Button>
            )}
          </div>

          {/* Help Text */}
          <div style={styles.helpBox}>
            <Text size={200} style={styles.helpText}>
              💡 للحصول على مفتاح ترخيص، يرجى التواصل مع مطور التطبيق.
              <br /> سيتم إرسال المفتاح إليك عبر البريد الإلكتروني.
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    position: "relative",
    overflow: "hidden",
    direction: "rtl",
  },
  backgroundDecoration: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      "radial-gradient(circle at 20% 50%, rgba(14, 124, 66, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)",
    pointerEvents: "none",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  },
  loadingContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
  },
  loadingText: {
    color: "#0e7c42",
    fontWeight: 600,
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    background: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 20px 50px rgba(14, 124, 66, 0.12), 0 10px 20px rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
    border: "1px solid rgba(14, 124, 66, 0.1)",
    marginBottom: "40px",
  },
  header: {
    background: "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)",
    padding: "40px 32px",
    textAlign: "center",
    position: "relative",
  },
  iconContainer: {
    width: "72px",
    height: "72px",
    background: "rgba(255, 255, 255, 0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    backdropFilter: "blur(10px)",
    border: "2px solid rgba(255, 255, 255, 0.3)",
  },
  headerIcon: {
    fontSize: "36px",
    color: "#ffffff",
  },
  title: {
    color: "#ffffff",
    marginBottom: "8px",
    fontSize: "28px",
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "14px",
  },
  content: {
    padding: "32px",
  },
  inputSection: {
    marginBottom: "20px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: "8px",
  },
  labelIcon: {
    fontSize: "18px",
    color: "#0e7c42",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    width: "100%",
    borderRadius: "12px",
    border: "2px solid #e2e8f0",
    padding: "14px 16px",
    fontSize: "15px",
    transition: "all 0.3s ease",
    fontFamily: "inherit",
    direction: "ltr",
  },
  toggleSection: {
    marginBottom: "20px",
  },
  toggleButton: {
    width: "100%",
    justifyContent: "center",
    borderRadius: "12px",
    padding: "12px",
    color: "#0e7c42",
    fontWeight: 600,
    border: "2px dashed #d1fae5",
    background: "#f0fdf4",
    transition: "all 0.3s ease",
  },
  successMessage: {
    background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "24px",
    border: "2px solid #6ee7b7",
  },
  errorMessage: {
    background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "24px",
    border: "2px solid #fca5a5",
  },
  messageContent: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  successIcon: {
    fontSize: "24px",
    color: "#059669",
  },
  errorIcon: {
    fontSize: "24px",
    color: "#dc2626",
  },
  licenseInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(5, 150, 105, 0.2)",
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  infoIcon: {
    fontSize: "20px",
    color: "#059669",
  },
  actionButtons: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px",
  },
  primaryButton: {
    flex: 1,
    background: "linear-gradient(135deg, #0e7c42 0%, #10b981 100%)",
    borderRadius: "12px",
    padding: "16px",
    fontSize: "16px",
    fontWeight: 700,
    border: "none",
    color: "#ffffff",
    boxShadow: "0 4px 12px rgba(14, 124, 66, 0.3)",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  secondaryButton: {
    borderRadius: "12px",
    padding: "16px 24px",
    fontSize: "15px",
    fontWeight: 600,
    color: "#64748b",
  },
  helpBox: {
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #bfdbfe",
    textAlign: "right",
  },
  helpText: {
    color: "#1e40af",
    lineHeight: 1.6,
  },
};

export default LicenseActivation;
