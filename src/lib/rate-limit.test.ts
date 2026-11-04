import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, getClientKey } from "./rate-limit";

test("allows up to the limit, then blocks with a Retry-After", () => {
  const o = { limit: 2, windowMs: 60_000 };
  const a = checkRateLimit("rl-a", o), b = checkRateLimit("rl-a", o), c = checkRateLimit("rl-a", o);
  assert.deepEqual([a.allowed, b.allowed, c.allowed], [true, true, false]);
  assert.deepEqual([a.remaining, b.remaining, c.remaining], [1, 0, 0]);
  assert.ok(c.retryAfterSeconds >= 1 && c.retryAfterSeconds <= 60);
});

test("keys are independent", () => {
  const o = { limit: 1, windowMs: 60_000 };
  assert.equal(checkRateLimit("rl-b1", o).allowed, true);
  assert.equal(checkRateLimit("rl-b2", o).allowed, true);
  assert.equal(checkRateLimit("rl-b1", o).allowed, false);
});

test("the window resets", async () => {
  const o = { limit: 1, windowMs: 50 };
  assert.equal(checkRateLimit("rl-c", o).allowed, true);
  assert.equal(checkRateLimit("rl-c", o).allowed, false);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(checkRateLimit("rl-c", o).allowed, true);
});

test("a limit of 0 or less turns limiting off", () => {
  for (let i = 0; i < 5; i++) assert.equal(checkRateLimit("rl-d", { limit: 0, windowMs: 1000 }).allowed, true);
});

test("the env settings apply when no override is given", () => {
  process.env.MARKET_SCOUT_RATE_LIMIT = "1";
  try {
    assert.equal(checkRateLimit("rl-e").allowed, true);
    assert.equal(checkRateLimit("rl-e").allowed, false);
  } finally { delete process.env.MARKET_SCOUT_RATE_LIMIT; }
});

test("client key: first forwarded address, then x-real-ip, then unknown", () => {
  const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });
  assert.equal(getClientKey(req({ "x-forwarded-for": " 1.1.1.1, 2.2.2.2" })), "1.1.1.1");
  assert.equal(getClientKey(req({ "x-real-ip": "3.3.3.3" })), "3.3.3.3");
  assert.equal(getClientKey(req({})), "unknown");
});
