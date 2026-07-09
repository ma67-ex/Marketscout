import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "@/lib/config";
import type { AIProvider, AISynthesisInput, AISynthesisOutput } from "@/lib/providers/contracts";
import type { BusinessRecommendation, CategoryStat, ImprovementReport, Saturation } from "@/lib/types";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";

export function createAIProvider(
  config: AppConfig,
  useMock: boolean,
): AIProvider {
  if (useMock) {
    return { synthesize: mockSynthesize };
  }

  const client = new Anthropic({ apiKey: config.ai.apiKey });

  return {
    async synthesize(input) {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        system: buildSystemPrompt(input.mode),
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("AI returned no text content.");
      }

      let raw = textBlock.text.trim();
      // Strip accidental markdown fences.
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("AI returned invalid JSON.");
      }

      const summary = typeof parsed.summary === "string" ? parsed.summary : "";
      const output: AISynthesisOutput = { summary };

      if (input.mode === "opportunity" && Array.isArray(parsed.recommendations)) {
        output.recommendations = (parsed.recommendations as Record<string, unknown>[]).map(
          coerceRecommendation,
        );
      }

      if (input.mode === "improve" && parsed.improvementReport) {
        output.improvementReport = coerceImprovementReport(
          parsed.improvementReport as Record<string, unknown>,
        );
      }

      return output;
    },
  };
}

// ---------------------------------------------------------------------------
// Mock synthesis: builds a genuinely useful report from the analysis data
// without calling any API.
// ---------------------------------------------------------------------------

async function mockSynthesize(
  input: AISynthesisInput,
): Promise<AISynthesisOutput> {
  const city =
    input.location.city || input.location.formattedAddress.split(",")[0];
  const populationNote = extractPopulationNote(input.areaContext?.extract);

  if (input.mode === "improve") {
    const summary = buildImproveSummary(input, city, populationNote);
    const improvementReport = buildMockImprovementReport(input);
    return { summary, improvementReport };
  }

  const summary = buildOpportunitySummary(input, city, populationNote);
  const recommendations = buildMockRecommendations(input);
  return { summary, recommendations };
}

function buildOpportunitySummary(
  input: AISynthesisInput,
  city: string,
  populationNote: string | null,
): string {
  const topCategories = input.categoryStats
    .slice(0, 3)
    .map((c) => c.category.toLowerCase());
  const topGaps = input.marketGaps.slice(0, 2).map((g) => g.category.toLowerCase());

  const { adjective } = fieldAngle(input.fieldOfStudy);
  const crowded = topCategories.join(", ");
  const gaps = topGaps.join(" and ");
  const cityClause = populationNote ? `${city} (${populationNote})` : city;
  // Seed varies the wording by the actual local data, so different areas read
  // differently instead of every report using the same skeleton sentence.
  const seed =
    input.categoryStats.length + (input.marketGaps[0]?.opportunityScore ?? 0);

  return topGaps.length > 0
    ? pickBy(
        [
          `${cityClause} leans heavily on ${crowded}, while ${gaps} look underserved — that's where a ${adjective} newcomer could win.`,
          `Across ${cityClause}, ${crowded} dominate the map, but ${gaps} are noticeably thin. Your ${input.fieldOfStudy} background points to a few concrete moves.`,
          `The data on ${cityClause} shows a crowded field in ${crowded} and visible openings in ${gaps}. A ${adjective} approach is the real differentiator here.`,
        ],
        seed,
      )
    : pickBy(
        [
          `${cityClause} looks well-served across ${crowded}, so the play is a ${adjective} angle on an existing category rather than an untapped gap.`,
          `Most common categories in ${cityClause} — ${crowded} — are already covered. Winning here means out-executing incumbents with a ${adjective} approach.`,
        ],
        seed,
      );
}

function buildImproveSummary(
  input: AISynthesisInput,
  city: string,
  populationNote: string | null,
): string {
  const businessType = input.existingBusinessType || "business";
  const match = matchCategory(businessType, input.categoryStats);
  const clause = match
    ? competitorClause(match.examples, match.category, city)
    : null;
  // Two forms: one meant to sit mid-sentence (trailing comma, followed by
  // more clause), one meant to end a sentence (no trailing comma).
  const cityMid = populationNote ? `${city}, a city of ${populationNote},` : city;
  const cityEnd = populationNote ? `${city} (${populationNote})` : city;
  const seed =
    input.categoryStats.length +
    Math.round((input.demandSignals[0]?.frequency ?? 0) * 100);

  if (clause) {
    return pickBy(
      [
        `Running a ${businessType} in ${cityMid} means going up against ${clause}. Local sentiment points to specific things worth tightening.`,
        `In ${cityMid} a ${businessType} competes directly with ${clause} — here's where the data says you can pull ahead.`,
      ],
      seed,
    );
  }

  return pickBy(
    [
      `Here's what the data shows about running a ${businessType} in ${cityEnd}.`,
      `${capitalize(businessType)}s in ${cityEnd} face a mixed picture based on local sentiment — here's the breakdown.`,
    ],
    seed,
  );
}

