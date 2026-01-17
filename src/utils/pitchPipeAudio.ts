// Pitch Pipe Audio Utilities
// Separate audio system for precision frequency generation

export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface OscillatorChain {
  oscillator: OscillatorNode;
  filter: BiquadFilterNode;
  gainNode: GainNode;
}

// Note frequencies for quick selection (A4 = 440Hz standard)
export const NOTE_FREQUENCIES: Record<string, number> = {
  'C': 261.63,
  'C#': 277.18,
  'D': 293.66,
  'D#': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#': 369.99,
  'G': 392.00,
  'G#': 415.30,
  'A': 440.00,
  'A#': 466.16,
  'B': 493.88,
};

// Get frequency for a note at a specific octave
export const getNoteFrequency = (note: string, octave: number): number => {
  const baseFreq = NOTE_FREQUENCIES[note];
  if (!baseFreq) return 440; // Default to A4
  
  // Octave 4 is our reference, adjust accordingly
  const octaveDiff = octave - 4;
  return baseFreq * Math.pow(2, octaveDiff);
};

// Get note name from frequency
export const frequencyToNote = (frequency: number): { note: string; octave: number; cents: number } => {
  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(frequency / A4);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - roundedSemitones) * 100);
  
  const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
  const noteIndex = ((roundedSemitones % 12) + 12) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);
  
  return {
    note: noteNames[noteIndex],
    octave,
    cents
  };
};

// Chord intervals in semitones
export const CHORD_INTERVALS: Record<string, number[]> = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented': [0, 4, 8],
  'Major 7th': [0, 4, 7, 11],
  'Minor 7th': [0, 3, 7, 10],
  'Dominant 7th': [0, 4, 7, 10],
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7],
};

// Get chord frequencies from root frequency
export const getChordFrequencies = (rootFrequency: number, chordType: string): number[] => {
  const intervals = CHORD_INTERVALS[chordType] || [0, 4, 7];
  return intervals.map(semitones => rootFrequency * Math.pow(2, semitones / 12));
};

// Create oscillator chain: Oscillator -> Filter -> Gain -> Destination
export const createOscillatorChain = (
  audioContext: AudioContext,
  frequency: number,
  waveform: WaveformType,
  filterCutoff: number
): OscillatorChain => {
  const oscillator = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gainNode = audioContext.createGain();

  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
  filter.Q.setValueAtTime(1, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  return { oscillator, filter, gainNode };
};

// Start oscillator with attack envelope
export const startOscillatorWithAttack = (
  gainNode: GainNode,
  oscillator: OscillatorNode,
  volume: number,
  attackTime: number,
  currentTime: number
): void => {
  gainNode.gain.cancelScheduledValues(currentTime);
  gainNode.gain.setValueAtTime(0.0001, currentTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, currentTime + attackTime);
  oscillator.start(currentTime);
};

// Stop oscillator with release envelope
export const stopOscillatorWithRelease = (
  oscillator: OscillatorNode,
  gainNode: GainNode,
  releaseTime: number,
  currentTime: number
): void => {
  // Fade out gain to avoid clicks
  gainNode.gain.cancelScheduledValues(currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + releaseTime);
  
  // Stop oscillator after release
  oscillator.stop(currentTime + releaseTime);
};

// Update oscillator frequency in real-time
export const updateOscillatorFrequency = (
  oscillator: OscillatorNode,
  frequency: number,
  currentTime: number,
  glideTime: number = 0.05
): void => {
  oscillator.frequency.cancelScheduledValues(currentTime);
  oscillator.frequency.setValueAtTime(oscillator.frequency.value, currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, currentTime + glideTime);
};

// Update filter cutoff in real-time
export const updateFilterCutoff = (
  filter: BiquadFilterNode,
  cutoff: number,
  currentTime: number
): void => {
  filter.frequency.cancelScheduledValues(currentTime);
  filter.frequency.setValueAtTime(cutoff, currentTime);
};

// Update gain in real-time
export const updateGain = (
  gainNode: GainNode,
  volume: number,
  currentTime: number
): void => {
  gainNode.gain.cancelScheduledValues(currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), currentTime + 0.05);
};
