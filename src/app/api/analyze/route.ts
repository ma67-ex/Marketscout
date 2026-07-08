// POST /api/analyze
//
// Validates the request, runs the analysis pipeline, and returns the report.
// Kept thin on purpose: validation lives in lib/validation, the real work in
// lib/orchestrator.

import { NextResponse } from "next/server";
import { analyze } from "@/lib/orchestrator";
import { parseAnalysisRequest } from "@/lib/validation";

// The AI and outbound HTTP calls need the Node runtime, not the edge.
export const runtime = "nodejs";
// This endpoint is always computed fresh per request.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = parseAnalysisRequest(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const report = await analyze(parsed.data);
    return NextResponse.json(report);
  } catch (err) {
    // Surface a readable message but keep internals out of the client payload.
    const message =
      err instanceof Error ? err.message : "Unexpected analysis error.";
    console.error("[analyze] failed:", err);
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 },
    );
  }
}
