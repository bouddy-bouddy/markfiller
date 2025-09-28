import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, Button, Input, Text, Spinner, MessageBar, Field, Select } from "@fluentui/react-components";
import {
  Key20Regular,
  Shield20Regular,
  Person20Regular,
  Calendar20Regular,
  DeviceEq20Regular,
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
} from "@fluentui/react-icons";
import { licenseService, LicenseValidationResult } from "../services/licenseService";

interface LicenseActivationProps {
  onLicenseValidated: () => void;
}

interface TeacherProfile {
  cin?: string;
  phone?: string;
  level?: "الإعدادي" | "الثانوي";
  subject?: string;
  classesCount?: number;
  testsPerTerm?: number;
}

const LicenseActivation: React.FC<LicenseActivationProps> = ({ onLicenseValidated }) => {
  const [licenseKey, setLicenseKey] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [validationResult, setValidationResult] = useState<LicenseValidationResult | null>(null);
  const [showProfileForm, setShowProfileForm] = useState<boolean>(false);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>({});
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check for existing license on component mount
  useEffect(() => {
    checkExistingLicense();
  }, []);

  const checkExistingLicense = async () => {
    setIsLoading(true);

    if (licenseService.hasStoredLicense()) {
      const result = await licenseService.validateLicense();
      setValidationResult(result);

      if (result.valid) {
        // Auto-proceed if license is valid
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
      // First try to activate the license
      const result = await licenseService.activateLicense(
        licenseKey.trim(),
        showProfileForm ? teacherProfile : undefined
      );
      setValidationResult(result);

      if (result.valid) {
        // Track activation event
        await licenseService.trackUsage("license_activated", {
          hasProfile: showProfileForm,
          profileData: showProfileForm ? Object.keys(teacherProfile).length : 0,
        });

        // Proceed to main app after successful activation
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
      setIsActivating(false);
    }
  };

  const handleRemoveLicense = () => {
    licenseService.removeLicense();
    setValidationResult(null);
    setLicenseKey("");
  };

  // Focus trap, Escape prevention, and beforeunload while activation is shown
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusable = (): HTMLElement[] => {
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      return nodes.filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    };

    // Initial focus to the license input if available
    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent closing via Escape
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Trap Tab focus within activation view
      if (e.key === "Tab") {
        const elements = getFocusable();
        if (elements.length === 0) {
          e.preventDefault();
          return;
        }

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === container) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const renderLicenseInfo = () => {
    if (!validationResult || !validationResult.valid) return null;

    return (
      <Card style={{ marginTop: "16px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <CheckmarkCircle20Filled color="green" />
          <Text weight="semibold">معلومات الترخيص</Text>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {validationResult.teacherName && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Person20Regular />
              <Text>{validationResult.teacherName}</Text>
            </div>
          )}

          {validationResult.daysRemaining !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar20Regular />
              <Text>
                {validationResult.daysRemaining > 0 ? `${validationResult.daysRemaining} يوم متبقي` : "ينتهي اليوم"}
              </Text>
            </div>
          )}

          {validationResult.devicesUsed !== undefined && validationResult.maxDevices && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <DeviceEq20Regular />
              <Text>
                الأجهزة: {validationResult.devicesUsed} من {validationResult.maxDevices}
              </Text>
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px" }}>
        <Spinner size="large" />
        <Text style={{ marginTop: "16px" }}>جاري التحقق من الترخيص...</Text>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      style={{ padding: "24px", maxWidth: "500px", margin: "0 auto" }}
    >
      <Card>
        <CardHeader
          header={
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Shield20Regular />
              <Text size={600} weight="semibold">
                تفعيل MarkFiller
              </Text>
            </div>
          }
          description="يرجى إدخال مفتاح الترخيص الخاص بك للمتابعة"
        />

        <div style={{ padding: "24px" }}>
          {/* License Key Input */}
          <Field label="مفتاح الترخيص" required>
            <div style={{ display: "flex", gap: "8px" }}>
              <Input
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="أدخل مفتاح الترخيص هنا..."
                disabled={isValidating || isActivating}
                style={{ flex: 1 }}
                contentBefore={<Key20Regular />}
              />
            </div>
          </Field>

          {/* Optional Teacher Profile Toggle */}
          <div style={{ marginTop: "16px" }}>
            <Button
              appearance="subtle"
              onClick={() => setShowProfileForm(!showProfileForm)}
              disabled={isValidating || isActivating}
            >
              {showProfileForm ? "إخفاء" : "إضافة"} المعلومات الشخصية (اختياري)
            </Button>
          </div>

          {/* Teacher Profile Form */}
          {showProfileForm && (
            <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
              <Text weight="semibold" style={{ marginBottom: "12px" }}>
                المعلومات الشخصية
              </Text>

              <div style={{ display: "grid", gap: "12px" }}>
                <Field label="رقم بطاقة التعريف الوطنية">
                  <Input
                    value={teacherProfile.cin || ""}
                    onChange={(e) => setTeacherProfile((prev) => ({ ...prev, cin: e.target.value }))}
                    placeholder="CB123456"
                  />
                </Field>

                <Field label="رقم الهاتف">
                  <Input
                    value={teacherProfile.phone || ""}
                    onChange={(e) => setTeacherProfile((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+212612345678"
                  />
                </Field>

                <Field label="المستوى التعليمي">
                  <Select
                    value={teacherProfile.level || ""}
                    onChange={(e) =>
                      setTeacherProfile((prev) => ({ ...prev, level: e.target.value as "الإعدادي" | "الثانوي" }))
                    }
                  >
                    <option value="">اختر المستوى</option>
                    <option value="الإعدادي">الإعدادي</option>
                    <option value="الثانوي">الثانوي</option>
                  </Select>
                </Field>

                <Field label="المادة المدرسة">
                  <Input
                    value={teacherProfile.subject || ""}
                    onChange={(e) => setTeacherProfile((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="الرياضيات، الفيزياء، العربية..."
                  />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="عدد الأقسام">
                    <Input
                      type="number"
                      value={teacherProfile.classesCount?.toString() || ""}
                      onChange={(e) =>
                        setTeacherProfile((prev) => ({ ...prev, classesCount: parseInt(e.target.value) || undefined }))
                      }
                      placeholder="6"
                    />
                  </Field>

                  <Field label="الاختبارات لكل دورة">
                    <Input
                      type="number"
                      value={teacherProfile.testsPerTerm?.toString() || ""}
                      onChange={(e) =>
                        setTeacherProfile((prev) => ({ ...prev, testsPerTerm: parseInt(e.target.value) || undefined }))
                      }
                      placeholder="4"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Validation Result */}
          {validationResult && (
            <div style={{ marginTop: "16px" }}>
              <MessageBar intent={validationResult.valid ? "success" : "error"} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {validationResult.valid ? (
                    <CheckmarkCircle20Filled color="green" />
                  ) : (
                    <ErrorCircle20Filled color="red" />
                  )}
                  <Text>{validationResult.message}</Text>
                </div>
              </MessageBar>

              {validationResult.valid && renderLicenseInfo()}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <Button
              appearance="primary"
              onClick={handleValidateLicense}
              disabled={isValidating || isActivating || validationResult?.valid}
              style={{ flex: 1 }}
            >
              {isValidating || isActivating ? (
                <>
                  <Spinner size="tiny" />
                  جاري التحقق...
                </>
              ) : validationResult?.valid ? (
                "تم التفعيل بنجاح"
              ) : (
                "تفعيل الترخيص"
              )}
            </Button>

            {validationResult?.valid && (
              <Button appearance="subtle" onClick={handleRemoveLicense} disabled={isValidating || isActivating}>
                إلغاء
              </Button>
            )}
          </div>

          {/* Help Text */}
          <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f0f8ff", borderRadius: "6px" }}>
            <Text size={200}>
              💡 للحصول على مفتاح ترخيص، يرجى التواصل مع مطور التطبيق. سيتم إرسال المفتاح إليك عبر البريد الإلكتروني.
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LicenseActivation;
