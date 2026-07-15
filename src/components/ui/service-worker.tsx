"use client";

// Registers the service worker (public/sw.js) once the page has loaded, so the
// app shell and globe data become available offline. No UI — mount it once in
// the root layout. Registration is skipped in development, where the SW cache
// would fight Next's hot-reload of chunks.

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing (e.g. unsupported context) is non-fatal; the
        // app still works online, it just loses the offline fallback.
      });
    };

    // Wait for load so registration never competes with initial rendering.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
