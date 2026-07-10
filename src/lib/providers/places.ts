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
      //
      // The amenity filter excludes high-volume street furniture (benches,
      // parking, waste baskets, ...). In a city like London these outnumber
      // real businesses many times over, and scanning them all is what makes
      // the free mirrors time out. Dropping them speeds the query up sharply
      // and also removes noise from the category analysis.
      const around = `(around:${radius},${location.lat},${location.lng})`;
      const query = `
        [out:json][timeout:20];
        (
          node["amenity"]["amenity"!~"${AMENITY_EXCLUDE}"]${around};
          node["shop"]${around};
        );
        out ${limit};
      `;

      const data = await queryOverpass(query);
      return data.elements.map((el, i) => mapOverpassElement(el, i, location));
    },
  };
}

// High-volume, non-business amenity values to exclude from the query. These
// are street furniture and infrastructure that swamp dense cities and carry
// no market-analysis signal. Written as an Overpass regex alternation.
const AMENITY_EXCLUDE = [
  "bench",
  "waste_basket",
  "waste_disposal",
  "bicycle_parking",
  "motorcycle_parking",
  "parking",
  "parking_space",
  "parking_entrance",
  "recycling",
  "drinking_water",
  "fountain",
  "post_box",
  "telephone",
  "shelter",
  "clock",
  "vending_machine",
  "charging_station",
  "bicycle_repair_station",
  "grave_yard",
  "hunting_stand",
  "taxi",
  "bbq",
  "street_lamp",
].join("|");

// The free public Overpass servers rate-limit and occasionally time out, so
// try each mirror in turn and only fail if all of them do.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function queryOverpass(query: string): Promise<OverpassResponse> {
  // Race all mirrors at once instead of trying them one at a time -- a
  // sequential retry chain means a slow/overloaded mirror blocks the ones
  // behind it even though they're independent servers. Promise.any returns
  // as soon as the first one succeeds; a mirror that 200s with malformed
  // data is treated as a failure so the others still get a chance.
  const attempts = OVERPASS_ENDPOINTS.map((endpoint) => queryOneMirror(endpoint, query));

  try {
    return await Promise.any(attempts);
  } catch (err) {
    const lastError =
      err instanceof AggregateError
        ? err.errors.map((e) => String(e?.message ?? e)).join("; ")
        : String(err);
    throw new Error(
      `All Overpass servers are busy right now (last error: ${lastError}). Wait a moment and try again.`,
    );
  }
}

async function queryOneMirror(endpoint: string, query: string): Promise<OverpassResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // OSM services reject requests without an identifying User-Agent.
      "User-Agent": "MarketScout/0.1 (local analysis tool)",
    },
    body: `data=${encodeURIComponent(query)}`,
    // Bound each mirror's own wait; the Overpass-side [timeout:20] bounds
    // the server-side work.
    signal: AbortSignal.timeout(22_000),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as OverpassResponse;
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
