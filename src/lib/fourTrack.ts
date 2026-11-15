// The four-track's musical arithmetic and saved settings. No audio here, so it
// can be tested on its own. Songs are in 4/4 unless a groove from the rhythm
// room brings its own meter.

import { readGroove, type Groove, type Stress, type Unit } from "./groove.ts";

export const BEATS_PER_BAR = 4;
export const BAR_CHOICES = [8, 16, 32] as const;
export const MIN_BPM = 30;
export const MAX_BPM = 320;
export const MAX_NUDGE_MS = 250;
export const VOICE_PARTS = ["Soprano", "Alto", "Tenor", "Bass"] as const;

export type TrackSettings = {
  name: string;
  /** The shelf take playing on this track, or null for blank tape. */
  takeId: string | null;
  /** Where the take begins on the song timeline, in seconds. */
  startSec: number;
  /** Fine timing correction, in milliseconds. Positive moves it later. */
  nudgeMs: number;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  /** 0 to 1. */
  reverb: number;
  /** 0 to 1. */
  echo: number;
};

export type SongSettings = {
  bpm: number;
  bars: (typeof BAR_CHOICES)[number];
  click: boolean;
  countIn: boolean;
  armed: number | null;
  tracks: TrackSettings[];
  /** A groove from the rhythm room. Its meter sets the bars and the click. */
  groove: Groove | null;
  /** Play the groove's drums under the tape (otherwise just the click). */
  grooveOn: boolean;
};

/** The song's pulse: how long each one lasts, how many make a bar, their weight. */
export type TimeGrid = {
  pulseSec: number;
  pulsesPerBar: number;
  unit: Unit;
  stresses: Stress[];
};

export const STORAGE_KEY = "lumina-four-track";

export function blankTrack(name: string): TrackSettings {
  return {
    name,
    takeId: null,
    startSec: 0,
    nudgeMs: 0,
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    reverb: 0,
    echo: 0,
  };
}

export function defaultSong(): SongSettings {
  return {
    bpm: 90,
    bars: 32,
    click: true,
    countIn: true,
    armed: 0,
    tracks: VOICE_PARTS.map(blankTrack),
    groove: null,
    grooveOn: false,
  };
}

const clamp = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(high, Math.max(low, value))
    : fallback;

/** Reads saved settings, repairing anything odd instead of throwing it away. */
export function readSong(raw: string | null): SongSettings {
  const song = defaultSong();
  if (!raw) return song;
  let saved: Record<string, unknown>;
  try {
    saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return song;
  } catch {
    return song;
  }
  song.bpm = Math.round(clamp(saved.bpm, MIN_BPM, MAX_BPM, song.bpm));
  if (BAR_CHOICES.includes(saved.bars as never))
    song.bars = saved.bars as SongSettings["bars"];
  if (typeof saved.click === "boolean") song.click = saved.click;
  if (typeof saved.countIn === "boolean") song.countIn = saved.countIn;
  if (saved.groove && typeof saved.groove === "object") {
    song.groove = readGroove(saved.groove);
    song.grooveOn = saved.grooveOn !== false;
  }
  song.armed =
    saved.armed === null
      ? null
      : Math.round(clamp(saved.armed, 0, 3, song.armed ?? 0));
  if (Array.isArray(saved.tracks))
    song.tracks = song.tracks.map((fallback, index) => {
      const track = saved.tracks[index] as Partial<TrackSettings> | undefined;
      if (!track || typeof track !== "object") return fallback;
      return {
        name:
          typeof track.name === "string" && track.name.trim()
            ? track.name.trim().slice(0, 24)
            : fallback.name,
        takeId: typeof track.takeId === "string" ? track.takeId : null,
        startSec: clamp(track.startSec, 0, 600, 0),
        nudgeMs: clamp(track.nudgeMs, -MAX_NUDGE_MS, MAX_NUDGE_MS, 0),
        volume: clamp(track.volume, 0, 1, fallback.volume),
        pan: clamp(track.pan, -1, 1, 0),
        mute: track.mute === true,
        solo: track.solo === true,
        reverb: clamp(track.reverb, 0, 1, 0),
        echo: clamp(track.echo, 0, 1, 0),
      };
    });
  return song;
}

export const secondsPerBeat = (bpm: number) => 60 / bpm;

/** The pulse grid for a song: plain 4/4, or the meter of its groove. */
export function songGrid(song: Pick<SongSettings, "bpm"> & { groove?: Groove | null }): TimeGrid {
  if (song.groove)
    return {
      pulseSec: secondsPerBeat(song.bpm),
      pulsesPerBar: song.groove.meter.top,
      unit: song.groove.meter.unit,
      stresses: song.groove.meter.stresses,
    };
  return {
    pulseSec: secondsPerBeat(song.bpm),
    pulsesPerBar: BEATS_PER_BAR,
    unit: 4,
    stresses: ["strong", "light", "light", "light"],
  };
}

