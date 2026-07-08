import type { Place, RedditPost, DemandSignal, Sentiment } from "@/lib/types";
import { scoreSentiment, extractThemes } from "./sentiment";

// Walk every review and reddit post, extract themes and sentiment, then
// aggregate per theme into demand signals. Evidence is capped at 3 short
// representative quotes per signal.

const MAX_EVIDENCE = 3;
const MAX_QUOTE_LENGTH = 120;

interface ThemeAccumulator {
  sentimentSum: number;
  sentimentCount: number;
  rawCount: number;
  evidence: string[];
  sources: Set<"reviews" | "reddit">;
}

export function mineDemandSignals(
  places: Place[],
  redditPosts: RedditPost[],
): DemandSignal[] {
  const accumulators = new Map<string, ThemeAccumulator>();

  function getOrCreate(theme: string): ThemeAccumulator {
    let acc = accumulators.get(theme);
    if (!acc) {
      acc = {
        sentimentSum: 0,
        sentimentCount: 0,
        rawCount: 0,
        evidence: [],
        sources: new Set(),
      };
      accumulators.set(theme, acc);
    }
    return acc;
  }

  function processText(
    text: string,
    source: "reviews" | "reddit",
  ): void {
    const themes = extractThemes(text);
    if (themes.length === 0) return;

    const { score } = scoreSentiment(text);
    for (const theme of themes) {
      const acc = getOrCreate(theme);
      acc.sentimentSum += score;
      acc.sentimentCount++;
      acc.rawCount++;
      acc.sources.add(source);

      if (acc.evidence.length < MAX_EVIDENCE) {
        const trimmed =
          text.length > MAX_QUOTE_LENGTH
            ? text.slice(0, MAX_QUOTE_LENGTH - 3) + "..."
            : text;
        acc.evidence.push(trimmed);
      }
    }
  }

  // Process review text from all places.
  for (const place of places) {
    for (const review of place.reviews) {
      processText(review.text, "reviews");
    }
  }

  // Process reddit posts (title + body combined).
  for (const post of redditPosts) {
    const combined = `${post.title}. ${post.text}`;
    processText(combined, "reddit");
  }

  // Normalize frequency to 0-1 across all themes.
  const maxRaw = Math.max(1, ...Array.from(accumulators.values()).map((a) => a.rawCount));

  const signals: DemandSignal[] = [];
  for (const [theme, acc] of accumulators) {
    const avgSentiment = acc.sentimentCount > 0
      ? acc.sentimentSum / acc.sentimentCount
      : 0;
    const label: Sentiment =
      avgSentiment > 0.15
        ? "positive"
        : avgSentiment < -0.15
          ? "negative"
          : "neutral";

    signals.push({
      theme,
      sentiment: label,
      frequency: Number((acc.rawCount / maxRaw).toFixed(3)),
      evidence: acc.evidence,
      sources: Array.from(acc.sources),
    });
  }

  signals.sort((a, b) => b.frequency - a.frequency);
  return signals;
}
