import { voiceNotes } from "./noteSelection.ts";

export type ScalePlayback = {
  bpm: number;
  direction: "up" | "down" | "up-down";
};
export type SequenceTiming = {
  stepSeconds: number;
  gateSeconds: number;
  releaseSeconds: number;
};

export function scalePlaybackPlan(
  notes: string[],
  octave: number,
  options: ScalePlayback,
) {
  const stepSeconds =
    60 /
    Math.min(
      180,
      Math.max(60, Number.isFinite(options.bpm) ? options.bpm : 120),
    );
  const timing: SequenceTiming = {
    stepSeconds,
    gateSeconds: stepSeconds * 0.92,
    releaseSeconds: 0.14,
  };
  const pitches = voiceNotes(notes, octave);
  const up = pitches.map((midi, index) => ({ midi, index }));
  if (pitches.length) up.push({ midi: pitches[0] + 12, index: pitches.length });
  const ordered =
    options.direction === "down"
      ? [...up].reverse()
      : options.direction === "up-down"
        ? [...up, ...up.slice(0, -1).reverse()]
        : up;
  return {
    timing,
    steps: ordered.map((step, i) => ({ ...step, at: i * stepSeconds })),
    duration: ordered.length
      ? (ordered.length - 1) * stepSeconds +
        timing.gateSeconds +
        timing.releaseSeconds
      : 0,
  };
}

export function sameSelection(
  a: { name: string; notes: string[]; kind: string },
  b: { name: string; notes: string[]; kind: string },
) {
  return (
    a.name === b.name &&
    a.kind === b.kind &&
    a.notes.length === b.notes.length &&
    a.notes.every((note, i) => note === b.notes[i])
  );
}
