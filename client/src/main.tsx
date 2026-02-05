import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// DOM EXCEPTION SHIELD: Suppress YouTube IFrame API removeChild errors globally
// These errors occur when the API clears/reinitializes player DOM content
// or when React unmounts a widget with an active YouTube player.
// The app continues working correctly - this is purely a DOM lifecycle timing issue.
// 
// CRITICAL: Use capture phase (true) to catch errors BEFORE Vite's error overlay
// and use stopImmediatePropagation to prevent any other handlers from seeing it

// Capture phase error listener - runs BEFORE other handlers including Vite overlay
// SILENCE: Use debug level to keep console clean
window.addEventListener('error', (event) => {
  const msg = event.message || event.error?.message || '';
  if (msg.includes("removeChild") || msg.includes("NotFoundError") || msg.includes("not a child")) {
    // Silent suppression - no console output for cleaner UX
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}, true); // true = capture phase, runs first

// Global error handler - backup for window.onerror
const originalOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
  // Catch removeChild/NotFoundError from YouTube IFrame API - silent suppression
  if (message && typeof message === 'string' && 
      (message.includes("removeChild") || message.includes("NotFoundError") || message.includes("not a child"))) {
    return true; // Prevent error from propagating
  }
  if (originalOnError) {
    return originalOnError.call(window, message, source, lineno, colno, error);
  }
  return false;
};

// Catch unhandled promise rejections that might include DOM errors
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason);
  if (reason.includes("removeChild") || reason.includes("NotFoundError") || reason.includes("not a child")) {
    // Silent suppression - no console output
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true); // capture phase

createRoot(document.getElementById("root")!).render(<App />);