function buildMockRecommendations(
  input: AISynthesisInput,
): BusinessRecommendation[] {
  const { adjective, edge } = fieldAngle(input.fieldOfStudy);
  const city = input.location.city || "the area";
  const topGaps = input.marketGaps.slice(0, 3);

  if (topGaps.length === 0) {
    return [
      {
        name: capitalize(`${adjective} local ${input.fieldOfStudy} studio`),
        category: "Professional services",
        whyInDemand: `${city} is well-covered on the usual categories, but specialized ${input.fieldOfStudy} services are still something people travel out of the area for.`,
        targetCustomer: `Small businesses and residents in ${city} who currently outsource ${input.fieldOfStudy} work elsewhere`,
        competitionLevel: "low",
        differentiators: [
          `Lead with ${edge}`,
          "Local presence eliminates the commute clients currently accept",
          `A ${adjective} operating model most incumbents don't offer`,
        ],
        risks: [
          "Market size may be limited in a smaller area — validate demand before committing",
          "Building the first client base takes time and referrals",
        ],
        fieldFit: `Puts your ${input.fieldOfStudy} training to work directly, which is the whole moat.`,
        confidence: 55,
      },
    ];
  }

  return topGaps.map((gap) => {
    const { concept, customer } = conceptFor(gap.category);
    const confidence = clamp(Math.round(gap.opportunityScore), 30, 92);
    const competition: Saturation =
      gap.competitionScore < 30
        ? "low"
        : gap.competitionScore < 60
          ? "medium"
          : "high";

    // Real, specific things locals ask for — used to ground the pitch.
    const relatedSignals = input.demandSignals
      .filter((s) => s.frequency > 0.25)
      .slice(0, 2)
      .map((s) => s.theme);
    const wanted =
      relatedSignals.length > 0
        ? relatedSignals.join(" and ")
        : "better options than what's there now";

    // Seed the wording from this gap's own numbers so the three cards read
    // differently from each other and from other locations' reports.
    const seed = gap.demandScore + gap.competitionScore + city.length;

    let whyInDemand = pickBy(
      [
        `${gap.rationale} People here keep bringing up ${wanted}, and nothing in ${city} really serves it.`,
        `${gap.rationale} With ${wanted} coming up repeatedly in local chatter, there's room for a ${adjective} take.`,
        `Demand for ${gap.category.toLowerCase()} outpaces what ${city} offers today — locals specifically mention ${wanted}.`,
      ],
      seed,
    );

    // Name the real, nearby incumbents when this category already has some —
    // this is what makes the pitch read as local intelligence instead of a
    // generic template.
    const competitors = competitorsIn(gap.category, input.categoryStats);
    const competitorPhrase = competitorClause(competitors, gap.category, city);
    if (competitorPhrase) {
      whyInDemand += ` Right now that means ${competitorPhrase} — a ${adjective} newcomer has room to stand apart.`;
    }

    return {
      name: capitalize(`${adjective} ${concept}`),
      category: gap.category,
      whyInDemand,
      targetCustomer: capitalize(`${customer} in ${city}`),
      competitionLevel: competition,
      differentiators: [
        `Lead with ${edge}`,
        relatedSignals.length > 0
          ? `Directly answer what locals ask for: ${wanted}`
          : "Compete on quality, hours, and service where incumbents are weak",
        `Local ownership and a visible presence in ${city}`,
      ],
      risks: [
        gap.competitionScore > 50
          ? "Established players are entrenched — you need a clear, defensible edge to displace them"
          : "The market is unproven here — start lean and validate demand before scaling",
        "Upfront capital for setup and the first several months of operation",
      ],
      fieldFit: `Your ${input.fieldOfStudy} background is a natural fit — it's what lets you bring ${edge}.`,
      confidence,
    };
  });
}

// ---------------------------------------------------------------------------
// Real-data grounding: name actual nearby businesses and pull a concrete fact
// about the place, instead of only talking about categories in the abstract.
// ---------------------------------------------------------------------------

// Real, named businesses of a category already found in the area (empty if
// there are none, or none were named on the source map data).
function competitorsIn(
  category: string,
  categoryStats: CategoryStat[],
): string[] {
  const norm = category.toLowerCase();
  const stat = categoryStats.find((c) => c.category.toLowerCase() === norm);
  return stat?.examples ?? [];
}

