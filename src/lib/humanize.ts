// Strips the most common tells of AI-generated writing from AI-synthesized
// report text before it reaches the user. Applied uniformly to every real
// AI provider (Claude/Gemini/FreeLLMAPI) and to the offline mock template,
// so the result is dash-free and free of stock filler regardless of which
// path produced it -- prompt instructions alone aren't reliable enough to
// guarantee this on their own.

import type { AISynthesisOutput } from "@/lib/providers/contracts";

// Filler lead-ins that add no information and are a strong AI-writing tell.
// Matched at the start of a clause and removed outright.
const FILLER_LEAD_INS: RegExp[] = [
  /\b(?:it'?s|it is) (?:important|worth) (?:to note|noting) that\s*/gi,
  /\bin today'?s fast-paced world,?\s*/gi,
  /\bat the end of the day,?\s*/gi,
  /\bin conclusion,?\s*/gi,
  /\bin summary,?\s*/gi,
  /\bto summarize,?\s*/gi,
  /\boverall,?\s*/gi,
  /\bfurthermore,?\s*/gi,
  /\bmoreover,?\s*/gi,
  /\badditionally,?\s*/gi,
];

// Inflated or promotional vocabulary, swapped for a plain synonym so the
// surrounding sentence structure stays intact.
const WORD_SWAPS: Array<[RegExp, string]> = [
  [/\bboasts\b/gi, "has"],
  [/\bboasting\b/gi, "with"],
  [/\bshowcases?\b/gi, "shows"],
  [/\bunderscores?\b/gi, "highlights"],
  [/\belevates?\b/gi, "improves"],
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
  [/\bleverages?\b/gi, "uses"],
  [/\bleveraging\b/gi, "using"],
  [/\bdelv(?:e|es|ed|ing) into\b/gi, "look at"],
  [/\bdiv(?:e|es|ed|ing) into\b/gi, "look at"],
  [/\bunlocks?\b/gi, "opens up"],
  [/\bunleash(?:es|ed)?\b/gi, "brings"],
  [/\bgame[- ]changers?\b/gi, "major shift"],
  [/\bcutting[- ]edge\b/gi, "advanced"],
  [/\brobust\b/gi, "solid"],
  [/\btestament to\b/gi, "a sign of"],
  [/\b(?:vibrant|rich) tapestry\b/gi, "mix"],
];

export function humanizeText(text: string): string {
  if (!text) return text;
  let out = text;

  // No dashes as punctuation, ever -- collapse them into a comma so the
  // clause reads as one continuous sentence instead of an AI-style aside.
  out = out.replace(/\s*[—–]\s*/g, ", ");
  out = out.replace(/\s+-{2,}\s+/g, ", ");

  for (const pattern of FILLER_LEAD_INS) out = out.replace(pattern, "");
  for (const [pattern, replacement] of WORD_SWAPS) out = out.replace(pattern, replacement);

  // Clean up punctuation and spacing left behind by the removals above.
  out = out.replace(/,\s*([.,!?])/g, "$1");
  out = out.replace(/\s{2,}/g, " ").trim();
  if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

export function humanizeSynthesis(output: AISynthesisOutput): AISynthesisOutput {
  const result: AISynthesisOutput = { summary: humanizeText(output.summary) };

  if (output.recommendations) {
    result.recommendations = output.recommendations.map((r) => ({
      ...r,
      name: humanizeText(r.name),
      whyInDemand: humanizeText(r.whyInDemand),
      targetCustomer: humanizeText(r.targetCustomer),
      differentiators: r.differentiators.map(humanizeText),
      risks: r.risks.map(humanizeText),
      fieldFit: humanizeText(r.fieldFit),
    }));
  }

  if (output.improvementReport) {
    const ir = output.improvementReport;
    result.improvementReport = {
      whatPeopleWant: ir.whatPeopleWant.map(humanizeText),
      commonComplaints: ir.commonComplaints.map(humanizeText),
      improvements: ir.improvements.map((imp) => ({
        ...imp,
        area: humanizeText(imp.area),
        suggestion: humanizeText(imp.suggestion),
      })),
      strengthsToKeep: ir.strengthsToKeep.map(humanizeText),
    };
  }

  return result;
}
