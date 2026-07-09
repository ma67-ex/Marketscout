// Provider contracts.
//
// Every external data source (geocoding, places, reddit) and the AI layer sit
// behind one of these interfaces. Real implementations call live APIs; mock
// implementations return realistic sample data. Because both satisfy the same
// interface, swapping between them is a config change, never a code change.

import type {
  AnalysisMode,
  AreaContext,
  BusinessRecommendation,
  CategoryStat,
  DemandSignal,
  GeoLocation,
  ImprovementReport,
  MarketGap,
  Place,
  PlaceReview,
  RedditPost,
} from "@/lib/types";

export interface GeocodingProvider {
  // Turn free-text into coordinates. Throws if the location cannot be resolved.
  geocode(query: string): Promise<GeoLocation>;
}

export interface PlacesNearbyOptions {
  // Search radius in meters. Defaults are set by the caller.
  radiusMeters?: number;
  // Cap on how many places to return.
  limit?: number;
}

export interface PlacesProvider {
  // Businesses and services near a point, each with a sample of reviews.
  nearby(location: GeoLocation, opts?: PlacesNearbyOptions): Promise<Place[]>;
}

export interface RedditSearchOptions {
  limit?: number;
}

export interface RedditProvider {
  // Local discussion relevant to the area. `keywords` typically includes the
  // city/neighborhood name plus the user's field of study.
  search(
    location: GeoLocation,
    keywords: string[],
    opts?: RedditSearchOptions,
  ): Promise<RedditPost[]>;
}

export interface ReviewsSearchOptions {
  limit?: number;
}

export interface ReviewsProvider {
  // Keyless public reviews for the area (Mangrove Reviews open dataset).
  // Returns an area-level corpus of real review text; empty where there is no
  // coverage. Never throws -- a failure just yields no reviews.
  nearby(
    location: GeoLocation,
    opts?: ReviewsSearchOptions,
  ): Promise<PlaceReview[]>;
}

export interface ContextProvider {
  // Real, keyless background on the location (Wikipedia). Undefined when there
  // is no confident match. Never throws.
  describe(location: GeoLocation): Promise<AreaContext | undefined>;
}

// Input the AI layer needs to write its synthesis. This is the analysis
// engine's output plus the original request context.
export interface AISynthesisInput {
  mode: AnalysisMode;
  fieldOfStudy: string;
  existingBusinessType?: string;
  location: GeoLocation;
  categoryStats: CategoryStat[];
  demandSignals: DemandSignal[];
  marketGaps: MarketGap[];
}

export interface AISynthesisOutput {
  summary: string;
  // Populated in "opportunity" mode.
  recommendations?: BusinessRecommendation[];
  // Populated in "improve" mode.
  improvementReport?: ImprovementReport;
}

export interface AIProvider {
  synthesize(input: AISynthesisInput): Promise<AISynthesisOutput>;
}

// A bundle of every provider, resolved once per request from config.
export interface ProviderBundle {
  geocoding: GeocodingProvider;
  places: PlacesProvider;
  reddit: RedditProvider;
  reviews: ReviewsProvider;
  context: ContextProvider;
  ai: AIProvider;
  usingMock: boolean;
}
