import { MarkType } from "../types";

export const MARK_TYPE_NAMES: Record<MarkType, string> = {
  fard1: "الفرض الأول",
  fard2: "الفرض الثاني",
  fard3: "الفرض الثالث",
  fard4: "الفرض الرابع",
  activities: "الأنشطة",
};

export const MARK_TYPE_COLORS: Record<MarkType, string> = {
  fard1: "#3182ce",
  fard2: "#38a169",
  fard3: "#805ad5",
  fard4: "#d53f8c",
  activities: "#dd6b20",
};

export const getMarkTypeName = (type: MarkType): string => {
  return MARK_TYPE_NAMES[type] || type;
};

export const getMarkTypeColor = (type: MarkType): string => {
  return MARK_TYPE_COLORS[type] || "#718096";
};

export const formatNumber = (num: number): string => {
  return num.toFixed(2);
};

export const getScoreColor = (score: number): string => {
  if (score >= 16) return "linear-gradient(135deg, #10b981 0%, #059669 100%)";
  if (score >= 14) return "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
  if (score >= 10) return "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
  return "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
};

export const getRankColor = (rank: number): string => {
  switch (rank) {
    case 1:
      return "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)";
    case 2:
      return "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)";
    case 3:
      return "linear-gradient(135deg, #cd7c0f 0%, #92400e 100%)";
    default:
      return "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)";
  }
};
