// The pitch line: listen to a recorded take and work out which notes were
// sung and how close they came to the notes the learner was aiming for.
// Everything here is plain data in, plain data out, so the same summary can
// be drawn on screen, tested, or handed to a helper that gives pointers.

export type PitchFrame = {
  /** Seconds from the start of the take. */
  time: number;
  /** Pitch as a MIDI number with decimals (69 = A4), or null for no clear pitch. */
  midi: number | null;
};

export type SungNote = {
  start: number;
  end: number;
  /** The middle pitch of the held note, as a MIDI number with decimals. */
  midi: number;
  /** The nearest note it was judged against. */
  nearest: number;
  /** Hundredths of a half step away from that note. Negative is flat. */
  cents: number;
  /** True when the nearest note is one of the notes being aimed for. */
  onTarget: boolean;
};

export type PitchSummary = {
  /** Seconds of the take with a clear, single pitch. */
  voicedSeconds: number;
  /** Share of that time spent on a target note (or on any note, with no target). */
  onShare: number;
  /** Average lean while close to a note, in hundredths of a half step. Negative is flat. */
  lean: number;
  notes: SungNote[];
  low: number | null;
  high: number | null;
};

/** How close counts as "on the note": 30 hundredths of a half step either way. */
export const ON_NOTE_CENTS = 30;

const HOP_SECONDS = 0.02,
  WINDOW_SECONDS = 0.04,
  LOWEST_HZ = 70,
  HIGHEST_HZ = 1100;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Mix to a slower sample rate. Voices sit low, so this loses nothing we need. */
function thin(samples: Float32Array, sampleRate: number) {
  const factor = Math.max(1, Math.round(sampleRate / 11025));
  if (factor === 1) return { data: samples, rate: sampleRate };
  const data = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += samples[i * factor + j];
    data[i] = sum / factor;
  }
  return { data, rate: sampleRate / factor };
}

/**
 * Follow the pitch of one voice or instrument through a recording.
 * Uses the YIN method: for each short slice, find the delay at which the
 * sound best matches a shifted copy of itself. That delay is one cycle.
 */
export function trackPitch(
  samples: Float32Array,
  sampleRate: number,
): PitchFrame[] {
  const { data, rate } = thin(samples, sampleRate);
  const size = Math.round(WINDOW_SECONDS * rate),
    hop = Math.round(HOP_SECONDS * rate),
    longest = Math.floor(rate / LOWEST_HZ),
    shortest = Math.max(2, Math.floor(rate / HIGHEST_HZ));
  const count = Math.max(0, Math.floor((data.length - size - longest) / hop));
  const levels = new Float32Array(count);
  for (let frame = 0; frame < count; frame++) {
    let sum = 0;
    const start = frame * hop;
    for (let i = 0; i < size; i++) sum += data[start + i] ** 2;
    levels[frame] = Math.sqrt(sum / size);
  }
  // Quiet is relative: a soft singer still has louder notes than their room.
  const loud = count
    ? [...levels].sort((a, b) => a - b)[Math.floor(count * 0.9)]
    : 0;
  const gate = Math.max(0.004, loud * 0.12);
  const difference = new Float32Array(longest + 1);
  const raw: (number | null)[] = [];
  for (let frame = 0; frame < count; frame++) {
    if (levels[frame] < gate) {
      raw.push(null);
      continue;
    }
    const start = frame * hop;
    let running = 0,
      found = -1;
    difference[0] = 1;
    for (let lag = 1; lag <= longest; lag++) {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        const delta = data[start + i] - data[start + i + lag];
        sum += delta * delta;
      }
      running += sum;
      difference[lag] = running ? (sum * lag) / running : 1;
    }
    for (let lag = shortest; lag < longest; lag++)
      if (difference[lag] < 0.15) {
        while (lag + 1 < longest && difference[lag + 1] < difference[lag]) lag++;
        found = lag;
        break;
      }
    if (found < 0) {
      let best = shortest;
      for (let lag = shortest; lag < longest; lag++)
        if (difference[lag] < difference[best]) best = lag;
      if (difference[best] < 0.3) found = best;
    }
    if (found < 0) {
      raw.push(null);
      continue;
    }
    // Slide to the true low point between whole steps of delay.
    const before = difference[found - 1],
      at = difference[found],
      after = difference[found + 1];
    const bend = before + after - 2 * at;
    const lag = bend > 0 ? found + (before - after) / (2 * bend) : found;
    raw.push(69 + 12 * Math.log2(rate / lag / 440));
  }
  // Smooth single-frame wobbles and drop blips too short to be a sung note.
  const smooth = raw.map((value, index) => {
    if (value === null) return null;
    const near = raw
      .slice(Math.max(0, index - 2), index + 3)
      .filter((v): v is number => v !== null);
    return near.length >= 3 ? median(near) : value;
  });
  for (let index = 0; index < smooth.length; ) {
    if (smooth[index] === null) {
      index++;
      continue;
    }
    let end = index;
    while (end < smooth.length && smooth[end] !== null) end++;
    if (end - index < 4) for (let i = index; i < end; i++) smooth[i] = null;
    index = end;
  }
  return smooth.map((midi, index) => ({
    time: (index * hop + size / 2) / rate,
    midi,
  }));
}

