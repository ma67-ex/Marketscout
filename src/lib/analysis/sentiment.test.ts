import { test } from "node:test";
import assert from "node:assert/strict";
import { extractThemes, scoreSentiment } from "./sentiment";

test("plain positive and negative text", () => {
  assert.equal(scoreSentiment("The food was great and the staff were friendly").label, "positive");
  assert.equal(scoreSentiment("Terrible service and dirty tables").label, "negative");
  assert.deepEqual(scoreSentiment("We went on Tuesday"), { score: 0, label: "neutral" });
});

test("a negator within two words flips the word", () => {
  assert.equal(scoreSentiment("not good").label, "negative");
  assert.equal(scoreSentiment("not bad").label, "positive");
  assert.equal(scoreSentiment("never really great").label, "negative");
});

test("contractions negate too, with straight or curly apostrophes", () => {
  assert.equal(scoreSentiment("The pizza wasn't great").label, "negative");
  assert.equal(scoreSentiment("I don't love the parking").label, "negative");
  assert.equal(scoreSentiment("It isn’t clean").label, "negative"); // curly apostrophe
  assert.equal(scoreSentiment("You can't beat the value, it's amazing").label, "positive");
});

test("score stays within -1..1", () => {
  const { score } = scoreSentiment("great great great excellent amazing");
  assert.ok(score <= 1 && score > 0.9);
});

test("themes are found by keyword", () => {
  assert.deepEqual(extractThemes("Parking is a nightmare and the line is long"), ["parking", "wait time"]);
  assert.ok(extractThemes("Great vegan options and fast delivery").includes("healthy options"));
  assert.ok(extractThemes("Great vegan options and fast delivery").includes("delivery"));
  assert.deepEqual(extractThemes("We went on Tuesday"), []);
});

test("the ordinary word 'it' is not the tech theme", () => {
  assert.ok(!extractThemes("I think it opens late and it is nice").includes("tech/digital"));
});

test("real tech words, and the capitalised IT department, are", () => {
  assert.ok(extractThemes("Great phone repair and screen fixes").includes("tech/digital"));
  assert.ok(extractThemes("They offer IT support for small offices").includes("tech/digital"));
  assert.equal(extractThemes("They offer IT support and phone repair").filter((t) => t === "tech/digital").length, 1); // not listed twice
});
