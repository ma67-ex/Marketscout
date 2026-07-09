import type { Place, CategoryStat, Saturation } from "@/lib/types";

// Saturation reflects how many providers a category has in the scanned area:
//   1 provider  -> low    (clear room to enter)
//   2-4         -> medium
//   5+          -> high   (already crowded)
// Absolute thresholds are used instead of percentiles because real-world
// category counts are heavily tied (lots of singletons), which collapses a
// tercile split into a single "medium" bucket and hides genuine saturation.

interface Group {
  count: number;
  ratingSum: number;
  ratedCount: number;
  totalReviews: number;
  // Real, named businesses of this type (deduped, "(unnamed)" ones skipped).
  examples: string[];
}

const MAX_EXAMPLES = 4;

export function computeCategoryStats(places: Place[]): CategoryStat[] {
  const groups = new Map<string, Group>();

  for (const place of places) {
    const key = place.primaryCategory;
    const existing: Group = groups.get(key) || {
      count: 0,
      ratingSum: 0,
      ratedCount: 0,
      totalReviews: 0,
      examples: [],
    };

    existing.count++;
    if (place.rating != null) {
      existing.ratingSum += place.rating;
      existing.ratedCount++;
    }
    existing.totalReviews += place.userRatingsTotal ?? place.reviews.length;

    // Keep a few real names; ignore placeholder "(unnamed)" entries.
    const named = !/\(unnamed\)/i.test(place.name);
    if (
      named &&
      existing.examples.length < MAX_EXAMPLES &&
      !existing.examples.includes(place.name)
    ) {
      existing.examples.push(place.name);
    }

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
      examples: g.examples,
    });
  }

  // Sort by count descending for the output.
  stats.sort((a, b) => b.count - a.count);

  for (const stat of stats) {
    stat.saturation = assignSaturation(stat.count);
  }

  return stats;
}

function assignSaturation(count: number): Saturation {
  if (count >= 5) return "high";
  if (count >= 2) return "medium";
  return "low";
}
