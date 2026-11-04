import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnalysisRequest } from "./validation";

const ok = { location: "Buffalo, NY", fieldOfStudy: "Economics", mode: "opportunity" };

test("a valid request passes and strings are trimmed", () => {
  const r = parseAnalysisRequest({ ...ok, location: "  Buffalo, NY  " });
  assert.ok(r.success && r.data.location === "Buffalo, NY");
});

test("improve mode needs the business type; opportunity mode does not", () => {
  assert.equal(parseAnalysisRequest({ ...ok, mode: "improve" }).success, false);
  assert.equal(parseAnalysisRequest({ ...ok, mode: "improve", existingBusinessType: "   " }).success, false);
  assert.equal(parseAnalysisRequest({ ...ok, mode: "improve", existingBusinessType: "Bakery" }).success, true);
});

test("empty, over-long, or wrongly typed input is rejected with a readable message", () => {
  assert.equal(parseAnalysisRequest({ ...ok, location: "   " }).success, false);
  const long = parseAnalysisRequest({ ...ok, location: "x".repeat(201) });
  assert.ok(!long.success && /200 characters/.test(long.error));
  assert.equal(parseAnalysisRequest({ ...ok, mode: "other" }).success, false);
  for (const bad of [null, undefined, "text", 42, []]) assert.equal(parseAnalysisRequest(bad).success, false);
});
