import { NOTE_NAMES, formatNote } from "./noteSelection.ts";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PITCHES = [0, 2, 4, 5, 7, 9, 11];
export const ROOT_SPELLINGS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
];
const COMMON_ROOTS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

export const CHORD_FORMULAS = [
  { name: "Major", suffix: "", intervals: [0, 4, 7], degrees: [1, 3, 5] },
  { name: "Minor", suffix: "m", intervals: [0, 3, 7], degrees: [1, 3, 5] },
  {
    name: "Dominant 7",
    suffix: "7",
    intervals: [0, 4, 7, 10],
    degrees: [1, 3, 5, 7],
  },
  {
    name: "Major 7",
    suffix: "maj7",
    intervals: [0, 4, 7, 11],
    degrees: [1, 3, 5, 7],
  },
  {
    name: "Minor 7",
    suffix: "m7",
    intervals: [0, 3, 7, 10],
    degrees: [1, 3, 5, 7],
  },
  {
    name: "Diminished",
    suffix: "dim",
    intervals: [0, 3, 6],
    degrees: [1, 3, 5],
  },
  {
    name: "Augmented",
    suffix: "aug",
    intervals: [0, 4, 8],
    degrees: [1, 3, 5],
  },
  { name: "Sus2", suffix: "sus2", intervals: [0, 2, 7], degrees: [1, 2, 5] },
  { name: "Sus4", suffix: "sus4", intervals: [0, 5, 7], degrees: [1, 4, 5] },
  { name: "6", suffix: "6", intervals: [0, 4, 7, 9], degrees: [1, 3, 5, 6] },
  {
    name: "Minor 6",
    suffix: "m6",
    intervals: [0, 3, 7, 9],
    degrees: [1, 3, 5, 6],
  },
  {
    name: "9",
    suffix: "9",
    intervals: [0, 4, 7, 10, 14],
    degrees: [1, 3, 5, 7, 9],
  },
];

export const SCALE_FORMULAS = {
  Major: { intervals: [0, 2, 4, 5, 7, 9, 11], degrees: [1, 2, 3, 4, 5, 6, 7] },
  "Natural Minor": {
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: [1, 2, 3, 4, 5, 6, 7],
  },
  "Pentatonic Major": { intervals: [0, 2, 4, 7, 9], degrees: [1, 2, 3, 5, 6] },
  "Pentatonic Minor": { intervals: [0, 3, 5, 7, 10], degrees: [1, 3, 4, 5, 7] },
  // The blues passing tone is the lowered fifth, not an augmented fourth.
  Blues: { intervals: [0, 3, 5, 6, 7, 10], degrees: [1, 3, 4, 5, 5, 7] },
  Dorian: { intervals: [0, 2, 3, 5, 7, 9, 10], degrees: [1, 2, 3, 4, 5, 6, 7] },
};

const mod12 = (pitch: number) => ((pitch % 12) + 12) % 12;
const isPitchSpelling = (note: string) => /^[A-G](?:#|b|♯|♭|𝄪|𝄫)*$/u.test(note);
function parseRoot(root: string) {
  const normalized = root
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/𝄪/gu, "##")
    .replace(/𝄫/gu, "bb");
  const match = /^([A-G])([#b]*)$/.exec(normalized);
  if (!match) throw new Error(`Invalid note spelling: ${root}`);
  const letter = LETTERS.indexOf(match[1]);
  const accidental = Array.from(match[2]).reduce(
    (sum, symbol) => sum + (symbol === "#" ? 1 : -1),
    0,
  );
  return { letter, pitch: NATURAL_PITCHES[letter] + accidental };
}
export const pitchClass = (note: string) => mod12(parseRoot(note).pitch);

/** Keep the diatonic degree's letter, then adjust its accidental to the pitch. */
export function spellIntervals(
  root: string,
  intervals: readonly number[],
  degrees: readonly number[],
): string[] {
  if (intervals.length !== degrees.length)
    throw new Error("Each interval needs a diatonic degree.");
  const parsed = parseRoot(root);
  return intervals.map((interval, i) => {
    const diatonicIndex = parsed.letter + degrees[i] - 1;
    const letterIndex = diatonicIndex % 7;
    const natural =
      NATURAL_PITCHES[letterIndex] + 12 * Math.floor(diatonicIndex / 7);
    const accidental = parsed.pitch + interval - natural;
    return (
      LETTERS[letterIndex] +
      (accidental >= 0 ? "#".repeat(accidental) : "b".repeat(-accidental))
    );
  });
}

export function chordsForRoot(root: string) {
  return CHORD_FORMULAS.map((formula) => ({
    ...formula,
    notes: formula.intervals.map(
      (interval) => NOTE_NAMES[mod12(pitchClass(root) + interval)],
    ),
    spellings: spellIntervals(root, formula.intervals, formula.degrees),
  }));
}

/** Read notation from the name; sounding note IDs remain compatible with the piano. */
export function selectionRoot(name: string, fallback = "C"): string {
  const match = /^([A-G](?:#{1,2}|b{1,2}|♯{1,2}|♭{1,2}|𝄪|𝄫)?)/u.exec(name);
  return match
    ? match[1]
        .replace(/♯/g, "#")
        .replace(/♭/g, "b")
        .replace(/𝄪/gu, "##")
        .replace(/𝄫/gu, "bb")
    : COMMON_ROOTS[pitchClass(fallback)];
}

export function spelledChordNotes(
  name: string,
  notes: readonly string[],
): string[] {
  const rootMatch = /^([A-G](?:#{1,2}|b{1,2}|♯{1,2}|♭{1,2}|𝄪|𝄫)?)(.*)$/u.exec(
    name,
  );
  if (!rootMatch) return [...notes];
  const suffix = rootMatch[2]
    .trim()
    .replace(/^major$/, "")
    .replace(/^minor$/, "m");
  const formula = CHORD_FORMULAS.find((chord) => chord.suffix === suffix);
  if (!formula) return [...notes];
  const spellings = spellIntervals(
    rootMatch[1],
    formula.intervals,
    formula.degrees,
  );
  // Do not reinterpret unknown/custom saved voicings with a misleading name.
  if (
    notes.length !== spellings.length ||
    notes.some((note) => !isPitchSpelling(note)) ||
    notes.some(
      (note) =>
        !spellings.some(
          (spelling) => pitchClass(note) === pitchClass(spelling),
        ),
    )
  )
    return [...notes];
  return notes.map(
    (note) =>
      spellings.find((spelling) => pitchClass(spelling) === pitchClass(note))!,
  );
}

export function selectionNoteLabels(selection: {
  name: string;
  notes: readonly string[];
  kind: string;
}): string[] {
  if (selection.kind === "chord")
    return spelledChordNotes(selection.name, selection.notes).map(formatNote);
  if (selection.kind === "scale") {
    const root = selectionRoot(selection.name, selection.notes[0] || "C");
    const scaleName = selection.name.slice(root.length).trim().toLowerCase();
    const entry = Object.entries(SCALE_FORMULAS).find(
      ([name]) => name.toLowerCase() === scaleName,
    );
    if (entry)
      return spellIntervals(root, entry[1].intervals, entry[1].degrees).map(
        formatNote,
      );
  }
  if (
    selection.kind === "note" &&
    selection.notes.length === 1 &&
    isPitchSpelling(selection.notes[0]) &&
    /^[A-G]/.test(selection.name)
  ) {
    const root = selectionRoot(selection.name, selection.notes[0]);
    if (pitchClass(root) === pitchClass(selection.notes[0]))
      return [formatNote(root)];
  }
  return selection.notes.map(formatNote);
}
