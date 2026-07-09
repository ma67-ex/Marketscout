// Orchestrator.
//
// One call, one report. This is the pipeline that ties the whole app together:
// resolve the location, gather supply (places) and demand (reddit) in parallel,
// run the analytics, then have the AI layer write the synthesis. Everything
// upstream is swappable (mock or live) behind the provider bundle.

import { runAnalysis } from "@/lib/analysis";
import { getProviders } from "@/lib/providers";
import type { AnalysisRequest, AnalysisReport } from "@/lib/types";

// Build the search terms Reddit is queried with: the place name plus the user's
// field, so we catch both "what does this town need" and field-specific chatter.
function buildRedditKeywords(
  city: string | undefined,
  region: string | undefined,
  fieldOfStudy: string,
): string[] {
  const terms = new Set<string>();
  if (city) terms.add(city);
  if (region) terms.add(region);
  if (fieldOfStudy) terms.add(fieldOfStudy);
  // Generic prompts that surface local wants and complaints.
  terms.add("what does the area need");
  terms.add("recommendations");
  return Array.from(terms);
}

export async function analyze(request: AnalysisRequest): Promise<AnalysisReport> {
  const providers = getProviders();

  // 1. Resolve the free-text location to coordinates.
  const location = await providers.geocoding.geocode(request.location);

  // 2. Gather supply (places), demand (reddit + keyless public reviews), and
  //    real area context concurrently.
  const [places, redditPosts, externalReviews, areaContext] = await Promise.all([
    providers.places.nearby(location),
    providers.reddit.search(
      location,
      buildRedditKeywords(location.city, location.region, request.fieldOfStudy),
    ),
    providers.reviews.nearby(location),
    providers.context.describe(location),
  ]);

  // 3. Turn raw data into structured signals.
  const { categoryStats, demandSignals, marketGaps } = runAnalysis({
    places,
    redditPosts,
    externalReviews,
  });

  // 4. Have the AI layer write the human-facing synthesis.
  const synthesis = await providers.ai.synthesize({
    mode: request.mode,
    fieldOfStudy: request.fieldOfStudy,
    existingBusinessType: request.existingBusinessType,
    location,
    categoryStats,
    demandSignals,
    marketGaps,
  });

  const reviewsCount =
    places.reduce((sum, p) => sum + p.reviews.length, 0) +
    externalReviews.length;

  // 5. Assemble the report, including provenance so the UI can be honest about
  //    where the conclusions came from.
  return {
    request,
    location,
    summary: synthesis.summary,
    areaContext,
    categoryStats,
    demandSignals,
    marketGaps,
    recommendations: synthesis.recommendations,
    improvementReport: synthesis.improvementReport,
    sources: {
      placesCount: places.length,
      reviewsCount,
      redditPostsCount: redditPosts.length,
      usedMockData: providers.usingMock,
    },
    generatedAt: new Date().toISOString(),
  };
}
