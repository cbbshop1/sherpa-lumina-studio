import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSteps, roomFromLocation } from "../src/lib/nextSteps.ts";

const chord = {
  selection: "C major",
  selectionKind: "chord" as const,
  hasTake: false,
};

test("rooms are recognised from the address, including each Pitch & Tone view", () => {
  assert.equal(roomFromLocation("/chords/", ""), "chords");
  assert.equal(roomFromLocation("/pitch-pipe", ""), "pitch-pipe");
  assert.equal(roomFromLocation("/pitch-pipe", "?view=tone"), "tone");
  assert.equal(
    roomFromLocation("/pitch-pipe", "?view=waveform&source=microphone"),
    "own-sound",
  );
  assert.equal(
    roomFromLocation("/pitch-pipe", "?view=waveform"),
    "see-the-sound",
  );
});

test("a chosen chord leads to singing it, seeing it, and finding it", () => {
  const steps = nextSteps("chords", chord);
  assert.deepEqual(
    steps.map((step) => step.id),
    ["record", "see", "piano"],
  );
  assert.equal(steps[0].label, "Sing C major and record");
});

test("no step ever sends you to the room you're already in", () => {
  for (const room of [
    "piano",
    "chords",
    "scales",
    "progressions",
    "pitch-pipe",
    "see-the-sound",
    "tone",
  ] as const) {
    for (const state of [chord, { ...chord, selection: "" }]) {
      const ids = nextSteps(room, state).map((step) => step.id);
      if (room === "piano") assert.ok(!ids.includes("piano"));
      if (room === "see-the-sound") assert.ok(!ids.includes("see"));
      if (room === "chords") assert.ok(!ids.includes("chords"));
      assert.ok(ids.length > 0 && ids.length <= 3);
    }
  }
});

test("after a take, the recorder offers sing-back and a closer look", () => {
  const steps = nextSteps("own-sound", { ...chord, hasTake: true });
  assert.equal(steps[0].action, "play-target");
  assert.equal(steps[0].label, "Hear C major, then sing again");
  assert.equal(steps[1].action, "show-spectrum");
  const back = nextSteps("own-sound", {
    ...chord,
    hasTake: true,
    scope: "spectrum",
  });
  assert.equal(back[1].action, "show-waveform");
});

test("with nothing chosen, the recorder points to a note to sing", () => {
  const steps = nextSteps("own-sound", { ...chord, selection: "" });
  assert.deepEqual(
    steps.map((step) => step.id),
    ["piano"],
  );
  assert.equal(steps[0].label, "Pick a note on the piano");
});
