// Runtime configuration.
//
// Geocoding, places, and Reddit run live with zero keys (Nominatim, Overpass,
// and Reddit's public search are all free and unauthenticated). Only the
// AI-written synthesis needs a key (ANTHROPIC_API_KEY) -- without one it
// falls back to a template that still describes the live data accurately,
// just without LLM-generated prose. Set MARKET_SCOUT_FORCE_MOCK=1 to force
// fully offline sample data instead (useful for demos with no network).

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
      // 2 km keeps dense-city queries light enough for the free Overpass
      // mirrors to answer quickly, while still covering a local catchment.
      radiusMeters: envInt("MARKET_SCOUT_RADIUS_METERS", 2000),
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

// Per-provider mock decisions. Geocoding, places, and Reddit are all free and
// keyless, so the only thing that ever forces them to mock is the explicit
// MARKET_SCOUT_FORCE_MOCK override. AI synthesis mocks whenever no Anthropic
// key is configured, since that is the one provider with no free live path.
export interface MockDecisions {
  geocoding: boolean;
  places: boolean;
  reddit: boolean;
  reviews: boolean;
  context: boolean;
  ai: boolean;
  // True only when the underlying FACTS (places/reviews/posts) are sample
  // data rather than real. AI running as a template over real data does not
  // count -- it is a synthesis-method difference, not fabricated data.
  usingSampleData: boolean;
}

export function resolveMockDecisions(config: AppConfig): MockDecisions {
  const force = config.forceMock;
  const geocoding = force;
  const places = force;
  const reddit = force;
  const reviews = force;
  const context = force;
  const ai = force || !config.ai.apiKey;
  return {
    geocoding,
    places,
    reddit,
    reviews,
    context,
    ai,
    usingSampleData: geocoding || places || reddit,
  };
}
