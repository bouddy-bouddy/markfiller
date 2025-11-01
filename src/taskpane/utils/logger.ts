/**
 * Production-safe logging utility
 * Automatically disables console logs in production builds
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Logger class with conditional logging based on environment
 */
class Logger {
  log(...args: any[]): void {
    if (!IS_PRODUCTION) {
      console.log(...args);
    }
  }

  warn(...args: any[]): void {
    if (!IS_PRODUCTION) {
      console.warn(...args);
    }
  }

  error(...args: any[]): void {
    // Always log errors, even in production
    console.error(...args);
  }

  info(...args: any[]): void {
    if (!IS_PRODUCTION) {
      console.info(...args);
    }
  }

  debug(...args: any[]): void {
    if (!IS_PRODUCTION) {
      console.debug(...args);
    }
  }

  /**
   * Group console logs (only in development)
   */
  group(label: string): void {
    if (!IS_PRODUCTION && console.group) {
      console.group(label);
    }
  }

  /**
   * End group (only in development)
   */
  groupEnd(): void {
    if (!IS_PRODUCTION && console.groupEnd) {
      console.groupEnd();
    }
  }

  /**
   * Performance timing (only in development)
   */
  time(label: string): void {
    if (!IS_PRODUCTION && console.time) {
      console.time(label);
    }
  }

  /**
   * End performance timing (only in development)
   */
  timeEnd(label: string): void {
    if (!IS_PRODUCTION && console.timeEnd) {
      console.timeEnd(label);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// For backwards compatibility, also export individual methods
export const { log, warn, error, info, debug, group, groupEnd, time, timeEnd } = logger;

