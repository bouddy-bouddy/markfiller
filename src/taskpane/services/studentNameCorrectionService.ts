import { Student } from "../types";

/**
 * Interface for student name correction results
 */
export interface NameCorrectionResult {
  originalName: string;
  correctedName: string;
  confidence: number;
  massarRowIndex: number;
}

/**
 * Interface for the complete correction process results
 */
export interface StudentNameCorrectionResults {
  correctedStudents: Student[];
  corrections: NameCorrectionResult[];
  totalCorrections: number;
  unmatchedStudents: string[];
}

/**
 * Service for correcting student names by comparing OCR results with Massar file data
 */
export class StudentNameCorrectionService {
  private massarStudentNames: string[] = [];
  private massarNameColumn: number = -1;

  /**
   * Initialize the service with Massar file data
   */
  async initializeFromMassarFile(): Promise<void> {
    try {
      console.log("🚀 Initializing student name correction service...");

      // Get the active worksheet
      const sheet = await this.getActiveWorksheet();
      const range = sheet.getUsedRange();
      range.load("values");

      await range.context.sync();

      console.log(
        "📊 Excel range loaded, dimensions:",
        range.values.length,
        "rows x",
        range.values[0]?.length,
        "columns"
      );

      // Find the student name column
      this.massarNameColumn = this.findStudentNameColumn(range.values);
      console.log("📍 Student name column found at index:", this.massarNameColumn);

      if (this.massarNameColumn === -1) {
        throw new Error("Could not find student name column in Massar file");
      }

      // Extract all student names from the Massar file
      this.massarStudentNames = this.extractStudentNamesFromMassar(range.values);

      console.log(`📚 Loaded ${this.massarStudentNames.length} student names from Massar file`);
      console.log("📝 Sample names:", this.massarStudentNames.slice(0, 10));

      if (this.massarStudentNames.length === 0) {
        console.warn("⚠️ No student names found in Massar file!");
        console.log("🔍 First few rows of data:", range.values.slice(0, 5));
      }
    } catch (error) {
      console.error("Error initializing student name correction service:", error);
      throw error;
    }
  }