// Common everyday terms that don't textually overlap with the OSM category
// label they mean (e.g. "coffee shop" vs. "Cafe"). Checked before falling
// back to substring matching.
const CATEGORY_SYNONYMS: Array<[RegExp, string]> = [
  [/coffee|espresso/, "cafe"],
  [/\bbar\b|tavern|taproom|pub/, "bar"],
  [/grocery|supermarket/, "supermarket"],
  [/gym|fitness/, "fitness centre"],
  [/vet\b|veterinary/, "veterinary"],
  [/hair|salon/, "hairdresser"],
  [/daycare|nursery/, "childcare"],
];

// Loosely match a free-text business type (what the user typed, e.g. "coffee
// shop") to a real category from the map data (e.g. "Coffee shop"), so
// improve-mode can name the user's actual local competitors.
function matchCategory(
  freeText: string,
  categoryStats: CategoryStat[],
): CategoryStat | undefined {
  const norm = freeText.toLowerCase().trim();
  if (!norm) return undefined;

  const exact = categoryStats.find((c) => c.category.toLowerCase() === norm);
  if (exact) return exact;

  const substring = categoryStats.find((c) => {
    const cat = c.category.toLowerCase();
    return cat.includes(norm) || norm.includes(cat);
  });
  if (substring) return substring;

  for (const [pattern, synonym] of CATEGORY_SYNONYMS) {
    if (pattern.test(norm)) {
      const hit = categoryStats.find((c) => c.category.toLowerCase() === synonym);
      if (hit) return hit;
    }
  }
  return undefined;
}

// "Nietzsche's and the other bar spots in Buffalo" -- null when there is
// nothing real to name.
function competitorClause(
  examples: string[],
  category: string,
  city: string,
): string | null {
  if (examples.length === 0) return null;
  const shown = examples.slice(0, 2);
  const namesPart = shown.length === 1 ? shown[0] : `${shown[0]} and ${shown[1]}`;
  return `${namesPart} and the other ${category.toLowerCase()} spots in ${city}`;
}

// Wikipedia city summaries reliably state population in the lead paragraph
// ("...with a population of 278,349 at the 2020 census."). Pull it out as a
// concrete fact to ground the report in the real place, not just its name.
function extractPopulationNote(extract: string | undefined): string | null {
  if (!extract) return null;
  const match = extract.match(/population of ([\d,]+)/i);
  if (!match) return null;
  return `roughly ${match[1]} people`;
}

// ---------------------------------------------------------------------------
// Template helpers: turn the user's field and a category into varied, natural
// wording instead of one fixed skeleton.
// ---------------------------------------------------------------------------

// Deterministic choice: same data always yields the same wording (stable
// results), but different data lands on different phrasings.
function pickBy<T>(arr: readonly T[], seed: number): T {
  const i = Math.abs(Math.trunc(seed)) % arr.length;
  return arr[i];
}

// How a field of study colors a business concept: an adjective for naming and
// an "edge" phrase describing the concrete advantage it brings.
function fieldAngle(field: string): { adjective: string; edge: string } {
  const f = field.toLowerCase();
  const table: Array<[RegExp, string, string]> = [
    [/comput|software|\bdata\b|information tech|\bit\b|programming|web/, "tech-enabled", "software, automation, and online booking that local rivals lack"],
    [/nutri|diet/, "health-forward", "nutrition expertise and transparent sourcing"],
    [/nurs|health|medic|care|clinic/, "wellness-focused", "clinical credibility and a duty-of-care mindset"],
    [/business|management|mba|entrepreneur/, "tightly-run", "sharp operations and margin discipline"],
    [/market|communicat|media|\bpr\b|advertis/, "brand-led", "storytelling and a strong local social presence"],
    [/financ|account|econ/, "numbers-driven", "the pricing and cost control most owners get wrong"],
    [/engineer/, "well-engineered", "reliability and smart process design"],
    [/design|art|architect/, "design-led", "a look and experience that stands out"],
    [/culinary|chef|hospitality|food service/, "chef-driven", "menu quality and genuine hospitality"],
    [/educat|teach|tutor/, "teaching-oriented", "classes and community programming that build loyalty"],
    [/environ|sustain|ecolog/, "sustainability-minded", "low-waste operations customers increasingly ask for"],
    [/law|legal/, "compliance-savvy", "airtight contracts and regulatory know-how"],
    [/psych|counsel|social work/, "people-centered", "empathy and hard-won community trust"],
    [/agricult|farm/, "farm-to-local", "direct sourcing and freshness rivals can't match"],
  ];
  for (const [re, adjective, edge] of table) {
    if (re.test(f)) return { adjective, edge };
  }
  return {
    adjective: `${field.toLowerCase()}-informed`,
    edge: `the specialized perspective your ${field} background brings`,
  };
}

