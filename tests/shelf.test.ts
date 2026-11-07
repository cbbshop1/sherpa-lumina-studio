import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SHELF_BYTES,
  MAX_TAKES,
  MemoryTakeStore,
  cleanName,
  formatDuration,
  isTakeRecord,
  nextTakeName,
  shelfRoomProblem,
  sortTakes,
} from "../src/lib/shelf.ts";

const take = (id: string, createdAt: number, name = id) => ({
  id,
  name,
  createdAt,
  duration: 2.5,
  channels: 1,
  source: "microphone" as const,
  bytes: 1000,
  type: "audio/wav",
  blob: new Blob(["x"], { type: "audio/wav" }),
});

test("take names count upward and never reuse a number still on the shelf", () => {
  assert.equal(nextTakeName([]), "Take 1");
  assert.equal(
    nextTakeName([{ name: "Take 1" }, { name: "Take 4" }, { name: "Alto" }]),
    "Take 5",
  );
  assert.equal(nextTakeName([{ name: "Take one" }]), "Take 1");
});

test("names are tidied, length-limited, and never left blank", () => {
  assert.equal(cleanName("  my   alto  line ", "Take 2"), "my alto line");
  assert.equal(cleanName("   ", "Take 2"), "Take 2");
  assert.equal(cleanName("a".repeat(100), "x").length, 60);
});

test("the newest take comes first", () => {
  const sorted = sortTakes([take("a", 1), take("c", 3), take("b", 2)]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["c", "b", "a"],
  );
});

test("a full shelf explains itself instead of silently dropping a take", () => {
  assert.equal(shelfRoomProblem([], 1000), "");
  const many = Array.from({ length: MAX_TAKES }, () => ({ bytes: 1 }));
  assert.match(shelfRoomProblem(many, 1), /Delete one/);
  assert.match(shelfRoomProblem([{ bytes: MAX_SHELF_BYTES }], 1), /full/);
});

test("only complete take records are accepted from storage", () => {
  assert.equal(isTakeRecord(take("a", 1)), true);
  assert.equal(isTakeRecord({ ...take("a", 1), blob: "not audio" }), false);
  assert.equal(isTakeRecord({ ...take("a", 1), source: "elsewhere" }), false);
  assert.equal(isTakeRecord(null), false);
});

test("durations read like a tape counter", () => {
  assert.equal(formatDuration(2.4), "0:02");
  assert.equal(formatDuration(85.3), "1:25");
});

test("the fallback store keeps, replaces, and removes takes", async () => {
  const store = new MemoryTakeStore();
  assert.equal(store.persistent, false);
  await store.put(take("a", 1));
  await store.put({ ...take("a", 1), name: "Soprano" });
  await store.put(take("b", 2));
  assert.deepEqual(
    (await store.list()).map((item) => item.name),
    ["Soprano", "b"],
  );
  await store.remove("a");
  assert.deepEqual(
    (await store.list()).map((item) => item.id),
    ["b"],
  );
});