  /**
   * Get the active worksheet
   */
  private async getActiveWorksheet(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        Excel.run(async (context) => {
          const sheet = context.workbook.worksheets.getActiveWorksheet();
          resolve(sheet);
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Find the student name column in the Massar file
   */
  private findStudentNameColumn(values: any[][]): number {
    if (!values || values.length === 0) return -1;

    console.log("🔍 Analyzing Excel data structure...");
    console.log("📊 Total rows:", values.length);
    console.log("📊 Total columns:", values[0]?.length);

    // Log all data for debugging
    for (let i = 0; i < Math.min(values.length, 5); i++) {
      console.log(`Row ${i}:`, values[i]);
    }

    // Try to find header row first (may not be the first row)
    let headerRowIndex = -1;
    const nameColumnIndicators = [
      "اسم التلميذ",
      "إسم التلميذ",
      "الاسم",
      "اسم الطالب",
      "إسم الطالب",
      "اسم",
      "الاسم الأول",
      "الاسم الكامل",
      "اسم العائلة",
      "التلميذ", // Just "التلميذ" part
      "الطالب", // Just "الطالب" part
    ];

    // Search for header row in first 10 rows
    for (let rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
      const row = values[rowIndex];
      if (!row) continue;

      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        if (cell && typeof cell === "string") {
          for (const indicator of nameColumnIndicators) {
            if (cell.includes(indicator)) {
              console.log(`✅ Found header "${cell}" at row ${rowIndex}, column ${colIndex}`);
              headerRowIndex = rowIndex;

              // Verify this column has student names by checking a few rows below
              let studentNameCount = 0;
              for (let checkRow = rowIndex + 1; checkRow < Math.min(values.length, rowIndex + 10); checkRow++) {
                const studentCell = values[checkRow]?.[colIndex];
                if (studentCell && typeof studentCell === "string" && studentCell.trim()) {
                  // Check if it looks like a student name (Arabic text, reasonable length)
                  if (/[\u0600-\u06FF]{2,}/.test(studentCell) && studentCell.length > 3 && studentCell.length < 50) {
                    studentNameCount++;
                  }
                }
              }

              console.log(`📝 Found ${studentNameCount} potential student names in column ${colIndex}`);
              if (studentNameCount >= 3) {
                console.log(`✅ Confirmed: Column ${colIndex} contains student names`);
                return colIndex;
              }
            }
          }
        }
      }
    }

    console.log("⚠️ No header-based detection worked, trying advanced fallback...");

    // Advanced fallback: look for column with most Arabic names
    let bestColumn = -1;
    let bestScore = 0;

    // Check each column
    for (let colIndex = 0; colIndex < (values[0]?.length || 0); colIndex++) {
      let validNameCount = 0;
      let totalNonEmptyCount = 0;

      // Sample from multiple rows to find names
      for (let rowIndex = 0; rowIndex < Math.min(values.length, 50); rowIndex++) {
        const cell = values[rowIndex]?.[colIndex];
        if (cell && typeof cell === "string" && cell.trim()) {
          totalNonEmptyCount++;

          // Check if this looks like a student name
          const trimmedCell = cell.trim();
          if (
            /[\u0600-\u06FF]{3,}/.test(trimmedCell) && // At least 3 Arabic characters
            trimmedCell.length >= 4 && // Reasonable minimum length
            trimmedCell.length <= 50 && // Not too long
            !trimmedCell.includes("الفرض") && // Not a test name
            !trimmedCell.includes("النقطة") && // Not "grade"
            !trimmedCell.includes("المجموع") && // Not "total"
            !trimmedCell.includes("المعدل") && // Not "average"
            !/^\d+([.,]\d+)?$/.test(trimmedCell) && // Not a number
            !/^[\d\s,./]+$/.test(trimmedCell) // Not just numbers and punctuation
          ) {
            validNameCount++;
          }
        }
      }

      if (totalNonEmptyCount > 0) {
        const score = validNameCount / totalNonEmptyCount;
        console.log(
          `  Column ${colIndex}: ${validNameCount}/${totalNonEmptyCount} valid names (${(score * 100).toFixed(1)}%)`
        );

        // Sample some values for debugging
        const sampleValues = [];
        for (let i = 0; i < Math.min(values.length, 5); i++) {
          if (values[i]?.[colIndex]) {
            sampleValues.push(values[i][colIndex]);
          }
        }
        console.log(`    Sample values:`, sampleValues);

        if (score > bestScore && score > 0.7 && validNameCount >= 5) {
          bestScore = score;
          bestColumn = colIndex;
        }
      }
    }

    if (bestColumn !== -1) {
      console.log(
        `✅ Advanced fallback: Best name column found at index ${bestColumn} (${(bestScore * 100).toFixed(1)}% valid names)`
      );
    } else {
      console.log("❌ Could not identify student name column");
    }

    return bestColumn;
  }

  /**
   * Extract student names from the Massar file
   */
  private extractStudentNamesFromMassar(values: any[][]): string[] {
    if (this.massarNameColumn === -1) return [];

    const names: string[] = [];
    console.log(`🔍 Extracting names from column ${this.massarNameColumn}`);
    console.log(`📊 Total rows to process: ${values.length}`);

    // Find the actual start row (skip headers and empty rows)
    let startRow = 0;
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      const cell = values[i][this.massarNameColumn];
      if (cell && typeof cell === "string") {
        const trimmed = cell.trim();
        // Skip header-like cells
        if (trimmed.includes("اسم") || trimmed.includes("التلميذ") || trimmed.includes("الطالب")) {
          startRow = i + 1;
          console.log(`📍 Found header at row ${i}, starting extraction from row ${startRow}`);
          break;
        }
        // If we find a name-like cell early, start from row 0
        else if (/[\u0600-\u06FF]{3,}/.test(trimmed) && trimmed.length > 3) {
          startRow = 0;
          console.log(`📍 Found student name at row ${i}, starting extraction from row ${startRow}`);
          break;
        }
      }
    }

    // Extract names starting from the determined row
    for (let i = startRow; i < values.length; i++) {
      const cell = values[i][this.massarNameColumn];
      if (cell && typeof cell === "string" && cell.trim()) {
        const originalName = cell.trim();

        // Additional validation to ensure this is actually a student name
        if (
          /[\u0600-\u06FF]{3,}/.test(originalName) && // At least 3 Arabic characters
          originalName.length >= 4 && // Reasonable minimum length
          originalName.length <= 50 && // Not too long
          !originalName.includes("الفرض") && // Not a test name
          !originalName.includes("النقطة") && // Not "grade"
          !originalName.includes("المجموع") && // Not "total"
          !originalName.includes("المعدل") && // Not "average"
          !/^\d+([.,]\d+)?$/.test(originalName) && // Not a number
          !/^[\d\s,./]+$/.test(originalName) // Not just numbers and punctuation
        ) {
          const cleanedName = this.normalizeArabicText(originalName);
          if (cleanedName && cleanedName.length > 2) {
            names.push(originalName); // Store original name, not normalized
            if (names.length <= 10) {
              // Log first 10 names for debugging
              console.log(`  Row ${i + 1}: "${originalName}" → normalized: "${cleanedName}"`);
            }
          }
        } else {
          if (i - startRow < 5) {
            console.log(`  Row ${i + 1}: Skipped "${originalName}" (doesn't look like a student name)`);
          }
        }
      }
    }

    console.log(`📝 Extracted ${names.length} valid student names`);
    console.log(`📋 First 5 names:`, names.slice(0, 5));
    console.log(`📋 Last 5 names:`, names.slice(-5));

    return names;
  }

  /**
   * Correct student names by comparing with Massar file data
   */
  async correctStudentNames(students: Student[]): Promise<StudentNameCorrectionResults> {
    if (this.massarStudentNames.length === 0) {
      throw new Error("Massar file data not loaded. Please initialize the service first.");
    }

    console.log(`🔍 Starting enhanced name correction for ${students.length} students`);
    console.log(`📚 Available Massar names: ${this.massarStudentNames.length}`);
    console.log(`📝 Sample Massar names:`, this.massarStudentNames.slice(0, 5));

    // Use optimized matching for large datasets
    const isLargeDataset = students.length > 50 || this.massarStudentNames.length > 100;
    if (isLargeDataset) {
      console.log(`📊 Large dataset detected, using optimized matching algorithm`);
      return await this.correctStudentNamesOptimized(students);
    }

    const corrections: NameCorrectionResult[] = [];
    const correctedStudents: Student[] = [];
    const unmatchedStudents: string[] = [];

    // Pre-process for better matching context
    const processedStudents = this.preprocessStudentsForMatching(students);

    for (let i = 0; i < processedStudents.length; i++) {
      const student = processedStudents[i];
      const normalizedName = this.normalizeArabicText(student.name);
      console.log(
        `\n🔍 Processing (${i + 1}/${processedStudents.length}): "${student.name}" → normalized: "${normalizedName}"`
      );

      // Find the best match with context
      const bestMatch = this.findBestNameMatchWithContext(normalizedName, i, processedStudents);

      if (bestMatch && bestMatch.confidence > 0.3) {
        // Apply correction
        const correctedStudent = {
          ...student,
          name: bestMatch.correctedName,
        };

        correctedStudents.push(correctedStudent);
        corrections.push({
          originalName: student.name,
          correctedName: bestMatch.correctedName,
          confidence: bestMatch.confidence,
          massarRowIndex: bestMatch.rowIndex,
        });

        console.log(
          `✅ Corrected: "${student.name}" → "${bestMatch.correctedName}" (confidence: ${(bestMatch.confidence * 100).toFixed(1)}%)`
        );
      } else {
        // No good match found
        correctedStudents.push(student);
        unmatchedStudents.push(student.name);
        console.log(`❌ No match found for: "${student.name}"`);

        // Debug: show top 3 closest matches
        const topMatches = this.findTopMatches(normalizedName, 3);
        if (topMatches.length > 0) {
          console.log(`   Top matches:`);
          topMatches.forEach((match, index) => {
            console.log(`   ${index + 1}. "${match.name}" (${(match.similarity * 100).toFixed(1)}%)`);
          });
        }
      }
    }

    console.log(`\n📊 Enhanced Correction Summary:`);
    console.log(`   Total students: ${students.length}`);
    console.log(`   Corrections found: ${corrections.length}`);
    console.log(`   Unmatched: ${unmatchedStudents.length}`);
    console.log(`   Success rate: ${((corrections.length / students.length) * 100).toFixed(1)}%`);

    return {
      correctedStudents,
      corrections,
      totalCorrections: corrections.length,
      unmatchedStudents,
    };
  }

  /**
   * Preprocess students for better matching context
   */
  private preprocessStudentsForMatching(students: Student[]): Student[] {
    // Sort by student number if available for better sequential matching
    const sortedStudents = [...students].sort((a, b) => {
      if (a.number && b.number) {
        return a.number - b.number;
      }
      return 0;
    });

    return sortedStudents.map((student, index) => ({
      ...student,
      // Add context information for better matching
      originalIndex: index,
    }));
  }

  /**
   * Find the best matching name with context awareness
   */
  private findBestNameMatchWithContext(
    normalizedName: string,
    studentIndex: number,
    allStudents: Student[]
  ): { correctedName: string; confidence: number; rowIndex: number } | null {
    let bestMatch: { correctedName: string; confidence: number; rowIndex: number } | null = null;
    let bestScore = 0;

    for (let i = 0; i < this.massarStudentNames.length; i++) {
      const massarName = this.massarStudentNames[i];
      let similarity = this.calculateNameSimilarity(normalizedName, massarName);

      // Apply context-based adjustments
      similarity = this.applyContextualAdjustments(similarity, studentIndex, i, allStudents);

      if (similarity > bestScore && similarity > 0.3) {
        bestScore = similarity;
        bestMatch = {
          correctedName: massarName,
          confidence: similarity,
          rowIndex: i + 2, // +2 because we skip header and arrays are 0-indexed
        };
      }
    }

    return bestMatch;
  }

  /**
   * Apply contextual adjustments to similarity score
   */
  private applyContextualAdjustments(
    baseSimilarity: number,
    studentIndex: number,
    massarIndex: number,
    allStudents: Student[]
  ): number {
    let adjustedSimilarity = baseSimilarity;

    // Bonus for sequential matching (students often appear in similar order)
    const positionBonus = this.calculatePositionBonus(studentIndex, massarIndex, allStudents.length);

    // Bonus for avoiding duplicate matches
    const uniquenessBonus = this.calculateUniquenessBonus(massarIndex);

    // Apply bonuses with diminishing returns
    adjustedSimilarity = baseSimilarity + positionBonus * 0.1 + uniquenessBonus * 0.05;

    return Math.min(1.0, adjustedSimilarity);
  }

  /**
   * Calculate position-based bonus for sequential matching
   */
  private calculatePositionBonus(studentIndex: number, massarIndex: number, totalStudents: number): number {
    if (totalStudents <= 1) return 0;

    // Calculate expected position ratio
    const studentRatio = studentIndex / (totalStudents - 1);
    const massarRatio = massarIndex / (this.massarStudentNames.length - 1);

    // Bonus for similar relative positions
    const positionDifference = Math.abs(studentRatio - massarRatio);
    return Math.max(0, 1 - positionDifference * 2); // Scale to 0-1
  }

  /**
   * Calculate uniqueness bonus to avoid duplicate matches
   */
  private calculateUniquenessBonus(massarIndex: number): number {
    // This is a simplified version - in a full implementation,
    // we'd track which Massar names have already been matched
    // For now, just return a small bonus
    return 0.1;
  }

  /**
   * Test name correction with sample data (for debugging)
   */
  async testNameCorrection(): Promise<void> {
    console.log("🧪 Testing name correction with sample data...");

    const sampleStudents = [
      {
        name: "زاهیر محمد",
        number: 1,
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      },
      {
        name: "حمادي أمين",
        number: 2,
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      },
      {
        name: "الكورش مصطفى",
        number: 3,
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      },
      { name: "الصمد", number: 4, marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null } },
      {
        name: "البيصوري عبد",
        number: 5,
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      },
    ];

    try {
      const results = await this.correctStudentNames(sampleStudents);
      console.log("✅ Test completed successfully");
      console.log("📊 Test results:", results);
    } catch (error) {
      console.error("❌ Test failed:", error);
    }
  }

