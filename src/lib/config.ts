// Runtime configuration.
//
// The whole app runs in demo mode out of the box: with no API keys present,
// every provider resolves to its mock implementation and the app is fully
// usable. When a key is added to the environment, that one provider switches to
// live automatically. There is nothing else to change.

export interface AppConfig {
  // Free geocoding via Nominatim (OpenStreetMap). No API key needed.
  geocoding: {
    radiusMeters: number;
  };
  // Free nearby places via Overpass API (OpenStreetMap). No API key needed.
  places: {
    radiusMeters: number;
    maxPlaces: number;
  };
  reddit: {
    clientId?: string;
    clientSecret?: string;
    // Reddit requires a descriptive User-Agent on every request.
    userAgent: string;
    maxPosts: number;
  };
  ai: {
    apiKey?: string;
    model: string;
  };
  // Global override. Set MARKET_SCOUT_FORCE_MOCK=1 to force mock data even if
  // keys are present (useful for local development and demos).
  forceMock: boolean;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function getConfig(): AppConfig {
  return {
    geocoding: {
      radiusMeters: envInt("MARKET_SCOUT_RADIUS_METERS", 2500),
    },
    places: {
      radiusMeters: envInt("MARKET_SCOUT_RADIUS_METERS", 2500),
      maxPlaces: envInt("MARKET_SCOUT_MAX_PLACES", 40),
    },
    reddit: {
      clientId: process.env.REDDIT_CLIENT_ID?.trim() || undefined,
      clientSecret: process.env.REDDIT_CLIENT_SECRET?.trim() || undefined,
      userAgent:
        process.env.REDDIT_USER_AGENT?.trim() ||
        "market-scout/0.1 (local demo)",
      maxPosts: envInt("MARKET_SCOUT_MAX_REDDIT", 25),
    },
    ai: {
      apiKey: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
      model: process.env.MARKET_SCOUT_AI_MODEL?.trim() || "claude-sonnet-5",
    },
    forceMock: process.env.MARKET_SCOUT_FORCE_MOCK === "1",
  };
}

// Per-provider mock decisions. A provider is mocked when forced, or when its
// required credentials are missing. Geocoding and places use free APIs so they
// never need to be mocked. Reddit and AI are optional; mock them when keys
// are absent or force-mock is on.
export interface MockDecisions {
  geocoding: boolean;
  places: boolean;
  reddit: boolean;
  ai: boolean;
  // True when at least one provider is serving mock data.
  any: boolean;
}

export function resolveMockDecisions(config: AppConfig): MockDecisions {
  const force = config.forceMock;
  // Geocoding and places always use live free APIs (Nominatim / Overpass).
  const geocoding = force;
  const places = force;
  // Reddit and AI are optional; mock when keys missing or forced.
  const reddit = force || !config.reddit.clientId || !config.reddit.clientSecret;
  const ai = force || !config.ai.apiKey;
  return {
    geocoding,
    places,
    reddit,
    ai,
    any: geocoding || places || reddit || ai,
  };
}
