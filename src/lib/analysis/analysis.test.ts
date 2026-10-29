import { test } from "node:test";
import assert from "node:assert/strict";
import type { DemandSignal, Place, RedditPost } from "@/lib/types";
import { computeCategoryStats } from "./categories";
import { mineDemandSignals } from "./demand";
import { computeMarketGaps } from "./gaps";

const place = (name: string, primaryCategory: string, extra: Partial<Place> = {}): Place => ({
  id: name, name, primaryCategory, categories: [primaryCategory], location: { lat: 0, lng: 0 }, reviews: [], ...extra,
});
const many = (category: string, n: number) => Array.from({ length: n }, (_, i) => place(`${category} ${i}`, category));

test("category stats: counts, saturation thresholds and ordering", () => {
  const stats = computeCategoryStats([...many("Pharmacy", 1), ...many("Cafe", 3), ...many("Gym", 5), ...many("Bar", 8)]);
  assert.deepEqual(stats.map((s) => [s.category, s.count, s.saturation]), [
    ["Bar", 8, "high"], ["Gym", 5, "high"], ["Cafe", 3, "medium"], ["Pharmacy", 1, "low"],
  ]);
});

test("category stats: ratings, review totals and example names", () => {
  const stats = computeCategoryStats([
    place("A", "Cafe", { rating: 4, userRatingsTotal: 10 }),
    place("B", "Cafe", { rating: 5, reviews: [{ rating: 5, text: "x" }, { rating: 5, text: "y" }] }),
    place("(unnamed)", "Cafe"),
    place("A", "Cafe"), // duplicate name
    place("C", "Cafe"), place("D", "Cafe"), place("E", "Cafe"),
  ]);
  const cafe = stats[0];
  assert.equal(cafe.avgRating, 4.5);
  assert.equal(cafe.totalReviews, 10 + 2); // userRatingsTotal where given, else the review count
  assert.deepEqual(cafe.examples, ["A", "B", "C", "D"]); // capped at 4, no "(unnamed)", no duplicate
  assert.equal(computeCategoryStats([place("Z", "Bank")])[0].avgRating, null);
});

test("gaps: non-commercial categories are never pitched", () => {
  const gaps = computeMarketGaps(computeCategoryStats([...many("School", 1), ...many("Pharmacy", 1)]), [], []);
  assert.deepEqual(gaps.map((g) => g.category), ["Pharmacy"]);
});

test("gaps: scores follow the documented formulas", () => {
  const [pharmacy] = computeMarketGaps(computeCategoryStats(many("Pharmacy", 1)), [], []);
  assert.equal(pharmacy.demandScore, 90); // essentiality prior, no local signal
  assert.equal(pharmacy.competitionScore, 27); // round(1/6 * 70) + neutral 15 for "no ratings"
  assert.equal(pharmacy.opportunityScore, 66); // 0.90 * (1 - 0.27)
  const [crowded] = computeMarketGaps(computeCategoryStats(many("Pharmacy", 9)), [], []);
  assert.equal(crowded.competitionScore, 85); // supply caps at 70, plus 15
  const rated = computeMarketGaps(computeCategoryStats([place("P", "Pharmacy", { rating: 5 })]), [], [])[0];
  assert.equal(rated.competitionScore, 42); // round(11.67 + 30): the parts are added before rounding
  assert.equal(computeMarketGaps(computeCategoryStats(many("Mystery shop", 1)), [], [])[0].demandScore, 50); // unknown category
});

test("gaps: local discussion lifts demand and results are sorted by opportunity", () => {
  const signal = (theme: string, frequency: number): DemandSignal => ({ theme, sentiment: "neutral", frequency, evidence: [], sources: ["reddit"] });
  const gaps = computeMarketGaps(
    computeCategoryStats([...many("Yoga studio", 1), ...many("Pharmacy", 1)]),
    [signal("hours", 1), signal("variety", 1), signal("price/value", 1)], []);
  const yoga = gaps.find((g) => g.category === "Yoga studio")!;
  assert.equal(yoga.demandScore, 100); // prior 50 overridden by related signals at frequency 1
  assert.deepEqual(gaps.map((g) => g.opportunityScore), [...gaps.map((g) => g.opportunityScore)].sort((a, b) => b - a));
});

test("gaps: a frequently discussed theme no category serves becomes its own gap", () => {
  const signal = (theme: string, frequency: number): DemandSignal => ({ theme, sentiment: "negative", frequency, evidence: [], sources: ["reddit"] });
  const stats = computeCategoryStats(many("Pharmacy", 1));
  const gaps = computeMarketGaps(stats, [signal("parking", 0.5), signal("wifi", 0.2), signal("hours", 0.9)], []);
  const parking = gaps.find((g) => g.category === "parking")!;
  assert.deepEqual([parking.demandScore, parking.competitionScore, parking.opportunityScore], [50, 5, 48]);
  assert.ok(!gaps.some((g) => g.category === "wifi"), "below the 0.3 frequency bar");
  assert.ok(!gaps.some((g) => g.category === "hours"), "Pharmacy already covers hours");
});

const post = (title: string, text: string): RedditPost => ({ id: title, subreddit: "x", title, text, score: 1, numComments: 0, url: "", createdUtc: 0 });

test("demand signals: frequency is normalised to the most common theme, sources recorded", () => {
  const signals = mineDemandSignals(
    [place("A", "Cafe", { reviews: [{ rating: 4, text: "Parking is awful" }, { rating: 4, text: "No parking again" }, { rating: 3, text: "Long wait" }] })],
    [post("Where to park", "Parking downtown is hard")]);
  const parking = signals.find((s) => s.theme === "parking")!;
  const wait = signals.find((s) => s.theme === "wait time")!;
  assert.equal(parking.frequency, 1);
  assert.equal(wait.frequency, 0.333);
  assert.deepEqual(parking.sources.sort(), ["reddit", "reviews"]);
  assert.equal(signals[0].theme, "parking"); // sorted by frequency
});

test("demand signals: evidence is capped at three quotes and long ones are shortened", () => {
  const long = "Parking " + "is hard ".repeat(40);
  const reviews = Array.from({ length: 5 }, () => ({ rating: 3, text: long }));
  const [parking] = mineDemandSignals([place("A", "Cafe", { reviews })], []);
  assert.equal(parking.evidence.length, 3);
  assert.equal(parking.evidence[0].length, 120);
  assert.ok(parking.evidence[0].endsWith("..."));
  assert.deepEqual(mineDemandSignals([], []), []);
});
