// POST /api/analyze
//
// Validates the request, runs the analysis pipeline, and returns the report.
// Kept thin on purpose: validation lives in lib/validation, the real work in
// lib/orchestrator.

import { NextResponse } from "next/server";
import { analyze } from "@/lib/orchestrator";
import { parseAnalysisRequest } from "@/lib/validation";
import { checkRateLimit, clientKeyFrom } from "@/lib/rate-limit";

// The AI and outbound HTTP calls need the Node runtime, not the edge.
export const runtime = "nodejs";
// This endpoint is always computed fresh per request.
export const dynamic = "force-dynamic";

// Each analysis fans out to external APIs and an LLM call, so keep this tight.
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

// The valid payload is a few short strings; anything near this size is abuse.
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: Request) {
  // --- Rate limit (per client IP, fixed 1-minute window) ---
  const rate = checkRateLimit(clientKeyFrom(request), RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  // --- Body size cap ---
  // Reject on declared size first, then verify actual bytes read, since
  // Content-Length can be absent or lied about.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
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
