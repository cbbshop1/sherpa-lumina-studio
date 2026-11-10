// Intervals: the distance between two notes, described the ways a learner
// meets it: by name, by counting half steps, and by counting letter names.
import { NOTE_NAMES, formatNote } from "./noteSelection.ts";
import { spellIntervals } from "./musicNotation.ts";

const NAMES = [
  "Unison",
  "Minor second",
  "Major second",
  "Minor third",
  "Major third",
  "Perfect fourth",
  "Tritone",
  "Perfect fifth",
  "Minor sixth",
  "Major sixth",
  "Minor seventh",
  "Major seventh",
  "Octave",
];
/** How many letter names each interval spans, counting both ends. */
const LETTERS = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7, 8];
const ORDINALS = [
  "",
  "unison",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "octave",
];
const FLAT_FIRST: Record<string, string[]> = {
  "C#": ["Db", "C#"],
  "D#": ["Eb", "D#"],
  "F#": ["F#", "Gb"],
  "G#": ["Ab", "G#"],
  "A#": ["Bb", "A#"],
};

export type IntervalInfo = {
  halfSteps: number;
  /** "Major third", or "An octave plus a major third" for wider reaches. */
  name: string;
  /** The two notes spelled so the letters agree with the name, e.g. ["C", "Eb"]. */
  spellings: [string, string];
  /** Letter names from the lower note up to the upper, e.g. ["C", "D", "E"]. */
  letters: string[];
  /** One plain sentence on why it has this name. */
  why: string;
};

export function describeInterval(a: number, b: number): IntervalInfo {
  const low = Math.min(a, b),
    high = Math.max(a, b),
    halfSteps = high - low;
  const extra = halfSteps > 12 ? Math.floor((halfSteps - 1) / 12) : 0;
  const simple = halfSteps - 12 * extra;
  const sharp = NOTE_NAMES[low % 12];
  const candidates = FLAT_FIRST[sharp] ?? [sharp];
  const spell = (root: string) =>
    spellIntervals(root, [simple], [LETTERS[simple]])[0];
  const root =
    candidates.find((candidate) => spell(candidate).length <= 2) ??
    candidates[0];
  const upper = spell(root);
  const span = LETTERS[simple];
  const start = "CDEFGAB".indexOf(root[0]);
  const letters = Array.from(
    { length: span },
    (_, index) => "CDEFGAB"[(start + index) % 7],
  );
  const base = NAMES[simple];
  const name =
    extra === 0
      ? base
      : simple === 12
        ? extra === 1
          ? "Two octaves"
          : `${extra + 1} octaves`
        : `${extra === 1 ? "An octave" : `${extra} octaves`} plus a ${base.toLowerCase()}`;
  const steps = `${halfSteps} half step${halfSteps === 1 ? "" : "s"}`;
  const why =
    halfSteps === 0
      ? "The same note twice. No distance at all."
      : simple === 6
        ? `${steps}, the exact middle of the octave. Written ${formatNote(root)} to ${formatNote(upper)} it is an augmented fourth. Spelled with the next letter up it is a diminished fifth.`
        : simple === 12
          ? `${steps}. The same letter name again, higher up.`
          : `${steps}. It spans ${span} letter names (${letters.join(", ")}), which makes it a ${ORDINALS[span]}.${
              [1, 3, 8, 10].includes(simple)
                ? " Minor is the smaller of the two sizes."
                : [2, 4, 9, 11].includes(simple)
                  ? " Major is the larger of the two sizes."
                  : ""
            }`;
  return { halfSteps, name, spellings: [root, upper], letters, why };
}
