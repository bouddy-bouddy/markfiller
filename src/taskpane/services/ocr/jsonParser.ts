/**
 * JSON Parser Utilities
 * Provides robust JSON parsing with multiple fallback strategies
 */

/**
 * JSON Parser with multiple fallback strategies for handling malformed JSON
 */
export class JSONParser {
  /**
   * Parse JSON with multiple fallback strategies
   */
  static parseRobust(text: string): any | null {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Strategy 1: Direct parse
    const direct = this.tryDirectParse(text);
    if (direct) return direct;

    // Strategy 2: Strip markdown code fences
    const withoutFences = this.tryParseWithoutCodeFences(text);
    if (withoutFences) return withoutFences;

    // Strategy 3: Extract JSON block from mixed content
    const extracted = this.tryExtractJSONBlock(text);
    if (extracted) return extracted;

    // Strategy 4: Fix common JSON errors
    const fixed = this.tryParseWithCommonFixes(text);
    if (fixed) return fixed;

    return null;
  }

  private static tryDirectParse(text: string): any | null {
    try {
      return JSON.parse(text.trim());
    } catch {
      return null;
    }
  }

  private static tryParseWithoutCodeFences(text: string): any | null {
    try {
      let cleaned = text.trim();
      // Remove ```json ... ``` or ``` ... ```
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
      cleaned = cleaned.replace(/\n?```\s*$/, "");
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  private static tryExtractJSONBlock(text: string): any | null {
    try {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return null;
      }

      const candidate = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  private static tryParseWithCommonFixes(text: string): any | null {
    try {
      let fixed = text.trim();

      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

      // Fix single quotes to double quotes (risky but sometimes necessary)
      if (!fixed.includes('"') && fixed.includes("'")) {
        fixed = fixed.replace(/'/g, '"');
      }

      // Try parsing after fixes
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }

  /**
   * Validate parsed JSON structure for student data
   */
  static validateStructuredResponse(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Response is not an object" };
    }

    if (!data.students || !Array.isArray(data.students)) {
      return { valid: false, error: "Missing or invalid 'students' array" };
    }

    if (!data.markTypes || typeof data.markTypes !== "object") {
      return { valid: false, error: "Missing or invalid 'markTypes' object" };
    }

    // Validate at least one student
    if (data.students.length === 0) {
      return { valid: false, error: "No students found in response" };
    }

    // Validate student structure
    for (let i = 0; i < Math.min(data.students.length, 3); i++) {
      const student = data.students[i];
      if (!student.name || typeof student.name !== "string") {
        return { valid: false, error: `Student at index ${i} missing valid name` };
      }
      if (!student.marks || typeof student.marks !== "object") {
        return { valid: false, error: `Student at index ${i} missing marks object` };
      }
    }

    return { valid: true };
  }
}

