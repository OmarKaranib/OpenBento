import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress YouTube IFrame API removeChild errors in development
// These errors occur when the API clears/reinitializes player DOM content
// and are harmless - the app continues working correctly
if (import.meta.env.DEV) {
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (message && typeof message === 'string' && 
        message.includes("removeChild") && 
        message.includes("Node")) {
      console.log('[YouTube] Suppressed removeChild error (harmless dev-only issue)');
      return true; // Prevent error from propagating
    }
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };
}

createRoot(document.getElementById("root")!).render(<App />);
