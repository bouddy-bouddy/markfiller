import { useState, useCallback, useRef, useEffect } from "react";
import { Student, DetectedMarkTypes } from "../types";
import { Statistics } from "../types/statistics";
import { generateMarkStatistics } from "../utils/statistics";
import { computeExtractionAccuracy } from "../utils/accuracy";

/**
 * Optimized useMarkData Hook
 * Features: debounced statistics, useCallback optimizations, efficient updates
 */

interface UseMarkDataResult {
  extractedData: Student[] | null;
  detectedMarkTypes: DetectedMarkTypes;
  markStats: Statistics | null;
  extractionAccuracy: number | null;
  isCalculatingStats: boolean;
  setExtractedStudents: (students: Student[], markTypes: DetectedMarkTypes) => void;
  updateStudentData: (updatedData: Student[]) => void;
  resetData: () => void;
}

// Debounce delay for statistics calculation (milliseconds)
const STATS_DEBOUNCE_DELAY = 300;

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
  const [isCalculatingStats, setIsCalculatingStats] = useState(false);

  // Refs for debouncing
  const statsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCalculationRef = useRef<{ students: Student[]; markTypes: DetectedMarkTypes } | null>(null);

  /**
   * Debounced statistics calculation
   */
  const calculateStatsDebounced = useCallback((students: Student[], markTypes: DetectedMarkTypes) => {
    // Clear existing timer
    if (statsTimerRef.current) {
      clearTimeout(statsTimerRef.current);
    }

    // Store pending calculation
    pendingCalculationRef.current = { students, markTypes };
    setIsCalculatingStats(true);

    // Schedule new calculation
    statsTimerRef.current = setTimeout(() => {
      const pending = pendingCalculationRef.current;
      if (pending) {
        try {
          // Calculate statistics
          const stats = generateMarkStatistics(pending.students, pending.markTypes);
          setMarkStats(stats);

          // Estimate extraction accuracy
          const accuracy = computeExtractionAccuracy(pending.students, pending.markTypes);
          setExtractionAccuracy(accuracy);
        } finally {
          setIsCalculatingStats(false);
          pendingCalculationRef.current = null;
        }
      }
    }, STATS_DEBOUNCE_DELAY);
  }, []);

  /**
   * Set extracted students with debounced statistics calculation
   */
  const setExtractedStudents = useCallback((students: Student[], markTypes: DetectedMarkTypes) => {
    setExtractedData(students);
    setDetectedMarkTypes(markTypes);
    calculateStatsDebounced(students, markTypes);
  }, [calculateStatsDebounced]);

  /**
   * Update student data with debounced statistics calculation
   */
  const updateStudentData = useCallback((updatedData: Student[]) => {
    setExtractedData(updatedData);
    // Use current detectedMarkTypes from state
    calculateStatsDebounced(updatedData, detectedMarkTypes);
  }, [calculateStatsDebounced, detectedMarkTypes]);

  /**
   * Reset all data and clear pending calculations
   */
  const resetData = useCallback(() => {
    // Clear pending timers
    if (statsTimerRef.current) {
      clearTimeout(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    pendingCalculationRef.current = null;

    // Reset state
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
    setIsCalculatingStats(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsTimerRef.current) {
        clearTimeout(statsTimerRef.current);
      }
    };
  }, []);

  return {
    extractedData,
    detectedMarkTypes,
    markStats,
    extractionAccuracy,
    isCalculatingStats,
    setExtractedStudents,
    updateStudentData,
    resetData,
  };
};

