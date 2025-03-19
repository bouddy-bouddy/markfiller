// This is a sample of how you could test your OCR service
// In a real implementation, you would use Jest or another testing framework
import { Student, DetectedMarkTypes } from "../taskpane/types";

// Mock data for testing
const testMarks: Student[] = [
  { number: 1, name: "أحمد محمد", marks: { fard1: 15.5, fard2: 16.0, fard3: null, activities: 18.0 } },
  { number: 2, name: "فاطمة الزهراء", marks: { fard1: 17.5, fard2: 16.5, fard3: null, activities: 19.0 } },
  { number: 3, name: "يوسف علي", marks: { fard1: 14.0, fard2: 13.5, fard3: null, activities: 16.0 } },
];

const testDetectedTypes: DetectedMarkTypes = {
  hasFard1: true,
  hasFard2: true,
  hasFard3: false,
  hasActivities: true,
};

// Example test function
async function testOcrService() {
  console.log("Running OCR Service tests...");

  // Test 1: Validate image file type
  console.log("Test 1: Validate image file type");
  const validImageFile = new File(["dummy content"], "test.jpg", { type: "image/jpeg" });
  const invalidImageFile = new File(["dummy content"], "test.txt", { type: "text/plain" });

  try {
    // This method would need to be exposed or modified for testing
    // const validResult = await enhancedOcrService.validateImage(validImageFile);
    // const invalidResult = await enhancedOcrService.validateImage(invalidImageFile);
    // console.log("  Valid image validation:", validResult);
    // console.log("  Invalid image validation:", invalidResult);
  } catch (error) {
    console.error("  Test failed:", error);
  }

  // Test 2: Statistical validation of marks
  console.log("Test 2: Statistical validation of marks");
  try {
    // Add outlier to test data
    const testDataWithOutlier = [...testMarks];
    testDataWithOutlier.push({
      number: 4,
      name: "علي حسن",
      marks: { fard1: 1.0, fard2: 2.0, fard3: null, activities: 3.0 }, // Outlier
    });

    // This method would need to be exposed or modified for testing
    // const validatedData = await enhancedOcrService.validateMarksStatistically(testDataWithOutlier);

    // console.log("  Original data:", testDataWithOutlier);
    // console.log("  Validated data:", validatedData);
  } catch (error) {
    console.error("  Test failed:", error);
  }

  console.log("OCR Service tests completed");
}

// Export for running tests
export { testOcrService };
