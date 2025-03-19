// OCR Edge Cases Handler - Helper functions to handle various edge cases and improve OCR accuracy
import { Student, DetectedMarkTypes } from "../types";

/**
 * Utility class to handle OCR edge cases and improve accuracy
 */
export class OCREdgeCasesHandler {
  /**
   * Handle common OCR misinterpretations and fix student names
   * @param students Array of extracted students
   * @returns Array of students with corrected names
   */
  static fixStudentNames(students: Student[]): Student[] {
    return students.map((student) => {
      let correctedName = student.name;

      // Fix common OCR errors in Arabic names
      correctedName = this.fixArabicNameOCRErrors(correctedName);

      // Fix letter case and spacing issues
      correctedName = this.normalizeNameSpacing(correctedName);

      return {
        ...student,
        name: correctedName,
      };
    });
  }

  /**
   * Fix common OCR errors in Arabic names
   */
  private static fixArabicNameOCRErrors(name: string): string {
    // Handle common OCR confusions in Arabic
    return (
      name
        // Fix common letter confusions
        .replace(/ة ([ا-ي])/g, "ة$1") // Fix taa marbouta spacing
        .replace(/([ا-ي]) و ([ا-ي])/g, "$1و$2") // Fix incorrect spaces around 'waw'
        .replace(/([ا-ي])1([ا-ي])/g, "$1ا$2") // Fix '1' mistaken for 'alif'
        .replace(/([ا-ي])5([ا-ي])/g, "$1ه$2") // Fix '5' mistaken for 'haa'
        .replace(/([ا-ي])V([ا-ي])/g, "$1ل$2") // Fix 'V' mistaken for 'lam'
        .replace(/([ا-ي])A([ا-ي])/g, "$1ع$2") // Fix 'A' mistaken for 'ayn'
        // Remove non-Arabic characters that might appear in names
        .replace(/[a-zA-Z0-9]/g, "")
        // Fix multiple spaces
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /**
   * Normalize name spacing and format
   */
  private static normalizeNameSpacing(name: string): string {
    return (
      name
        // Ensure spaces after commas
        .replace(/,([^ ])/g, ", $1")
        // Fix spacing around hyphenated names
        .replace(/([^ ])-([^ ])/g, "$1 - $2")
        // Fix double spaces
        .replace(/\s{2,}/g, " ")
        .trim()
    );
  }

  /**
   * Fix common OCR errors in marks
   * @param students Array of extracted students
   * @returns Array of students with corrected marks
   */
  static fixMarksOCRErrors(students: Student[]): Student[] {
    return students.map((student) => {
      const correctedMarks = { ...student.marks };

      // Fix each mark type
      for (const markType of ["fard1", "fard2", "fard3", "activities"] as Array<keyof typeof correctedMarks>) {
        const mark = correctedMarks[markType];
        if (mark !== null) {
          // Fix common OCR errors in marks
          correctedMarks[markType] = this.fixMarkValue(mark);
        }
      }

      return {
        ...student,
        marks: correctedMarks,
      };
    });
  }

  /**
   * Fix common OCR errors in mark values
   */
  private static fixMarkValue(mark: number): number {
    // Handle common OCR errors in digit recognition

    // If mark is above max possible value (20), it might be a misreading
    if (mark > 20) {
      // Check if it might be a decimal point issue
      if (mark > 100 && mark <= 200) {
        // Likely reading 15.5 as 155
        return mark / 10;
      } else {
        // Cap at maximum valid value
        return 20;
      }
    }

    // If mark is an impossible fraction (e.g., 12.57), round to valid precision
    return parseFloat(mark.toFixed(2));
  }

  /**
   * Apply statistical validation to marks to identify and correct outliers
   * @param students Array of extracted students
   * @returns Array of students with validated marks
   */
  static validateMarksStatistically(students: Student[]): Student[] {
    if (students.length < 3) {
      // Not enough data for statistical validation
      return students;
    }

    // Calculate statistics for each mark type
    const stats = this.calculateMarkStatistics(students);

    // Validate each student's marks using statistics
    return students.map((student) => {
      const validatedMarks = { ...student.marks };

      for (const markType of ["fard1", "fard2", "fard3", "activities"] as Array<keyof typeof validatedMarks>) {
        const mark = validatedMarks[markType];
        if (mark !== null && stats[markType].count >= 3) {
          // Calculate z-score to identify outliers
          const zScore = Math.abs((mark - stats[markType].average) / stats[markType].stdDev);

          // If extreme outlier (z-score > 3), adjust or nullify
          if (zScore > 3) {
            if (mark < 3 && stats[markType].average > 10) {
              // Likely a decimal point issue (e.g., 1.5 instead of 15)
              validatedMarks[markType] = mark * 10 > 20 ? 20 : mark * 10;
            } else if (mark > 18 && stats[markType].average < 10) {
              // Likely a decimal point issue (e.g., 19 instead of 1.9)
              validatedMarks[markType] = mark / 10;
            }
            // Extreme outliers that can't be fixed are left as is for teacher review
          }
        }
      }

      return {
        ...student,
        marks: validatedMarks,
      };
    });
  }

  /**
   * Calculate statistics for each mark type
   */
  private static calculateMarkStatistics(students: Student[]): Record<
    string,
    {
      count: number;
      min: number;
      max: number;
      average: number;
      stdDev: number;
    }
  > {
    const stats: Record<string, any> = {
      fard1: { count: 0, sum: 0, values: [] },
      fard2: { count: 0, sum: 0, values: [] },
      fard3: { count: 0, sum: 0, values: [] },
      activities: { count: 0, sum: 0, values: [] },
    };

    // Gather mark values
    for (const student of students) {
      for (const markType of ["fard1", "fard2", "fard3", "activities"] as Array<keyof typeof student.marks>) {
        const mark = student.marks[markType];
        if (mark !== null) {
          stats[markType].count++;
          stats[markType].sum += mark;
          stats[markType].values.push(mark);
        }
      }
    }

    // Calculate statistics
    for (const markType of Object.keys(stats)) {
      if (stats[markType].count > 0) {
        // Calculate average
        stats[markType].average = stats[markType].sum / stats[markType].count;

        // Calculate min and max
        stats[markType].min = Math.min(...stats[markType].values);
        stats[markType].max = Math.max(...stats[markType].values);

        // Calculate standard deviation
        let sumSquaredDiffs = 0;
        for (const value of stats[markType].values) {
          sumSquaredDiffs += Math.pow(value - stats[markType].average, 2);
        }
        stats[markType].stdDev = Math.sqrt(sumSquaredDiffs / stats[markType].count);
      } else {
        stats[markType].average = 0;
        stats[markType].min = 0;
        stats[markType].max = 0;
        stats[markType].stdDev = 0;
      }

      // Remove values array as it's no longer needed
      delete stats[markType].values;
      delete stats[markType].sum;
    }

    return stats;
  }

  /**
   * Enhance detection of mark types based on column patterns and distributions
   * @param students Extracted students
   * @param detectedMarkTypes Initially detected mark types
   * @returns Updated detected mark types
   */
  static enhanceMarkTypeDetection(students: Student[], detectedMarkTypes: DetectedMarkTypes): DetectedMarkTypes {
    // Copy to avoid modifying the original
    const enhancedDetection = { ...detectedMarkTypes };

    // Count present values for each mark type
    const counts = {
      fard1: students.filter((s) => s.marks.fard1 !== null).length,
      fard2: students.filter((s) => s.marks.fard2 !== null).length,
      fard3: students.filter((s) => s.marks.fard3 !== null).length,
      activities: students.filter((s) => s.marks.activities !== null).length,
    };

    // Calculate statistics for each mark type for additional verification
    const stats = this.calculateMarkStatistics(students);

    // Enhance detection based on counts and statistics
    if (counts.fard1 >= students.length * 0.5) {
      enhancedDetection.hasFard1 = true;
    }

    if (counts.fard2 >= students.length * 0.5) {
      enhancedDetection.hasFard2 = true;
    }

    if (counts.fard3 >= students.length * 0.5) {
      enhancedDetection.hasFard3 = true;
    }

    if (counts.activities >= students.length * 0.5) {
      enhancedDetection.hasActivities = true;
    }

    // Use statistical signature to identify activities column
    // Activities typically have higher averages than tests
    const markTypes = ["fard1", "fard2", "fard3", "activities"] as const;

    if (counts.activities > 0 && stats.activities.average > 0) {
      // If activities have significantly higher average than other marks
      // and are not already detected, they might be activities
      const otherAverages = [stats.fard1.average, stats.fard2.average, stats.fard3.average].filter((avg) => avg > 0);

      const avgOtherMarks =
        otherAverages.length > 0 ? otherAverages.reduce((sum, val) => sum + val, 0) / otherAverages.length : 0;

      if (stats.activities.average > avgOtherMarks + 3) {
        enhancedDetection.hasActivities = true;
      }
    }

    // Check for fard1,2,3 pattern (if two are detected, third likely exists)
    if (enhancedDetection.hasFard1 && enhancedDetection.hasFard2 && !enhancedDetection.hasFard3 && counts.fard3 > 0) {
      enhancedDetection.hasFard3 = true;
    }

    // If none detected but we have marks, assume at least one type
    const hasAnyDetected =
      enhancedDetection.hasFard1 ||
      enhancedDetection.hasFard2 ||
      enhancedDetection.hasFard3 ||
      enhancedDetection.hasActivities;

    if (!hasAnyDetected) {
      // Find the mark type with the most values
      const maxCount = Math.max(counts.fard1, counts.fard2, counts.fard3, counts.activities);

      if (maxCount > 0) {
        if (counts.fard1 === maxCount) enhancedDetection.hasFard1 = true;
        else if (counts.fard2 === maxCount) enhancedDetection.hasFard2 = true;
        else if (counts.fard3 === maxCount) enhancedDetection.hasFard3 = true;
        else if (counts.activities === maxCount) enhancedDetection.hasActivities = true;
      }
    }

    return enhancedDetection;
  }

  /**
   * Handle document structure variations by analyzing patterns in the data
   * @param students Extracted students
   * @returns Potentially reorganized students based on document structure
   */
  static handleDocumentStructureVariations(students: Student[]): Student[] {
    if (students.length < 3) {
      return students;
    }

    // Check if marks appear to be in wrong columns
    const markCounts = {
      fard1: students.filter((s) => s.marks.fard1 !== null).length,
      fard2: students.filter((s) => s.marks.fard2 !== null).length,
      fard3: students.filter((s) => s.marks.fard3 !== null).length,
      activities: students.filter((s) => s.marks.activities !== null).length,
    };

    // If there's a stark imbalance, columns might be wrongly assigned
    const maxCount = Math.max(...Object.values(markCounts));
    const nonZeroCounts = Object.values(markCounts).filter((c) => c > 0);

    if (nonZeroCounts.length > 1 && maxCount >= students.length * 0.8) {
      // Check if one column has most of the marks and other columns are mostly empty
      const columnsWithFewMarks = Object.entries(markCounts)
        .filter(([_, count]) => count > 0 && count < students.length * 0.2)
        .map(([type]) => type as keyof typeof markCounts);

      const columnWithMostMarks = Object.entries(markCounts).find(
        ([_, count]) => count === maxCount
      )?.[0] as keyof typeof markCounts;

      // If we have a clear imbalance, reorganize
      if (columnsWithFewMarks.length > 0 && columnWithMostMarks) {
        return students.map((student) => {
          const reorganizedMarks = { ...student.marks };

          // Move marks from the column with most marks to the appropriate columns
          if (student.marks[columnWithMostMarks] !== null) {
            // Distribute based on a heuristic (e.g., first mark to fard1, etc.)
            // This is a simplified approach; more complex logic could be implemented
            const sourceValue = student.marks[columnWithMostMarks];
            reorganizedMarks[columnWithMostMarks] = null;

            if (columnsWithFewMarks.includes("fard1")) {
              reorganizedMarks.fard1 = sourceValue;
            } else if (columnsWithFewMarks.includes("fard2")) {
              reorganizedMarks.fard2 = sourceValue;
            } else if (columnsWithFewMarks.includes("fard3")) {
              reorganizedMarks.fard3 = sourceValue;
            } else if (columnsWithFewMarks.includes("activities")) {
              reorganizedMarks.activities = sourceValue;
            }
          }

          return {
            ...student,
            marks: reorganizedMarks,
          };
        });
      }
    }

    return students;
  }

  /**
   * Apply all edge case handlers to improve extracted data
   * @param students Extracted students
   * @param detectedMarkTypes Initially detected mark types
   * @returns Enhanced data with improved accuracy
   */
  static enhanceExtractedData(
    students: Student[],
    detectedMarkTypes: DetectedMarkTypes
  ): { students: Student[]; detectedMarkTypes: DetectedMarkTypes } {
    // Apply corrections in sequence
    let enhancedStudents = [...students];

    // Fix student names
    enhancedStudents = this.fixStudentNames(enhancedStudents);

    // Fix mark values
    enhancedStudents = this.fixMarksOCRErrors(enhancedStudents);

    // Validate marks statistically
    enhancedStudents = this.validateMarksStatistically(enhancedStudents);

    // Handle document structure variations
    enhancedStudents = this.handleDocumentStructureVariations(enhancedStudents);

    // Enhance mark type detection
    const enhancedMarkTypes = this.enhanceMarkTypeDetection(enhancedStudents, detectedMarkTypes);

    return {
      students: enhancedStudents,
      detectedMarkTypes: enhancedMarkTypes,
    };
  }

  /**
   * Remove duplicate students that might occur due to OCR errors
   * @param students Array of extracted students
   * @returns Array of students with duplicates removed
   */
  static removeDuplicates(students: Student[]): Student[] {
    const uniqueStudents: Student[] = [];
    const processedNames = new Set<string>();

    for (const student of students) {
      // Normalize name for comparison
      const normalizedName = this.normalizeNameForComparison(student.name);

      // Check if we've already processed this name
      if (!processedNames.has(normalizedName)) {
        uniqueStudents.push(student);
        processedNames.add(normalizedName);
      } else {
        // If this is a duplicate, find the original and merge any missing marks
        const existingIndex = uniqueStudents.findIndex(
          (s) => this.normalizeNameForComparison(s.name) === normalizedName
        );

        if (existingIndex !== -1) {
          const existingStudent = uniqueStudents[existingIndex];

          // Merge marks, keeping existing values if present
          const mergedMarks = {
            fard1: existingStudent.marks.fard1 !== null ? existingStudent.marks.fard1 : student.marks.fard1,
            fard2: existingStudent.marks.fard2 !== null ? existingStudent.marks.fard2 : student.marks.fard2,
            fard3: existingStudent.marks.fard3 !== null ? existingStudent.marks.fard3 : student.marks.fard3,
            activities:
              existingStudent.marks.activities !== null ? existingStudent.marks.activities : student.marks.activities,
          };

          uniqueStudents[existingIndex] = {
            ...existingStudent,
            marks: mergedMarks,
          };
        }
      }
    }

    return uniqueStudents;
  }

  /**
   * Normalize a name for comparison purposes
   */
  private static normalizeNameForComparison(name: string): string {
    return name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[أإآا]/g, "ا") // Normalize alif variants
      .replace(/[ةه]/g, "ه") // Normalize taa marbouta and haa
      .replace(/[ىيی]/g, "ي") // Normalize yaa variants
      .replace(/\s+/g, " ") // Normalize spaces
      .toLowerCase()
      .trim();
  }
}

export default OCREdgeCasesHandler;
