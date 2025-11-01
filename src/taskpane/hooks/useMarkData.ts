import { useState } from "react";
import { Student, DetectedMarkTypes } from "../types";
import { Statistics } from "../types/statistics";
import { generateMarkStatistics } from "../utils/statistics";
import { computeExtractionAccuracy } from "../utils/accuracy";

interface UseMarkDataResult {
  extractedData: Student[] | null;
  detectedMarkTypes: DetectedMarkTypes;
  markStats: Statistics | null;
  extractionAccuracy: number | null;
  setExtractedStudents: (students: Student[], markTypes: DetectedMarkTypes) => void;
  updateStudentData: (updatedData: Student[]) => void;
  resetData: () => void;
}

export const useMarkData = (): UseMarkDataResult => {
  const [extractedData, setExtractedData] = useState<Student[] | null>(null);
  const [detectedMarkTypes, setDetectedMarkTypes] = useState<DetectedMarkTypes>({
    hasFard1: false,
    hasFard2: false,
    hasFard3: false,
    hasFard4: false,
    hasActivities: false,
  });
  const [markStats, setMarkStats] = useState<Statistics | null>(null);
  const [extractionAccuracy, setExtractionAccuracy] = useState<number | null>(null);

  const setExtractedStudents = (students: Student[], markTypes: DetectedMarkTypes) => {
    setExtractedData(students);
    setDetectedMarkTypes(markTypes);

    // Calculate statistics
    const stats = generateMarkStatistics(students, markTypes);
    setMarkStats(stats);

    // Estimate extraction accuracy
    const accuracy = computeExtractionAccuracy(students, markTypes);
    setExtractionAccuracy(accuracy);
  };

  const updateStudentData = (updatedData: Student[]) => {
    setExtractedData(updatedData);
    const stats = generateMarkStatistics(updatedData, detectedMarkTypes);
    setMarkStats(stats);
    const accuracy = computeExtractionAccuracy(updatedData, detectedMarkTypes);
    setExtractionAccuracy(accuracy);
  };

  const resetData = () => {
    setExtractedData(null);
    setDetectedMarkTypes({
      hasFard1: false,
      hasFard2: false,
      hasFard3: false,
      hasFard4: false,
      hasActivities: false,
    });
    setMarkStats(null);
    setExtractionAccuracy(null);
  };

  return {
    extractedData,
    detectedMarkTypes,
    markStats,
    extractionAccuracy,
    setExtractedStudents,
    updateStudentData,
    resetData,
  };
};

