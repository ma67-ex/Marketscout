// Provider factory.
//
// Resolves config once and hands back a bundle of live-or-mock providers. This
// is the only place that decides mock vs. real, so the rest of the app never
// has to care which it got.

import { getConfig, resolveMockDecisions, type AppConfig } from "@/lib/config";
import type { PlacesProvider, ProviderBundle } from "@/lib/providers/contracts";
import { createGeocodingProvider } from "@/lib/providers/geocoding";
import { createPlacesProvider } from "@/lib/providers/places";
import { createYelpPlacesProvider } from "@/lib/providers/yelp";
import { createRedditProvider } from "@/lib/providers/reddit";
import { createAIProvider } from "@/lib/providers/ai";

export function getProviders(): ProviderBundle {
  const config = getConfig();
  const mock = resolveMockDecisions(config);

  return {
    geocoding: createGeocodingProvider(config, mock.geocoding),
    places: resolvePlacesProvider(config, mock.places),
    reddit: createRedditProvider(config, mock.reddit),
    ai: createAIProvider(config, mock.ai),
    usingMock: mock.usingSampleData,
  };
}

// Places source selection:
//   Yelp key present -> Yelp (real ratings + reviews), falling back to OSM
//     whenever Yelp errors or has no coverage for the location.
//   otherwise        -> OSM/Overpass (free, keyless) or mock when forced.
function resolvePlacesProvider(
  config: AppConfig,
  useMock: boolean,
): PlacesProvider {
  const osm = createPlacesProvider(config, useMock);
  if (useMock || !config.yelp.apiKey) {
    return osm;
  }

  const yelp = createYelpPlacesProvider(config);
  return {
    async nearby(location, opts) {
      try {
        const places = await yelp.nearby(location, opts);
        // Yelp coverage is thin outside major markets; if it returns nothing,
        // fall back to OSM so international searches still work.
        if (places.length > 0) return places;
      } catch (err) {
        console.error("[places] Yelp failed, falling back to OSM:", err);
      }
      return osm.nearby(location, opts);
    },
  };
}
