/* License API Routes */
import { Router, Request, Response } from "express";
import { licenseService } from "../services/licenseService";

const router = Router();

/**
 * POST /api/license/activate
 * Activate a new license
 */
router.post("/activate", async (req: Request, res: Response) => {
  try {
    const { licenseKey, deviceId, deviceInfo, clientIP, teacherProfile } = req.body;

    if (!licenseKey || !deviceId || !deviceInfo) {
      return res.status(400).json({
        error: "بيانات غير مكتملة",
        code: "MISSING_FIELDS",
      });
    }

    console.log(`🔐 Activating license: ${licenseKey.substring(0, 8)}...`);

    const result = await licenseService.activateLicense(licenseKey, deviceId, deviceInfo, clientIP, teacherProfile);

    if (!result.valid) {
      return res.status(403).json(result);
    }

    console.log(`✅ License activated successfully`);
    res.json(result);
  } catch (error) {
    console.error("License activation error:", error);
    res.status(500).json({
      error: "خطأ في تفعيل الترخيص",
      code: "ACTIVATION_ERROR",
    });
  }
});

/**
 * POST /api/license/validate
 * Validate an existing license
 */
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { licenseKey, deviceId, deviceInfo, clientIP } = req.body;

    if (!licenseKey || !deviceId) {
      return res.status(400).json({
        error: "بيانات غير مكتملة",
        code: "MISSING_FIELDS",
      });
    }

    const result = await licenseService.validateLicense(
      licenseKey,
      deviceId,
      deviceInfo || { userAgent: req.headers["user-agent"] || "unknown" },
      clientIP
    );

    if (!result.valid) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("License validation error:", error);
    res.status(500).json({
      error: "خطأ في التحقق من الترخيص",
      code: "VALIDATION_ERROR",
    });
  }
});

/**
 * POST /api/license/track-usage
 * Track usage event
 */
router.post("/track-usage", async (req: Request, res: Response) => {
  try {
    const { licenseKey, deviceId, eventType, metadata } = req.body;

    if (!licenseKey || !deviceId || !eventType) {
      return res.status(400).json({
        error: "بيانات غير مكتملة",
        code: "MISSING_FIELDS",
      });
    }

    await licenseService.trackUsage(licenseKey, deviceId, eventType, metadata);

    res.json({ success: true });
  } catch (error) {
    console.error("Usage tracking error:", error);
    res.status(500).json({
      error: "خطأ في تتبع الاستخدام",
      code: "TRACKING_ERROR",
    });
  }
});

export default router;
