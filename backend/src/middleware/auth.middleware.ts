/* Authentication and Authorization Middleware */
import { Request, Response, NextFunction } from "express";

/**
 * Verify that the request has a valid license key
 * This prevents unauthorized access to your API
 */
export const verifyLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get license key from header or body
    const licenseKey = (req.headers["x-license-key"] as string) || req.body.licenseKey;

    if (!licenseKey) {
      return res.status(401).json({
        error: "لم يتم العثور على مفتاح الترخيص",
        code: "NO_LICENSE_KEY",
      });
    }

    // Basic format validation
    if (licenseKey.length < 10) {
      return res.status(401).json({
        error: "مفتاح ترخيص غير صالح",
        code: "INVALID_LICENSE_FORMAT",
      });
    }

    // Attach license key to request for use in routes
    req.licenseKey = licenseKey;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      error: "خطأ في التحقق من الترخيص",
      code: "AUTH_ERROR",
    });
  }
};

/**
 * Verify API secret key for sensitive operations
 * This adds an extra layer of security
 */
export const verifyApiSecret = (req: Request, res: Response, next: NextFunction) => {
  const apiSecret = req.headers["x-api-secret"] as string;
  const expectedSecret = process.env.API_SECRET_KEY;

  if (!expectedSecret) {
    console.error("API_SECRET_KEY not configured in environment");
    return res.status(500).json({
      error: "Server configuration error",
      code: "CONFIG_ERROR",
    });
  }

  if (!apiSecret || apiSecret !== expectedSecret) {
    return res.status(403).json({
      error: "غير مصرح بالوصول",
      code: "FORBIDDEN",
    });
  }

  next();
};

// Extend Express Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      licenseKey?: string;
      deviceId?: string;
    }
  }
}
