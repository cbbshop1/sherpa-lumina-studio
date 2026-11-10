import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trackPitch,
  summarizePitch,
  nearestNote,
  closeness,
  pitchVerdict,
} from "../src/lib/pitchTrack.ts";

const RATE = 44100;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** A voice-like tone: a fundamental with a few softer overtones. */
function sing(parts: [midi: number | null, seconds: number][]) {
  const total = parts.reduce((sum, [, seconds]) => sum + seconds, 0);
  const out = new Float32Array(Math.round(total * RATE));
  let at = 0,
    phase = 0;
  for (const [midi, seconds] of parts) {
    const length = Math.round(seconds * RATE);
    for (let i = 0; i < length; i++, at++) {
      if (midi === null) continue;
      phase += (2 * Math.PI * hz(midi)) / RATE;
      out[at] =
        0.3 * Math.sin(phase) +
        0.15 * Math.sin(2 * phase) +
        0.08 * Math.sin(3 * phase);
    }
  }
  return out;
}

test("a held A3 is heard as A3, right in the middle of the note", () => {
  const summary = summarizePitch(trackPitch(sing([[57, 1]]), RATE), [9]);
  assert.equal(summary.notes.length, 1);
  assert.equal(summary.notes[0].nearest, 57);
  assert.ok(Math.abs(summary.notes[0].cents) <= 3);
  assert.ok(summary.onShare > 0.95);
});

test("low and high voices are both followed", () => {
  for (const midi of [40, 48, 60, 72, 81]) {
    const { notes } = summarizePitch(trackPitch(sing([[midi, 0.6]]), RATE));
    assert.equal(notes.length, 1, `midi ${midi}`);
    assert.ok(Math.abs(notes[0].midi - midi) < 0.05, `midi ${midi}`);
  }
});

test("a flat note is reported flat against its target", () => {
  const summary = summarizePitch(trackPitch(sing([[59.6, 1]]), RATE), [0]);
  assert.equal(summary.notes[0].nearest, 60);
  assert.ok(Math.abs(summary.notes[0].cents + 40) <= 4);
  assert.equal(closeness(summary.notes[0].cents), "flat");
  assert.ok(summary.onShare < 0.1);
});

test("a sung triad with breaths comes back as three notes in order", () => {
  const take = sing([
    [null, 0.2],
    [60, 0.5],
    [null, 0.15],
    [64, 0.5],
    [null, 0.15],
    [67, 0.5],
    [null, 0.2],
  ]);
  const summary = summarizePitch(trackPitch(take, RATE), [0, 4, 7]);
  assert.deepEqual(
    summary.notes.map((note) => note.nearest),
    [60, 64, 67],
  );
  assert.ok(summary.notes.every((note) => note.onTarget));
  assert.match(pitchVerdict(summary, "the notes of C major"), /on the notes of C major for most/);
});

test("a wrong note is measured against the nearest target, in any octave", () => {
  assert.equal(nearestNote(49.2, [0, 4, 7]), 48);
  assert.equal(nearestNote(77.9, [0, 4, 7]), 79);
  assert.equal(nearestNote(61.4, []), 61);
  const summary = summarizePitch(trackPitch(sing([[62, 1]]), RATE), [0, 4, 7]);
  assert.equal(summary.notes[0].onTarget, false);
  assert.match(pitchVerdict(summary, "the notes of C major"), /away from the notes of C major/);
});

test("silence and noise give no pitch and a kind explanation", () => {
  const noise = new Float32Array(RATE);
  let seed = 7;
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 16807) % 2147483647;
    noise[i] = (seed / 2147483647 - 0.5) * 0.4;
  }
  for (const take of [new Float32Array(RATE), noise]) {
    const summary = summarizePitch(trackPitch(take, RATE));
    assert.ok(summary.voicedSeconds < 0.3);
    assert.match(pitchVerdict(summary), /could not find one clear pitch/);
  }
});

test("closeness words follow the size of the miss", () => {
  assert.equal(closeness(5), "on it");
  assert.equal(closeness(-20), "a touch flat");
  assert.equal(closeness(25), "a touch sharp");
  assert.equal(closeness(45), "sharp");
});
