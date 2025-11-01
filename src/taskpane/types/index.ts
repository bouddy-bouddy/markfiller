import React from "react";

export interface StudentMarks {
  fard1: number | null;
  fard2: number | null;
  fard3: number | null;
  fard4: number | null;
  activities: number | null;
  [key: string]: number | null; // To allow dynamic access
}

/**
 * Represents a student with their marks
 */
export interface Student {
  number: number;
  name: string;
  marks: StudentMarks;
  /** Optional OCR uncertainty flags for this student */
  uncertain?: StudentUncertainty;
}

/**
 * Type for mark type selection
 */
export type MarkType = "fard1" | "fard2" | "fard3" | "fard4" | "activities";

/**
 * Represents the display name of a mark type in Arabic
 */
export const markTypeNames: Record<MarkType, string> = {
  fard1: "الفرض الأول",
  fard2: "الفرض الثاني",
  fard3: "الفرض الثالث",
  fard4: "الفرض الرابع",
  activities: "الأنشطة",
};

/**
 * Per-student OCR uncertainty flags. When a mark is flagged true, the UI can highlight it for review.
 * Note: Avoids referencing MarkType here to keep declaration order simple.
 */
export interface StudentUncertainty {
  name?: boolean;
  marks: {
    fard1?: boolean;
    fard2?: boolean;
    fard3?: boolean;
    fard4?: boolean;
    activities?: boolean;
    [key: string]: boolean | undefined;
  };
}

/**
 * Detected mark types from OCR
 */
export interface DetectedMarkTypes {
  hasFard1: boolean;
  hasFard2: boolean;
  hasFard3: boolean;
  hasFard4: boolean;
  hasActivities: boolean;
}

/**
 * Excel file validation status
 */
export interface ExcelStatus {
  isValid: boolean;
  checked: boolean;
  message?: string;
}

/**
 * Excel worksheet structure
 */
export interface WorksheetStructure {
  headers: string[];
  studentNameColumn: number;
  totalRows: number;
  markColumns: Record<MarkType, number>;
}

/**
 * Intelligently recognized excel structure
 * Provides more details about the Excel file structure
 */
export interface IntelligentWorksheetStructure extends WorksheetStructure {
  // For each detected mark column, the confidence level (0-1)
  markColumnsConfidence: Record<MarkType, number>;
  // Student ID column if available
  studentIdColumn: number;
  // Additional mark columns that were detected but not mapped to standard types
  additionalMarkColumns: Array<{
    index: number;
    header: string;
  }>;
}

/**
 * Results of inserting marks into Excel
 */
export interface MarkInsertionResults {
  success: number;
  notFound: number;
  notFoundStudents: string[];
}

/**
 * Alert type for status messages
 */
export type AlertType = "error" | "warning" | "info" | "success";

/**
 * Application steps
 */
export enum AppStep {
  FileAnalysis = 1,
  ImageProcessing = 2,
  ReviewConfirm = 3,
  MappingPreview = 4,
  Statistics = 5,
}

/**
 * Props for the Step component
 */
export interface StepProps {
  number: number;
  title: string;
  description?: string;
  isActive: boolean;
  isCompleted: boolean;
  children: React.ReactNode;
}

/**
 * Valid ranges for different mark types (for contextual validation)
 */
export interface MarkValidRanges {
  fard1?: { min: number; max: number };
  fard2?: { min: number; max: number };
  fard3?: { min: number; max: number };
  fard4?: { min: number; max: number };
  activities?: { min: number; max: number };
}

export interface UsageCheckResponse {
  allowed: boolean;
  reason?: string;
  uploadCount: number;
  uploadLimit: number;
  remainingUploads?: number;
  usagePercentage?: number;
  status: string;
}

/**
 * Usage tracking response after recording an upload
 */
export interface UsageTrackResponse {
  success: boolean;
  error?: string;
  blocked?: boolean;
  uploadCount: number;
  uploadLimit: number;
  remainingUploads: number;
  usagePercentage: number;
  suspended: boolean;
  warning?: string;
}
