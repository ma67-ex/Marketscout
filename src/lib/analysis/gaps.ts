import type { CategoryStat, DemandSignal, MarketGap, Place } from "@/lib/types";

// Market gap scoring.
//
// This has to work from open map data (OpenStreetMap), which gives us the
// COUNT of each business type in the area but no ratings and no review text.
// So the model is supply-vs-demand at the category level:
//
// demandScore (0-100):
//   How much a place like this is generally needed, from a category
//   "essentiality" prior (a pharmacy is wanted almost everywhere; a juice bar
//   is more discretionary). When local discussion (Reddit) surfaces a stronger
//   signal for related themes, that overrides the prior upward. Never 0 for a
//   real business category, because every real category has some baseline
//   demand -- the old model returned 0 whenever there were no reviews to mine.
//
// competitionScore (0-100):
//   Driven by local supply density -- how many providers already exist
//   (5+ is treated as saturated) -- plus incumbent quality when ratings are
//   available (Google mode). More providers, and better-rated ones, mean a
//   harder market to enter.
//
// opportunityScore (0-100):
//   demandScore * (1 - competitionScore/100). High demand meeting low supply
//   is the opening. A wanted category that is under-served locally rises to
//   the top; a wanted-but-crowded category sinks.

// Baseline demand per category (0-1). Keys are the human-readable category
// labels produced from OSM tags (e.g. "fast_food" -> "Fast food"). Anything
// not listed falls back to DEFAULT_ESSENTIALITY.
const ESSENTIALITY: Record<string, number> = {
  // Everyday essentials.
  Restaurant: 0.9,
  "Grocery store": 0.9,
  Supermarket: 0.9,
  Pharmacy: 0.9,
  Doctors: 0.88,
  Clinic: 0.88,
  "Coffee shop": 0.85,
  Cafe: 0.85,
  Bakery: 0.8,
  "Fast food": 0.8,
  Convenience: 0.8,
  Fuel: 0.8,
  Bank: 0.78,
  Dentist: 0.8,
  Gym: 0.75,
  "Fitness centre": 0.75,
  Hairdresser: 0.75,
  "Hair salon": 0.75,
  Childcare: 0.75,
  "Daycare center": 0.75,
  Veterinary: 0.7,
  Veterinarian: 0.7,
  "Auto repair": 0.7,
  "Car repair": 0.7,
  "Pizza place": 0.7,
  Hardware: 0.68,
  Clothes: 0.65,
  "Pet store": 0.65,
  "Tutoring center": 0.65,
  Pub: 0.6,
  Bar: 0.6,
  Laundromat: 0.6,
  "Dry cleaner": 0.6,
  "Nail salon": 0.6,
  "Insurance agency": 0.55,
  // More discretionary / lifestyle.
  "Coworking space": 0.5,
  "Yoga studio": 0.5,
  "Juice bar": 0.5,
  Bookstore: 0.5,
  "Printing shop": 0.5,
};
const DEFAULT_ESSENTIALITY = 0.5;

// Categories that are not businesses a person would start. They still appear
// in "what is already here", but they should never be pitched as an
// opportunity, so we skip them when building gaps.
const NON_COMMERCIAL = new Set<string>([
  "Place of worship",
  "School",
  "University",
  "College",
  "Kindergarten",
  "Townhall",
  "Police",
  "Fire station",
  "Courthouse",
  "Prison",
  "Public building",
  "Community centre",
  "Library",
  "Parking",
  "Parking space",
  "Parking entrance",
  "Bench",
  "Toilets",
  "Post box",
  "Recycling",
  "Waste basket",
  "Waste disposal",
  "Fountain",
  "Shelter",
  "Drinking water",
  "Grave yard",
  "Cemetery",
  "Social facility",
  "Bicycle parking",
  "Bicycle repair station",
  "Hospital",
  "Clock",
  "Bus station",
  "Taxi",
]);

