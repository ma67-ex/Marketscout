// Shared domain types for Market Scout.
//
// This file is the contract that every module builds against: data providers
// produce these shapes, the analysis engine consumes and enriches them, and the
// AI layer turns them into recommendations. Treat changes here as changes to a
// public API and keep the whole team in sync.

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

// The two things a user does with the app:
//  - "opportunity": they do not have a business yet and want to know what is
//    worth starting in this area given their field of study.
//  - "improve": they already run a business here and want to know what people
//    want and what to fix.
export type AnalysisMode = "opportunity" | "improve";

export interface AnalysisRequest {
  // Free-text location the user typed, e.g. "Williamsville, NY" or a full
  // address. Geocoding turns this into coordinates.
  location: string;
  // The user's field of study or expertise, e.g. "Computer Science" or
  // "Nutrition". Used to bias recommendations toward what they can actually do.
  fieldOfStudy: string;
  mode: AnalysisMode;
  // Only relevant in "improve" mode: the kind of business they already run,
  // e.g. "coffee shop".
  existingBusinessType?: string;
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export interface GeoLocation {
  formattedAddress: string;
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  country?: string;
}

// ---------------------------------------------------------------------------
// Places (Google Places, or mock)
// ---------------------------------------------------------------------------

export interface PlaceReview {
  author?: string;
  rating: number; // 1-5
  text: string;
  // Unix seconds if known.
  time?: number;
}

export interface Place {
  id: string;
  name: string;
  // The primary category, normalized to a human-readable label, e.g.
  // "Coffee shop", "Gym", "Pharmacy".
  primaryCategory: string;
  // All raw category tags the source returned, kept for finer analysis.
  categories: string[];
  rating?: number; // average 1-5
  userRatingsTotal?: number;
  priceLevel?: number; // 0-4 where present
  location: { lat: number; lng: number };
  distanceMeters?: number;
  reviews: PlaceReview[];
}

// ---------------------------------------------------------------------------
// Reddit (local discussion, or mock)
// ---------------------------------------------------------------------------

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  text: string;
  score: number;
  numComments: number;
  url: string;
  createdUtc: number;
  // 0-1 confidence that this post is actually about the target location.
  relevance?: number;
}

// ---------------------------------------------------------------------------
// Analysis engine outputs
// ---------------------------------------------------------------------------

export type Saturation = "low" | "medium" | "high";
export type Sentiment = "positive" | "neutral" | "negative";

// Aggregate view of one business category in the area.
export interface CategoryStat {
  category: string;
  count: number;
  avgRating: number | null;
  totalReviews: number;
  // How crowded this category looks relative to the rest of the area.
  saturation: Saturation;
}

// A recurring thing people talk about, mined from reviews and Reddit.
export interface DemandSignal {
  theme: string; // e.g. "late-night options", "vegan food", "parking"
  sentiment: Sentiment;
  // How often it came up, normalized 0-1 across all signals.
  frequency: number;
  // Short representative quotes backing the signal.
  evidence: string[];
  sources: Array<"reviews" | "reddit">;
}

// A category that looks under-served: real demand, thin or weak supply.
export interface MarketGap {
  category: string;
  rationale: string;
  demandScore: number; // 0-100
  competitionScore: number; // 0-100, higher = more crowded
  opportunityScore: number; // 0-100, higher = better opening
}

// ---------------------------------------------------------------------------
// AI synthesis outputs
// ---------------------------------------------------------------------------

export interface BusinessRecommendation {
  name: string; // suggested concept name/label
  category: string;
  whyInDemand: string;
  targetCustomer: string;
  competitionLevel: Saturation;
  differentiators: string[];
  risks: string[];
  // How well this fits the user's stated field of study.
  fieldFit: string;
  // 0-100 overall confidence this is a strong move.
  confidence: number;
}

export interface ImprovementReport {
  whatPeopleWant: string[];
  commonComplaints: string[];
  improvements: Array<{
    area: string;
    suggestion: string;
    impact: Saturation; // low/medium/high impact
  }>;
  strengthsToKeep: string[];
}

// ---------------------------------------------------------------------------
// Final report returned to the client
// ---------------------------------------------------------------------------

export interface AnalysisReport {
  request: AnalysisRequest;
  location: GeoLocation;
  // Plain-language overview written by the AI layer.
  summary: string;
  categoryStats: CategoryStat[];
  demandSignals: DemandSignal[];
  marketGaps: MarketGap[];
  // Present in "opportunity" mode.
  recommendations?: BusinessRecommendation[];
  // Present in "improve" mode.
  improvementReport?: ImprovementReport;
  // Provenance so the user can see where conclusions came from.
  sources: {
    placesCount: number;
    reviewsCount: number;
    redditPostsCount: number;
    usedMockData: boolean;
  };
  generatedAt: string; // ISO timestamp
}
