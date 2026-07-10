"use client";

// A one-time notice, not a cookie banner — Market Scout doesn't set cookies.
// It tells first-time visitors what happens to what they type before they
// type it: the location and field of study get sent to OpenStreetMap and,
// if configured, an AI provider, to build the report. Dismissal is
// remembered in localStorage (not a cookie) so it only shows once per
// browser. See src/app/privacy/page.tsx for the full policy.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "market-scout-consent-ack-v1";

export default function ConsentNotice() {
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reading localStorage only works client-side, so this can't be done as
    // part of the initial render (server and client would disagree). One
    // setState right after mount is the standard, unavoidable way to surface
    // client-only storage into React state here.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage can be blocked (private mode, locked-down browser settings).
      // Fail open and just show the notice every visit rather than crash.
      setVisible(true);
    }
  }, []);

  // The bar is fixed, so it would otherwise sit on top of (and swallow
  // clicks on) whatever is at the bottom of the page underneath it, like the
  // footer's privacy link. Reserve exactly its height on the body while shown.
  useEffect(() => {
    if (!visible || !barRef.current) return;
    const height = barRef.current.offsetHeight;
    document.body.style.paddingBottom = `${height}px`;
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do if storage isn't available; the notice will just
      // reappear next visit, which is the safe default.
    }
  }

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      role="dialog"
      aria-live="polite"
      aria-label="Data use notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-5 py-4 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Market Scout sends the location and field of study you enter to
          OpenStreetMap, and, if the operator has configured one, an AI
          provider, to build your report. Nothing you submit is stored on
          our servers afterward, and this site doesn&rsquo;t use tracking
          cookies. Read the{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </Link>{" "}
          for the details.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="w-full shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
