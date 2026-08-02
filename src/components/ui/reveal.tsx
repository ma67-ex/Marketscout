"use client";

// Scroll-reveal wrapper for the landing page. Default state is fully visible
// so content never depends on JS running (no-JS, slow hydration, headless
// renderers all see the finished page). On mount, only sections that are
// NOT already in the viewport get marked pending, then clear once they
// scroll into view -- above-the-fold content never flashes hidden.

import { useEffect, useRef, useState } from "react";

export default function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    setPending(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPending(false);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-pending={pending} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
