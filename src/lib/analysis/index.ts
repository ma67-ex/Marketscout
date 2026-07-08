import type { CategoryStat, DemandSignal, MarketGap, Place, RedditPost } from "@/lib/types";
import { computeCategoryStats } from "./categories";
import { mineDemandSignals } from "./demand";
import { computeMarketGaps } from "./gaps";

export interface AnalysisResult {
  categoryStats: CategoryStat[];
  demandSignals: DemandSignal[];
  marketGaps: MarketGap[];
}

export function runAnalysis(input: {
  places: Place[];
  redditPosts: RedditPost[];
}): AnalysisResult {
  const categoryStats = computeCategoryStats(input.places);
  const demandSignals = mineDemandSignals(input.places, input.redditPosts);
  const marketGaps = computeMarketGaps(
    categoryStats,
    demandSignals,
    input.places,
  );
  return { categoryStats, demandSignals, marketGaps };
}
