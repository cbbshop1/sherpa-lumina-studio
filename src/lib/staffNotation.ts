import { NOTE_NAMES, formatNote } from "./noteSelection.ts";
import { pitchClass } from "./musicNotation.ts";
const letters = ["C", "D", "E", "F", "G", "A", "B"];
const naturals = [0, 2, 4, 5, 7, 9, 11];
export const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
export type StaffNote = {
  id: string;
  midiNote: number;
  startBeat: number;
  durationBeats: number;
};

export function writtenPitch(
  midi: number,
  preferred: readonly string[] = [],
  flats = false,
) {
  const pc = ((midi % 12) + 12) % 12;
  const spelling =
    preferred.find(
      (note) => /^[A-G][#b♭♯𝄪𝄫]*$/u.test(note) && pitchClass(note) === pc,
    ) ?? (flats ? FLAT_NAMES : NOTE_NAMES)[pc];
  const normalized = spelling
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/𝄪/gu, "##")
    .replace(/𝄫/gu, "bb");
  const letterIndex = letters.indexOf(normalized[0]);
  const accidental = [...normalized.slice(1)].reduce(
    (sum, symbol) => sum + (symbol === "#" ? 1 : -1),
    0,
  );
  const octave =
    Math.round((midi - naturals[letterIndex] - accidental) / 12) - 1;
  const position = octave * 7 + letterIndex;
  const clef = position >= 28 ? "treble" : "bass";
  const y =
    clef === "treble" ? 85 - (position - 30) * 5 : 185 - (position - 18) * 5;
  const top = clef === "treble" ? 45 : 145;
  const bottom = clef === "treble" ? 85 : 185;
  const ledger: number[] = [];
  for (let line = top - 10; line >= y; line -= 10) ledger.push(line);
  for (let line = bottom + 10; line <= y; line += 10) ledger.push(line);
  return {
    spelling: formatNote(normalized),
    name: formatNote(normalized) + octave,
    letter: normalized[0],
    accidental,
    octave,
    y,
    clef,
    ledger,
  };
}

export function staffNotes(
  notes: readonly StaffNote[],
  preferred: readonly string[] = [],
  flats = false,
) {
  const accidentals = new Map<string, number>();
  let previousBar = -1;
  return [...notes]
    .sort((a, b) => a.startBeat - b.startBeat || a.midiNote - b.midiNote)
    .map((note) => {
      const pitch = writtenPitch(note.midiNote, preferred, flats);
      const bar = Math.floor(note.startBeat / 4);
      if (bar !== previousBar) {
        accidentals.clear();
        previousBar = bar;
      }
      const key = pitch.letter + pitch.octave;
      const previous = accidentals.get(key) ?? 0;
      const sign =
        previous === pitch.accidental
          ? ""
          : pitch.accidental === 0
            ? "♮"
            : pitch.accidental === 2
              ? "𝄪"
              : pitch.accidental === -2
                ? "𝄫"
                : pitch.accidental > 0
                  ? "♯"
                  : "♭";
      accidentals.set(key, pitch.accidental);
      const base =
        [4, 2, 1, 0.5, 0.25].find(
          (duration) => note.durationBeats >= duration,
        ) ?? 0.25;
      return {
        ...note,
        ...pitch,
        sign,
        hollow: base >= 2,
        stem: base < 4,
        flags: base === 0.25 ? 2 : base === 0.5 ? 1 : 0,
        dotted: Math.abs(note.durationBeats - base * 1.5) < 0.001,
      };
    });
}

export function rollCell(
  x: number,
  y: number,
  gridWidth: number,
  beats: number,
) {
  return {
    midiNote: Math.max(36, Math.min(84, 84 - Math.floor(y / 20))),
    startBeat: Math.max(
      0,
      Math.min(beats - 0.25, Math.floor(x / (gridWidth / beats) / 0.25) * 0.25),
    ),
  };
}
export const durationName = (beats: number) =>
  ({ 0.25: "sixteenth", 0.5: "eighth", 1: "quarter", 2: "half", 4: "whole" })[
    beats
  ] ?? `${beats} beats`;
