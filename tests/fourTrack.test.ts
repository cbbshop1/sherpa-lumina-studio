import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  audible,
  barBeat,
  clockText,
  counterText,
  defaultSong,
  echoSettings,
  placeTake,
  readSong,
  renderLength,
  roomImpulse,
  songGrid,
  songSeconds,
} from "../src/lib/fourTrack.ts";
import { makeMeter, presets } from "../src/lib/groove.ts";

const grid120 = songGrid({ bpm: 120 });

test("a new song is four voice parts, 32 bars at a relaxed tempo", () => {
  const song = defaultSong();
  assert.deepEqual(
    song.tracks.map((track) => track.name),
    ["Soprano", "Alto", "Tenor", "Bass"],
  );
  assert.equal(song.bars, 32);
  assert.equal(song.bpm, 90);
  // 32 bars of 4/4 at 90 BPM is about 85 seconds.
  assert.equal(Math.round(songSeconds(song)), 85);
  assert.equal(STORAGE_KEY, "lumina-four-track");
});

test("the counter reads bar and beat, counted from one", () => {
  assert.deepEqual(barBeat(0, grid120), { bar: 1, beat: 1 });
  assert.deepEqual(barBeat(0.5, grid120), { bar: 1, beat: 2 });
  assert.deepEqual(barBeat(2, grid120), { bar: 2, beat: 1 });
  assert.equal(counterText(17.9, grid120), "009.4");
  assert.equal(clockText(85.33), "1:25.3");
});

test("saved songs are repaired rather than thrown away", () => {
  assert.deepEqual(readSong(null), defaultSong());
  assert.deepEqual(readSong("not json"), defaultSong());
  const song = readSong(
    JSON.stringify({
      bpm: 400,
      bars: 12,
      click: false,
      armed: null,
      tracks: [
        { name: "  Melody  ", takeId: "abc", volume: 3, reverb: 0.4, pan: -5 },
        "junk",
      ],
    }),
  );
  assert.equal(song.bpm, 320);
  assert.equal(song.bars, 32);
  assert.equal(song.click, false);
  assert.equal(song.armed, null);
  assert.equal(song.tracks[0].name, "Melody");
  assert.equal(song.tracks[0].takeId, "abc");
  assert.equal(song.tracks[0].volume, 1);
  assert.equal(song.tracks[0].pan, -1);
  assert.equal(song.tracks[0].reverb, 0.4);
  assert.equal(song.tracks[1].name, "Alto");
  assert.equal(song.tracks.length, 4);
});

test("solo wins over everything else, and mute always silences", () => {
  assert.deepEqual(
    audible([
      { mute: false, solo: false },
      { mute: true, solo: false },
    ]),
    [true, false],
  );
  assert.deepEqual(
    audible([
      { mute: false, solo: true },
      { mute: false, solo: false },
      { mute: true, solo: true },
    ]),
    [true, false, false],
  );
});

test("a recorded take skips the count-in and lines up after latency", () => {
  const rate = 1000;
  // Capture began 1 second (the count-in) before song time 4 sounded.
  const placed = placeTake({
    firstFrame: 5000,
    songZeroFrame: 6000,
    sampleRate: rate,
    fromSec: 4,
    latencySec: 0.05,
    length: 4000,
    songLengthSec: 100,
  });
  // 1.05 s of audio belongs before the song point: count-in plus latency.
  assert.equal(placed.skip, 1050);
  assert.equal(placed.keep, 2950);
  assert.ok(Math.abs(placed.startSec - 4) < 1e-9);
});

test("a take never runs past the end of the tape", () => {
  const placed = placeTake({
    firstFrame: 0,
    songZeroFrame: 0,
    sampleRate: 1000,
    fromSec: 9,
    latencySec: 0,
    length: 5000,
    songLengthSec: 10,
  });
  assert.equal(placed.keep, 1000);
});

test("echo repeats in time with the song and fades away", () => {
  const echo = echoSettings(0.5, 120);
  assert.equal(echo.delaySec, 0.25);
  assert.ok(echo.feedback < 1);
  assert.equal(renderLength(2, 0, 0, 120), 2);
  assert.ok(renderLength(2, 0.5, 0, 120) > 4);
  assert.ok(renderLength(2, 0, 1, 120) > 2.5);
});

test("the room sound is the same every time and dies away", () => {
  const a = roomImpulse(1000);
  const b = roomImpulse(1000);
  assert.deepEqual(a, b);
  const early = a.slice(0, 100).reduce((s, v) => s + Math.abs(v), 0);
  const late = a.slice(900).reduce((s, v) => s + Math.abs(v), 0);
  assert.ok(late < early / 50);
});

test("a groove brings its own meter: 7/8 bars count seven pulses", () => {
  const seven = presets().find((g) => g.name === "7/8 · 2+2+3")!;
  const song = { ...defaultSong(), bpm: 210, bars: 8 as const, groove: seven };
  const grid = songGrid(song);
  assert.equal(grid.pulsesPerBar, 7);
  assert.equal(grid.unit, 8);
  assert.equal(songSeconds(song), 16);
  assert.deepEqual(barBeat(2.1, grid), { bar: 2, beat: 1 });
  assert.equal(counterText(3.9, grid), "002.7");
});

test("a saved song keeps its groove, and a broken groove is repaired", () => {
  const groove = { ...presets()[2] };
  const song = readSong(JSON.stringify({ ...defaultSong(), groove, grooveOn: true }));
  assert.equal(song.groove?.name, "Samba");
  assert.equal(song.grooveOn, true);
  const repaired = readSong(JSON.stringify({ groove: { meter: { top: 99 } } }));
  assert.equal(repaired.groove?.name, "Rock beat");
  assert.equal(readSong(null).groove, null);
  assert.ok(makeMeter(4, 4, 2));
});
