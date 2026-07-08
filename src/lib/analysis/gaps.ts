import type { CategoryStat, DemandSignal, MarketGap, Place } from "@/lib/types";

// Market gap scoring formula:
//
// demandScore (0-100):
//   Base = average frequency of demand signals whose themes relate to this
//   category, scaled to 0-100. If no signal matches, we infer demand from
//   the category's total review volume (more reviews = more foot traffic =
//   more unmet adjacent demand).
//
// competitionScore (0-100):
//   Combines saturation and incumbent quality. A category that is both
//   saturated AND highly rated is hard to break into.
//   = saturationWeight * 50  +  qualityWeight * 50
//   where saturationWeight is high=1.0, medium=0.5, low=0.2
//   and qualityWeight is avgRating/5 (or 0.5 if unknown).
//
// opportunityScore (0-100):
//   = demandScore * (1 - competitionScore/100)
//   High demand + low competition = high opportunity. If a category exists
//   but is poorly rated, competition stays moderate because the incumbents
//   are beatable.

const SATURATION_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 0.5,
  low: 0.2,
};

// Map category names to related demand-signal themes so we can cross-reference
// demand for categories that might not share exact naming.
const CATEGORY_THEME_MAP: Record<string, string[]> = {
  "Coffee shop": ["atmosphere", "wifi", "hours", "price/value"],
  "Restaurant": ["quality", "variety", "delivery", "healthy options", "wait time"],
  "Fast food": ["hours", "delivery", "healthy options", "quality"],
  "Gym": ["capacity", "hours", "variety", "price/value"],
  "Pharmacy": ["hours", "wait time", "staff/service"],
  "Grocery store": ["variety", "quality", "price/value", "healthy options"],
  "Hair salon": ["wait time", "price/value", "staff/service"],
  "Auto repair": ["price/value", "wait time", "staff/service"],
  "Tutoring center": ["variety", "tech/digital", "price/value"],
  "Coworking space": ["wifi", "atmosphere", "price/value", "capacity"],
  "Bakery": ["quality", "variety", "hours"],
  "Yoga studio": ["hours", "variety", "price/value"],
  "Daycare center": ["childcare", "capacity", "staff/service"],
  "Juice bar": ["healthy options", "variety", "price/value"],
  "Bookstore": ["variety", "community"],
  "Pizza place": ["delivery", "quality", "variety"],
  "Laundromat": ["cleanliness", "hours", "price/value"],
  "Veterinarian": ["hours", "wait time", "price/value"],
  "Pet store": ["variety", "price/value", "staff/service"],
  "Dentist": ["wait time", "hours", "staff/service"],
  "Nail salon": ["cleanliness", "wait time", "price/value"],
  "Printing shop": ["wait time", "staff/service", "tech/digital"],
  "Insurance agency": ["staff/service", "tech/digital", "price/value"],
  "Dry cleaner": ["wait time", "delivery", "price/value"],
};

export function computeMarketGaps(
  categoryStats: CategoryStat[],
  demandSignals: DemandSignal[],
  _places: Place[],
): MarketGap[] {
  const signalMap = new Map(demandSignals.map((s) => [s.theme, s]));
  const gaps: MarketGap[] = [];

  for (const stat of categoryStats) {
    const relatedThemes = CATEGORY_THEME_MAP[stat.category] || [];

    // -- Demand score --
    let demandFromSignals = 0;
    let matchedSignals = 0;
    for (const theme of relatedThemes) {
      const sig = signalMap.get(theme);
      if (sig) {
        demandFromSignals += sig.frequency;
        matchedSignals++;
      }
    }
    const avgSignalFreq =
      matchedSignals > 0 ? demandFromSignals / matchedSignals : 0;
    // Fallback: infer demand from review volume (normalized loosely).
    const reviewDemand = Math.min(1, stat.totalReviews / 500);
    const demandScore = Math.round(
      Math.max(avgSignalFreq, reviewDemand * 0.6) * 100,
    );

    // -- Competition score --
    const satWeight = SATURATION_WEIGHT[stat.saturation] ?? 0.5;
    const qualWeight = stat.avgRating != null ? stat.avgRating / 5 : 0.5;
    const competitionScore = Math.round(satWeight * 50 + qualWeight * 50);

    // -- Opportunity score --
    const opportunityScore = Math.round(
      (demandScore / 100) * (1 - competitionScore / 100) * 100,
    );

    const rationale = buildRationale(stat, demandScore, competitionScore);
    gaps.push({
      category: stat.category,
      rationale,
      demandScore,
      competitionScore,
      opportunityScore,
    });
  }

  // Also surface phantom gaps: demand themes with no matching category at all.
  const coveredThemes = new Set(
    categoryStats.flatMap(
      (s) => CATEGORY_THEME_MAP[s.category] || [],
    ),
  );
  for (const signal of demandSignals) {
    if (!coveredThemes.has(signal.theme) && signal.frequency > 0.3) {
      gaps.push({
        category: signal.theme,
        rationale: `People frequently discuss "${signal.theme}" but no local business clearly serves this need.`,
        demandScore: Math.round(signal.frequency * 100),
        competitionScore: 5,
        opportunityScore: Math.round(signal.frequency * 95),
      });
    }
  }

  gaps.sort((a, b) => b.opportunityScore - a.opportunityScore);
  return gaps;
}

function buildRationale(
  stat: CategoryStat,
  demand: number,
  competition: number,
): string {
  if (demand > 60 && competition < 40) {
    return `${stat.category} has strong demand signals but limited or weak competition -- a clear opening.`;
  }
  if (demand > 60 && competition >= 40) {
    return `${stat.category} is in demand but already has solid incumbents. A new entrant needs clear differentiation.`;
  }
  if (stat.avgRating != null && stat.avgRating < 3.5 && stat.count > 0) {
    return `Existing ${stat.category.toLowerCase()} providers are poorly rated (avg ${stat.avgRating}). A quality-focused entrant could win share.`;
  }
  return `${stat.category} shows moderate demand relative to current supply in the area.`;
}
