import { test } from "node:test";
import assert from "node:assert/strict";
import { describeInterval } from "../src/lib/intervals.ts";
import { rootPosition, invert, inversionOf } from "../src/lib/inversions.ts";

test("intervals are named and spelled so the letters agree with the name", () => {
  const third = describeInterval(60, 64);
  assert.equal(third.name, "Major third");
  assert.deepEqual(third.spellings, ["C", "E"]);
  assert.deepEqual(third.letters, ["C", "D", "E"]);
  assert.deepEqual(describeInterval(60, 63).spellings, ["C", "Eb"]);
  assert.equal(describeInterval(60, 63).name, "Minor third");
  assert.deepEqual(describeInterval(60, 66).spellings, ["C", "F#"]);
  assert.equal(describeInterval(67, 60).name, "Perfect fifth");
  assert.equal(describeInterval(60, 72).name, "Octave");
  assert.equal(describeInterval(60, 60).name, "Unison");
});

test("black-key starting notes pick the spelling without double flats or sharps", () => {
  // D-flat up a minor sixth would be B double-flat, so it reads C-sharp to A.
  assert.deepEqual(describeInterval(61, 69).spellings, ["C#", "A"]);
  assert.deepEqual(describeInterval(61, 65).spellings, ["Db", "F"]);
  assert.deepEqual(describeInterval(63, 70).spellings, ["Eb", "Bb"]);
  for (let low = 48; low < 60; low++)
    for (let high = low; high <= low + 24; high++)
      for (const spelling of describeInterval(low, high).spellings)
        assert.ok(spelling.length <= 2, `${low}-${high}: ${spelling}`);
});

test("reaches wider than an octave are described in plain words", () => {
  assert.equal(describeInterval(60, 76).name, "An octave plus a major third");
  assert.equal(describeInterval(60, 84).name, "Two octaves");
  assert.deepEqual(describeInterval(60, 74).spellings, ["C", "D"]);
});

test("a chord stacks from its root and inverts by lifting the bottom note", () => {
  const c = { name: "C", notes: ["C", "E", "G"], kind: "chord" };
  const stack = rootPosition(c, 4)!;
  assert.deepEqual(stack, [60, 64, 67]);
  assert.deepEqual(invert(stack, 1), [64, 67, 72]);
  assert.deepEqual(invert(stack, 2), [67, 72, 76]);
  assert.equal(inversionOf(stack, [64, 67, 72]), 1);
  assert.equal(inversionOf(stack, [55, 60, 64]), 2);
  const ninth = { name: "C9", notes: ["C", "E", "G", "A#", "D"], kind: "chord" };
  assert.deepEqual(rootPosition(ninth, 3), [48, 52, 55, 58, 62]);
  // Built by hand in first inversion, it still stacks from the root.
  const built = { name: "D#m", notes: ["F#", "A#", "D#"], kind: "chord" };
  assert.deepEqual(rootPosition(built, 4), [63, 66, 70]);
  assert.equal(rootPosition({ name: "C · D", notes: ["C", "D"], kind: "chord" }, 4), null);
  assert.equal(rootPosition({ name: "C4", notes: ["C"], kind: "note" }, 4), null);
});
