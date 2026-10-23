import { test } from "node:test";
import assert from "node:assert/strict";
import { scalePlaybackPlan, sameSelection } from "../src/lib/playbackPlan.ts";

const major = ["G", "A", "B", "C", "D", "E", "F#"];
test("scales cross the octave in order and finish on the upper tonic", () => {
  const plan = scalePlaybackPlan(major, 4, { bpm: 120, direction: "up" });
  assert.deepEqual(
    plan.steps.map((step) => step.midi),
    [67, 69, 71, 72, 74, 76, 78, 79],
  );
  assert.deepEqual(
    plan.steps.map((step) => step.at),
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
  );
  assert.ok(
    plan.timing.gateSeconds + plan.timing.releaseSeconds >
      plan.timing.stepSeconds,
  );
  assert.ok(
    plan.timing.gateSeconds + plan.timing.releaseSeconds <
      2 * plan.timing.stepSeconds,
  );
});
test("descending and return journeys retain note labels without repeating the turning note", () => {
  const down = scalePlaybackPlan(major, 4, { bpm: 120, direction: "down" });
  assert.deepEqual(
    down.steps.map((step) => step.index),
    [7, 6, 5, 4, 3, 2, 1, 0],
  );
  const both = scalePlaybackPlan(major, 4, { bpm: 120, direction: "up-down" });
  assert.deepEqual(
    both.steps.map((step) => step.index),
    [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0],
  );
  assert.equal(both.steps.at(-1)!.midi, 67);
});
test("pentatonic and blues scales resolve to their tonic and invalid pace remains finite", () => {
  const blues = ["A#", "C#", "D#", "E", "F", "G#"];
  const plan = scalePlaybackPlan(blues, 3, { bpm: NaN, direction: "up" });
  assert.equal(plan.steps.length, 7);
  assert.equal(plan.steps.at(-1)!.midi - plan.steps[0].midi, 12);
  assert.ok(Number.isFinite(plan.duration));
  assert.equal(
    scalePlaybackPlan([], 4, { bpm: 120, direction: "up" }).duration,
    0,
  );
});
test("card toggles distinguish another chord from the current sounding selection", () => {
  const c = { name: "C", notes: ["C", "E", "G"], kind: "chord" };
  assert.equal(sameSelection(c, { ...c, notes: [...c.notes] }), true);
  assert.equal(
    sameSelection(c, { ...c, name: "Cm", notes: ["C", "D#", "G"] }),
    false,
  );
});