// Related demand-signal themes per category, so Reddit chatter about e.g.
// "parking" or "late-night" can lift the relevant category's demand.
const CATEGORY_THEME_MAP: Record<string, string[]> = {
  "Coffee shop": ["atmosphere", "wifi", "hours", "price/value"],
  Cafe: ["atmosphere", "wifi", "hours", "price/value"],
  Restaurant: ["quality", "variety", "delivery", "healthy options", "wait time"],
  "Fast food": ["hours", "delivery", "healthy options", "quality"],
  Gym: ["capacity", "hours", "variety", "price/value"],
  "Fitness centre": ["capacity", "hours", "variety", "price/value"],
  Pharmacy: ["hours", "wait time", "staff/service"],
  "Grocery store": ["variety", "quality", "price/value", "healthy options"],
  Supermarket: ["variety", "quality", "price/value", "healthy options"],
  "Hair salon": ["wait time", "price/value", "staff/service"],
  Hairdresser: ["wait time", "price/value", "staff/service"],
  "Auto repair": ["price/value", "wait time", "staff/service"],
  "Car repair": ["price/value", "wait time", "staff/service"],
  "Tutoring center": ["variety", "tech/digital", "price/value"],
  "Coworking space": ["wifi", "atmosphere", "price/value", "capacity"],
  Bakery: ["quality", "variety", "hours"],
  "Yoga studio": ["hours", "variety", "price/value"],
  "Daycare center": ["childcare", "capacity", "staff/service"],
  Childcare: ["childcare", "capacity", "staff/service"],
  "Juice bar": ["healthy options", "variety", "price/value"],
  Bookstore: ["variety", "community"],
  "Pizza place": ["delivery", "quality", "variety"],
  Laundromat: ["cleanliness", "hours", "price/value"],
  Veterinarian: ["hours", "wait time", "price/value"],
  Veterinary: ["hours", "wait time", "price/value"],
  "Pet store": ["variety", "price/value", "staff/service"],
  Dentist: ["wait time", "hours", "staff/service"],
  "Nail salon": ["cleanliness", "wait time", "price/value"],
  "Printing shop": ["wait time", "staff/service", "tech/digital"],
  "Insurance agency": ["staff/service", "tech/digital", "price/value"],
  "Dry cleaner": ["wait time", "delivery", "price/value"],
  Pub: ["atmosphere", "variety", "community"],
  Bar: ["atmosphere", "variety", "community"],
  Convenience: ["hours", "variety", "price/value"],
};

// Providers at which a category is considered fully saturated.
const SATURATION_CEILING = 6;

export function computeMarketGaps(
  categoryStats: CategoryStat[],
  demandSignals: DemandSignal[],
  _places: Place[],
): MarketGap[] {
  const signalMap = new Map(demandSignals.map((s) => [s.theme, s]));
  const gaps: MarketGap[] = [];

  for (const stat of categoryStats) {
    if (NON_COMMERCIAL.has(stat.category)) continue;

    const relatedThemes = CATEGORY_THEME_MAP[stat.category] || [];

    // -- Demand: essentiality prior, lifted by any related local discussion.
    let signalSum = 0;
    let matched = 0;
    for (const theme of relatedThemes) {
      const sig = signalMap.get(theme);
      if (sig) {
        signalSum += sig.frequency;
        matched++;
      }
    }
    const signalDemand = matched > 0 ? signalSum / matched : 0;
    const essentiality = ESSENTIALITY[stat.category] ?? DEFAULT_ESSENTIALITY;
    const demandScore = Math.round(Math.max(essentiality, signalDemand) * 100);

    // -- Competition: supply density (+ incumbent quality when known).
    const supplySaturation = Math.min(1, stat.count / SATURATION_CEILING);
    const supplyComponent = supplySaturation * 70; // 0-70
    // Neutral 15 when ratings are unavailable (open map data has none).
    const qualityComponent =
      stat.avgRating != null ? (stat.avgRating / 5) * 30 : 15; // 0-30
    const competitionScore = Math.round(supplyComponent + qualityComponent);

    // -- Opportunity: wanted, but under-served.
    const opportunityScore = Math.round(
      (demandScore / 100) * (1 - competitionScore / 100) * 100,
    );

    gaps.push({
      category: stat.category,
      rationale: buildRationale(stat, demandScore, competitionScore),
      demandScore,
      competitionScore,
      opportunityScore,
    });
  }

  // Surface themes people discuss that no local category clearly serves.
  const coveredThemes = new Set(
    categoryStats.flatMap((s) => CATEGORY_THEME_MAP[s.category] || []),
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
  const c = stat.category.toLowerCase();
  if (demand >= 70 && competition < 45) {
    return `Strong everyday demand for ${c}, but only ${providerPhrase(stat.count)} in range, a clear opening.`;
  }
  if (stat.avgRating != null && stat.avgRating < 3.5 && stat.count > 0) {
    return `Existing ${c} providers are poorly rated (avg ${stat.avgRating}); a quality-focused entrant could win share.`;
  }
  if (competition >= 70) {
    return `${stat.category} is already well covered (${providerPhrase(stat.count)}); breaking in needs clear differentiation.`;
  }
  return `Moderate demand for ${c} against ${providerPhrase(stat.count)} currently in the area.`;
}

function providerPhrase(count: number): string {
  if (count === 1) return "1 provider";
  return `${count} providers`;
}
