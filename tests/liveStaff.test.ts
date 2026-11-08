import { test } from "node:test";
import assert from "node:assert/strict";
import { flatName, liveStaff, staffBounds } from "../src/lib/liveStaff.ts";

test("a single key is one note, on the right staff", () => {
  const [column] = liveStaff({ selected: [67], sounding: [67], kind: "note" });
  assert.equal(column.notes.length, 1);
  assert.equal(column.notes[0].name, "G4");
  assert.equal(column.notes[0].clef, "treble");
  assert.equal(column.notes[0].sounding, true);
  const [low] = liveStaff({ selected: [43], sounding: [], kind: "note" });
  assert.equal(low.notes[0].clef, "bass");
  assert.equal(low.notes[0].sounding, false);
});

test("middle C gets its ledger line", () => {
  const [column] = liveStaff({ selected: [60], sounding: [], kind: "note" });
  assert.equal(column.notes[0].name, "C4");
  assert.deepEqual(column.notes[0].ledger, [95]);
});

test("a chord stacks in one column, low to high", () => {
  const [column] = liveStaff({
    selected: [60, 64, 67],
    sounding: [60, 64, 67],
    kind: "chord",
  });
  assert.deepEqual(
    column.notes.map((note) => note.name),
    ["C4", "E4", "G4"],
  );
  assert.ok(column.notes.every((note) => !note.shifted));
});

test("notes a step apart sit side by side, as in print", () => {
  const [column] = liveStaff({ selected: [60, 62, 64], sounding: [], kind: "chord" });
  assert.deepEqual(
    column.notes.map((note) => note.shifted),
    [false, true, false],
  );
});

test("flats stay flats when the chord is spelled that way", () => {
  const [column] = liveStaff({
    selected: [63, 67, 70],
    sounding: [],
    kind: "chord",
    spellings: ["E♭", "G", "B♭"],
  });
  assert.deepEqual(
    column.notes.map((note) => note.name + note.sign),
    ["E♭4♭", "G4", "B♭4♭"],
  );
  const [sharp] = liveStaff({ selected: [61], sounding: [], kind: "note" });
  assert.equal(sharp.notes[0].sign, "♯");
});

test("a scale is written out note by note, lighting the one being played", () => {
  const columns = liveStaff({
    selected: [60, 62, 64, 65],
    sounding: [64],
    kind: "scale",
  });
  assert.equal(columns.length, 4);
  assert.deepEqual(
    columns.map((column) => column.notes[0].sounding),
    [false, false, true, false],
  );
});

test("a MIDI key held on top of the selection is shown too", () => {
  const [column] = liveStaff({ selected: [60], sounding: [72], kind: "note" });
  assert.deepEqual(
    column.notes.map((note) => note.name),
    ["C4", "C5"],
  );
  assert.deepEqual(liveStaff({ selected: [], sounding: [], kind: "note" }), []);
});

test("the drawing grows to fit very high and very low notes", () => {
  assert.deepEqual(staffBounds([]), { top: 20, bottom: 210 });
  const high = staffBounds(
    liveStaff({ selected: [96], sounding: [], kind: "note" }),
  );
  assert.ok(high.top < 20);
  const low = staffBounds(
    liveStaff({ selected: [24], sounding: [], kind: "note" }),
  );
  assert.ok(low.bottom > 210);
});

test("double-sharp spellings are rewritten in plain flats", () => {
  const [column] = liveStaff({
    selected: [62, 63, 67, 70],
    sounding: [],
    kind: "chord",
    spellings: ["D♯", "F𝄪", "A♯", "C𝄪"],
  });
  assert.deepEqual(
    column.notes.map((note) => note.name),
    ["D4", "E♭4", "G4", "B♭4"],
  );
  assert.equal(flatName("D♯maj7"), "E♭maj7");
  assert.equal(flatName("Fmaj7"), "Fmaj7");
});
