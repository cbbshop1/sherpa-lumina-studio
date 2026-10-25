import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHORD_FORMULAS,
  ROOT_SPELLINGS,
  SCALE_FORMULAS,
  chordsForRoot,
  pitchClass,
  spellIntervals,
  spelledChordNotes,
  selectionNoteLabels,
  selectionRoot,
} from "../src/lib/musicNotation.ts";
import { formatNote, voiceNotes } from "../src/lib/noteSelection.ts";

const chord = (root: string, suffix: string) =>
  chordsForRoot(root).find((value) => value.suffix === suffix)!;

test("minor and diminished chords spell thirds and fifths, rather than augmented seconds and fourths", () => {
  assert.deepEqual(chord("C", "m").spellings, ["C", "Eb", "G"]);
  assert.deepEqual(chord("C", "dim").spellings, ["C", "Eb", "Gb"]);
  assert.deepEqual(chord("Bb", "m").spellings, ["Bb", "Db", "F"]);
  assert.deepEqual(chord("Eb", "m").spellings, ["Eb", "Gb", "Bb"]);
});
test("sevenths, sixths, extensions, and suspensions retain their intended degree letters", () => {
  assert.deepEqual(chord("C", "7").spellings, ["C", "E", "G", "Bb"]);
  assert.deepEqual(chord("C", "m6").spellings, ["C", "Eb", "G", "A"]);
  assert.deepEqual(chord("C", "9").spellings, ["C", "E", "G", "Bb", "D"]);
  assert.deepEqual(chord("C", "sus2").spellings, ["C", "D", "G"]);
  assert.deepEqual(chord("C", "sus4").spellings, ["C", "F", "G"]);
});
test("sharps are preserved where correct, including theoretical double accidentals", () => {
  assert.deepEqual(chord("F#", "maj7").spellings, ["F#", "A#", "C#", "E#"]);
  assert.deepEqual(chord("C", "aug").spellings, ["C", "E", "G#"]);
  assert.deepEqual(chord("C#", "aug").spellings, ["C#", "E#", "G##"]);
  assert.deepEqual(chord("Gb", "aug").spellings, ["Gb", "Bb", "D"]);
  assert.equal(formatNote("G##"), "G𝄪");
  assert.equal(formatNote("Bbb"), "B𝄫");
  assert.deepEqual(spellIntervals("Cb", [0, 4, 7], [1, 3, 5]), [
    "Cb",
    "Eb",
    "Gb",
  ]);
});
test("enharmonic root choices preserve distinct notation for the same sound", () => {
  assert.deepEqual(chord("C#", "").spellings, ["C#", "E#", "G#"]);
  assert.deepEqual(chord("Db", "").spellings, ["Db", "F", "Ab"]);
  assert.deepEqual(chord("C#", "").notes, chord("Db", "").notes);
  assert.equal(selectionRoot("D♭maj7", "C#"), "Db");
});
test("every supported chord and scale spelling sounds at exactly its existing chromatic pitch", () => {
  for (const root of ROOT_SPELLINGS) {
    for (const formula of [
      ...CHORD_FORMULAS,
      ...Object.values(SCALE_FORMULAS),
    ]) {
      const labels = spellIntervals(root, formula.intervals, formula.degrees);
      assert.deepEqual(
        labels.map(pitchClass),
        formula.intervals.map((interval) => (pitchClass(root) + interval) % 12),
        `${root}: ${formula.intervals}`,
      );
    }
  }
});
test("scale spelling respects major, minor, pentatonic, and blues degrees", () => {
  const scale = (name: keyof typeof SCALE_FORMULAS) => {
    const formula = SCALE_FORMULAS[name];
    return spellIntervals("C", formula.intervals, formula.degrees);
  };
  assert.deepEqual(scale("Natural Minor"), [
    "C",
    "D",
    "Eb",
    "F",
    "G",
    "Ab",
    "Bb",
  ]);
  assert.deepEqual(scale("Pentatonic Minor"), ["C", "Eb", "F", "G", "Bb"]);
  assert.deepEqual(scale("Blues"), ["C", "Eb", "F", "Gb", "G", "Bb"]);
  assert.deepEqual(
    selectionNoteLabels({
      name: "Bb major",
      notes: ["A#", "C", "D", "D#", "F", "G", "A"],
      kind: "scale",
    }),
    ["B♭", "C", "D", "E♭", "F", "G", "A"],
  );
});
test("existing saved chords are respelled for display without rewriting their pitches", () => {
  const saved = Object.freeze(["C", "D#", "G"]);
  assert.deepEqual(spelledChordNotes("Cm", saved), ["C", "Eb", "G"]);
  assert.deepEqual(
    selectionNoteLabels({ name: "Cm", notes: saved, kind: "chord" }),
    ["C", "E♭", "G"],
  );
  assert.deepEqual(saved, ["C", "D#", "G"]);
  assert.deepEqual(voiceNotes([...saved]), [60, 63, 67]);
  assert.deepEqual(spelledChordNotes("G#aug", ["G#", "C", "E"]), [
    "G#",
    "B#",
    "D##",
  ]);
  assert.deepEqual(spelledChordNotes("Custom chord", saved), saved);
  assert.deepEqual(spelledChordNotes("C", saved), saved);
  assert.deepEqual(spelledChordNotes("C", ["C", "E", "C2"]), ["C", "E", "C2"]);
  assert.deepEqual(
    selectionNoteLabels({ name: "E♭4", notes: ["D#"], kind: "note" }),
    ["E♭"],
  );
});
