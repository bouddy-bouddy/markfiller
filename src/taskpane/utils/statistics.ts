import { DetectedMarkTypes, MarkType, Student } from "../types";
import { Statistics } from "../types/statistics";

export function generateMarkStatistics(students: Student[], types: DetectedMarkTypes): Statistics {
  const stats: Statistics = {
    totalStudents: students.length,
    markTypes: {
      fard1: {
        count: 0,
        sum: 0,
        min: 20,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        passCount: 0,
        failCount: 0,
        missingCount: 0,
      },
      fard2: {
        count: 0,
        sum: 0,
        min: 20,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        passCount: 0,
        failCount: 0,
        missingCount: 0,
      },
      fard3: {
        count: 0,
        sum: 0,
        min: 20,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        passCount: 0,
        failCount: 0,
        missingCount: 0,
      },
      fard4: {
        count: 0,
        sum: 0,
        min: 20,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        passCount: 0,
        failCount: 0,
        missingCount: 0,
      },
      activities: {
        count: 0,
        sum: 0,
        min: 20,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        passCount: 0,
        failCount: 0,
        missingCount: 0,
      },
    },
    distribution: {
      fard1: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
      fard2: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
      fard3: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
      fard4: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
      activities: { "0-5": 0, "5-10": 0, "10-15": 0, "15-20": 0 },
    },
    topStudentsByType: {
      fard1: [],
      fard2: [],
      fard3: [],
      fard4: [],
      activities: [],
    },
    bottomStudentsByType: {
      fard1: [],
      fard2: [],
      fard3: [],
      fard4: [],
      activities: [],
    },
    outliersByType: {
      fard1: { high: [], low: [] },
      fard2: { high: [], low: [] },
      fard3: { high: [], low: [] },
      fard4: { high: [], low: [] },
      activities: { high: [], low: [] },
    },
    overall: {
      overallAverage: 0,
      overallMedian: 0,
      overallStdDev: 0,
      passRate: 0,
      failRate: 0,
      missingRate: 0,
      totalMarksCounted: 0,
    },
    recommendations: [],
  };

  const isTypeDetected = (type: MarkType): boolean => {
    switch (type) {
      case "fard1":
        return types.hasFard1;
      case "fard2":
        return types.hasFard2;
      case "fard3":
        return types.hasFard3;
      case "fard4":
        return types.hasFard4;
      case "activities":
        return types.hasActivities;
      default:
        return false;
    }
  };

  students.forEach((student) => {
    Object.entries(student.marks).forEach(([key, value]) => {
      if (!(["fard1", "fard2", "fard3", "fard4", "activities"] as string[]).includes(key)) return;
      const markType = key as MarkType;
      if (!isTypeDetected(markType)) return;
      if (value !== null) {
        stats.markTypes[markType].count++;
        stats.markTypes[markType].sum += value;
        stats.markTypes[markType].min = Math.min(stats.markTypes[markType].min, value);
        stats.markTypes[markType].max = Math.max(stats.markTypes[markType].max, value);
        if (value >= 10) stats.markTypes[markType].passCount! += 1;
        else stats.markTypes[markType].failCount! += 1;
        (stats.topStudentsByType![markType] as Array<{ name: string; value: number }>).push({
          name: student.name,
          value,
        });

        if (value >= 0 && value < 5) stats.distribution[markType]["0-5"]++;
        else if (value >= 5 && value < 10) stats.distribution[markType]["5-10"]++;
        else if (value >= 10 && value < 15) stats.distribution[markType]["10-15"]++;
        else if (value >= 15 && value <= 20) stats.distribution[markType]["15-20"]++;
      } else {
        stats.markTypes[markType].missingCount! += 1;
      }
    });
  });

  (Object.keys(stats.markTypes) as MarkType[]).forEach((type) => {
    if (stats.markTypes[type].count > 0) {
      stats.markTypes[type].avg = stats.markTypes[type].sum / stats.markTypes[type].count;
    }
  });

  const overallValues: number[] = [];
  let totalMissing = 0;
  (Object.keys(stats.markTypes) as MarkType[]).forEach((type) => {
    if (!isTypeDetected(type)) return;
    const arr = (stats.topStudentsByType![type] as Array<{ name: string; value: number }>).map((s) => s.value);
    arr.sort((a, b) => a - b);
    if (arr.length > 0) {
      const mid = Math.floor(arr.length / 2);
      stats.markTypes[type].median = arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
      const mean = stats.markTypes[type].avg;
      const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
      stats.markTypes[type].stdDev = Math.sqrt(variance);

      const highThreshold = mean + 2 * (stats.markTypes[type].stdDev || 0);
      const lowThreshold = mean - 2 * (stats.markTypes[type].stdDev || 0);
      const sortedPairs = (stats.topStudentsByType![type] as Array<{ name: string; value: number }>).slice();
      stats.outliersByType![type].high = sortedPairs.filter((p) => p.value >= highThreshold);
      stats.outliersByType![type].low = sortedPairs.filter((p) => p.value <= lowThreshold);

      stats.bottomStudentsByType![type] = sortedPairs
        .slice()
        .sort((a, b) => a.value - b.value)
        .slice(0, 5);

      overallValues.push(...arr);
    } else {
      totalMissing += stats.markTypes[type].missingCount || 0;
    }
    stats.topStudentsByType![type] = (stats.topStudentsByType![type] as Array<{ name: string; value: number }>).sort(
      (a, b) => b.value - a.value
    );
  });

  overallValues.sort((a, b) => a - b);
  const overallCount = overallValues.length;
  if (overallCount > 0) {
    const mid = Math.floor(overallCount / 2);
    const overallMedian =
      overallCount % 2 !== 0 ? overallValues[mid] : (overallValues[mid - 1] + overallValues[mid]) / 2;
    const overallAverage = overallValues.reduce((s, v) => s + v, 0) / overallCount;
    const overallVariance = overallValues.reduce((s, v) => s + Math.pow(v - overallAverage, 2), 0) / overallCount;
    const overallStdDev = Math.sqrt(overallVariance);
    const pass = overallValues.filter((v) => v >= 10).length;
    stats.overall = {
      overallAverage,
      overallMedian,
      overallStdDev,
      passRate: pass / overallCount,
      failRate: 1 - pass / overallCount,
      missingRate: totalMissing / (overallCount + (totalMissing || 0) || 1),
      totalMarksCounted: overallCount,
    };
  }

  const classifyStudent = (studentMarks: Record<MarkType, number | null>): number | null => {
    const activeValues: number[] = [];
    (Object.keys(stats.markTypes) as MarkType[]).forEach((type) => {
      if (!isTypeDetected(type)) return;
      const v = studentMarks[type];
      if (typeof v === "number") activeValues.push(v);
    });
    if (activeValues.length === 0) return null;
    return activeValues.reduce((s, v) => s + v, 0) / activeValues.length;
  };

  let masteredCount = 0;
  let inProgressCount = 0;
  let notMasteredCount = 0;
  students.forEach((s) => {
    const avg = classifyStudent(s.marks as any);
    if (avg === null) {
      notMasteredCount += 1;
    } else if (avg >= 15) {
      masteredCount += 1;
    } else if (avg >= 10) {
      inProgressCount += 1;
    } else {
      notMasteredCount += 1;
    }
  });

  const total = students.length || 1;
  stats.mastery = {
    masteredPct: Math.round((masteredCount / total) * 100),
    inProgressPct: Math.round((inProgressCount / total) * 100),
    notMasteredPct: Math.round((notMasteredCount / total) * 100),
    masteredCount,
    inProgressCount,
    notMasteredCount,
  };

  const recs: string[] = [];
  if (stats.overall && (stats.overall.passRate || 0) < 0.6) {
    recs.push("نسبة النجاح العامة منخفضة. قد تحتاج لتقوية الدعم للتلاميذ ذوي النتائج الضعيفة.");
  }
  (Object.keys(stats.markTypes) as MarkType[]).forEach((type) => {
    if (!isTypeDetected(type)) return;
    const s = stats.markTypes[type];
    if (s.count > 0 && s.avg < 10) {
      const typeName =
        type === "fard1"
          ? "الفرض الأول"
          : type === "fard2"
            ? "الفرض الثاني"
            : type === "fard3"
              ? "الفرض الثالث"
              : type === "fard4"
                ? "الفرض الرابع"
                : type === "activities"
                  ? "الأنشطة"
                  : type;
      recs.push(`متوسط ${typeName} أقل من المعدل (10).`);
    }
    if ((s.stdDev || 0) > 4) {
      const typeName =
        type === "fard1"
          ? "الفرض الأول"
          : type === "fard2"
            ? "الفرض الثاني"
            : type === "fard3"
              ? "الفرض الثالث"
              : type === "fard4"
                ? "الفرض الرابع"
                : type === "activities"
                  ? "الأنشطة"
                  : type;
      recs.push(
        `تشتت عالٍ في ${typeName} (انحراف معياري ${(s.stdDev || 0).toFixed(2)}). قد توجد فوارق كبيرة بين التلاميذ.`
      );
    }
    if ((s.missingCount || 0) / (s.count + (s.missingCount || 0) || 1) > 0.1) {
      const typeName =
        type === "fard1"
          ? "الفرض الأول"
          : type === "fard2"
            ? "الفرض الثاني"
            : type === "fard3"
              ? "الفرض الثالث"
              : type === "fard4"
                ? "الفرض الرابع"
                : type === "activities"
                  ? "الأنشطة"
                  : type;
      recs.push(`نسبة القيم المفقودة مرتفعة في ${typeName}. تحقق من اكتمال الإدخال أو وضوح الصورة.`);
    }
  });
  stats.recommendations = recs;

  return stats;
}
