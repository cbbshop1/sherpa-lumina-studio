import { test } from "node:test";
import assert from "node:assert/strict";
import {
  keyChords,
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
    const ids = keyChords("C", mode).map((chord) => chord.id);
    for (const chord of keyChords("C", mode))
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
  const c = keyChords("C", "major"),
    g = keyChords("G", "major");
  const one451 = [c[0], c[3], c[4], c[0]].map(({ name, notes }) => ({ name, notes }));
  const outside = { name: "Ab", notes: ["G#", "C", "D#"] };
  const moved = moveToKey([...one451, outside], c, g);
  assert.deepEqual(moved.map((chord) => chord.name), ["G", "C", "D", "G", "Ab"]);
  // A favorite saved under its sharp name is still found in a flat key.
  assert.equal(placeInKey({ name: "A#", notes: ["A#", "D", "F"] }, keyChords("F", "major"))?.numeral, "IV");
});
