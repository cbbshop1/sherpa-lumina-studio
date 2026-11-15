import { test } from "node:test";
import assert from "node:assert/strict";
import {
  keyChords,
  keyVocabulary,
  pointerChords,
  moveToKey,
  placeInKey,
  MAJOR_KEYS,
  MINOR_KEYS,
  STARTERS,
} from "../src/lib/keyChords.ts";

const names = (root: string, mode: "major" | "minor") =>
  keyChords(root, mode).map((chord) => `${chord.numeral} ${chord.name}`);

test("a major key lists its seven chords with numerals and correct spelling", () => {
  assert.deepEqual(names("C", "major"), [
    "I C", "ii Dm", "iii Em", "IV F", "V G", "vi Am", "vii° Bdim",
  ]);
  assert.deepEqual(names("F", "major").slice(3, 4), ["IV Bb"]);
  assert.deepEqual(names("Eb", "major"), [
    "I Eb", "ii Fm", "iii Gm", "IV Ab", "V Bb", "vi Cm", "vii° Ddim",
  ]);
});

test("a minor key uses a major V by default and offers the natural-minor v beside it", () => {
  assert.deepEqual(names("A", "minor"), [
    "i Am", "ii° Bdim", "III C", "iv Dm", "V E", "VI F", "VII G",
    "v Em", "vii° G#dim",
  ]);
  const chords = keyChords("A", "minor");
  assert.deepEqual(chords[4].notes, ["E", "G#", "B"]);
  assert.equal(chords[7].alternate, true);
});

test("every offered key spells its seven main chords without double sharps or flats", () => {
  for (const [keys, mode] of [[MAJOR_KEYS, "major"], [MINOR_KEYS, "minor"]] as const)
    for (const key of keys)
      for (const chord of keyChords(key, mode)) {
        // G-sharp minor's raised seventh really is F double-sharp; only that
        // extra chord may carry one.
        if (!chord.alternate)
          assert.ok(!/##|bb/.test(chord.name), `${key} ${mode}: ${chord.name}`);
        assert.equal(chord.notes.length, 3);
      }
});

test("leads-to targets and starter progressions all point at real chords", () => {
  for (const mode of ["major", "minor"] as const) {
    const all = [...keyChords("C", mode), ...pointerChords("C", mode)];
    const ids = all.map((chord) => chord.id);
    for (const chord of all)
      for (const target of chord.leadsTo) assert.ok(ids.includes(target));
    for (const starter of STARTERS[mode])
      for (const id of starter.ids) assert.ok(ids.includes(id));
  }
  const c = keyChords("C", "major");
  assert.deepEqual(c[1].leadsTo, ["5", "7"]);
  assert.deepEqual(c[4].leadsTo, ["1", "6"]);
  assert.deepEqual(c[0].leadsTo, []);
});

test("a progression keeps its shape when the key changes", () => {
  const c = keyVocabulary("C", "major"),
    g = keyVocabulary("G", "major");
  const pick = (name: string) => {
    const chord = c.find((entry) => entry.name === name)!;
    return { name: chord.name, notes: chord.notes };
  };
  const outside = { name: "Ab", notes: ["G#", "C", "D#"] };
  const moved = moveToKey(
    [pick("C"), pick("F"), pick("G7"), pick("D7"), outside],
    c,
    g,
  );
  // Triads stay triads, sevenths stay sevenths, V7 of V stays V7 of V.
  assert.deepEqual(moved.map((chord) => chord.name), ["G", "C", "D7", "A7", "Ab"]);
  // A favorite saved under its sharp name is still found in a flat key.
  assert.equal(placeInKey({ name: "A#", notes: ["A#", "D", "F"] }, keyChords("F", "major"))?.numeral, "IV");
});

test("sevenths follow the key, with V as a dominant seventh", () => {
  assert.deepEqual(
    keyChords("C", "major", true).map((chord) => `${chord.numeral} ${chord.name}`),
    ["Imaj7 Cmaj7", "ii7 Dm7", "iii7 Em7", "IVmaj7 Fmaj7", "V7 G7", "vi7 Am7", "viiø7 Bm7b5"],
  );
  const minor = keyChords("A", "minor", true);
  assert.equal(`${minor[4].numeral} ${minor[4].name}`, "V7 E7");
  assert.equal(`${minor[8].numeral} ${minor[8].name}`, "vii°7 G#dim7");
  assert.deepEqual(minor[8].notes, ["G#", "B", "D", "F"]);
});

test("pointer chords are the V7 of each chord and chain into the barbershop circle", () => {
  const ab = pointerChords("Ab", "major");
  assert.deepEqual(
    ab.map((chord) => `${chord.numeral} ${chord.name}`),
    ["V7/ii F7", "V7/iii G7", "V7/IV Ab7", "V7/V Bb7", "V7/vi C7"],
  );
  // F7 can resolve to ii, or hand on to Bb7, as in Meet Me Tonight in Dreamland.
  assert.deepEqual(ab[0].leadsTo, ["2", "s5"]);
  assert.deepEqual(ab[3].leadsTo, ["5"]);
  const words = keyVocabulary("Ab", "major");
  assert.equal(placeInKey({ name: "Bb7", notes: ["A#", "D", "F", "G#"] }, words)?.numeral, "V7/V");
  assert.equal(placeInKey({ name: "Eb7", notes: ["D#", "G", "A#", "C#"] }, words)?.numeral, "V7");
  for (const key of ["C", "F#", "Db", "Eb", "B"])
    for (const chord of pointerChords(key, "major"))
      assert.ok(!/##|bb/.test(chord.name), `${key}: ${chord.name}`);
});
