import { useCallback, useRef } from 'react';

// Note frequencies for on-screen piano (C4-C5)
const noteFrequencies: Record<string, number> = {
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
  'C2': 523.25,
};

// Convert MIDI note number to frequency (A4 = 69 = 440Hz)
const midiNoteToFrequency = (midiNote: number): number => {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
};

interface ActiveOscillator {
  oscillator: OscillatorNode;
  gainNode: GainNode;
}

export const usePianoAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeOscillatorsRef = useRef<Map<string, ActiveOscillator>>(new Map());
  const activeMidiOscillatorsRef = useRef<Map<number, ActiveOscillator>>(new Map());

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play a single note by name (for on-screen piano)
  const playNote = useCallback((note: string) => {
    const frequency = noteFrequencies[note];
    if (!frequency) return;

    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // ADSR envelope
    const now = audioContext.currentTime;
    const attackTime = 0.01;
    const decayTime = 0.1;
    const sustainLevel = 0.3;
    const releaseTime = 0.3;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    gainNode.gain.linearRampToValueAtTime(0, now + attackTime + decayTime + releaseTime);

    oscillator.start(now);
    oscillator.stop(now + attackTime + decayTime + releaseTime);
  }, [getAudioContext]);

  // Play/stop chord note by name (for on-screen piano)
  const playChordNote = useCallback((note: string, shouldStop: boolean) => {
    const frequency = noteFrequencies[note];
    if (!frequency) return;

    const audioContext = getAudioContext();

    // If stopping, fade out and remove
    if (shouldStop) {
      const active = activeOscillatorsRef.current.get(note);
      if (active) {
        const now = audioContext.currentTime;
        const releaseTime = 0.5;
        
        active.gainNode.gain.cancelScheduledValues(now);
        active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
        active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
        
        active.oscillator.stop(now + releaseTime);
        activeOscillatorsRef.current.delete(note);
      }
      return;
    }

    // If already playing, don't start again
    if (activeOscillatorsRef.current.has(note)) return;

    // Start new sustained note
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Sustained envelope
    const now = audioContext.currentTime;
    const attackTime = 0.01;
    const decayTime = 0.1;
    const sustainLevel = 0.35;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    oscillator.start(now);
    
    activeOscillatorsRef.current.set(note, { oscillator, gainNode });
  }, [getAudioContext]);

  // Play a single MIDI note (momentary, with auto-release)
  const playMidiNote = useCallback((midiNote: number) => {
    const frequency = midiNoteToFrequency(midiNote);
    const audioContext = getAudioContext();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // ADSR envelope
    const now = audioContext.currentTime;
    const attackTime = 0.01;
    const decayTime = 0.1;
    const sustainLevel = 0.3;
    const releaseTime = 0.3;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    gainNode.gain.linearRampToValueAtTime(0, now + attackTime + decayTime + releaseTime);

    oscillator.start(now);
    oscillator.stop(now + attackTime + decayTime + releaseTime);
  }, [getAudioContext]);

  // Play/stop sustained MIDI note (for chord mode)
  const playMidiChordNote = useCallback((midiNote: number, shouldStop: boolean) => {
    const audioContext = getAudioContext();

    // If stopping, fade out and remove
    if (shouldStop) {
      const active = activeMidiOscillatorsRef.current.get(midiNote);
      if (active) {
        const now = audioContext.currentTime;
        const releaseTime = 0.5;
        
        active.gainNode.gain.cancelScheduledValues(now);
        active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
        active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
        
        active.oscillator.stop(now + releaseTime);
        activeMidiOscillatorsRef.current.delete(midiNote);
      }
      return;
    }

    // If already playing, don't start again
    if (activeMidiOscillatorsRef.current.has(midiNote)) return;

    // Calculate frequency from MIDI note
    const frequency = midiNoteToFrequency(midiNote);

    // Start new sustained note
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Sustained envelope
    const now = audioContext.currentTime;
    const attackTime = 0.01;
    const decayTime = 0.1;
    const sustainLevel = 0.35;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    oscillator.start(now);
    
    activeMidiOscillatorsRef.current.set(midiNote, { oscillator, gainNode });
  }, [getAudioContext]);

  const stopAllNotes = useCallback(() => {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    const releaseTime = 0.5;

    // Stop on-screen piano notes
    activeOscillatorsRef.current.forEach((active) => {
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
      active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
      active.oscillator.stop(now + releaseTime);
    });
    activeOscillatorsRef.current.clear();

    // Stop MIDI notes
    activeMidiOscillatorsRef.current.forEach((active) => {
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
      active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
      active.oscillator.stop(now + releaseTime);
    });
    activeMidiOscillatorsRef.current.clear();
  }, [getAudioContext]);

  return { 
    playNote, 
    playChordNote, 
    playMidiNote, 
    playMidiChordNote, 
    stopAllNotes 
  };
};
