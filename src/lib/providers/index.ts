// Provider factory.
//
// Resolves config once and hands back a bundle of live-or-mock providers. This
// is the only place that decides mock vs. real, so the rest of the app never
// has to care which it got.

import { getConfig, resolveMockDecisions } from "@/lib/config";
import type { ProviderBundle } from "@/lib/providers/contracts";
import { createGeocodingProvider } from "@/lib/providers/geocoding";
import { createPlacesProvider } from "@/lib/providers/places";
import { createRedditProvider } from "@/lib/providers/reddit";
import { createAIProvider } from "@/lib/providers/ai";

export function getProviders(): ProviderBundle {
  const config = getConfig();
  const mock = resolveMockDecisions(config);

  return {
    geocoding: createGeocodingProvider(config, mock.geocoding),
    places: createPlacesProvider(config, mock.places),
    reddit: createRedditProvider(config, mock.reddit),
    ai: createAIProvider(config, mock.ai),
    usingMock: mock.any,
  };
}
