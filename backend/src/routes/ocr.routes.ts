/* OCR API Routes */
import { Router, Request, Response } from "express";
import { verifyLicense } from "../middleware/auth.middleware";
import geminiOcrService from "../services/geminiOcrService";

const router = Router();

/**
 * POST /api/ocr/process
 * Process an image and extract student marks
 * Body: { base64Image: string, mimeType: string, licenseKey: string }
 */
router.post("/process", verifyLicense, async (req: Request, res: Response) => {
  try {
    const { base64Image, mimeType } = req.body;

    // Validation
    if (!base64Image) {
      return res.status(400).json({
        error: "لم يتم إرسال الصورة",
        code: "NO_IMAGE",
      });
    }

    // Remove data URL prefix if present
    const base64Content = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const imageType = mimeType || "image/jpeg";

    console.log(`📸 Processing OCR request for license: ${req.licenseKey?.substring(0, 8)}...`);

    // Process the image
    const result = await geminiOcrService.processImage(base64Content, imageType);

    console.log(`✅ OCR completed: ${result.students.length} students found`);

    res.json({
      success: true,
      students: result.students,
      detectedMarkTypes: result.detectedMarkTypes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("OCR processing error:", error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "فشلت معالجة الصورة",
      code: "OCR_ERROR",
    });
  }
});

/**
 * GET /api/ocr/health
 * Health check for OCR service
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ocr",
    timestamp: new Date().toISOString(),
  });
});

export default router;
