import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { logAppError } from "./lib/tauri";

// Record uncaught frontend failures in the local error log so a bug report has
// something to show. Logging must never itself throw.
window.addEventListener("error", (event) => {
  logAppError("ui", event.message).catch(() => {});
});
window.addEventListener("unhandledrejection", (event) => {
  logAppError("ui-promise", String(event.reason)).catch(() => {});
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
