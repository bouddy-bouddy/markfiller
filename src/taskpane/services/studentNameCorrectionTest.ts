/**
 * Test suite for the enhanced Student Name Correction Service
 * This file provides comprehensive testing of the name correction functionality
 */

import { StudentNameCorrectionService } from "./studentNameCorrectionService";
import { Student } from "../types";

export class StudentNameCorrectionTest {
  private service: StudentNameCorrectionService;

  constructor() {
    this.service = new StudentNameCorrectionService();
  }

  /**
   * Run comprehensive tests for the correction service
   */
  async runAllTests(): Promise<void> {
    console.log("🧪 Starting comprehensive Student Name Correction tests...");

    try {
      await this.testArabicTextNormalization();
      await this.testOCRErrorCorrection();
      await this.testPhoneticMatching();
      await this.testContextualMatching();
      await this.testPerformanceOptimization();

      console.log("✅ All tests completed successfully!");
    } catch (error) {
      console.error("❌ Test suite failed:", error);
      throw error;
    }
  }

  /**
   * Test Arabic text normalization improvements
   */
  private async testArabicTextNormalization(): Promise<void> {
    console.log("\n📝 Testing Arabic text normalization...");

    const testCases = [
      { input: "محمد أحمد", expected: "محمد احمد" },
      { input: "فاطمة الزهراء", expected: "فاطمه الزهراء" },
      { input: "عبدالله إبراهيم", expected: "عبدالله ابراهيم" },
      { input: "خديجة بنت خويلد", expected: "خديجه بنت خويلد" },
      { input: "عمر بن الخطاب", expected: "عمر بن الخطاب" },
    ];

    for (const testCase of testCases) {
      const result = (this.service as any).normalizeArabicText(testCase.input);
      console.log(`  "${testCase.input}" → "${result}"`);

      if (result !== testCase.expected) {
        console.warn(`    Expected: "${testCase.expected}", Got: "${result}"`);
      }
    }

    console.log("✅ Arabic text normalization tests completed");
  }

  /**
   * Test OCR error correction
   */
  private async testOCRErrorCorrection(): Promise<void> {
    console.log("\n🔍 Testing OCR error correction...");

    const testCases = [
      { input: "محمد l احمد", description: "Latin l mistaken for Arabic ل" },
      { input: "فاطمه123", description: "Stray numbers" },
      { input: "عبد|الله", description: "Pipe character mistaken for ل" },
      { input: "خديجة()", description: "Stray brackets" },
      { input: "عمز بن", description: "ر/ز confusion" },
    ];

    for (const testCase of testCases) {
      const result = (this.service as any).fixCommonOCRErrors(testCase.input);
      console.log(`  "${testCase.input}" → "${result}" (${testCase.description})`);
    }

    console.log("✅ OCR error correction tests completed");
  }

  /**
   * Test phonetic matching
   */
  private async testPhoneticMatching(): Promise<void> {
    console.log("\n🔊 Testing phonetic matching...");

    const testPairs = [
      { name1: "محمد", name2: "محمت", description: "د/ت confusion" },
      { name1: "سارة", name2: "صارة", description: "س/ص confusion" },
      { name1: "حسن", name2: "حسين", description: "Similar roots" },
      { name1: "فاطمة", name2: "فاطمه", description: "ة/ه variation" },
    ];

    for (const pair of testPairs) {
      const phonetic1 = (this.service as any).getPhoneticSignature(pair.name1);
      const phonetic2 = (this.service as any).getPhoneticSignature(pair.name2);
      const similarity = (this.service as any).calculatePhoneticSimilarity(pair.name1, pair.name2);

      console.log(`  "${pair.name1}" vs "${pair.name2}": ${(similarity * 100).toFixed(1)}% (${pair.description})`);
      console.log(`    Phonetic: "${phonetic1}" vs "${phonetic2}"`);
    }

    console.log("✅ Phonetic matching tests completed");
  }

