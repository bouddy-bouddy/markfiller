/* Usage Tracking API Routes */
import { Router, Request, Response } from "express";
import { verifyLicense } from "../middleware/auth.middleware";
import { usageTrackerService } from "../services/usageTracker";

const router = Router();

/**
 * GET /api/usage/check
 * Check if upload is allowed for a license
 */
router.get("/check", verifyLicense, async (req: Request, res: Response) => {
  try {
    const licenseKey = req.licenseKey!;

    const result = await usageTrackerService.checkUploadAllowed(licenseKey);

    if (!result.allowed) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Usage check error:", error);
    res.status(500).json({
      error: "خطأ في التحقق من حد الاستخدام",
      code: "USAGE_CHECK_ERROR",
    });
  }
});

/**
 * POST /api/usage/track
 * Track an upload operation
 */
router.post("/track", verifyLicense, async (req: Request, res: Response) => {
  try {
    const licenseKey = req.licenseKey!;
    const { metadata } = req.body;

    const result = await usageTrackerService.trackUpload(licenseKey, metadata);

    if (result.blocked || result.suspended) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Usage tracking error:", error);
    res.status(500).json({
      error: "خطأ في تتبع الاستخدام",
      code: "TRACKING_ERROR",
    });
  }
});

export default router;
