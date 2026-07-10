"use client";

// Ambient background: a handful of thin rings tumbling slowly in 3D, scattered
// behind the page content. Reads as "orbits" / signal loops — a quiet nod to
// the wireframe globe's motif without repeating it outright. Purely
// decorative (fixed, pointer-events: none, negative z-index) and monochrome
// so it never competes with the black/white interface.
//
// Each ring is a flat circle tilted in 3D. Rather than doing full matrix
// projection, we exploit that a tilted circle projects to an ellipse: as the
// tilt angle sweeps, the ellipse's height oscillates through zero and back,
// which reads as the ring rotating edge-on and open again — a cheap, fast
// stand-in for a real 3D transform.

import { useEffect, useRef } from "react";

interface Ring {
  xPct: number;
  yPct: number;
  radius: number;
  tiltSpeed: number;
  tiltPhase: number;
  spinSpeed: number;
  spinPhase: number;
  opacity: number;
}

const RING_COUNT = 6;

function makeRings(seed: number): Ring[] {
  // Deterministic pseudo-randomness so layout doesn't jump between renders.
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  return Array.from({ length: RING_COUNT }, (_, i) => ({
    xPct: 0.08 + rand() * 0.84,
    yPct: 0.1 + rand() * 0.8,
    radius: 60 + rand() * 130,
    tiltSpeed: 0.00006 + rand() * 0.00007,
    tiltPhase: rand() * Math.PI * 2,
    spinSpeed: (0.00004 + rand() * 0.00005) * (i % 2 === 0 ? 1 : -1),
    spinPhase: rand() * Math.PI * 2,
    opacity: 0.05 + rand() * 0.07,
  }));
}

export default function OrbitLoopsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const rings = makeRings(42);

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (elapsed: number) => {
      ctx.clearRect(0, 0, width, height);

      for (const ring of rings) {
        const cx = ring.xPct * width;
        const cy = ring.yPct * height;
        const tilt = Math.sin(elapsed * ring.tiltSpeed + ring.tiltPhase);
        const spin = elapsed * ring.spinSpeed + ring.spinPhase;

        const rx = ring.radius;
        const ry = ring.radius * tilt;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, Math.abs(ry), 0, 0, Math.PI * 2);
        // Fade a touch as the ring turns edge-on, so it doesn't flash into a
        // hard line.
        const edgeFade = 0.35 + 0.65 * Math.abs(tilt);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ring.opacity * edgeFade})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    };

    if (reduceMotion) {
      draw(0);
      return () => window.removeEventListener("resize", resize);
    }

    let frame = 0;
    const loop = (t: number) => {
      draw(t);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
