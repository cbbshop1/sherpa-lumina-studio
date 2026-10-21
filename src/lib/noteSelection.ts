export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export function voiceNotes(notes: string[], octave = 4): number[] {
  let previous = -1;
  return notes.map((note) => {
    const pitch = NOTE_NAMES.indexOf(note);
    if (pitch < 0) throw new Error(`Unknown note: ${note}`);
    let midi = (octave + 1) * 12 + pitch;
    while (midi < previous) midi += 12;
    previous = midi;
    return midi;
  });
}
export const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const formatNote = (note: string) => note.replace("#", "♯");
