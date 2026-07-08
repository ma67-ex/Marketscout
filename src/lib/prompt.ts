import type { AnalysisMode } from "@/lib/types";
import type { AISynthesisInput } from "@/lib/providers/contracts";

export function buildSystemPrompt(mode: AnalysisMode): string {
  const sharedRules = [
    "You are a pragmatic local-market analyst.",
    "Write clear, natural prose. No hype, no filler, no emojis.",
    "Return ONLY strict JSON. No markdown fences, no commentary outside the JSON.",
  ].join(" ");

  if (mode === "opportunity") {
    return `${sharedRules}

Return a JSON object with exactly this shape:
{
  "summary": "<string: 2-4 sentences describing the area's market landscape>",
  "recommendations": [
    {
      "name": "<string: a concise concept name>",
      "category": "<string: business category>",
      "whyInDemand": "<string: why this is needed here>",
      "targetCustomer": "<string: who this serves>",
      "competitionLevel": "<'low' | 'medium' | 'high'>",
      "differentiators": ["<string>", ...],
      "risks": ["<string>", ...],
      "fieldFit": "<string: how the user's field of study applies>",
      "confidence": <number 0-100>
    }
  ]
}
Provide 2-3 recommendations. Bias toward the user's field of study. Base conclusions on the data provided, not assumptions.`;
  }

  return `${sharedRules}

Return a JSON object with exactly this shape:
{
  "summary": "<string: 2-4 sentences about this business's position in the local market>",
  "improvementReport": {
    "whatPeopleWant": ["<string>", ...],
    "commonComplaints": ["<string>", ...],
    "improvements": [
      {
        "area": "<string: the area to improve>",
        "suggestion": "<string: specific actionable suggestion>",
        "impact": "<'low' | 'medium' | 'high'>"
      }
    ],
    "strengthsToKeep": ["<string>", ...]
  }
}
Base conclusions on the data provided, not assumptions.`;
}

export function buildUserPrompt(input: AISynthesisInput): string {
  const parts: string[] = [];
  parts.push(`Location: ${input.location.formattedAddress}`);
  parts.push(`Field of study: ${input.fieldOfStudy}`);
  if (input.existingBusinessType) {
    parts.push(`Existing business type: ${input.existingBusinessType}`);
  }

  parts.push("");
  parts.push("--- Category stats ---");
  for (const cat of input.categoryStats.slice(0, 15)) {
    parts.push(
      `${cat.category}: ${cat.count} businesses, avg rating ${cat.avgRating ?? "n/a"}, saturation ${cat.saturation}`,
    );
  }

  parts.push("");
  parts.push("--- Demand signals ---");
  for (const sig of input.demandSignals.slice(0, 12)) {
    parts.push(
      `"${sig.theme}" (${sig.sentiment}, freq ${sig.frequency}): ${sig.evidence[0] || "no quote"}`,
    );
  }

  parts.push("");
  parts.push("--- Market gaps ---");
  for (const gap of input.marketGaps.slice(0, 10)) {
    parts.push(
      `${gap.category}: demand ${gap.demandScore}, competition ${gap.competitionScore}, opportunity ${gap.opportunityScore} -- ${gap.rationale}`,
    );
  }

  return parts.join("\n");
}
