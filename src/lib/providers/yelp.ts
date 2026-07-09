import type { AppConfig } from "@/lib/config";
import type { PlacesProvider, PlacesNearbyOptions } from "@/lib/providers/contracts";
import type { GeoLocation, Place, PlaceReview } from "@/lib/types";

// Yelp Fusion places provider (free tier).
//
// Yelp gives us what OpenStreetMap cannot: real ratings, review counts, price
// levels, and -- for the busiest businesses -- actual review excerpts, which
// feed the sentiment and demand-signal analysis. One business-search request
// covers ratings for everything; review text is fetched only for the top few
// businesses to stay within the free tier's rate limits.
//
// Yelp coverage is strong in the US/Canada/Western Europe and thinner
// elsewhere, so the provider factory falls back to OSM when Yelp returns
// nothing for a location.

const SEARCH_URL = "https://api.yelp.com/v3/businesses/search";
// Yelp's search radius is capped at 40000 m.
const MAX_RADIUS = 40000;

export function createYelpPlacesProvider(config: AppConfig): PlacesProvider {
  const apiKey = config.yelp.apiKey;
  if (!apiKey) {
    throw new Error("Yelp provider created without an API key.");
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };

  return {
    async nearby(location: GeoLocation, opts?: PlacesNearbyOptions) {
      const radius = Math.min(
        opts?.radiusMeters ?? config.places.radiusMeters,
        MAX_RADIUS,
      );
      const limit = Math.min(opts?.limit ?? config.places.maxPlaces, 50);

      const params = new URLSearchParams({
        latitude: String(location.lat),
        longitude: String(location.lng),
        radius: String(Math.round(radius)),
        limit: String(limit),
        sort_by: "review_count",
      });

      const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`Yelp search failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as YelpSearchResponse;
      const businesses = data.businesses ?? [];
      const places = businesses.map((b) => mapBusiness(b, location));

      // Pull review excerpts for the busiest businesses so the analysis has
      // real text to mine. Done in parallel but capped to a small number to
      // respect Yelp's free-tier limits.
      const withReviews = places
        .filter((p) => (p.userRatingsTotal ?? 0) > 0)
        .slice(0, config.yelp.reviewFetchCount);

      await Promise.all(
        withReviews.map(async (place) => {
          const yelpId = place.id.replace(/^yelp-/, "");
          try {
            place.reviews = await fetchReviews(yelpId, authHeaders);
          } catch {
            // A failed review fetch is non-fatal: keep the place with its
            // rating, just without excerpts.
            place.reviews = [];
          }
        }),
      );

      return places;
    },
  };
}

async function fetchReviews(
  businessId: string,
  authHeaders: Record<string, string>,
): Promise<PlaceReview[]> {
  const res = await fetch(
    `https://api.yelp.com/v3/businesses/${encodeURIComponent(businessId)}/reviews?limit=3&sort_by=yelp_sort`,
    { headers: authHeaders, signal: AbortSignal.timeout(10_000) },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as YelpReviewsResponse;
  return (data.reviews ?? []).map((r) => ({
    author: r.user?.name,
    rating: r.rating,
    text: r.text,
    time: r.time_created ? Date.parse(r.time_created) / 1000 : undefined,
  }));
}

function mapBusiness(b: YelpBusiness, origin: GeoLocation): Place {
  const categories = (b.categories ?? []).map((c) => c.title);
  return {
    id: `yelp-${b.id}`,
    name: b.name,
    primaryCategory: categories[0] || "Business",
    categories,
    rating: b.rating,
    userRatingsTotal: b.review_count,
    // Yelp price is a "$".."$$$$" string; its length is the 1-4 level.
    priceLevel: b.price ? b.price.length : undefined,
    location: {
      lat: b.coordinates?.latitude ?? origin.lat,
      lng: b.coordinates?.longitude ?? origin.lng,
    },
    distanceMeters: b.distance != null ? Math.round(b.distance) : undefined,
    reviews: [],
  };
}

interface YelpSearchResponse {
  businesses?: YelpBusiness[];
}

interface YelpBusiness {
  id: string;
  name: string;
  rating?: number;
  review_count?: number;
  price?: string;
  categories?: Array<{ alias: string; title: string }>;
  coordinates?: { latitude: number; longitude: number };
  distance?: number;
}

interface YelpReviewsResponse {
  reviews?: Array<{
    text: string;
    rating: number;
    time_created?: string;
    user?: { name?: string };
  }>;
}
