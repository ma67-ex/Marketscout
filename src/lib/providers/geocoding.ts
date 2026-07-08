import type { AppConfig } from "@/lib/config";
import type { GeocodingProvider } from "@/lib/providers/contracts";
import { mockGeocodeFor } from "@/lib/mock/dataset";

export function createGeocodingProvider(
  _config: AppConfig,
  useMock: boolean,
): GeocodingProvider {
  if (useMock) {
    return {
      async geocode(query) {
        return mockGeocodeFor(query);
      },
    };
  }

  // Live provider: Nominatim (OpenStreetMap). Free, no key required.
  // Usage policy: max 1 req/sec, identify via User-Agent.
  return {
    async geocode(query) {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "1",
        addressdetails: "1",
        // Keep place names readable regardless of the local script.
        "accept-language": "en",
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            "User-Agent": "MarketScout/0.1 (local analysis tool)",
            Accept: "application/json",
          },
          // Consistent with the other live providers: never hang the whole
          // analysis on a slow upstream.
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!res.ok) {
        throw new Error(`Geocoding failed: ${res.status} ${res.statusText}`);
      }

      const results = (await res.json()) as NominatimResult[];
      if (!results.length) {
        throw new Error(
          `Could not find a location matching "${query}". Try a more specific address or city name.`,
        );
      }

      const top = results[0];
      const addr = top.address || {};

      return {
        formattedAddress: top.display_name,
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        city:
          addr.city || addr.town || addr.village || addr.hamlet || undefined,
        region: addr.state || addr.county || undefined,
        country: addr.country || undefined,
      };
    },
  };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}
