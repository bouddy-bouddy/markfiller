import { Student, DetectedMarkTypes } from "../types";

class HandwrittenOcrService {
  // Specialized processing for handwritten Arabic tables
  async processHandwrittenTable(
    imageFile: File
  ): Promise<{ students: Student[]; detectedMarkTypes: DetectedMarkTypes }> {
    // This would integrate with a more specialized OCR API designed for handwritten text
    // For testing purposes, let's create some sample data

    const sampleStudents: Student[] = [
      {
        number: 1,
        name: "زاهر محمد",
        marks: {
          fard1: 4.0,
          fard2: 3.0,
          fard3: 8.0,
          fard4: null,
          activities: 7.0,
        },
      },
      {
        number: 2,
        name: "حمادي أمين",
        marks: {
          fard1: 5.0,
          fard2: 2.0,
          fard3: 4.0,
          fard4: null,
          activities: 8.0,
        },
      },
      // Add more sample students as needed
    ];

    const detectedMarkTypes: DetectedMarkTypes = {
      hasFard1: true,
      hasFard2: true,
      hasFard3: true,
      hasFard4: true,
      hasActivities: true,
    };

    return { students: sampleStudents, detectedMarkTypes };
  }
}

export default new HandwrittenOcrService();
