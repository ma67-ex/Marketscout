"use client";

// Wireframe dotted globe rendered to canvas with d3-geo.
//
// Adapted from the stock component with one addition Market Scout needs: a
// `focus` prop. When set, the globe animates its rotation and zoom to center
// that coordinate and draws a marker on it; when cleared, it zooms back out
// and resumes the idle auto-rotation.

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface GlobeFocus {
  lat: number;
  lng: number;
}

interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
  focus?: GlobeFocus | null;
}

// Minimal GeoJSON shapes for the Natural Earth land file.
type Ring = [number, number][];
interface LandGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: Ring[] | Ring[][];
}
interface LandFeature {
  type: "Feature";
  geometry: LandGeometry;
  properties?: Record<string, unknown>;
}
interface LandCollection {
  type: "FeatureCollection";
  features: LandFeature[];
}

// Served from /public (same origin) so it loads under the app's strict CSP
// (`connect-src 'self'`) without depending on GitHub being reachable.
// Source: natural-earth-geojson 110m physical land (martynafford).
const LAND_DATA_URL = "/ne_110m_land.json";

// How much closer the camera gets when a location is focused.
const FOCUS_ZOOM = 1.65;
const FOCUS_ANIMATION_MS = 1400;

export default function RotatingEarth({
  width = 800,
  height = 600,
  className = "",
  focus = null,
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Shared mutable state between the setup effect and the focus effect.
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const rotationRef = useRef<[number, number]>([0, 0]);
  const baseRadiusRef = useRef(0);
  const autoRotateRef = useRef(true);
  const markerRef = useRef<GlobeFocus | null>(focus);
  const focusAnimationRef = useRef<d3.Timer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Set up responsive dimensions. Fall back to the requested size when the
    // window reports 0 (can happen if the effect runs before layout), and
    // floor both dimensions so the derived radius can never go <= 0 -- a
    // negative radius makes canvas arc() throw and blanks the globe.
    const viewportWidth = window.innerWidth || width;
    const viewportHeight = window.innerHeight || height;
    const containerWidth = Math.max(240, Math.min(width, viewportWidth - 40));
    const containerHeight = Math.max(240, Math.min(height, viewportHeight - 100));
    const radius = Math.min(containerWidth, containerHeight) / 2.5;
    baseRadiusRef.current = radius;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    context.scale(dpr, dpr);

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90);
    projectionRef.current = projection;

    const path = d3.geoPath().projection(projection).context(context);

    const pointInPolygon = (point: [number, number], polygon: Ring): boolean => {
      const [x, y] = point;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };

    const pointInFeature = (
      point: [number, number],
      feature: LandFeature,
    ): boolean => {
      const geometry = feature.geometry;

      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates as Ring[];
        if (!pointInPolygon(point, coordinates[0])) return false;
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) return false;
        }
        return true;
      }

      // MultiPolygon: inside if within any outer ring and not in its holes.
      for (const polygon of geometry.coordinates as Ring[][]) {
        if (pointInPolygon(point, polygon[0])) {
          let inHole = false;
          for (let i = 1; i < polygon.length; i++) {
            if (pointInPolygon(point, polygon[i])) {
              inHole = true;
              break;
            }
          }
          if (!inHole) return true;
        }
      }
      return false;
    };

    const generateDotsInPolygon = (feature: LandFeature, dotSpacing = 16) => {
      const dots: [number, number][] = [];
      const bounds = d3.geoBounds(feature as d3.GeoPermissibleObjects);
      const [[minLng, minLat], [maxLng, maxLat]] = bounds;
      const stepSize = dotSpacing * 0.08;

      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat];
          if (pointInFeature(point, feature)) {
            dots.push(point);
          }
        }
      }
      return dots;
    };

    const allDots: [number, number][] = [];
    let landFeatures: LandCollection | null = null;

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight);

      const currentScale = projection.scale();
      const scaleFactor = currentScale / radius;

      // Globe disc and outline.
      context.beginPath();
      context.arc(
        containerWidth / 2,
        containerHeight / 2,
        currentScale,
        0,
        2 * Math.PI,
      );
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

        // Halftone dots.
        allDots.forEach(([lng, lat]) => {
          const projected = projection([lng, lat]);
          if (
            projected &&
            projected[0] >= 0 &&
            projected[0] <= containerWidth &&
            projected[1] >= 0 &&
            projected[1] <= containerHeight
          ) {
            context.beginPath();
            context.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI);
            context.fillStyle = "#999999";
            context.fill();
          }
        });
      }

      // Location marker: only drawn when its point is on the near side of
      // the globe (great-circle distance from the view center under 90 deg).
      const marker = markerRef.current;
      if (marker) {
        const [rLambda, rPhi] = rotationRef.current;
        const distance = d3.geoDistance(
          [marker.lng, marker.lat],
          [-rLambda, -rPhi],
        );
        if (distance < Math.PI / 2) {
          const projected = projection([marker.lng, marker.lat]);
          if (projected) {
            const [x, y] = projected;
            context.beginPath();
            context.arc(x, y, 4.5, 0, 2 * Math.PI);
            context.fillStyle = "#ffffff";
            context.fill();
            context.beginPath();
            context.arc(x, y, 10, 0, 2 * Math.PI);
            context.strokeStyle = "#ffffff";
            context.lineWidth = 1.5;
            context.globalAlpha = 0.6;
            context.stroke();
            context.globalAlpha = 1;
          }
        }
      }
    };
    renderRef.current = render;

    const loadWorldData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(LAND_DATA_URL);
        if (!response.ok) throw new Error("Failed to load land data");

        landFeatures = (await response.json()) as LandCollection;
        landFeatures.features.forEach((feature) => {
          allDots.push(...generateDotsInPolygon(feature, 16));
        });

        render();
        setIsLoading(false);
      } catch (err) {
        console.error("[globe] load failed:", err);
        setError("Failed to load land map data");
        setIsLoading(false);
      }
    };

    // Idle auto-rotation. Time-based (degrees per second) so the speed is the
    // same regardless of the display's frame rate. Kept gentle on purpose.
    const ROTATION_DEG_PER_SEC = 8;
    let lastElapsed = 0;
    const rotate = (elapsed: number) => {
      const deltaMs = lastElapsed ? elapsed - lastElapsed : 0;
      lastElapsed = elapsed;
      if (autoRotateRef.current) {
        rotationRef.current[0] += (ROTATION_DEG_PER_SEC / 1000) * deltaMs;
        projection.rotate(rotationRef.current);
        render();
      }
    };
    const rotationTimer = d3.timer(rotate);

    const handleMouseDown = (event: MouseEvent) => {
      autoRotateRef.current = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const startRotation: [number, number] = [...rotationRef.current];

      const handleMouseMove = (moveEvent: MouseEvent) => {
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
      event.preventDefault();
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

    // If a focus already exists (e.g. after a resize re-runs this effect),
    // jump straight to it without animating.
    if (markerRef.current) {
      autoRotateRef.current = false;
      rotationRef.current = [-markerRef.current.lng, -markerRef.current.lat];
      projection.rotate(rotationRef.current);
      projection.scale(radius * FOCUS_ZOOM);
    }

    loadWorldData();

    return () => {
      rotationTimer.stop();
      focusAnimationRef.current?.stop();
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [width, height]);

  // Animate to a newly focused location (or back out when focus clears).
  useEffect(() => {
    markerRef.current = focus;

    const projection = projectionRef.current;
    const render = renderRef.current;
    if (!projection || !render) return;

    focusAnimationRef.current?.stop();

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
      render();

      if (t >= 1) {
        timer.stop();
        if (!focus) autoRotateRef.current = true;
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
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-2xl bg-background"
        style={{ maxWidth: "100%", height: "auto" }}
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