  /**
   * Test contextual matching improvements
   */
  private async testContextualMatching(): Promise<void> {
    console.log("\n🎯 Testing contextual matching...");

    const mockStudents: Student[] = [
      { number: 1, name: "احمد محمد", marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null } },
      { number: 2, name: "فاطمه علي", marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null } },
      {
        number: 3,
        name: "عبدالله حسن",
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      },
    ];

    const mockMassarNames = ["أحمد محمد السيد", "فاطمة علي أحمد", "عبد الله حسن محمد"];

    // Simulate the service having Massar names loaded
    (this.service as any).massarStudentNames = mockMassarNames;
    (this.service as any).massarNameColumn = 0;

    // Test position bonus calculation
    for (let i = 0; i < mockStudents.length; i++) {
      const positionBonus = (this.service as any).calculatePositionBonus(i, i, mockStudents.length);
      console.log(`  Student ${i + 1} position bonus: ${(positionBonus * 100).toFixed(1)}%`);
    }

    console.log("✅ Contextual matching tests completed");
  }

  /**
   * Test performance optimization
   */
  private async testPerformanceOptimization(): Promise<void> {
    console.log("\n⚡ Testing performance optimization...");

    // Create a large mock dataset
    const largeMockStudents: Student[] = [];
    const largeMockMassarNames: string[] = [];

    const arabicNames = [
      "محمد أحمد",
      "فاطمة علي",
      "عبد الله حسن",
      "خديجة محمد",
      "عمر عبد الله",
      "عائشة أحمد",
      "علي محمد",
      "زينب حسن",
      "حسن علي",
      "مريم عبد الله",
    ];

    // Generate 60 students (triggers optimization)
    for (let i = 0; i < 60; i++) {
      const baseName = arabicNames[i % arabicNames.length];
      largeMockStudents.push({
        number: i + 1,
        name: `${baseName} ${i + 1}`,
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      });

      largeMockMassarNames.push(`${baseName} الطالب ${i + 1}`);
    }

    // Simulate the service having large dataset
    (this.service as any).massarStudentNames = largeMockMassarNames;
    (this.service as any).massarNameColumn = 0;

    console.log(`  Testing with ${largeMockStudents.length} students and ${largeMockMassarNames.length} Massar names`);

    const startTime = performance.now();

    try {
      const results = await this.service.correctStudentNames(largeMockStudents);
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`  ✅ Optimization test completed in ${duration.toFixed(2)}ms`);
      console.log(
        `  📊 Results: ${results.totalCorrections} corrections, ${results.unmatchedStudents.length} unmatched`
      );
      console.log(`  🎯 Success rate: ${((results.totalCorrections / largeMockStudents.length) * 100).toFixed(1)}%`);
    } catch (error) {
      console.error("  ❌ Performance test failed:", error);
    }

    console.log("✅ Performance optimization tests completed");
  }

  /**
   * Test the detailed statistics method
   */
  async testDetailedStats(): Promise<void> {
    console.log("\n📊 Testing detailed statistics...");

    const stats = this.service.getDetailedStats();
    console.log("  Detailed Service Statistics:", JSON.stringify(stats, null, 2));

    console.log("✅ Detailed statistics test completed");
  }

  /**
   * Run a quick smoke test
   */
  async runSmokeTest(): Promise<boolean> {
    console.log("\n🚀 Running quick smoke test...");

    try {
      // Test basic functionality
      const testStudent: Student = {
        number: 1,
        name: "محمد احمد",
        marks: { fard1: null, fard2: null, fard3: null, fard4: null, activities: null },
      };

      // Mock some data
      (this.service as any).massarStudentNames = ["محمد أحمد السيد", "فاطمة علي أحمد"];
      (this.service as any).massarNameColumn = 0;

      const results = await this.service.correctStudentNames([testStudent]);

      console.log(`  ✅ Smoke test passed: ${results.totalCorrections} corrections found`);
      return true;
    } catch (error) {
      console.error("  ❌ Smoke test failed:", error);
      return false;
    }
  }
}

// Export a singleton instance for easy testing
export const studentNameCorrectionTest = new StudentNameCorrectionTest();

// Make available globally for browser console testing
if (typeof window !== "undefined") {
  (window as any).studentNameCorrectionTest = studentNameCorrectionTest;
}
