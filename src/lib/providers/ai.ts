import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "@/lib/config";
import type { AIProvider, AISynthesisInput, AISynthesisOutput } from "@/lib/providers/contracts";
import type { BusinessRecommendation, ImprovementReport, Saturation } from "@/lib/types";
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

  // Summary references real data.
  const topCategories = input.categoryStats
    .slice(0, 3)
    .map((c) => c.category.toLowerCase());
  const topGaps = input.marketGaps
    .slice(0, 2)
    .map((g) => g.category.toLowerCase());

  const summary = [
    `The ${city} area has a mix of local services, with ${topCategories.join(", ")} being the most represented categories.`,
    topGaps.length > 0
      ? `Analysis of local discussion and business data suggests underserved demand in ${topGaps.join(" and ")}.`
      : "The local market appears relatively well-served across common categories.",
    `Given a background in ${input.fieldOfStudy}, there are several directions worth considering.`,
  ].join(" ");

  if (input.mode === "opportunity") {
    const recommendations = buildMockRecommendations(input);
    return { summary, recommendations };
  }

  const improvementReport = buildMockImprovementReport(input);
  return { summary, improvementReport };
}

function buildMockRecommendations(
  input: AISynthesisInput,
): BusinessRecommendation[] {
  const topGaps = input.marketGaps.slice(0, 3);
  if (topGaps.length === 0) {
    return [
      {
        name: `${input.fieldOfStudy} Consulting`,
        category: "Professional services",
        whyInDemand:
          "Local businesses frequently need specialized expertise that is currently unavailable in the immediate area.",
        targetCustomer: "Small business owners and professionals in the area",
        competitionLevel: "low",
        differentiators: [
          "Local presence eliminates commute for clients",
          "Specialization in " + input.fieldOfStudy,
        ],
        risks: [
          "Market size may be limited in a smaller area",
          "Building initial client base takes time",
        ],
        fieldFit: `Directly applies your ${input.fieldOfStudy} training to local market needs.`,
        confidence: 55,
      },
    ];
  }

  return topGaps.map((gap) => {
    const confidence = Math.min(90, Math.max(30, gap.opportunityScore));
    const competition: Saturation =
      gap.competitionScore < 30
        ? "low"
        : gap.competitionScore < 60
          ? "medium"
          : "high";

    // Find related demand signals for richer context.
    const relatedSignals = input.demandSignals
      .filter((s) => s.frequency > 0.3)
      .slice(0, 2);
    const wantedThings = relatedSignals.map((s) => s.theme).join(", ");

    return {
      name: `${gap.category} Hub`,
      category: gap.category,
      whyInDemand: `${gap.rationale} Local residents frequently mention ${wantedThings || "a need for better options"} in this space.`,
      targetCustomer: `Residents and workers in the ${input.location.city || "local"} area seeking ${gap.category.toLowerCase()} services`,
      competitionLevel: competition,
      differentiators: [
        `Apply ${input.fieldOfStudy} expertise to create a differentiated offering`,
        "Focus on the specific pain points locals have expressed (quality, hours, accessibility)",
        "Local ownership builds trust in a community that values it",
      ],
      risks: [
        gap.competitionScore > 50
          ? "Established competitors will be hard to displace without clear differentiation"
          : "Unproven market -- start small and validate demand before scaling",
        "Initial capital requirements for setup and first months of operation",
      ],
      fieldFit: `Your background in ${input.fieldOfStudy} provides analytical and domain advantages in building and running a ${gap.category.toLowerCase()} operation.`,
      confidence,
    };
  });
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
