// The chords that live in a key, and where each one usually goes next.
// This is the place where scales and chords meet: every chord here is built
// from every other note of the key's scale.
import { chordsForRoot, spellIntervals } from "./musicNotation.ts";

export type KeyMode = "major" | "minor";

export type KeyChord = {
  /** Stable id within a key: "1" to "7", plus "5m" and "7dim" in minor. */
  id: string;
  /** Roman numeral: capitals for major chords, small letters for minor, ° for diminished. */
  numeral: string;
  /** Chord name as the rest of Lumina writes it, e.g. "Bb", "Dm", "Bdim". */
  name: string;
  quality: "Major" | "Minor" | "Diminished";
  notes: string[];
  /** Ids of the chords this one most often moves to. Empty means it can go anywhere. */
  leadsTo: string[];
  /** A one-line reason a learner can hear for themselves. */
  role: string;
  /** True for the two extra minor-key chords that sit outside the main seven. */
  alternate?: boolean;
};

export const MAJOR_KEYS = [
  "C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F",
];
export const MINOR_KEYS = [
  "A", "E", "B", "F#", "C#", "G#", "Eb", "Bb", "F", "C", "G", "D",
];

const SUFFIX = { Major: "", Minor: "m", Diminished: "dim" } as const;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const DEGREES = [1, 2, 3, 4, 5, 6, 7];

type Row = [
  degree: number,
  semitones: number,
  quality: KeyChord["quality"],
  leadsTo: string[],
  role: string,
  id?: string,
];

const MAJOR: Row[] = [
  [1, 0, "Major", [], "Home. From here you can go anywhere."],
  [2, 2, "Minor", ["5", "7"], "Sets up V. The classic lead-in."],
  [3, 4, "Minor", ["6", "4"], "A gentle step away from home."],
  [4, 5, "Major", ["5", "2", "1"], "Moves away from home, toward V or back."],
  [5, 7, "Major", ["1", "6"], "Wants to go home. Its middle note leans up into I."],
  [6, 9, "Minor", ["2", "4"], "Home's sadder cousin. Shares two notes with I."],
  [7, 11, "Diminished", ["1", "3"], "Tense and unstable. Pulls hard toward I."],
];
const MINOR: Row[] = [
  [1, 0, "Minor", [], "Home. From here you can go anywhere."],
  [2, 2, "Diminished", ["5", "7dim"], "Tense. Sets up V."],
  [3, 3, "Major", ["6", "4"], "The bright side of a minor key."],
  [4, 5, "Minor", ["5", "2", "1"], "Moves away from home, toward V or back."],
  [5, 7, "Major", ["1", "6"], "Major, with the raised seventh note that leans up into home."],
  [6, 8, "Major", ["2", "4"], "Warm and open. Often heads back toward iv."],
  [7, 10, "Major", ["3"], "Leads to III, the bright side."],
  [5, 7, "Minor", ["1", "6"], "The softer V, straight from the natural minor scale.", "5m"],
  [7, 11, "Diminished", ["1"], "Built on the raised seventh note. Pulls hard toward home.", "7dim"],
];

const numeral = (degree: number, quality: KeyChord["quality"]) =>
  (quality === "Major" ? ROMAN[degree - 1] : ROMAN[degree - 1].toLowerCase()) +
  (quality === "Diminished" ? "°" : "");

/** The chords of a key, in scale order, with the minor-key alternates last. */
export function keyChords(root: string, mode: KeyMode): KeyChord[] {
  return (mode === "major" ? MAJOR : MINOR).map(
    ([degree, semitones, quality, leadsTo, role, id]) => {
      const chordRoot = spellIntervals(root, [semitones], [DEGREES[degree - 1]])[0];
      const formula = chordsForRoot(chordRoot).find(
        (chord) => chord.name === quality,
      )!;
      return {
        id: id ?? String(degree),
        numeral: numeral(degree, quality),
        name: chordRoot + SUFFIX[quality],
        quality,
        notes: formula.notes,
        leadsTo,
        role,
        alternate: !!id,
      };
    },
  );
}

/** Find a chord's place in a key by its sound, so C# and Db count as the same chord. */
export function placeInKey(
  chord: { name: string; notes: readonly string[] },
  chords: readonly KeyChord[],
) {
  const sound = (notes: readonly string[]) => notes.join(",");
  return (
    chords.find((entry) => entry.name === chord.name) ??
    chords.find((entry) => sound(entry.notes) === sound(chord.notes))
  );
}

/** Carry a progression into another key: chords that belonged to the old key keep their place. */
export function moveToKey<T extends { name: string; notes: string[] }>(
  progression: readonly T[],
  from: readonly KeyChord[],
  to: readonly KeyChord[],
): T[] {
  return progression.map((chord) => {
    const place = placeInKey(chord, from);
    const next = place && to.find((entry) => entry.id === place.id);
    return next ? { ...chord, name: next.name, notes: next.notes } : chord;
  });
}

export const STARTERS: Record<KeyMode, { label: string; ids: string[] }[]> = {
  major: [
    { label: "I  IV  V  I", ids: ["1", "4", "5", "1"] },
    { label: "I  V  vi  IV", ids: ["1", "5", "6", "4"] },
    { label: "I  vi  IV  V", ids: ["1", "6", "4", "5"] },
    { label: "ii  V  I", ids: ["2", "5", "1"] },
  ],
  minor: [
    { label: "i  iv  V  i", ids: ["1", "4", "5", "1"] },
    { label: "i  VI  III  VII", ids: ["1", "6", "3", "7"] },
    { label: "i  VII  VI  V", ids: ["1", "7", "6", "5"] },
    { label: "ii°  V  i", ids: ["2", "5", "1"] },
  ],
};
