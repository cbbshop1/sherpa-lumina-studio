import { test } from "node:test";
import assert from "node:assert/strict";
import {
  writtenPitch,
  staffNotes,
  rollCell,
} from "../src/lib/staffNotation.ts";
import {
  SCALE_FORMULAS,
  spellIntervals,
  pitchClass,
  selectionNoteLabels,
} from "../src/lib/musicNotation.ts";
import { scalePlaybackPlan } from "../src/lib/playbackPlan.ts";
test("grand staff places middle C and bass C with correct ledger lines", () => {
  assert.equal(writtenPitch(60).name, "C4");
  assert.equal(writtenPitch(60).y, 95);
  assert.deepEqual(writtenPitch(60).ledger, [95]);
  assert.equal(writtenPitch(36).clef, "bass");
  assert.equal(writtenPitch(36).y, 205);
  assert.deepEqual(writtenPitch(36).ledger, [195, 205]);
  assert.equal(writtenPitch(84).y, 25);
  assert.deepEqual(writtenPitch(84).ledger, [35, 25]);
});
test("lesson spelling preserves E flat, B sharp and C flat including written octave", () => {
  assert.equal(writtenPitch(63, ["C", "Eb", "G"]).name, "E♭4");
  assert.equal(writtenPitch(60, ["B#"]).name, "B♯3");
  assert.equal(writtenPitch(59, ["Cb"]).name, "C♭4");
});
test("staff accidentals cancel and reset at each bar, and durations have the appropriate flags", () => {
  const notes = [61, 61, 60, 61, 61].map((midiNote, i) => ({
    id: String(i),
    midiNote,
    startBeat: i,
    durationBeats: [0.25, 0.5, 1, 2, 4][i],
  }));
  const model = staffNotes(notes);
  assert.deepEqual(
    model.map((n) => n.sign),
    ["♯", "", "♮", "♯", "♯"],
  );
  assert.deepEqual(
    model.map((n) => n.flags),
    [2, 1, 0, 0, 0],
  );
  assert.deepEqual(
    model.map((n) => n.hollow),
    [false, false, false, true, true],
  );
});
test("grid placement uses readable semitone rows and sixteenth snapping, bounded to the pattern", () => {
  assert.deepEqual(rollCell(135, 480, 960, 8), { midiNote: 60, startBeat: 1 });
  assert.deepEqual(rollCell(-5, -5, 960, 8), { midiNote: 84, startBeat: 0 });
  assert.deepEqual(rollCell(2000, 2000, 960, 8), {
    midiNote: 36,
    startBeat: 7.75,
  });
});
test("classical melodic minor raises six and seven only on the ascending leg", () => {
  const formula = SCALE_FORMULAS["Melodic Minor"];
  const up = spellIntervals("C", formula.intervals, formula.degrees);
  const down = spellIntervals(
    "C",
    formula.descendingIntervals,
    formula.degrees,
  );
  assert.deepEqual(up, ["C", "D", "Eb", "F", "G", "A", "B"]);
  assert.deepEqual(down, ["C", "D", "Eb", "F", "G", "Ab", "Bb"]);
  const canonical = (notes: string[]) =>
    notes.map(
      (n) =>
        ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][
          pitchClass(n)
        ],
    );
  const plan = scalePlaybackPlan(
    canonical(up),
    4,
    { bpm: 120, direction: "up-down" },
    canonical(down),
  );
  assert.deepEqual(
    plan.steps.map((n) => n.midi),
    [60, 62, 63, 65, 67, 69, 71, 72, 70, 68, 67, 65, 63, 62, 60],
  );
  assert.ok(plan.steps.slice(8).every((n) => n.descending));
  assert.deepEqual(
    scalePlaybackPlan(
      canonical(up),
      4,
      { bpm: 120, direction: "down" },
      canonical(down),
    ).steps.map((n) => n.midi),
    [72, 70, 68, 67, 65, 63, 62, 60],
  );
});
test("harmonic minor and all seven diatonic modes retain seven written letter names", () => {
  assert.deepEqual(
    SCALE_FORMULAS["Harmonic Minor"].intervals,
    [0, 2, 3, 5, 7, 8, 11],
  );
  for (const mode of [
    "Major",
    "Natural Minor",
    "Dorian",
    "Phrygian",
    "Lydian",
    "Mixolydian",
    "Locrian",
  ]) {
    const f = SCALE_FORMULAS[mode];
    const notes = spellIntervals("Eb", f.intervals, f.degrees);
    assert.equal(new Set(notes.map((n) => n[0])).size, 7, mode);
  }
});

test("descending selection labels show the lowered sixth and seventh", () => {
  assert.deepEqual(
    selectionNoteLabels({
      kind: "scale",
      name: "C melodic minor",
      notes: ["C", "D", "D#", "F", "G", "A", "B"],
      descending: true,
    }),
    ["C", "D", "E♭", "F", "G", "A♭", "B♭"],
  );
});
