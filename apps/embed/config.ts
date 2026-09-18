// In production widget.js is served by the widget app itself, so the iframe
// URL defaults to the origin the script was loaded from.
const scriptOrigin =
  document.currentScript instanceof HTMLScriptElement && document.currentScript.src
    ? new URL(document.currentScript.src).origin
    : null;

export const EMBED_CONFIG = {
  WIDGET_URL:
    import.meta.env.VITE_WIDGET_URL ||
    (import.meta.env.PROD && scriptOrigin) ||
    "http://localhost:3001",
  DEFAULT_ORG_ID: "org_31QtvqJKwhtvop04esLJMkmFouB",
  DEFAULT_POSITION: "bottom-right" as const,
};
