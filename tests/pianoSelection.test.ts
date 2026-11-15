import { test } from "node:test";
import assert from "node:assert/strict";
import { pianoSelection } from "../src/lib/pianoSelection.ts";
import { selectionNoteLabels } from "../src/lib/musicNotation.ts";

test("a built minor chord keeps its canonical pitches and spells its third correctly", () => {
  const chord = pianoSelection([67, 60, 63]);
  assert.equal(chord.name, "Cm");
  assert.deepEqual(chord.midiNotes, [60, 63, 67]);
  assert.deepEqual(selectionNoteLabels(chord), ["C", "E♭", "G"]);
});
test("upper C, octaves, inversions and external MIDI retain their actual register", () => {
  assert.deepEqual(pianoSelection([72]).midiNotes, [72]);
  assert.deepEqual(pianoSelection([72, 60, 60, 48]).midiNotes, [48, 60, 72]);
  assert.deepEqual(pianoSelection([64, 67, 72]).midiNotes, [64, 67, 72]);
  assert.deepEqual(pianoSelection([]).notes, []);
});

test("the lowest note is tried as the root first, and ninths are recognised", () => {
  assert.equal(pianoSelection([62, 65, 69, 72]).name, "Dm7");
  assert.equal(pianoSelection([60, 64, 67, 69]).name, "C6");
  assert.equal(pianoSelection([64, 67, 72]).name, "C");
  assert.equal(pianoSelection([60, 62, 64, 67, 70]).name, "C9");
});
