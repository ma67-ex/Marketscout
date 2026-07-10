"use client";

// Wireframe globe rendered to canvas with d3-geo.
//
// Adapted from the stock component with one addition Market Scout needs: a
// `focus` prop. When set, the globe animates its rotation and zoom to center
// that coordinate, then floods the containing US state (or country, outside
// the US) in red so the selected area reads clearly at a glance. When
// cleared, it zooms back out and resumes the idle auto-rotation.
//
// Sizing: the canvas is a CSS square (`aspect-ratio: 1 / 1`) and a
// ResizeObserver keeps its backing bitmap locked to the *actual rendered*
// box size. Never derive the bitmap from viewport dimensions or set width
// and height independently -- any mismatch between the bitmap's aspect
// ratio and the box it's stretched into visibly squishes the circle.

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface GlobeFocus {
  lat: number;
  lng: number;
}

interface RotatingEarthProps {
  size?: number;
  className?: string;
  focus?: GlobeFocus | null;
}

// Minimal GeoJSON shapes for the Natural Earth files this component loads.
interface GeoFeature {
  type: "Feature";
  geometry: d3.GeoGeometryObjects;
  properties?: Record<string, unknown>;
}
interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

// Served from /public (same origin) so it loads under the app's strict CSP
// (`connect-src 'self'`) without depending on GitHub being reachable.
// Source: natural-earth-geojson 110m (martynafford), trimmed to the
// properties this component actually reads.
const LAND_DATA_URL = "/ne_110m_land.json";
const US_STATES_URL = "/ne_110m_us_states.json";
const COUNTRIES_URL = "/ne_110m_countries.json";

// How much closer the camera gets when a location is focused.
const FOCUS_ZOOM = 1.65;
const FOCUS_ANIMATION_MS = 1400;

// Highlight color: matches the app's --destructive token family so the red
// reads as intentional accent, not a foreign color.
const HIGHLIGHT_FILL = "220, 38, 38";

