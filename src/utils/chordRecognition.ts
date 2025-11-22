// Chord recognition utility
// Identifies chord types based on selected notes

const noteToSemitone: Record<string, number> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11, 'C2': 0
};

const semitoneToNote: Record<number, string> = {
  0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
  6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B'
};

interface ChordPattern {
  name: string;
  quality: string;
  intervals: number[];
}

const chordPatterns: ChordPattern[] = [
  // Triads
  { name: "Major", quality: "major", intervals: [0, 4, 7] },
  { name: "Minor", quality: "minor", intervals: [0, 3, 7] },
  { name: "Diminished", quality: "diminished", intervals: [0, 3, 6] },
  { name: "Augmented", quality: "augmented", intervals: [0, 4, 8] },
  { name: "Sus2", quality: "suspended", intervals: [0, 2, 7] },
  { name: "Sus4", quality: "suspended", intervals: [0, 5, 7] },
  
  // Seventh chords
  { name: "Major 7", quality: "major7", intervals: [0, 4, 7, 11] },
  { name: "Minor 7", quality: "minor7", intervals: [0, 3, 7, 10] },
  { name: "Dominant 7", quality: "dominant7", intervals: [0, 4, 7, 10] },
  { name: "Diminished 7", quality: "diminished7", intervals: [0, 3, 6, 9] },
  { name: "Minor 7♭5", quality: "half-diminished", intervals: [0, 3, 6, 10] },
  { name: "Major 7♯5", quality: "augmented7", intervals: [0, 4, 8, 11] },
  
  // Extended and altered
  { name: "6", quality: "sixth", intervals: [0, 4, 7, 9] },
  { name: "Minor 6", quality: "minor6", intervals: [0, 3, 7, 9] },
  { name: "9", quality: "ninth", intervals: [0, 4, 7, 10, 14] },
  { name: "Minor 9", quality: "minor9", intervals: [0, 3, 7, 10, 14] },
  
  // Power chord
  { name: "5", quality: "power", intervals: [0, 7] },
];

export interface ChordInfo {
  name: string;
  quality: string;
  inversion: number;
  notes: string[];
  rootNote: string;
}

export function recognizeChord(selectedNotes: string[]): ChordInfo | null {
  if (selectedNotes.length === 0) return null;
  if (selectedNotes.length === 1) {
    return {
      name: `${selectedNotes[0]}`,
      quality: "single",
      inversion: 0,
      notes: selectedNotes,
      rootNote: selectedNotes[0]
    };
  }

  // Convert notes to semitones and sort
  const semitones = selectedNotes
    .map(note => noteToSemitone[note])
    .filter(s => s !== undefined)
    .sort((a, b) => a - b);

  // Remove duplicates
  const uniqueSemitones = [...new Set(semitones)];

  // Try all possible root notes (inversions)
  for (let inversionIndex = 0; inversionIndex < uniqueSemitones.length; inversionIndex++) {
    const rootSemitone = uniqueSemitones[inversionIndex];
    
    // Calculate intervals from this root
    const intervals = uniqueSemitones.map(s => (s - rootSemitone + 12) % 12).sort((a, b) => a - b);
    
    // Try to match against chord patterns
    for (const pattern of chordPatterns) {
      if (arraysEqual(intervals, pattern.intervals)) {
        const rootNote = semitoneToNote[rootSemitone];
        return {
          name: `${rootNote}${pattern.name}`,
          quality: pattern.quality,
          inversion: inversionIndex,
          notes: selectedNotes,
          rootNote
        };
      }
    }
  }

  // No match found - custom chord
  return {
    name: "Custom Chord",
    quality: "custom",
    inversion: 0,
    notes: selectedNotes,
    rootNote: selectedNotes[0]
  };
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
