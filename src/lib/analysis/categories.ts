import type { Place, CategoryStat, Saturation } from "@/lib/types";

// Saturation assignment: group all categories by count, split into terciles.
// Top third = "high", middle third = "medium", bottom third = "low".
// If all categories have the same count, everything is "medium".

export function computeCategoryStats(places: Place[]): CategoryStat[] {
  const groups = new Map<
    string,
    { count: number; ratingSum: number; ratedCount: number; totalReviews: number }
  >();

  for (const place of places) {
    const key = place.primaryCategory;
    const existing = groups.get(key) || {
      count: 0,
      ratingSum: 0,
      ratedCount: 0,
      totalReviews: 0,
    };

    existing.count++;
    if (place.rating != null) {
      existing.ratingSum += place.rating;
      existing.ratedCount++;
    }
    existing.totalReviews += place.userRatingsTotal ?? place.reviews.length;
    groups.set(key, existing);
  }

  const stats: CategoryStat[] = [];
  for (const [category, g] of groups) {
    stats.push({
      category,
      count: g.count,
      avgRating: g.ratedCount > 0
        ? Number((g.ratingSum / g.ratedCount).toFixed(2))
        : null,
      totalReviews: g.totalReviews,
      saturation: "medium", // placeholder, assigned below
    });
  }

  // Sort by count descending for the output.
  stats.sort((a, b) => b.count - a.count);

  // Assign saturation by tercile ranking.
  if (stats.length > 0) {
    const counts = stats.map((s) => s.count).sort((a, b) => a - b);
    const p33 = counts[Math.floor(counts.length / 3)];
    const p66 = counts[Math.floor((counts.length * 2) / 3)];

    for (const stat of stats) {
      stat.saturation = assignSaturation(stat.count, p33, p66);
    }
  }

  return stats;
}

function assignSaturation(
  count: number,
  p33: number,
  p66: number,
): Saturation {
  if (p33 === p66) return "medium";
  if (count > p66) return "high";
  if (count <= p33) return "low";
  return "medium";
}
