// The chords that live in a key, and where each one usually goes next.
// This is the place where scales and chords meet: every chord here is built
// from every other note of the key's scale.
import { chordsForRoot, spellIntervals } from "./musicNotation.ts";

export type KeyMode = "major" | "minor";

export type Quality =
  | "Major"
  | "Minor"
  | "Diminished"
  | "Major 7"
  | "Minor 7"
  | "Dominant 7"
  | "Half-diminished 7"
  | "Diminished 7";

export type KeyChord = {
  /**
   * Stable id within a key: "1" to "7", plus "5m" and "7dim" in minor, and
   * "s2" to "s7" for the dominant sevenths that point at another chord.
   */
  id: string;
  /** Roman numeral: capitals for major chords, small letters for minor, ° for diminished. */
  numeral: string;
  /** Chord name as the rest of Lumina writes it, e.g. "Bb", "Dm", "Bdim". */
  name: string;
  quality: Quality;
  notes: string[];
  /** Ids of the chords this one most often moves to. Empty means it can go anywhere. */
  leadsTo: string[];
  /** A one-line reason a learner can hear for themselves. */
  role: string;
  /** True for the two extra minor-key chords that sit outside the main seven. */
  alternate?: boolean;
  /** True for a dominant seventh borrowed to point at another chord of the key. */
  pointer?: boolean;
};

export const MAJOR_KEYS = [
  "C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F",
];
export const MINOR_KEYS = [
  "A", "E", "B", "F#", "C#", "G#", "Eb", "Bb", "F", "C", "G", "D",
];

