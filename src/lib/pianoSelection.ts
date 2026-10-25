import { NOTE_NAMES } from "./noteSelection.ts";
import { recognizeChord } from "../utils/chordRecognition.ts";

/** Preserve actual register, including the upper C and physical MIDI input. */
export function pianoSelection(midiNotes: number[]) {
  const pitches = [...new Set(midiNotes)].sort((a, b) => a - b);
  const notes = pitches.map((midi) => NOTE_NAMES[midi % 12]);
  const unique = [...new Set(notes)];
  const chord = recognizeChord(unique);
  const suffixes: Record<string, string> = {
    major: "",
    minor: "m",
    diminished: "dim",
    augmented: "aug",
    major7: "maj7",
    minor7: "m7",
    dominant7: "7",
    diminished7: "dim7",
    "half-diminished": "m7b5",
    augmented7: "maj7#5",
    sixth: "6",
    minor6: "m6",
    ninth: "9",
    minor9: "m9",
    power: "5",
  };
  let name = unique.join(" · ");
  if (chord && unique.length > 1 && chord.quality !== "custom") {
    const suffix =
      chord.quality === "suspended"
        ? chord.name.endsWith("Sus2")
          ? "sus2"
          : "sus4"
        : suffixes[chord.quality];
    if (suffix !== undefined) name = chord.rootNote + suffix;
  }
  return {
    name,
    notes,
    midiNotes: pitches,
    kind: unique.length > 1 ? ("chord" as const) : ("note" as const),
  };
}
