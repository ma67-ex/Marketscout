// GET /api/geocode/suggest?q=...
//
// Type-ahead location suggestions for the search box. Proxies Nominatim
// (OpenStreetMap) server-side, so it works under the app's strict CSP
// (`connect-src 'self'` blocks the browser from calling Nominatim directly).
// Returns a short list that narrows as the query gets more specific; each item
// carries a concise, geocode-safe `value` (usually "City, State, Country") that
// the analyze endpoint can resolve back to the exact same place.

import { NextResponse } from "next/server";
import { checkRateLimit, clientKeyFrom } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Typing fires several requests; keep it generous but bounded per client.
const RATE_LIMIT = { limit: 40, windowMs: 60_000 };
// Nominatim's own cap on a search string; also our input guard.
const MAX_QUERY = 200;
// Below this, matches are too broad to be useful — skip the round-trip.
const MIN_QUERY = 3;

export interface LocationSuggestion {
  // Full, human-readable place name shown in the dropdown.
  label: string;
  // Concise string submitted for analysis, e.g. "Williamsville, New York,
  // United States". Kept short and unambiguous so re-geocoding lands here.
  value: string;
  lat: number;
  lng: number;
}

export async function GET(request: Request) {
  const rate = checkRateLimit(`suggest:${clientKeyFrom(request)}`, RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { suggestions: [] },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const q = (new URL(request.url).searchParams.get("q") || "")
    .trim()
    .slice(0, MAX_QUERY);
  if (q.length < MIN_QUERY) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Nominatim policy: identify via User-Agent, keep volume modest. Free, no
    // key. limit=6 keeps the dropdown short; addressdetails gives us city/state.
    const params = new URLSearchParams({
      q,
      format: "json",
      limit: "6",
      addressdetails: "1",
      "accept-language": "en",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "MarketScout/0.1 (local analysis tool)",
          Accept: "application/json",
        },
        // A slow suggestion is worse than none — fail fast and stay responsive.
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const results = (await res.json()) as NominatimResult[];
    const suggestions = results
      .map(toSuggestion)
      .filter((s): s is LocationSuggestion => s !== null);

    return NextResponse.json({ suggestions });
  } catch {
    // Suggestions are best-effort; the user can always type a full string and
    // let the analyze endpoint geocode it. Never surface an error here.
    return NextResponse.json({ suggestions: [] });
  }
}

function toSuggestion(r: NominatimResult): LocationSuggestion | null {
  const lat = Number.parseFloat(r.lat);
  const lng = Number.parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const a = r.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.suburb;
  const region = a.state || a.county;
  const country = a.country;

  // Prefer a compact "City, State, Country" when we have the parts; otherwise
  // fall back to the full display name (capped to the analyze length limit).
  const parts = [city, region, country].filter(Boolean) as string[];
  const value =
    parts.length >= 2 ? parts.join(", ") : r.display_name.slice(0, MAX_QUERY);

  return { label: r.display_name, value, lat, lng };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}
