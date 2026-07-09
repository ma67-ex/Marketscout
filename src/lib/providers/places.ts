import type { AppConfig } from "@/lib/config";
import type { PlacesProvider, PlacesNearbyOptions } from "@/lib/providers/contracts";
import type { GeoLocation, Place } from "@/lib/types";
import { mockPlacesFor, haversine } from "@/lib/mock/dataset";

export function createPlacesProvider(
  config: AppConfig,
  useMock: boolean,
): PlacesProvider {
  if (useMock) {
    return {
      async nearby(location, opts) {
        const limit = opts?.limit ?? config.places.maxPlaces;
        return mockPlacesFor(location, "", limit);
      },
    };
  }

  // Live provider: Overpass API (OpenStreetMap). Free, no key required.
  // Queries for amenities/shops within a radius of the given point.
  return {
    async nearby(location: GeoLocation, opts?: PlacesNearbyOptions) {
      const radius = opts?.radiusMeters ?? config.places.radiusMeters;
      const limit = opts?.limit ?? config.places.maxPlaces;

      // Overpass QL: businesses and services within radius. Nodes only, and
      // capped server-side -- fetching ways/relations with `out center` is far
      // slower and frequently times out on the free mirrors, especially in
      // dense cities. Named POIs are overwhelmingly mapped as nodes, so this
      // keeps the analysis representative while staying fast worldwide.
      const query = `
        [out:json][timeout:20];
        (
          node["amenity"](around:${radius},${location.lat},${location.lng});
          node["shop"](around:${radius},${location.lat},${location.lng});
        );
        out ${limit};
      `;

      const data = await queryOverpass(query);
      return data.elements.map((el, i) => mapOverpassElement(el, i, location));
    },
  };
}

// The free public Overpass servers rate-limit and occasionally time out, so
// try each mirror in turn and only fail if all of them do.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function queryOverpass(query: string): Promise<OverpassResponse> {
  let lastError = "";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // OSM services reject requests without an identifying User-Agent.
          "User-Agent": "MarketScout/0.1 (local analysis tool)",
        },
        body: `data=${encodeURIComponent(query)}`,
        // Fail over to the next mirror quickly rather than hanging on one
        // overloaded server. The Overpass-side [timeout:20] bounds the work.
        signal: AbortSignal.timeout(22_000),
      });

      if (res.ok) {
        return (await res.json()) as OverpassResponse;
      }
      lastError = `${res.status} ${res.statusText}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(
    `All Overpass servers are busy right now (last error: ${lastError}). Wait a moment and try again.`,
  );
}

// Map an Overpass element to our Place type. OSM does not have ratings or
// reviews, so those fields come back empty -- the analysis engine handles
// that gracefully and leans on Reddit signals instead.
function mapOverpassElement(
  el: OverpassElement,
  index: number,
  origin: GeoLocation,
): Place {
  const tags = el.tags || {};
  const lat = el.center?.lat ?? el.lat ?? origin.lat;
  const lng = el.center?.lon ?? el.lon ?? origin.lng;

  const amenity = tags.amenity || "";
  const shop = tags.shop || "";
  const primaryCategory = formatCategory(amenity || shop);

  const categories: string[] = [];
  if (amenity) categories.push(amenity);
  if (shop) categories.push(shop);
  if (tags.cuisine) categories.push(...tags.cuisine.split(";").map((s) => s.trim()));

  return {
    id: `osm-${el.type}-${el.id}`,
    name: tags.name || `${primaryCategory} (unnamed)`,
    primaryCategory,
    categories,
    rating: undefined,
    userRatingsTotal: undefined,
    priceLevel: undefined,
    location: { lat, lng },
    distanceMeters: Math.round(haversine(origin.lat, origin.lng, lat, lng)),
    reviews: [],
  };
}

// Turn an OSM tag value like "fast_food" into "Fast food".
function formatCategory(raw: string): string {
  if (!raw) return "Other";
  return raw
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}