  /**
   * Manually trigger name correction from UI with enhanced error handling
   */
  async manualCorrection(students: Student[]): Promise<StudentNameCorrectionResults> {
    console.log(`🔧 Manual correction triggered for ${students.length} students`);

    try {
      // Validate input
      if (!students || students.length === 0) {
        throw new Error("No students provided for correction");
      }

      // Check service state
      if (!this.isInitialized()) {
        throw new Error("Service not initialized. Please ensure a Massar file is loaded.");
      }

      // Validate student data
      const validStudents = students.filter((s) => s.name && s.name.trim().length > 0);
      if (validStudents.length === 0) {
        throw new Error("No valid student names found");
      }

      if (validStudents.length < students.length) {
        console.warn(`⚠️ Filtered out ${students.length - validStudents.length} students with invalid names`);
      }

      // Perform correction
      const results = await this.correctStudentNames(validStudents);

      console.log(`✅ Manual correction completed: ${results.totalCorrections} corrections found`);
      return results;
    } catch (error) {
      console.error("❌ Manual correction failed:", error);
      throw new Error(`Name correction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Reset the service state (useful for testing or reinitializing)
   */
  reset(): void {
    console.log("🔄 Resetting student name correction service...");
    this.massarStudentNames = [];
    this.massarNameColumn = -1;
    console.log("✅ Service reset completed");
  }

  /**
   * Get a copy of Massar student names currently loaded
   */
  getMassarStudentNames(): string[] {
    return [...this.massarStudentNames];
  }

  /**
   * Force-synchronize the provided students' names with the Massar names by order.
   * This guarantees the "الاسم" column matches exactly the names column in the open Massar file.
   */
  synchronizeNamesWithMassarOrder(students: Student[]): Student[] {
    if (this.massarStudentNames.length === 0) {
      throw new Error("Massar names not loaded. Initialize service first.");
    }

    const synced: Student[] = students.map((s, i) => ({
      ...s,
      name: this.massarStudentNames[i] !== undefined ? this.massarStudentNames[i] : s.name,
    }));

    return synced;
  }

  /**
   * Reorder students to match the order of names in Massar and force Massar names.
   * This provides the most accurate alignment between UI rows and Excel rows.
   */
  reorderStudentsToMatchMassarOrder(students: Student[]): Student[] {
    if (this.massarStudentNames.length === 0) {
      throw new Error("Massar names not loaded. Initialize service first.");
    }

    const normalizedMassar = this.massarStudentNames.map((n) => this.normalizeArabicText(n));

    // Build candidate matches: for each student, best massar index + score
    const candidates: Array<{ studentIndex: number; massarIndex: number; score: number }> = [];
    students.forEach((s, si) => {
      const ns = this.normalizeArabicText(s.name);
      let best = -1;
      let bestScore = 0;
      for (let mi = 0; mi < normalizedMassar.length; mi++) {
        const score = this.calculateNameSimilarity(ns, normalizedMassar[mi]);
        if (score > bestScore) {
          bestScore = score;
          best = mi;
        }
      }
      if (best !== -1) {
        candidates.push({ studentIndex: si, massarIndex: best, score: bestScore });
      }
    });

    // Greedy assignment by highest score first to avoid duplicates
    candidates.sort((a, b) => b.score - a.score);
    const assignedMassar = new Set<number>();
    const assignedStudent = new Set<number>();
    const studentToMassar = new Map<number, number>();
    for (const c of candidates) {
      if (c.score < 0.35) continue; // safety threshold
      if (!assignedMassar.has(c.massarIndex) && !assignedStudent.has(c.studentIndex)) {
        assignedMassar.add(c.massarIndex);
        assignedStudent.add(c.studentIndex);
        studentToMassar.set(c.studentIndex, c.massarIndex);
      }
    }

    // Construct reordered list following Massar order
    const massarToStudent = new Map<number, number>();
    studentToMassar.forEach((mIdx, sIdx) => {
      massarToStudent.set(mIdx, sIdx);
    });

    const reordered: Student[] = [];
    for (let mi = 0; mi < this.massarStudentNames.length; mi++) {
      const sIdx = massarToStudent.get(mi);
      if (sIdx !== undefined) {
        // Use the student's marks but force Massar name
        const base = students[sIdx];
        reordered.push({ ...base, name: this.massarStudentNames[mi] });
      }
    }

    // Append any unassigned students at the end (rare edge case)
    students.forEach((s, si) => {
      if (!studentToMassar.has(si)) {
        reordered.push(s);
      }
    });

    return reordered;
  }

  /**
   * Force exact Massar names by aligning with sequential student numbers.
   * Assumes OCR extracted numbers represent ordering (1..N). Keeps marks intact.
   */
  forceExactNamesByRowNumber(students: Student[]): Student[] {
    if (this.massarStudentNames.length === 0) {
      throw new Error("Massar names not loaded. Initialize service first.");
    }

    // Sort students by their extracted row number
    const sorted = [...students].sort((a, b) => {
      const an = typeof a.number === "number" ? a.number : 0;
      const bn = typeof b.number === "number" ? b.number : 0;
      return an - bn;
    });

    // Verify numbers are roughly sequential and counts match
    const countsMatch = sorted.length === this.massarStudentNames.length;
    const sequential = sorted.every((s, idx) => {
      const n = typeof s.number === "number" ? s.number : 0;
      return Math.abs(n - (idx + 1)) <= 1; // allow small OCR off-by-one
    });

    if (!countsMatch) {
      throw new Error("Counts do not match for number-based alignment");
    }

    if (!sequential) {
      throw new Error("Student numbers are not sequential enough for number-based alignment");
    }

    // Map Massar names to sorted students by index
    const updated = sorted.map((s, i) => ({ ...s, name: this.massarStudentNames[i] }));
    return updated;
  }

  /**
   * Validate service configuration and data integrity
   */
  validateService(): { isValid: boolean; issues: string[]; warnings: string[] } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check initialization
    if (!this.isInitialized()) {
      issues.push("Service not initialized - no Massar data loaded");
    }

    // Check data quality
    if (this.massarStudentNames.length === 0) {
      issues.push("No student names loaded from Massar file");
    } else {
      // Check for potential data issues
      const emptyNames = this.massarStudentNames.filter((name) => !name || name.trim().length === 0).length;
      if (emptyNames > 0) {
        warnings.push(`${emptyNames} empty names found in Massar data`);
      }

      const shortNames = this.massarStudentNames.filter((name) => name && name.trim().length < 3).length;
      if (shortNames > 0) {
        warnings.push(`${shortNames} very short names found (may be incomplete)`);
      }

      const duplicateNames = this.massarStudentNames.length - new Set(this.massarStudentNames).size;
      if (duplicateNames > 0) {
        warnings.push(`${duplicateNames} duplicate names found in Massar data`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Find the best matching name from Massar file
   */
  private findBestNameMatch(
    normalizedName: string
  ): { correctedName: string; confidence: number; rowIndex: number } | null {
    let bestMatch: { correctedName: string; confidence: number; rowIndex: number } | null = null;
    let bestScore = 0;

    for (let i = 0; i < this.massarStudentNames.length; i++) {
      const massarName = this.massarStudentNames[i];
      const similarity = this.calculateNameSimilarity(normalizedName, massarName);

      if (similarity > bestScore && similarity > 0.3) {
        // Lowered threshold
        bestScore = similarity;
        bestMatch = {
          correctedName: massarName,
          confidence: similarity,
          rowIndex: i + 2, // +2 because we skip header and arrays are 0-indexed
        };
      }
    }

    return bestMatch;
  }

  /**
   * Find top N matches for debugging
   */
  private findTopMatches(normalizedName: string, topN: number): Array<{ name: string; similarity: number }> {
    const matches = this.massarStudentNames.map((name, index) => ({
      name,
      similarity: this.calculateNameSimilarity(normalizedName, name),
    }));

    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
  }

  /**
   * Calculate similarity between two names using multiple enhanced algorithms
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (name1 === name2) return 1.0;
    if (!name1 || !name2) return 0.0;

    // Split names into parts
    const parts1 = name1.split(/\s+/).filter((p) => p.length > 0);
    const parts2 = name2.split(/\s+/).filter((p) => p.length > 0);

    // Calculate different similarity metrics
    const exactMatch = this.calculateExactMatchSimilarity(parts1, parts2);
    const fuzzyMatch = this.calculateFuzzySimilarity(name1, name2);
    const partialMatch = this.calculatePartialMatchSimilarity(parts1, parts2);
    const substringMatch = this.calculateSubstringSimilarity(name1, name2);
    const phonetic = this.calculatePhoneticSimilarity(name1, name2);
    const structuralMatch = this.calculateStructuralSimilarity(parts1, parts2);

    // Enhanced weighted combination with adaptive scoring
    const baseScore =
      exactMatch * 0.4 +
      partialMatch * 0.25 +
      fuzzyMatch * 0.15 +
      substringMatch * 0.1 +
      phonetic * 0.05 +
      structuralMatch * 0.05;

    // Apply length-based penalty for very different name lengths
    const lengthPenalty = this.calculateLengthPenalty(name1, name2);

    // Apply bonus for common Arabic name patterns
    const patternBonus = this.calculateArabicPatternBonus(parts1, parts2);

    return Math.min(1.0, baseScore * lengthPenalty + patternBonus);
  }

  /**
   * Calculate phonetic similarity for Arabic names
   */
  private calculatePhoneticSimilarity(name1: string, name2: string): number {
    // Simplified Arabic phonetic matching
    const phonetic1 = this.getPhoneticSignature(name1);
    const phonetic2 = this.getPhoneticSignature(name2);

    return this.calculateFuzzySimilarity(phonetic1, phonetic2);
  }

  /**
   * Get phonetic signature for Arabic text
   */
  private getPhoneticSignature(text: string): string {
    return (
      text
        // Group similar sounding letters
        .replace(/[سصث]/g, "س")
        .replace(/[تط]/g, "ت")
        .replace(/[حخ]/g, "ح")
        .replace(/[دذ]/g, "د")
        .replace(/[رز]/g, "ر")
        .replace(/[شس]/g, "ش")
        .replace(/[صض]/g, "ص")
        .replace(/[طظ]/g, "ط")
        .replace(/[عغ]/g, "ع")
        .replace(/[فق]/g, "ف")
        .replace(/[كق]/g, "ك")
    );
  }

  /**
   * Calculate structural similarity (name part count, order, etc.)
   */
  private calculateStructuralSimilarity(parts1: string[], parts2: string[]): number {
    // Bonus for same number of name parts
    const partCountSimilarity = 1 - Math.abs(parts1.length - parts2.length) / Math.max(parts1.length, parts2.length);

    // Bonus for similar name structure (first name similar length, etc.)
    let structureBonus = 0;
    if (parts1.length > 0 && parts2.length > 0) {
      const firstNameLengthSim =
        1 - Math.abs(parts1[0].length - parts2[0].length) / Math.max(parts1[0].length, parts2[0].length);
      structureBonus += firstNameLengthSim * 0.6;

      if (parts1.length > 1 && parts2.length > 1) {
        const lastNameLengthSim =
          1 -
          Math.abs(parts1[parts1.length - 1].length - parts2[parts2.length - 1].length) /
            Math.max(parts1[parts1.length - 1].length, parts2[parts2.length - 1].length);
        structureBonus += lastNameLengthSim * 0.4;
      }
    }

    return partCountSimilarity * 0.5 + structureBonus * 0.5;
  }

  /**
   * Calculate length-based penalty to avoid matching very different length names
   */
  private calculateLengthPenalty(name1: string, name2: string): number {
    const lengthDiff = Math.abs(name1.length - name2.length);
    const maxLength = Math.max(name1.length, name2.length);

    if (maxLength === 0) return 1;

    const lengthRatio = lengthDiff / maxLength;

    // Apply penalty if length difference is more than 50%
    if (lengthRatio > 0.5) {
      return Math.max(0.3, 1 - lengthRatio);
    }

    return 1;
  }

  /**
   * Calculate bonus for common Arabic name patterns
   */
  private calculateArabicPatternBonus(parts1: string[], parts2: string[]): number {
    let bonus = 0;

    // Bonus for common Arabic prefixes/suffixes
    const commonPrefixes = ["عبد", "أبو", "أم", "بن", "بنت"];
    const commonSuffixes = ["الدين", "الله", "الرحمن"];

    for (const prefix of commonPrefixes) {
      if (parts1.some((p) => p.startsWith(prefix)) && parts2.some((p) => p.startsWith(prefix))) {
        bonus += 0.1;
      }
    }

    for (const suffix of commonSuffixes) {
      if (parts1.some((p) => p.endsWith(suffix)) && parts2.some((p) => p.endsWith(suffix))) {
        bonus += 0.1;
      }
    }

    return Math.min(0.2, bonus); // Cap bonus at 20%
  }

  /**
   * Calculate substring similarity (useful for OCR errors)
   */
  private calculateSubstringSimilarity(name1: string, name2: string): number {
    if (name1.length === 0 || name2.length === 0) return 0;

    const longer = name1.length > name2.length ? name1 : name2;
    const shorter = name1.length > name2.length ? name2 : name1;

    // Check if shorter name is contained in longer name
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    // Check for common substrings
    let maxCommonLength = 0;
    for (let i = 0; i < shorter.length; i++) {
      for (let j = i + 1; j <= shorter.length; j++) {
        const substring = shorter.substring(i, j);
        if (substring.length > 2 && longer.includes(substring)) {
          maxCommonLength = Math.max(maxCommonLength, substring.length);
        }
      }
    }

    return maxCommonLength / Math.max(name1.length, name2.length);
  }

  /**
   * Calculate similarity based on exact word matches
   */
  private calculateExactMatchSimilarity(parts1: string[], parts2: string[]): number {
    if (parts1.length === 0 || parts2.length === 0) return 0;

    let matches = 0;
    let totalParts = Math.max(parts1.length, parts2.length);

    for (const part1 of parts1) {
      for (const part2 of parts2) {
        if (part1 === part2) {
          matches++;
          break;
        }
      }
    }

    return matches / totalParts;
  }

  /**
   * Calculate fuzzy similarity using edit distance
   */
  private calculateFuzzySimilarity(name1: string, name2: string): number {
    const longer = name1.length > name2.length ? name1 : name2;
    const shorter = name1.length > name2.length ? name2 : name1;

    if (longer.length === 0) return 1.0;

    const editDist = this.editDistance(longer, shorter);
    return (longer.length - editDist) / longer.length;
  }

  /**
   * Calculate partial match similarity (first/last name matching)
   */
  private calculatePartialMatchSimilarity(parts1: string[], parts2: string[]): number {
    if (parts1.length === 0 || parts2.length === 0) return 0;

    let score = 0;
    let totalScore = 0;

    // First name match (most important)
    if (parts1[0] && parts2[0]) {
      const firstSimilarity = this.calculateFuzzySimilarity(parts1[0], parts2[0]);
      if (firstSimilarity > 0.7) {
        score += firstSimilarity * 0.6;
      }
      totalScore += 0.6;
    }

    // Last name match
    if (parts1.length > 1 && parts2.length > 1) {
      const lastSimilarity = this.calculateFuzzySimilarity(parts1[parts1.length - 1], parts2[parts2.length - 1]);
      if (lastSimilarity > 0.7) {
        score += lastSimilarity * 0.4;
      }
      totalScore += 0.4;
    }

    // Middle names matching
    if (parts1.length > 2 && parts2.length > 2) {
      const middleParts1 = parts1.slice(1, -1);
      const middleParts2 = parts2.slice(1, -1);

      for (const part1 of middleParts1) {
        for (const part2 of middleParts2) {
          const similarity = this.calculateFuzzySimilarity(part1, part2);
          if (similarity > 0.6) {
            score += similarity * 0.2;
            totalScore += 0.2;
            break;
          }
        }
      }
    }

    return totalScore > 0 ? score / totalScore : 0;
  }

  /**
   * Calculate edit distance between two strings
   */
  private editDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Normalize Arabic text for comparison with enhanced OCR error handling
   */
  private normalizeArabicText(text: string): string {
    if (!text) return "";

    let normalized = text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[أإآ]/g, "ا") // Normalize Alef variants
      .replace(/ة/g, "ه") // Normalize Taa Marbouta
      .replace(/ى/g, "ي") // Normalize Alif Maqsura
      .replace(/ؤ/g, "و") // Normalize Hamza on Waw
      .replace(/ئ/g, "ي") // Normalize Hamza on Yaa
      .replace(/ء/g, "") // Remove Hamza
      .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48)) // Convert Arabic numerals to English
      .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48)) // Convert Persian numerals to English
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();

    // Enhanced OCR error correction for Arabic text
    normalized = this.fixCommonOCRErrors(normalized);

    return normalized.toLowerCase();
  }

  /**
   * Fix common OCR errors in Arabic names
   */
  private fixCommonOCRErrors(text: string): string {
    // Common OCR misreadings in Arabic
    const corrections: Array<[RegExp, string]> = [
      // Letter confusion
      [/[رز]/g, "ر"], // OCR often confuses ر and ز
      [/[دذ]/g, "د"], // OCR often confuses د and ذ
      [/[صض]/g, "ص"], // OCR often confuses ص and ض
      [/[طظ]/g, "ط"], // OCR often confuses ط and ظ
      [/[عغ]/g, "ع"], // OCR often confuses ع and غ
      [/[فق]/g, "ف"], // OCR often confuses ف and ق
      [/[كک]/g, "ك"], // Normalize different forms of Kaf
      [/[يى]/g, "ي"], // Normalize different forms of Ya
      [/[هة]/g, "ه"], // Normalize different forms of Ha

      // Common OCR artifacts
      [/[۰-۹]/g, ""], // Remove stray Persian numerals
      [/[0-9]/g, ""], // Remove stray Arabic numerals
      [/[.,;:]/g, ""], // Remove punctuation
      [/[()[\]{}]/g, ""], // Remove brackets
      [/[-_]/g, " "], // Convert dashes to spaces
      [/[|]/g, "ل"], // OCR sometimes reads ل as |
      [/[l1I]/g, "ل"], // Latin characters often misread as Arabic ل
      [/[o0]/g, ""], // Remove stray Latin o/0

      // Fix spacing issues
      [/\s+/g, " "], // Multiple spaces to single space
    ];

    let corrected = text;
    for (const [pattern, replacement] of corrections) {
      corrected = corrected.replace(pattern, replacement);
    }

    return corrected.trim();
  }

  /**
   * Get statistics about the correction process
   */
  getCorrectionStats(): { totalMassarNames: number; totalOcrNames: number } {
    return {
      totalMassarNames: this.massarStudentNames.length,
      totalOcrNames: 0, // This will be set when correction is called
    };
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.massarStudentNames.length > 0 && this.massarNameColumn !== -1;
  }

  /**
   * Debug method to manually test column detection and data extraction
   */
  async debugColumnDetection(): Promise<void> {
    try {
      console.log("🔧 DEBUG: Manual column detection test");

      const sheet = await this.getActiveWorksheet();
      const range = sheet.getUsedRange();
      range.load("values");
      await range.context.sync();

      console.log("📊 DEBUG: Excel data loaded");
      console.log("📊 DEBUG: Dimensions:", range.values.length, "rows x", range.values[0]?.length, "columns");

      // Test column detection
      const detectedColumn = this.findStudentNameColumn(range.values);
      console.log("📍 DEBUG: Detected column:", detectedColumn);

      if (detectedColumn !== -1) {
        // Test name extraction
        this.massarNameColumn = detectedColumn;
        const extractedNames = this.extractStudentNamesFromMassar(range.values);
        console.log("📝 DEBUG: Extracted names:", extractedNames);
      }
    } catch (error) {
      console.error("❌ DEBUG: Column detection test failed:", error);
    }
  }

  /**
   * Get detailed statistics about the service state
   */
  getDetailedStats(): {
    isInitialized: boolean;
    totalMassarNames: number;
    massarNameColumn: number;
    sampleMassarNames: string[];
    averageNameLength: number;
    uniqueFirstNames: number;
  } {
    const sampleSize = Math.min(5, this.massarStudentNames.length);
    const sampleNames = this.massarStudentNames.slice(0, sampleSize);

    const averageLength =
      this.massarStudentNames.length > 0
        ? this.massarStudentNames.reduce((sum, name) => sum + name.length, 0) / this.massarStudentNames.length
        : 0;

    const firstNames = new Set(
      this.massarStudentNames.map((name) => name.split(" ")[0]).filter((name) => name.length > 0)
    );

    return {
      isInitialized: this.isInitialized(),
      totalMassarNames: this.massarStudentNames.length,
      massarNameColumn: this.massarNameColumn,
      sampleMassarNames: sampleNames,
      averageNameLength: Math.round(averageLength * 10) / 10,
      uniqueFirstNames: firstNames.size,
    };
  }

  /**
   * Performance-optimized matching for large datasets
   */
  private async correctStudentNamesOptimized(students: Student[]): Promise<StudentNameCorrectionResults> {
    console.log(
      `🚀 Using optimized matching for ${students.length} students against ${this.massarStudentNames.length} Massar names`
    );

    // Pre-compute normalized Massar names for faster lookup
    const normalizedMassarNames = this.massarStudentNames.map((name) => this.normalizeArabicText(name));

    // Create lookup maps for faster searching
    const firstNameMap = new Map<string, number[]>();
    normalizedMassarNames.forEach((name, index) => {
      const firstName = name.split(" ")[0];
      if (!firstNameMap.has(firstName)) {
        firstNameMap.set(firstName, []);
      }
      firstNameMap.get(firstName)!.push(index);
    });

    const corrections: NameCorrectionResult[] = [];
    const correctedStudents: Student[] = [];
    const unmatchedStudents: string[] = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const normalizedName = this.normalizeArabicText(student.name);
      const studentFirstName = normalizedName.split(" ")[0];

      // Fast lookup using first name map
      const candidateIndices = firstNameMap.get(studentFirstName) || [];
      let bestMatch: { correctedName: string; confidence: number; rowIndex: number } | null = null;
      let bestScore = 0;

      // If no first name match, fall back to full search but with limited scope
      const searchIndices =
        candidateIndices.length > 0
          ? candidateIndices
          : this.getTopCandidateIndices(normalizedName, normalizedMassarNames, 10);

      for (const massarIndex of searchIndices) {
        const massarName = normalizedMassarNames[massarIndex];
        let similarity = this.calculateNameSimilarity(normalizedName, massarName);

        // Apply contextual adjustments
        similarity = this.applyContextualAdjustments(similarity, i, massarIndex, students);

        if (similarity > bestScore && similarity > 0.3) {
          bestScore = similarity;
          bestMatch = {
            correctedName: this.massarStudentNames[massarIndex], // Use original (non-normalized) name
            confidence: similarity,
            rowIndex: massarIndex + 2,
          };
        }
      }

      if (bestMatch) {
        correctedStudents.push({ ...student, name: bestMatch.correctedName });
        corrections.push({
          originalName: student.name,
          correctedName: bestMatch.correctedName,
          confidence: bestMatch.confidence,
          massarRowIndex: bestMatch.rowIndex,
        });
      } else {
        correctedStudents.push(student);
        unmatchedStudents.push(student.name);
      }
    }

    return {
      correctedStudents,
      corrections,
      totalCorrections: corrections.length,
      unmatchedStudents,
    };
  }

  /**
   * Get top candidate indices for a name using quick pre-filtering
   */
  private getTopCandidateIndices(targetName: string, normalizedNames: string[], maxCandidates: number): number[] {
    const candidates: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < normalizedNames.length; i++) {
      const name = normalizedNames[i];
      // Quick pre-filter using substring and length similarity
      const lengthSimilarity = 1 - Math.abs(name.length - targetName.length) / Math.max(name.length, targetName.length);
      const hasCommonSubstring = name
        .split(" ")
        .some((part) => targetName.includes(part) || part.includes(targetName.split(" ")[0]));

      if (lengthSimilarity > 0.3 || hasCommonSubstring) {
        candidates.push({ index: i, score: lengthSimilarity });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates)
      .map((c) => c.index);
  }
}

export default new StudentNameCorrectionService();

// Make available globally for testing
if (typeof window !== "undefined") {
  (window as any).studentNameCorrectionService = new StudentNameCorrectionService();

  // Add debug method to global scope
  (window as any).debugStudentNameCorrection = async () => {
    await (window as any).studentNameCorrectionService.debugColumnDetection();
  };
}
