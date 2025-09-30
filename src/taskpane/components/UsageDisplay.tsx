import React, { useEffect, useState } from "react";
import { checkUploadAllowed } from "../services/usageTracker";
import { UsageCheckResponse } from "../types";

interface UsageDisplayProps {
  licenseKey: string;
}

export const UsageDisplay: React.FC<UsageDisplayProps> = ({ licenseKey }) => {
  const [usage, setUsage] = useState<UsageCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();

    // Refresh every 2 minutes
    const interval = setInterval(loadUsage, 120000);
    return () => clearInterval(interval);
  }, [licenseKey]);

  const loadUsage = async () => {
    try {
      const data = await checkUploadAllowed(licenseKey);
      setUsage(data);
    } catch (error) {
      console.error("Failed to load usage:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage) return null;

  const percentage = usage.usagePercentage || 0;
  const getColor = () => {
    if (percentage >= 90) return "#f44336";
    if (percentage >= 70) return "#ff9800";
    return "#4caf50";
  };

  return (
    <div
      style={{
        padding: "12px",
        background: "#f5f5f5",
        borderRadius: "6px",
        margin: "10px 0",
        border: "1px solid #e0e0e0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
          fontSize: "13px",
        }}
      >
        <span style={{ fontWeight: "600", color: "#333" }}>الاستخدام</span>
        <span style={{ fontWeight: "600", color: getColor() }}>
          {usage.uploadCount} / {usage.uploadLimit}
        </span>
      </div>

      <div
        style={{
          height: "6px",
          background: "#e0e0e0",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: getColor(),
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "11px",
          color: "#666",
          textAlign: "right",
        }}
      >
        متبقي: {usage.remainingUploads} عملية رفع
      </div>

      {percentage >= 90 && (
        <div
          style={{
            marginTop: "8px",
            padding: "6px 8px",
            background: "#fff3cd",
            borderRight: "3px solid #ffc107",
            fontSize: "11px",
            borderRadius: "4px",
          }}
        >
          ⚠️ تحذير: أنت على وشك استنفاذ رصيدك!
        </div>
      )}

      {usage.status === "suspended" && (
        <div
          style={{
            marginTop: "8px",
            padding: "6px 8px",
            background: "#ffebee",
            borderRight: "3px solid #f44336",
            fontSize: "11px",
            fontWeight: "600",
            borderRadius: "4px",
          }}
        >
          🚫 الترخيص معلق - تواصل مع الدعم
        </div>
      )}
    </div>
  );
};
