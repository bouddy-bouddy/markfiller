import { MarkType } from ".";

export interface MarkTypeStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  median?: number;
  stdDev?: number;
  passCount?: number;
  failCount?: number;
  missingCount?: number;
}
export interface MarkDistribution {
  "0-5": number;
  "5-10": number;
  "10-15": number;
  "15-20": number;
}

export interface Statistics {
  totalStudents: number;
  markTypes: Record<MarkType, MarkTypeStats>;
  distribution: Record<MarkType, MarkDistribution>;
  topStudentsByType?: Record<
    MarkType,
    Array<{
      name: string;
      value: number;
    }>
  >;
  bottomStudentsByType?: Record<
    MarkType,
    Array<{
      name: string;
      value: number;
    }>
  >;
  outliersByType?: Record<
    MarkType,
    {
      high: Array<{ name: string; value: number }>;
      low: Array<{ name: string; value: number }>;
    }
  >;
  overall?: {
    overallAverage: number;
    overallMedian: number;
    overallStdDev: number;
    passRate: number; // 0..1
    failRate: number; // 0..1
    missingRate: number; // 0..1
    totalMarksCounted: number;
  };
  recommendations?: string[];
  mastery?: {
    masteredPct: number; // المتحكمون
    inProgressPct: number; // في طور التحكم
    notMasteredPct: number; // غير متحكمين
    masteredCount: number;
    inProgressCount: number;
    notMasteredCount: number;
  };
}