/** The nearest target note to a pitch, in any octave. With no targets, the nearest note. */
export function nearestNote(midi: number, targets: readonly number[]) {
  if (!targets.length) return Math.round(midi);
  let best = Math.round(midi),
    distance = Infinity;
  for (const target of targets) {
    const pitchClass = ((target % 12) + 12) % 12;
    const candidate = pitchClass + 12 * Math.round((midi - pitchClass) / 12);
    if (Math.abs(candidate - midi) < distance) {
      distance = Math.abs(candidate - midi);
      best = candidate;
    }
  }
  return best;
}

/**
 * Turn a pitch trace into something a person can read: the notes that were
 * held, and how the take compares with the notes being aimed for.
 * `targets` are pitch classes (0 = C ... 11 = B); pass none to judge against
 * the nearest note of any name.
 */
export function summarizePitch(
  frames: readonly PitchFrame[],
  targets: readonly number[] = [],
): PitchSummary {
  const voiced = frames.filter(
    (frame): frame is { time: number; midi: number } => frame.midi !== null,
  );
  const step = frames.length > 1 ? frames[1].time - frames[0].time : HOP_SECONDS;
  let on = 0,
    leanSum = 0,
    leanCount = 0;
  for (const { midi } of voiced) {
    const cents = (midi - nearestNote(midi, targets)) * 100;
    if (Math.abs(cents) <= ON_NOTE_CENTS) on++;
    if (Math.abs(cents) <= 50) {
      leanSum += cents;
      leanCount++;
    }
  }
  const notes: SungNote[] = [];
  let run: { time: number; midi: number }[] = [];
  const close = () => {
    if (run.length * step >= 0.14) {
      const midi = median(run.map((frame) => frame.midi));
      const nearest = nearestNote(midi, targets);
      notes.push({
        start: run[0].time,
        end: run[run.length - 1].time + step,
        midi,
        nearest,
        cents: Math.round((midi - nearest) * 100),
        onTarget: Math.abs(midi - nearest) <= 0.5,
      });
    }
    run = [];
  };
  let previous: PitchFrame | null = null;
  for (const frame of frames) {
    if (frame.midi === null) {
      close();
    } else {
      const centre = run.length ? median(run.map((f) => f.midi)) : frame.midi;
      const gap = previous?.midi === null || previous === null;
      if (run.length && (gap || Math.abs(frame.midi - centre) > 0.7)) close();
      run.push({ time: frame.time, midi: frame.midi });
    }
    previous = frame;
  }
  close();
  const pitches = voiced.map((frame) => frame.midi);
  return {
    voicedSeconds: voiced.length * step,
    onShare: voiced.length ? on / voiced.length : 0,
    lean: leanCount ? Math.round(leanSum / leanCount) : 0,
    notes,
    low: pitches.length ? Math.min(...pitches) : null,
    high: pitches.length ? Math.max(...pitches) : null,
  };
}

/** "on it", "a touch flat", "sharp": how one held note sat against its target. */
export function closeness(cents: number) {
  const size = Math.abs(cents);
  if (size <= 12) return "on it";
  const side = cents < 0 ? "flat" : "sharp";
  return size <= ON_NOTE_CENTS ? `a touch ${side}` : side;
}

/**
 * One or two plain sentences about the whole take. `aim` is what the learner
 * was singing toward, worded to finish "You were on ...": "A", or
 * "the notes of C major". Leave it empty when there was no target.
 */
export function pitchVerdict(summary: PitchSummary, aim = "") {
  if (summary.voicedSeconds < 0.3)
    return "Lumina could not find one clear pitch in this take. The pitch line works best with a single voice or instrument, close to the microphone.";
  const share = summary.onShare;
  const first = aim
    ? share >= 0.75
      ? `You were on ${aim} for most of this take.`
      : share >= 0.45
        ? `You were on ${aim} about ${Math.round(share * 10) * 10}% of the time.`
        : `Most of this take sat away from ${aim}.`
    : share >= 0.75
      ? "Your notes sat close to their centers for most of this take."
      : share >= 0.45
        ? "Your notes sat close to their centers about half the time."
        : "Most of this take sat between notes.";
  const lean =
    summary.lean <= -10
      ? " When you were close, you leaned a little flat."
      : summary.lean >= 10
        ? " When you were close, you leaned a little sharp."
        : "";
  return first + lean;
}