export default function RotatingEarth({
  size = 560,
  className = "",
  focus = null,
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Shared mutable state between the setup effect and the focus effect.
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const renderRef = useRef<((elapsed?: number) => void) | null>(null);
  const rotationRef = useRef<[number, number]>([0, 0]);
  const baseRadiusRef = useRef(0);
  const boxSizeRef = useRef(0);
  const autoRotateRef = useRef(true);
  const markerRef = useRef<GlobeFocus | null>(focus);
  const focusAnimationRef = useRef<d3.Timer | null>(null);
  const pulseTimerRef = useRef<d3.Timer | null>(null);
  const highlightFeatureRef = useRef<GeoFeature | null>(null);
  const statesRef = useRef<GeoCollection | null>(null);
  const countriesRef = useRef<GeoCollection | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas = canvasEl;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let landFeatures: GeoCollection | null = null;
    let started = false;
    let cleanupInteraction: (() => void) | null = null;

    const render = (elapsed = 0) => {
      const projection = projectionRef.current;
      const boxSize = boxSizeRef.current;
      const radius = baseRadiusRef.current;
      if (!projection || !boxSize || !radius) return;

      const path = d3.geoPath().projection(projection).context(context);
      context.clearRect(0, 0, boxSize, boxSize);

      const currentScale = projection.scale();
      const scaleFactor = currentScale / radius;

      // Globe disc and outline.
      context.beginPath();
      context.arc(boxSize / 2, boxSize / 2, currentScale, 0, 2 * Math.PI);
      context.fillStyle = "#000000";
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2 * scaleFactor;
      context.stroke();

      if (landFeatures) {
        // Graticule.
        const graticule = d3.geoGraticule();
        context.beginPath();
        path(graticule());
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1 * scaleFactor;
        context.globalAlpha = 0.25;
        context.stroke();
        context.globalAlpha = 1;

        // Land outlines.
        context.beginPath();
        landFeatures.features.forEach((feature) => {
          path(feature as d3.GeoPermissibleObjects);
        });
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1 * scaleFactor;
        context.stroke();
      }

      // Selected area: the containing state (or country, outside the US)
      // floods red with a slow pulse instead of a pinned marker dot.
      const highlight = highlightFeatureRef.current;
      if (highlight) {
        const pulse = 0.4 + 0.18 * Math.sin(elapsed / 650);
        context.beginPath();
        path(highlight as d3.GeoPermissibleObjects);
        context.fillStyle = `rgba(${HIGHLIGHT_FILL}, ${pulse})`;
        context.fill();
        context.strokeStyle = `rgba(${HIGHLIGHT_FILL}, 0.9)`;
        context.lineWidth = 1.5 * scaleFactor;
        context.stroke();
      }
    };
    renderRef.current = render;

    // (Re)fit the projection to the box's current rendered size, preserving
    // the current zoom ratio so a mid-focus resize doesn't snap the view.
    const applySize = (renderedSize: number) => {
      const boxSize = Math.max(160, Math.round(renderedSize));
      if (boxSize === boxSizeRef.current) return;

      const prevRadius = baseRadiusRef.current;
      const prevScale = projectionRef.current?.scale();
      const zoomRatio = prevRadius && prevScale ? prevScale / prevRadius : 1;

      boxSizeRef.current = boxSize;
      const radius = boxSize / 2.5;
      baseRadiusRef.current = radius;

      canvas.width = boxSize * dpr;
      canvas.height = boxSize * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!projectionRef.current) {
        projectionRef.current = d3
          .geoOrthographic()
          .scale(radius)
          .translate([boxSize / 2, boxSize / 2])
          .clipAngle(90);
      } else {
        projectionRef.current
          .translate([boxSize / 2, boxSize / 2])
          .scale(radius * zoomRatio);
      }

      render();

      if (!started) {
        started = true;
        cleanupInteraction = setupInteractionAndData();
      }
    };

    // Idle auto-rotation. Time-based (degrees per second) so the speed is the
    // same regardless of the display's frame rate. Kept gentle on purpose.
    const ROTATION_DEG_PER_SEC = 8;
    let lastElapsed = 0;
    const rotate = (elapsed: number) => {
      const projection = projectionRef.current;
      if (!projection) return;
      const deltaMs = lastElapsed ? elapsed - lastElapsed : 0;
      lastElapsed = elapsed;
      if (autoRotateRef.current) {
        rotationRef.current[0] += (ROTATION_DEG_PER_SEC / 1000) * deltaMs;
        projection.rotate(rotationRef.current);
        render(elapsed);
      }
    };

    function setupInteractionAndData() {
      const rotationTimer = d3.timer(rotate);

      const handleMouseDown = (event: MouseEvent) => {
        autoRotateRef.current = false;
        const startX = event.clientX;
        const startY = event.clientY;
        const startRotation: [number, number] = [...rotationRef.current];

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const projection = projectionRef.current;
          if (!projection) return;
          const sensitivity = 0.5;
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          rotationRef.current[0] = startRotation[0] + dx * sensitivity;
          rotationRef.current[1] = Math.max(
            -90,
            Math.min(90, startRotation[1] - dy * sensitivity),
          );
          projection.rotate(rotationRef.current);
          render();
        };

        const handleMouseUp = () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          // Only resume the idle spin when nothing is focused.
          setTimeout(() => {
            if (!markerRef.current) autoRotateRef.current = true;
          }, 10);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      };

      const handleWheel = (event: WheelEvent) => {
        const projection = projectionRef.current;
        if (!projection) return;
        event.preventDefault();
        const radius = baseRadiusRef.current;
        const factor = event.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(
          radius * 0.5,
          Math.min(radius * 3, projection.scale() * factor),
        );
        projection.scale(newScale);
        render();
      };

      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("wheel", handleWheel, { passive: false });

      // If a focus already exists (e.g. after remount), jump straight to it
      // without animating.
      const projection = projectionRef.current;
      if (markerRef.current && projection) {
        autoRotateRef.current = false;
        rotationRef.current = [-markerRef.current.lng, -markerRef.current.lat];
        projection.rotate(rotationRef.current);
        projection.scale(baseRadiusRef.current * FOCUS_ZOOM);
      }

      const loadWorldData = async () => {
        try {
          setIsLoading(true);
          const [landRes, statesRes, countriesRes] = await Promise.all([
            fetch(LAND_DATA_URL),
            fetch(US_STATES_URL),
            fetch(COUNTRIES_URL),
          ]);
          if (!landRes.ok) throw new Error("Failed to load land data");

          landFeatures = (await landRes.json()) as GeoCollection;
          statesRef.current = statesRes.ok
            ? ((await statesRes.json()) as GeoCollection)
            : null;
          countriesRef.current = countriesRes.ok
            ? ((await countriesRes.json()) as GeoCollection)
            : null;

          render();
          setIsLoading(false);
        } catch (err) {
          console.error("[globe] load failed:", err);
          setError("Failed to load land map data");
          setIsLoading(false);
        }
      };
      loadWorldData();

      return () => {
        rotationTimer.stop();
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("wheel", handleWheel);
      };
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const renderedSize =
        entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      applySize(renderedSize);
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      cleanupInteraction?.();
      focusAnimationRef.current?.stop();
      pulseTimerRef.current?.stop();
    };
  }, []);

  // Animate to a newly focused location (or back out when focus clears), and
  // figure out which state/country polygon should flood red.
  useEffect(() => {
    markerRef.current = focus;

    const projection = projectionRef.current;
    const render = renderRef.current;
    if (!projection || !render) return;

    focusAnimationRef.current?.stop();
    pulseTimerRef.current?.stop();

    if (focus) {
      const point: [number, number] = [focus.lng, focus.lat];
      const state = statesRef.current?.features.find((f) =>
        d3.geoContains(f as d3.GeoPermissibleObjects, point),
      );
      const country = state
        ? undefined
        : countriesRef.current?.features.find((f) =>
            d3.geoContains(f as d3.GeoPermissibleObjects, point),
          );
      highlightFeatureRef.current = state ?? country ?? null;
    } else {
      highlightFeatureRef.current = null;
    }

    const startRotation: [number, number] = [...rotationRef.current];
    const startScale = projection.scale();
    const baseRadius = baseRadiusRef.current;

    const targetRotation: [number, number] = focus
      ? [-focus.lng, -focus.lat]
      : [startRotation[0], 0];
    const targetScale = focus ? baseRadius * FOCUS_ZOOM : baseRadius;

    // Take the short way around for longitude.
    let dLambda = targetRotation[0] - startRotation[0];
    dLambda = ((((dLambda + 180) % 360) + 360) % 360) - 180;
    const dPhi = targetRotation[1] - startRotation[1];
    const dScale = targetScale - startScale;

    autoRotateRef.current = false;

    const timer = d3.timer((elapsed) => {
      const t = Math.min(1, elapsed / FOCUS_ANIMATION_MS);
      const e = d3.easeCubicInOut(t);

      rotationRef.current[0] = startRotation[0] + dLambda * e;
      rotationRef.current[1] = startRotation[1] + dPhi * e;
      projection.rotate(rotationRef.current);
      projection.scale(startScale + dScale * e);
      render(elapsed);

      if (t >= 1) {
        timer.stop();
        if (!focus) {
          autoRotateRef.current = true;
        } else if (highlightFeatureRef.current) {
          // Keep the highlighted area pulsing gently while it's focused.
          const pulseTimer = d3.timer((pulseElapsed) => {
            render(FOCUS_ANIMATION_MS + pulseElapsed);
          });
          pulseTimerRef.current = pulseTimer;
        }
      }
    });
    focusAnimationRef.current = timer;

    return () => {
      timer.stop();
    };
  }, [focus]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-card rounded-2xl p-8 ${className}`}
      >
        <div className="text-center">
          <p className="text-destructive-foreground font-semibold mb-2">
            Error loading Earth visualization
          </p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`} style={{ maxWidth: size }}>
      <canvas
        ref={canvasRef}
        className="block w-full rounded-2xl"
        style={{ aspectRatio: "1 / 1" }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading globe...</p>
        </div>
      )}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground px-2 py-1 rounded-md bg-card">
        Drag to rotate. Scroll to zoom.
      </div>
    </div>
  );
}
