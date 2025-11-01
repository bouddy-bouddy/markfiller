import { useState, useEffect } from "react";
import { licenseService } from "../services/licenseService";

interface UseLicenseResult {
  isLicenseValid: boolean;
  isCheckingLicense: boolean;
  teacherName: string | null;
  checkLicenseOnStartup: () => Promise<void>;
  handleLicenseValidated: () => void;
}

export const useLicense = (): UseLicenseResult => {
  const [isLicenseValid, setIsLicenseValid] = useState<boolean>(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState<boolean>(true);
  const [teacherName, setTeacherName] = useState<string | null>(null);

  const checkLicenseOnStartup = async () => {
    setIsCheckingLicense(true);

    try {
      if (licenseService.hasStoredLicense()) {
        const result = await licenseService.validateLicense();

        if (result.valid) {
          setIsLicenseValid(true);
          if (result.teacherName) {
            setTeacherName(result.teacherName);
          }
          // Track app launch
          await licenseService.trackUsage("app_launched");
        } else {
          // License invalid, show activation screen
          setIsLicenseValid(false);
        }
      } else {
        // No license stored, show activation screen
        setIsLicenseValid(false);
      }
    } catch (error) {
      console.error("License check failed:", error);
      setIsLicenseValid(false);
    } finally {
      setIsCheckingLicense(false);
    }
  };

  const handleLicenseValidated = () => {
    setIsLicenseValid(true);
    // Track successful license validation
    licenseService.trackUsage("license_validated");
  };

  // Check license on initialization
  useEffect(() => {
    checkLicenseOnStartup();
  }, []);

  return {
    isLicenseValid,
    isCheckingLicense,
    teacherName,
    checkLicenseOnStartup,
    handleLicenseValidated,
  };
};

