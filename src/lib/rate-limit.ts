// Minimal fixed-window in-memory rate limiter.
//
// Good enough for a single-process deployment (next start, one container).
// If you deploy serverless or multi-instance, each instance gets its own
// counters — swap this for a shared store (e.g. Upstash Redis) in that case.

interface WindowEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, WindowEntry>();

// Periodically drop stale entries so the map can't grow unbounded
// (an attacker rotating IPs would otherwise leak memory here too).
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > windowMs) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. Only meaningful when blocked. */
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  sweep(windowMs);

  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfterSeconds = Math.ceil(
      (entry.windowStart + windowMs - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client identifier from proxy headers, for rate-limit keying. */
export function clientKeyFrom(request: Request): string {
  // x-forwarded-for may be a comma-separated chain; the first hop is the client.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
