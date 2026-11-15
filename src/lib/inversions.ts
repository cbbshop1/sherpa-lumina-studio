// Inversions: the same chord with a different note on the bottom.
import { NOTE_NAMES } from "./noteSelection.ts";
import { CHORD_FORMULAS, pitchClass, selectionRoot } from "./musicNotation.ts";

export const POSITION_NAMES = [
  "Root position",
  "1st inversion",
  "2nd inversion",
  "3rd inversion",
  "4th inversion",
];

const ROOT = /^([A-G](?:#{1,2}|b{1,2}|♯{1,2}|♭{1,2}|𝄪|𝄫)?)(.*)$/u;

/**
 * The chord stacked from its root, as MIDI notes starting in `octave`.
 * Returns null when the selection isn't a named chord of three or more notes.
 */
export function rootPosition(
  chord: { name: string; notes: readonly string[]; kind: string },
  octave: number,
): number[] | null {
  if (chord.kind !== "chord" || chord.name.includes("·")) return null;
  const match = ROOT.exec(chord.name);
  if (!match) return null;
  const root = pitchClass(selectionRoot(chord.name));
  const sounding = [
    ...new Set(chord.notes.map((note) => NOTE_NAMES.indexOf(note))),
  ];
  if (sounding.length < 3 || !sounding.includes(root)) return null;
  const formula = CHORD_FORMULAS.find(
    (entry) => entry.suffix === match[2].trim(),
  );
  const matches =
    formula &&
    formula.intervals.length === sounding.length &&
    formula.intervals.every((interval) =>
      sounding.includes((root + interval) % 12),
    );
  const intervals = matches
    ? formula.intervals
    : sounding
        .map((pitch) => (pitch - root + 12) % 12)
        .sort((a, b) => a - b);
  const base = (octave + 1) * 12 + root;
  return intervals.map((interval) => base + interval);
}

/** Move the lowest `steps` notes up an octave. */
export function invert(position: readonly number[], steps: number): number[] {
  const count = Math.max(0, Math.min(steps, position.length - 1));
  return [
    ...position.slice(count),
    ...position.slice(0, count).map((note) => note + 12),
  ];
}

/** Which inversion is sounding: the place of the lowest note in the root-position stack. */
export function inversionOf(
  position: readonly number[],
  sounding: readonly number[],
): number {
  if (!sounding.length) return 0;
  const bass = Math.min(...sounding) % 12;
  const index = position.findIndex((note) => note % 12 === bass);
  return Math.max(0, index);
}
