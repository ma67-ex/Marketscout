// Best-effort, in-memory, per-instance rate limiter for public API routes.
//
// Deliberately dependency-free: no Redis, no external service, just a
// module-scope Map holding fixed-window counters. That also means it is NOT
// a global guarantee -- on serverless/multi-instance deployments each
// instance holds its own map, so a client can get up to `limit` requests
// per instance rather than per deployment as a whole. Good enough to blunt
// casual abuse and protect the external APIs (Nominatim/Overpass/Reddit/
// Anthropic) this app fans out to. If a hard global limit is ever needed,
// swap this for a shared store (e.g. Upstash Redis) or lean on
// platform-level rate limiting (Vercel).

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Requests left in the current window, clamped to >= 0. */
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
  /** ceil((resetAt - now) / 1000), minimum 1. Only meaningful when blocked. */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Memory-leak guard: bound the map without paying an O(n) walk on every
// request. At most once per window, sweep and drop buckets whose window
// has already elapsed (an attacker rotating IPs would otherwise be able to
// grow this map without bound).
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Check (and consume) one request against the fixed-window limit for `key`.
 *
 * Reads config from env at call time:
 *   MARKET_SCOUT_RATE_LIMIT      (default 20)    -- max requests per window per key
 *   MARKET_SCOUT_RATE_WINDOW_MS  (default 60000) -- window length in ms
 * Setting MARKET_SCOUT_RATE_LIMIT <= 0 disables limiting entirely (always
 * allowed) -- useful for local dev/testing.
 *
 * `override` lets a caller pin its own limit/window instead of the env
 * defaults, for routes that need a different budget than the default (e.g.
 * a chattier type-ahead endpoint). Most callers should omit it and rely on
 * the env-configured default.
 */
export function checkRateLimit(
  key: string,
  override?: { limit: number; windowMs: number },
): RateLimitResult {
  const limit = override?.limit ?? envInt("MARKET_SCOUT_RATE_LIMIT", 20);
  const windowMs =
    override?.windowMs ?? envInt("MARKET_SCOUT_RATE_WINDOW_MS", 60_000);
  const now = Date.now();

  if (limit <= 0) {
    // Limiting disabled.
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit),
      resetAt: now + windowMs,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  sweep(now, windowMs);

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
  } else {
    bucket.count++;
  }

  const allowed = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - now) / 1000),
  );

  return {
    allowed,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  };
}

/**
 * Extract a best-effort client identifier from the incoming request, for
 * use as the rate-limit key.
 *
 * Prefers the first IP in "x-forwarded-for" (a comma-separated hop chain --
 * the first entry is the original client), then falls back to "x-real-ip",
 * then "unknown". Both headers are set by a reverse proxy/CDN and are
 * trivially spoofable by a direct caller with no proxy in front, so this is
 * best-effort app-level throttling, not a security boundary. The
 * production-grade defense is platform rate limiting (Vercel) or a shared
 * store (Upstash Redis) keyed on a trusted identifier.
 */
export function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// Older call sites imported this name; kept as an alias so they keep
// compiling unchanged. New code should use getClientKey.
export const clientKeyFrom = getClientKey;
