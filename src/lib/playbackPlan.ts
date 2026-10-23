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
  descendingNotes?: string[],
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
  const up = pitches.map((midi, index) => ({ midi, index, descending: false }));
  if (pitches.length)
    up.push({
      midi: pitches[0] + 12,
      index: pitches.length,
      descending: false,
    });
  const downPitches = voiceNotes(descendingNotes ?? notes, octave);
  const down = downPitches.map((midi, index) => ({
    midi,
    index,
    descending: true,
  }));
  if (downPitches.length)
    down.push({
      midi: downPitches[0] + 12,
      index: downPitches.length,
      descending: true,
    });
  down.reverse();
  const ordered =
    options.direction === "down"
      ? down
      : options.direction === "up-down"
        ? [...up, ...down.slice(1)]
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
