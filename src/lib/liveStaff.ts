// What the grand staff above the piano shows at this moment: the note or
// chord you're playing, stacked, or a scale written out left to right.

import { writtenPitch } from "./staffNotation.ts";

export type LiveStaffInput = {
  /** Notes chosen on the piano (or carried in from another room). */
  selected: readonly number[];
  /** Notes actually sounding right now, from the screen or a MIDI keyboard. */
  sounding: readonly number[];
  /** A scale is written as a run of notes rather than a stack. */
  kind: "note" | "chord" | "scale";
  /** Preferred spellings, e.g. ["E♭", "G", "B♭"], so flats stay flats. */
  spellings?: readonly string[];
};

export type LiveNote = {
  midi: number;
  name: string;
  y: number;
  clef: "treble" | "bass";
  ledger: number[];
  sign: string;
  /** Notes a step apart in a chord sit side by side, as they do in print. */
  shifted: boolean;
  sounding: boolean;
};

export type LiveColumn = { notes: LiveNote[] };

const SIGNS: Record<number, string> = {
  [-2]: "𝄫",
  [-1]: "♭",
  0: "",
  1: "♯",
  2: "𝄪",
};

function place(
  midi: number,
  spellings: readonly string[],
  sounding: ReadonlySet<number>,
  flats = false,
): LiveNote {
  const pitch = writtenPitch(midi, spellings, flats);
  return {
    midi,
    name: pitch.name,
    y: pitch.y,
    clef: pitch.clef as LiveNote["clef"],
    ledger: pitch.ledger,
    sign: SIGNS[pitch.accidental] ?? "",
    shifted: false,
    sounding: sounding.has(midi),
  };
}

/** Low to high; a note a step above its neighbour moves aside. */
function stack(notes: LiveNote[]) {
  const sorted = [...notes].sort((a, b) => b.y - a.y);
  for (let i = 1; i < sorted.length; i++) {
    const below = sorted[i - 1];
    const current = sorted[i];
    if (
      below.y - current.y === 5 &&
      below.clef === current.clef &&
      !below.shifted
    )
      current.shifted = true;
  }
  return sorted;
}

/** Chords found by ear on the piano can come out as "D♯ F𝄪 A♯". Nobody reads
 * that comfortably, so when a spelling needs double sharps or flats, the
 * staff writes the same notes with plain flats instead (E♭ G B♭). */
export function needsFlats(spellings: readonly string[]) {
  return spellings.some((name) => /𝄪|𝄫|##|bb|♯♯|♭♭/u.test(name));
}

const SHARP_TO_FLAT: Record<string, string> = {
  "C♯": "D♭",
  "D♯": "E♭",
  "F♯": "G♭",
  "G♯": "A♭",
  "A♯": "B♭",
};

/** "D♯maj7" becomes "E♭maj7" to match a staff written in flats. */
export function flatName(name: string) {
  const root = name.slice(0, 2);
  return SHARP_TO_FLAT[root] ? SHARP_TO_FLAT[root] + name.slice(2) : name;
}

export function liveStaff({
  selected,
  sounding,
  kind,
  spellings: given = [],
}: LiveStaffInput): LiveColumn[] {
  const flats = needsFlats(given);
  const spellings = flats ? [] : given;
  const heard = new Set(sounding);
  const unique = (notes: readonly number[]) =>
    [...new Set(notes)].sort((a, b) => a - b);

  if (kind === "scale" && selected.length > 1) {
    const columns = selected.map((midi) => ({
      notes: [place(midi, spellings, heard, flats)],
    }));
    // A MIDI key held outside the scale still shows, at the end.
    const extra = unique(sounding).filter((midi) => !selected.includes(midi));
    if (extra.length)
      columns.push({ notes: stack(extra.map((m) => place(m, [], heard))) });
    return columns;
  }

  const notes = unique([...selected, ...sounding]);
  if (!notes.length) return [];
  return [
    { notes: stack(notes.map((midi) => place(midi, spellings, heard, flats))) },
  ];
}

/** The top and bottom of the drawing, so ledger-line notes never get cut off. */
export function staffBounds(columns: LiveColumn[]) {
  let top = 28;
  let bottom = 200;
  for (const { notes } of columns)
    for (const note of notes) {
      top = Math.min(top, note.y - 20);
      bottom = Math.max(bottom, note.y + 20);
    }
  return { top, bottom };
}
