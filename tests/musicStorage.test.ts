import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readMusic,
  isSavedChord,
  isProgression,
} from "../src/lib/musicStorage.ts";
const favorite = { id: "old-favorite", name: "Cm", notes: ["C", "D#", "G"] };
test("existing favorite and progression data is loaded without changing its format", () => {
  const storage = { getItem: () => JSON.stringify([favorite]) };
  assert.deepEqual(readMusic(storage, "piano-favorites", isSavedChord), {
    value: [favorite],
    readable: true,
  });
  const progression = {
    id: "old-progression",
    name: "My song",
    chords: [favorite],
  };
  assert.deepEqual(
    readMusic(
      { getItem: () => JSON.stringify([progression]) },
      "piano-progressions",
      isProgression,
    ),
    { value: [progression], readable: true },
  );
});
test("missing storage starts empty, malformed or inaccessible storage is protected", () => {
  assert.deepEqual(readMusic({ getItem: () => null }, "test", isSavedChord), {
    value: [],
    readable: true,
  });
  for (const raw of ["broken JSON", "{}", '[{"foo":1}]'])
    assert.deepEqual(readMusic({ getItem: () => raw }, "test", isSavedChord), {
      value: [],
      readable: false,
    });
  assert.deepEqual(
    readMusic(
      {
        getItem: () => {
          throw new Error("Storage blocked");
        },
      },
      "test",
      isSavedChord,
    ),
    { value: [], readable: false },
  );
});
