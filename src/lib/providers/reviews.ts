import type { AppConfig } from "@/lib/config";
import type { ReviewsProvider, ReviewsSearchOptions } from "@/lib/providers/contracts";
import type { GeoLocation, PlaceReview } from "@/lib/types";

// Keyless public reviews via Mangrove Reviews (https://mangrove.reviews).
//
// Mangrove is an open, nonprofit review dataset with a public API that needs
// no key, no login, and no card. Coverage is sparse compared with the big
// platforms, but every review returned is real. We query by area name and feed
// the review text into the same sentiment/demand analysis the rest of the app
// uses, so wherever Mangrove has data the "what people say" signal is real.

const MANGROVE_URL = "https://api.mangrove.reviews/reviews";

export function createReviewsProvider(
  _config: AppConfig,
  useMock: boolean,
): ReviewsProvider {
  if (useMock) {
    // Offline/demo mode: the mock places already carry sample reviews, so the
    // keyless review corpus is simply empty here.
    return {
      async nearby() {
        return [];
      },
    };
  }

  return {
    async nearby(location: GeoLocation, opts?: ReviewsSearchOptions) {
      const limit = opts?.limit ?? 100;

      // Geocoders often return a formal name ("Greater London") that does not
      // match how Mangrove indexes a place ("London"), so query both the raw
      // and a cleaned city name and merge the results.
      const candidates = queryCandidates(location);
      if (candidates.length === 0) return [];

      const byText = new Map<string, PlaceReview>();
      for (const term of candidates) {
        for (const review of await fetchReviews(term, limit)) {
          if (!byText.has(review.text)) byText.set(review.text, review);
        }
        if (byText.size >= limit) break;
      }

      return Array.from(byText.values()).slice(0, limit);
    },
  };
}

async function fetchReviews(
  term: string,
  limit: number,
): Promise<PlaceReview[]> {
  const params = new URLSearchParams({ q: term, limit: String(limit) });
  try {
    const res = await fetch(`${MANGROVE_URL}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as MangroveResponse;
    const reviews: PlaceReview[] = [];
    for (const item of data.reviews ?? []) {
      const p = item.payload;
      // Text-only reviews (no opinion) carry no signal for us; skip them.
      if (!p?.opinion) continue;
      reviews.push({
        author: subjectName(p.sub),
        // Mangrove ratings are 0-100; map to the app's 1-5 scale. Some
        // reviews have no rating, in which case treat it as neutral (3).
        rating: p.rating != null ? clampStar(p.rating / 20) : 3,
        text: p.opinion,
        time: p.iat,
      });
    }
    return reviews;
  } catch {
    // Non-fatal: no keyless reviews for this term.
    return [];
  }
}

// Distinct area names to try, most specific first.
function queryCandidates(location: GeoLocation): string[] {
  const terms = new Set<string>();
  const add = (v: string | undefined) => {
    const t = v?.trim();
    if (t) terms.add(t);
  };
  add(location.city);
  if (location.city) add(cleanCityName(location.city));
  add(location.region);
  return Array.from(terms);
}

// Strip administrative qualifiers a geocoder adds but Mangrove usually omits,
// e.g. "Greater London" -> "London", "City of Toronto" -> "Toronto".
function cleanCityName(city: string): string {
  return city
    .replace(/^(greater|city of|borough of|metropolitan|municipality of)\s+/i, "")
    .replace(/\s+(city|metropolitan area|municipality)$/i, "")
    .trim();
}

// Mangrove subjects are geo URIs like "geo:52.5,13.4?q=Cafe%20Name&u=30".
// Pull the human-readable place name out of the `q` parameter.
function subjectName(sub: string | undefined): string | undefined {
  if (!sub) return undefined;
  const match = sub.match(/[?&]q=([^&]+)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}

function clampStar(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

interface MangroveResponse {
  reviews?: Array<{
    payload?: {
      sub?: string;
      rating?: number | null;
      opinion?: string;
      iat?: number;
    };
  }>;
}