// Map a (possibly raw OSM) category to a natural business concept and the
// customer it serves. Falls back gracefully for odd tags.
function conceptFor(category: string): { concept: string; customer: string } {
  const c = category.toLowerCase();
  const table: Array<[RegExp, string, string]> = [
    [/cafe|coffee/, "specialty coffee & study space", "students, remote workers, and morning commuters"],
    [/fast.?food/, "healthier quick-service spot", "on-the-go workers who want better than the usual chains"],
    [/restaurant|food|dining|eat/, "fast-casual eatery", "families and the weekday lunch crowd"],
    [/pub|bar|drink|brew/, "neighborhood taproom", "locals after an easy evening hangout"],
    [/bak/, "artisan bakery", "weekend shoppers and gift-buyers"],
    [/gym|fitness|sport|yoga/, "boutique fitness studio", "residents who want classes close to home"],
    [/school|educat|tutor|learn/, "tutoring & skills center", "parents and adult learners"],
    [/grocer|convenience|supermarket|market/, "curated grocery market", "households wanting fresh, local options"],
    [/pharm|health|clinic|medic|dental/, "wellness clinic", "residents underserved by distant providers"],
    [/salon|beauty|hair|spa/, "modern salon & spa", "regulars wanting a nearby standby"],
    [/book|librar/, "bookshop & community space", "readers and event-goers"],
    [/pet|vet/, "pet supply & grooming shop", "the area's pet owners"],
    [/repair|hardware|garage/, "repair & maker shop", "homeowners and hobbyists"],
    [/child|kinder|daycare|nursery/, "childcare & play space", "working parents"],
    [/laundr|clean/, "modern laundromat & drop-off service", "renters and busy households"],
  ];
  for (const [re, concept, customer] of table) {
    if (re.test(c)) return { concept, customer };
  }
  return {
    concept: `${c} service`,
    customer: "residents and workers nearby",
  };
}

function buildMockImprovementReport(
  input: AISynthesisInput,
): ImprovementReport {
  const negativeSignals = input.demandSignals.filter(
    (s) => s.sentiment === "negative",
  );
  const positiveSignals = input.demandSignals.filter(
    (s) => s.sentiment === "positive",
  );

  const commonComplaints = negativeSignals.slice(0, 4).map((s) => {
    const quote = s.evidence[0] || s.theme;
    return `Customers mention "${s.theme}" as a pain point: ${quote}`;
  });

  const whatPeopleWant = input.demandSignals
    .filter((s) => s.frequency > 0.3)
    .slice(0, 4)
    .map((s) => `${capitalize(s.theme)}: mentioned frequently in local discussion and reviews`);

  const improvements = negativeSignals.slice(0, 4).map((s) => {
    const impact: Saturation = s.frequency > 0.6 ? "high" : s.frequency > 0.3 ? "medium" : "low";
    return {
      area: capitalize(s.theme),
      suggestion: `Address the recurring "${s.theme}" concern by reviewing current practices and making targeted changes based on specific customer feedback.`,
      impact,
    };
  });

  const strengthsToKeep = positiveSignals.slice(0, 3).map((s) =>
    `"${capitalize(s.theme)}" is viewed positively -- maintain current standards in this area`,
  );

  if (strengthsToKeep.length === 0) {
    strengthsToKeep.push(
      "Your presence in the local market provides an incumbency advantage that new entrants lack",
    );
  }

  return { whatPeopleWant, commonComplaints, improvements, strengthsToKeep };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Coercion helpers for parsing real AI output defensively.
// ---------------------------------------------------------------------------

function coerceRecommendation(
  raw: Record<string, unknown>,
): BusinessRecommendation {
  return {
    name: String(raw.name || "Unnamed"),
    category: String(raw.category || "General"),
    whyInDemand: String(raw.whyInDemand || ""),
    targetCustomer: String(raw.targetCustomer || "Local residents"),
    competitionLevel: coerceSaturation(raw.competitionLevel),
    differentiators: coerceStringArray(raw.differentiators),
    risks: coerceStringArray(raw.risks),
    fieldFit: String(raw.fieldFit || ""),
    confidence: clamp(Number(raw.confidence) || 50, 0, 100),
  };
}

function coerceImprovementReport(
  raw: Record<string, unknown>,
): ImprovementReport {
  return {
    whatPeopleWant: coerceStringArray(raw.whatPeopleWant),
    commonComplaints: coerceStringArray(raw.commonComplaints),
    improvements: Array.isArray(raw.improvements)
      ? (raw.improvements as Record<string, unknown>[]).map((imp) => ({
          area: String(imp.area || "General"),
          suggestion: String(imp.suggestion || ""),
          impact: coerceSaturation(imp.impact),
        }))
      : [],
    strengthsToKeep: coerceStringArray(raw.strengthsToKeep),
  };
}

function coerceSaturation(val: unknown): Saturation {
  const s = String(val).toLowerCase();
  if (s === "low" || s === "medium" || s === "high") return s;
  return "medium";
}

function coerceStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
