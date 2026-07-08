import type { Sentiment } from "@/lib/types";

const POSITIVE = new Set([
  "good", "great", "excellent", "amazing", "love", "best", "wonderful",
  "fantastic", "awesome", "friendly", "clean", "quality", "solid",
  "reliable", "honest", "comfortable", "beautiful", "welcoming",
  "fresh", "generous", "decent", "helpful", "nice", "recommend",
  "worth", "perfect", "improved", "impressive", "convenient",
]);

const NEGATIVE = new Set([
  "bad", "terrible", "awful", "worst", "hate", "poor", "dirty",
  "rude", "slow", "overpriced", "expensive", "broken", "crowded",
  "long", "wait", "frustrating", "disappointing", "limited",
  "dated", "outdated", "impossible", "nightmare", "inconvenient",
  "steep", "mess", "struggle", "lacking", "dropped", "downhill",
  "lost", "painfully", "insane", "ridiculous", "desperate",
]);

const NEGATORS = new Set([
  "not", "no", "never", "nothing", "neither", "nor", "hardly",
  "barely", "cannot", "can't", "don't", "doesn't", "didn't",
  "won't", "wouldn't", "shouldn't", "isn't", "aren't", "wasn't",
]);

// Themes the analysis engine tracks, mapped from keywords/phrases found in
// review and post text. Each theme key is a human-readable label.
const THEME_PATTERNS: readonly [string, RegExp][] = [
  ["parking", /\bpark(ing|ed|s)?\b/i],
  ["price/value", /\b(price[sd]?|pric(ing|ey)|overpriced|expensive|cheap|afford|cost|value|rate[sd]?)\b/i],
  ["wait time", /\b(wait(ing|ed|s)?|line[sd]?|queue|slow|turnaround|backed up)\b/i],
  ["hours", /\b(hour[sd]?|open|close[sd]?|late[- ]?night|early|evening|midnight|24[- ]?hour|schedule)\b/i],
  ["staff/service", /\b(staff|service|employee|worker|friendly|rude|helpful|team|trainer|instructor)\b/i],
  ["cleanliness", /\b(clean|dirty|sanit|hygien|spotless|mess)\b/i],
  ["variety", /\b(variety|selection|option|choice|menu|range|more .{0,15} options)\b/i],
  ["healthy options", /\b(healthy|vegan|vegetarian|organic|gluten[- ]?free|diet|nutrition|salad|smoothie|grain bowl)\b/i],
  ["quality", /\b(quality|fresh|stale|frozen|taste|flavor|premium|mediocre)\b/i],
  ["delivery", /\b(deliver(y|ing|s)?|takeout|take[- ]?out|pickup|pick[- ]?up|order online)\b/i],
  ["wifi", /\b(wifi|wi[- ]?fi|internet|online|connection)\b/i],
  ["atmosphere", /\b(atmosphere|vibe|ambiance|decor|space|loud|noise|quiet|calm)\b/i],
  ["capacity", /\b(crowd|capacity|full|busy|packed|overcrowded|waitlist|book(ed|ing))\b/i],
  ["childcare", /\b(child|kid|daycare|childcare|family|parent|baby)\b/i],
  ["tech/digital", /\b(tech|computer|phone|app|digital|IT|repair|screen|software)\b/i],
  ["community", /\b(community|event|networking|social|hang out|nightlife|entertainment)\b/i],
];

export function scoreSentiment(text: string): {
  score: number;
  label: Sentiment;
} {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  let total = 0;
  let counted = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let polarity = 0;
    if (POSITIVE.has(w)) polarity = 1;
    else if (NEGATIVE.has(w)) polarity = -1;

    if (polarity !== 0) {
      // Check for negation in the two preceding words.
      const prev1 = i > 0 ? words[i - 1] : "";
      const prev2 = i > 1 ? words[i - 2] : "";
      if (NEGATORS.has(prev1) || NEGATORS.has(prev2)) {
        polarity *= -1;
      }
      total += polarity;
      counted++;
    }
  }

  if (counted === 0) return { score: 0, label: "neutral" };
  const score = Math.max(-1, Math.min(1, total / counted));
  const label: Sentiment =
    score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
  return { score, label };
}

export function extractThemes(text: string): string[] {
  const found: string[] = [];
  for (const [theme, pattern] of THEME_PATTERNS) {
    if (pattern.test(text)) {
      found.push(theme);
    }
  }
  return found;
}
