import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankPattern,
  defaultGroups,
  defaultStresses,
  groupingChoices,
  hitGain,
  loopSeconds,
  makeMeter,
  meterLabel,
  nextCell,
  parseGroups,
  presets,
  readGroove,
  refitPattern,
  stepGroup,
  stepStress,
  stepTime,
  tempoLabel,
  totalSteps,
} from "../src/lib/groove.ts";

test("simple meters count every beat; eighth-note meters group in 2s and 3s", () => {
  assert.deepEqual(defaultGroups(4, 4), [1, 1, 1, 1]);
  assert.deepEqual(defaultGroups(6, 8), [3, 3]);
  assert.deepEqual(defaultGroups(7, 8), [2, 2, 3]);
  assert.deepEqual(defaultGroups(5, 8), [2, 3]);
});

test("the downbeat is strong and each later group starts medium", () => {
  assert.deepEqual(defaultStresses([2, 2, 3]), [
    "strong",
    "light",
    "medium",
    "light",
    "medium",
    "light",
    "light",
  ]);
});

test("7/8 offers the groupings musicians actually use", () => {
  const texts = groupingChoices(7, 8).map((g) => g.join("+"));
  for (const wanted of ["2+2+3", "3+2+2", "2+3+2", "3+4"])
    assert.ok(texts.includes(wanted), wanted);
  assert.ok(groupingChoices(13, 8).length >= 1);
});

test("typed groupings must add up to the top number", () => {
  assert.deepEqual(parseGroups("3 + 4", 7), [3, 4]);
  assert.equal(parseGroups("3+3", 7), null);
  assert.equal(parseGroups("3+x", 7), null);
  assert.equal(parseGroups("0+7", 7), null);
});

test("labels read like a musician would say them", () => {
  assert.equal(meterLabel(makeMeter(7, 8, 1, [2, 2, 3])), "7/8 · 2+2+3");
  assert.equal(meterLabel(makeMeter(4, 4, 2)), "4/4");
  assert.equal(tempoLabel(8, 210), "♪ = 210");
  assert.equal(tempoLabel(4, 96), "♩ = 96");
});

test("steps fall on an even grid, and lean pushes the in-between notes late", () => {
  const groove = { meter: makeMeter(4, 4, 2), tempo: 120, lean: 0 };
  assert.equal(stepTime(0, groove), 0);
  assert.equal(stepTime(1, groove), 0.25);
  assert.equal(stepTime(2, groove), 0.5);
  const swung = { ...groove, lean: 0.33 };
  assert.ok(Math.abs(stepTime(1, swung) - 0.3325) < 1e-9);
  assert.equal(stepTime(2, swung), 0.5);
  // Triplet splits never lean.
  const triplet = { meter: makeMeter(4, 4, 3), tempo: 120, lean: 0.4 };
  assert.ok(Math.abs(stepTime(1, triplet) - 0.5 / 3) < 1e-9);
});

test("a loop lasts its bars times its pulses", () => {
  assert.equal(loopSeconds({ meter: makeMeter(7, 8, 1), tempo: 210, bars: 2 }), 4);
  assert.equal(totalSteps({ meter: makeMeter(7, 8, 2), bars: 2 }), 28);
});

test("stress and group follow the meter, step by step", () => {
  const meter = makeMeter(7, 8, 2, [2, 2, 3]);
  assert.equal(stepStress(0, meter), "strong");
  assert.equal(stepStress(1, meter), "off");
  assert.equal(stepStress(4, meter), "medium");
  assert.equal(stepStress(6, meter), "light");
  assert.deepEqual(
    Array.from({ length: 14 }, (_, s) => stepGroup(s, meter)),
    [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
  );
  assert.equal(stepStress(14, meter), "strong");
});

test("accents are full; other hits follow the stress", () => {
  assert.equal(hitGain(0, "strong"), 0);
  assert.equal(hitGain(2, "light"), 1);
  assert.ok(hitGain(1, "strong") > hitGain(1, "light"));
  assert.ok(hitGain(1, "light") > hitGain(1, "off"));
  assert.deepEqual([nextCell(0), nextCell(1), nextCell(2)], [1, 2, 0]);
});

test("changing the meter keeps hits that still fit", () => {
  const from = { meter: makeMeter(4, 4, 2), bars: 2 };
  const pattern = blankPattern(16);
  pattern.kick[0] = 2;
  pattern.kick[1] = 1; // the "and" of beat 1
  pattern.snare[6] = 1; // beat 4
  pattern.hat[9] = 1; // bar 2
  const to = { meter: makeMeter(3, 4, 4), bars: 1 };
  const next = refitPattern(pattern, from, to);
  assert.equal(next.kick.length, 12);
  assert.equal(next.kick[0], 2);
  assert.equal(next.kick[2], 1); // the "and" stays the "and"
  assert.ok(next.snare.every((c) => c === 0)); // beat 4 doesn't exist in 3/4
  assert.ok(next.hat.every((c) => c === 0)); // bar 2 is gone
});

test("every preset is complete and survives saving and loading", () => {
  const all = presets();
  assert.ok(all.length >= 9);
  for (const groove of all) {
    const steps = totalSteps(groove);
    assert.equal(groove.meter.stresses.length, groove.meter.top, groove.name);
    assert.equal(
      groove.meter.groups.reduce((a, b) => a + b, 0),
      groove.meter.top,
      groove.name,
    );
    for (const row of Object.values(groove.pattern))
      assert.equal(row.length, steps, groove.name);
    assert.deepEqual(readGroove(JSON.stringify(groove)), groove, groove.name);
  }
  const samba = all.find((g) => g.name === "Samba")!;
  assert.deepEqual(samba.meter.stresses, ["medium", "strong"]);
});

test("broken saves fall back safely", () => {
  assert.equal(readGroove("nonsense").name, "Rock beat");
  assert.equal(readGroove(null).name, "Rock beat");
  const odd = readGroove({
    meter: { top: 7, unit: 8, subdivision: 1, groups: [5, 5] },
    tempo: 9999,
    pattern: { kick: [2, 7, "x"] },
  });
  assert.deepEqual(odd.meter.groups, [2, 2, 3]);
  assert.equal(odd.tempo, 320);
  assert.deepEqual(odd.pattern.kick.slice(0, 3), [2, 0, 0]);
});