export const secondsPerBar = (grid: TimeGrid) => grid.pulseSec * grid.pulsesPerBar;
export const songSeconds = (
  song: Pick<SongSettings, "bpm" | "bars"> & { groove?: Groove | null },
) => secondsPerBar(songGrid(song)) * song.bars;

/** The tempo as quarter notes per minute, so echo repeats feel the same in any meter. */
export const quarterBpm = (grid: TimeGrid) => (60 / grid.pulseSec) * (4 / grid.unit);

/** Bar and beat (both counted from 1) at a time in the song. */
export function barBeat(seconds: number, grid: TimeGrid) {
  const beats = Math.max(0, Math.floor(seconds / grid.pulseSec + 1e-6));
  return {
    bar: Math.floor(beats / grid.pulsesPerBar) + 1,
    beat: (beats % grid.pulsesPerBar) + 1,
  };
}

/** "009.2" style counter, like the tape counter on an old deck. */
export function counterText(seconds: number, grid: TimeGrid) {
  const { bar, beat } = barBeat(seconds, grid);
  return `${String(bar).padStart(3, "0")}.${beat}`;
}

export function clockText(seconds: number) {
  const tenths = Math.max(0, Math.floor(seconds * 10));
  const minutes = Math.floor(tenths / 600);
  const secs = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(secs).padStart(2, "0")}.${tenths % 10}`;
}

/** A track is heard if it isn't muted and, when anything is soloed, it is. */
export function audible(tracks: Pick<TrackSettings, "mute" | "solo">[]) {
  const anySolo = tracks.some((track) => track.solo);
  return tracks.map((track) =>
    anySolo ? track.solo && !track.mute : !track.mute,
  );
}

/** Where the take really starts once the timing nudge is applied. */
export const effectiveStart = (track: Pick<TrackSettings, "startSec" | "nudgeMs">) =>
  track.startSec + track.nudgeMs / 1000;

/**
 * Turns captured microphone audio into a take on the song timeline.
 * `firstFrame` is the audio-clock frame of the first captured sample,
 * `songZeroFrame` the frame at which song time `fromSec` sounded, and
 * `latencySec` how late the singer's audio arrives compared with what they
 * heard. Samples from before `fromSec` (the count-in) are dropped.
 */
export function placeTake(options: {
  firstFrame: number;
  songZeroFrame: number;
  sampleRate: number;
  fromSec: number;
  latencySec: number;
  length: number;
  songLengthSec: number;
}) {
  const {
    firstFrame,
    songZeroFrame,
    sampleRate,
    fromSec,
    latencySec,
    length,
    songLengthSec,
  } = options;
  const firstSongTime =
    fromSec + (firstFrame - songZeroFrame) / sampleRate - latencySec;
  const skip = Math.max(0, Math.ceil((fromSec - firstSongTime) * sampleRate));
  const startSec = firstSongTime + skip / sampleRate;
  const room = Math.max(0, Math.floor((songLengthSec - startSec) * sampleRate));
  const keep = Math.max(0, Math.min(length - skip, room));
  return { skip, keep, startSec };
}

/** Echo repeats on the beat, so it always sits in time with the song. */
export function echoSettings(amount: number, bpm: number) {
  return {
    delaySec: secondsPerBeat(bpm) / 2,
    feedback: 0.2 + amount * 0.4,
    wet: amount * 0.55,
  };
}

export function reverbSettings(amount: number) {
  return { wet: amount * 0.7, dry: 1 - amount * 0.25, seconds: 2.4 };
}

/** A decaying burst of noise: what a room's echo sounds like, roughly. */
export function roomImpulse(length: number, seed = 7) {
  const data = new Float32Array(length);
  let state = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const noise = ((state >>> 0) / 0xffffffff) * 2 - 1;
    data[i] = noise * Math.pow(1 - i / length, 3);
  }
  return data;
}

/** How long a take runs once its effect tail is added, trimmed to the song. */
export function renderLength(
  sourceSec: number,
  reverb: number,
  echo: number,
  bpm: number,
) {
  let tail = 0;
  if (reverb > 0) tail = Math.max(tail, reverbSettings(reverb).seconds);
  if (echo > 0) {
    const { delaySec, feedback } = echoSettings(echo, bpm);
    // Until the repeats fall below about 1% of the original.
    tail = Math.max(tail, delaySec * Math.ceil(Math.log(0.01) / Math.log(feedback)));
  }
  return sourceSec + tail;
}
