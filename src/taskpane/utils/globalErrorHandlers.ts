/* eslint-disable no-console */

export function installGlobalErrorHandlers(): void {
  if ((window as any).__global_error_handlers_installed__) return;
  (window as any).__global_error_handlers_installed__ = true;

  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      try {
        const details = {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error && (event.error.stack || event.error.message || String(event.error)),
        };
        console.error("Global error captured:", details);
      } catch (_) {
        // ignore
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      try {
        console.error("Unhandled promise rejection:", event.reason);
      } catch (_) {
        // ignore
      }
    },
    true
  );
}