const SUFFIX: Record<Quality, string> = {
  Major: "",
  Minor: "m",
  Diminished: "dim",
  "Major 7": "maj7",
  "Minor 7": "m7",
  "Dominant 7": "7",
  "Half-diminished 7": "m7b5",
  "Diminished 7": "dim7",
};
/** What each quality adds to its Roman numeral. */
const MARK: Record<Quality, string> = {
  Major: "",
  Minor: "",
  Diminished: "°",
  "Major 7": "maj7",
  "Minor 7": "7",
  "Dominant 7": "7",
  "Half-diminished 7": "ø7",
  "Diminished 7": "°7",
};
const UPPER: Quality[] = ["Major", "Major 7", "Dominant 7"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

type Row = [
  degree: number,
  semitones: number,
  triad: Quality,
  seventh: Quality,
  leadsTo: string[],
  role: string,
  id?: string,
];

const MAJOR: Row[] = [
  [1, 0, "Major", "Major 7", [], "Home. From here you can go anywhere."],
  [2, 2, "Minor", "Minor 7", ["5", "7"], "Sets up V. The classic lead-in."],
  [3, 4, "Minor", "Minor 7", ["6", "4"], "A gentle step away from home."],
  [4, 5, "Major", "Major 7", ["5", "2", "1"], "Moves away from home, toward V or back."],
  [5, 7, "Major", "Dominant 7", ["1", "6"], "Wants to go home. Its middle note leans up into I."],
  [6, 9, "Minor", "Minor 7", ["2", "4"], "Home's sadder cousin. Shares two notes with I."],
  [7, 11, "Diminished", "Half-diminished 7", ["1", "3"], "Tense and unstable. Pulls hard toward I."],
];
const MINOR: Row[] = [
  [1, 0, "Minor", "Minor 7", [], "Home. From here you can go anywhere."],
  [2, 2, "Diminished", "Half-diminished 7", ["5", "7dim"], "Tense. Sets up V."],
  [3, 3, "Major", "Major 7", ["6", "4"], "The bright side of a minor key."],
  [4, 5, "Minor", "Minor 7", ["5", "2", "1"], "Moves away from home, toward V or back."],
  [5, 7, "Major", "Dominant 7", ["1", "6"], "Major, with the raised seventh note that leans up into home."],
  [6, 8, "Major", "Major 7", ["2", "4"], "Warm and open. Often heads back toward iv."],
  [7, 10, "Major", "Dominant 7", ["3"], "Leads to III, the bright side."],
  [5, 7, "Minor", "Minor 7", ["1", "6"], "The softer V, straight from the natural minor scale.", "5m"],
  [7, 11, "Diminished", "Diminished 7", ["1"], "Built on the raised seventh note. Pulls hard toward home.", "7dim"],
];

const numeral = (degree: number, quality: Quality) =>
  (UPPER.includes(quality) ? ROMAN[degree - 1] : ROMAN[degree - 1].toLowerCase()) +
  MARK[quality];

const build = (chordRoot: string, quality: Quality) => ({
  name: chordRoot + SUFFIX[quality],
  quality,
  notes: chordsForRoot(chordRoot).find((chord) => chord.name === quality)!.notes,
});

/**
 * The chords of a key, in scale order, with the minor-key alternates last.
 * Pass `sevenths` for four-note chords: V becomes V7 and the rest follow.
 */
export function keyChords(
  root: string,
  mode: KeyMode,
  sevenths = false,
): KeyChord[] {
  return (mode === "major" ? MAJOR : MINOR).map(
    ([degree, semitones, triad, seventh, leadsTo, role, id]) => {
      const quality = sevenths ? seventh : triad;
      return {
        id: id ?? String(degree),
        numeral: numeral(degree, quality),
        ...build(spellIntervals(root, [semitones], [degree])[0], quality),
        leadsTo,
        role,
        alternate: !!id,
      };
    },
  );
}

/**
 * Dominant sevenths that point at another chord of the key: V7 of V and its
 * relatives. The music leans on the target as if it were home for a moment,
 * without changing key. Chained together they make the barbershop circle,
 * each seventh handing on to the next until V7 brings it home.
 */
export function pointerChords(root: string, mode: KeyMode): KeyChord[] {
  // The circle, walking home: V7 of iii, of vi, of ii, of V, then V itself.
  const chain: Record<string, string> = { "3": "s6", "6": "s2", "2": "s5" };
  return keyChords(root, mode)
    .filter(
      (target) =>
        !target.alternate && target.id !== "1" && target.quality !== "Diminished",
    )
    .map((target) => {
      const targetRoot = /^[A-G][#b]*/.exec(target.name)![0];
      const next = mode === "major" ? chain[target.id] : undefined;
      return {
        id: `s${target.id}`,
        numeral: `V7/${target.numeral}`,
        ...build(spellIntervals(targetRoot, [7], [5])[0], "Dominant 7"),
        leadsTo: next ? [target.id, next] : [target.id],
        role: next
          ? `Points at ${target.numeral}. In a chain of sevenths it hands on to the next one instead.`
          : `Points at ${target.numeral}, leaning on it as if it were home for a moment.`,
        pointer: true,
      };
    });
}

/** Every chord Lumina can name in a key: triads, sevenths, and the pointers. */
export function keyVocabulary(root: string, mode: KeyMode): KeyChord[] {
  return [
    ...keyChords(root, mode),
    ...keyChords(root, mode, true),
    ...pointerChords(root, mode),
  ];
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

/**
 * Carry a progression into another key: chords that belonged to the old key
 * keep their place. Pass two lists built the same way (two `keyVocabulary`
 * results), so a seventh stays a seventh and a pointer stays a pointer.
 */
export function moveToKey<T extends { name: string; notes: string[] }>(
  progression: readonly T[],
  from: readonly KeyChord[],
  to: readonly KeyChord[],
): T[] {
  return progression.map((chord) => {
    const place = placeInKey(chord, from);
    const next = place && to[from.indexOf(place)];
    return next ? { ...chord, name: next.name, notes: next.notes } : chord;
  });
}

export const STARTERS: Record<KeyMode, { label: string; ids: string[] }[]> = {
  major: [
    { label: "I  IV  V  I", ids: ["1", "4", "5", "1"] },
    { label: "I  V  vi  IV", ids: ["1", "5", "6", "4"] },
    { label: "I  vi  IV  V", ids: ["1", "6", "4", "5"] },
    { label: "ii  V  I", ids: ["2", "5", "1"] },
    { label: "Circle of sevenths", ids: ["1", "s6", "s2", "s5", "5", "1"] },
  ],
  minor: [
    { label: "i  iv  V  i", ids: ["1", "4", "5", "1"] },
    { label: "i  VI  III  VII", ids: ["1", "6", "3", "7"] },
    { label: "i  VII  VI  V", ids: ["1", "7", "6", "5"] },
    { label: "ii°  V  i", ids: ["2", "5", "1"] },
  ],
};
