import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleFavoriteChord } from "../src/lib/favoriteChords.ts";
const chord = { id: "first", name: "Cm", notes: ["C", "D#", "G"] };
test("a heart can save and then unfavorite the same chord", () => {
  const saved = toggleFavoriteChord([], chord);
  assert.deepEqual(saved, [chord]);
  assert.notEqual(saved[0].notes, chord.notes);
  assert.deepEqual(toggleFavoriteChord(saved, { ...chord, id: "next" }), []);
});
test("unfavoriting removes old duplicate names without changing a progression or other favorites", () => {
  const other = { id: "G", name: "G", notes: ["G", "B", "D"] };
  const progression = { name: "My song", chords: [chord] };
  assert.deepEqual(
    toggleFavoriteChord([chord, { ...chord, id: "duplicate" }, other], chord),
    [other],
  );
  assert.deepEqual(progression.chords, [chord]);
  assert.deepEqual(chord.notes, ["C", "D#", "G"]);
});
