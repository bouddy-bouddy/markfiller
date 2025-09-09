import { DetectedMarkTypes, MarkType, Student } from "../types";

/**
 * Compute a heuristic extraction accuracy percentage (0-100)
 * based on how complete and valid the extracted marks are, and basic name presence.
 * - Completeness/validity of marks contributes 90%
 * - Presence of non-empty student names contributes 10%
 */
export function computeExtractionAccuracy(students: Student[], detectedMarkTypes: DetectedMarkTypes): number {
  if (!students || students.length === 0) return 0;

  const activeTypes: MarkType[] = [];
  if (detectedMarkTypes.hasFard1) activeTypes.push("fard1");
  if (detectedMarkTypes.hasFard2) activeTypes.push("fard2");
  if (detectedMarkTypes.hasFard3) activeTypes.push("fard3");
  if (detectedMarkTypes.hasFard4) activeTypes.push("fard4");
  if (detectedMarkTypes.hasActivities) activeTypes.push("activities");

  const totalExpectedMarks = students.length * activeTypes.length;
  if (totalExpectedMarks === 0) {
    // If no mark types detected, fall back to name presence
    const namesPresent = students.filter((s) => isValidName(s.name)).length;
    return Math.round((namesPresent / students.length) * 100);
  }

  let validMarksCount = 0;
  for (const student of students) {
    for (const type of activeTypes) {
      const value = student.marks[type];
      if (value !== null && typeof value === "number" && value >= 0 && value <= 20) {
        validMarksCount++;
      }
    }
  }

  const marksCompleteness = validMarksCount / totalExpectedMarks; // 0..1
  const namesPresent = students.filter((s) => isValidName(s.name)).length;
  const namesPresenceRatio = namesPresent / students.length; // 0..1

  const weighted = 0.9 * marksCompleteness + 0.1 * namesPresenceRatio;
  const percentage = Math.max(0, Math.min(1, weighted)) * 100;
  return Math.round(percentage);
}

function isValidName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Basic check: contains at least one letter (Arabic or Latin)
  return /[\p{L}]/u.test(trimmed);
}
