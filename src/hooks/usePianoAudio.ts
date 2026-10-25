import { useCallback, useRef, useState } from 'react';
import { 
  InstrumentType, 
  createInstrumentNote, 
  getInstrumentReleaseTime,
  getInstrumentAutoStopTime 
} from '@/utils/instrumentSynthesis';

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

interface ActiveNote {
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  filterNode?: BiquadFilterNode;
}

type WebKitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const usePianoAudio = () => {
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>('piano');
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeNotesRef = useRef<Map<string, ActiveNote>>(new Map());
  const activeMidiNotesRef = useRef<Map<number, ActiveNote>>(new Map());

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext || (window as WebKitAudioWindow).webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error('Web Audio is not supported in this browser.');
      }

      audioContextRef.current = new AudioContextConstructor();
    }
    return audioContextRef.current;
  }, []);

  // Play a single note by name (for on-screen piano)
  const playNote = useCallback((note: string) => {
    const frequency = noteFrequencies[note];
    if (!frequency) return;

    const audioContext = getAudioContext();
    const { oscillators, gainNode, filterNode } = createInstrumentNote(
      audioContext, 
      frequency, 
      currentInstrument,
      false
    );

    // Start all oscillators
    oscillators.forEach(osc => osc.start());

    // Auto-stop after instrument-specific time
    const stopTime = getInstrumentAutoStopTime(currentInstrument);
    setTimeout(() => {
      oscillators.forEach(osc => {
        try { osc.stop(); } catch {
          // Oscillator may already have stopped.
        }
      });
    }, stopTime * 1000);
  }, [getAudioContext, currentInstrument]);

  const stopNote = useCallback((note: string) => {
    const frequency = noteFrequencies[note];
    if (!frequency) return;

    const audioContext = getAudioContext();
    const active = activeNotesRef.current.get(note);
    if (!active) return;

    const now = audioContext.currentTime;
    const releaseTime = getInstrumentReleaseTime(currentInstrument);

    active.gainNode.gain.cancelScheduledValues(now);
    active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
    active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

    active.oscillators.forEach(osc => {
      try { osc.stop(now + releaseTime); } catch {
        // Oscillator may already have stopped.
      }
    });
    activeNotesRef.current.delete(note);
  }, [getAudioContext, currentInstrument]);

  const startNote = useCallback((note: string) => {
    const frequency = noteFrequencies[note];
    if (!frequency) return;

    const audioContext = getAudioContext();

    // If already playing, don't start again
    if (activeNotesRef.current.has(note)) return;

    // Create instrument note
    const { oscillators, gainNode, filterNode } = createInstrumentNote(
      audioContext,
      frequency,
      currentInstrument,
      true
    );

    // Start all oscillators
    oscillators.forEach(osc => osc.start());

    activeNotesRef.current.set(note, { oscillators, gainNode, filterNode });
  }, [getAudioContext, currentInstrument]);

  // Play/stop chord note by name (for on-screen piano)
  const playChordNote = useCallback((note: string, shouldStop: boolean) => {
    if (shouldStop) {
      stopNote(note);
      return;
    }

    startNote(note);
  }, [startNote, stopNote]);

  // Play a single MIDI note (momentary, with auto-release)
  const playMidiNote = useCallback((midiNote: number) => {
    const frequency = midiNoteToFrequency(midiNote);
    const audioContext = getAudioContext();
    
    const { oscillators, gainNode, filterNode } = createInstrumentNote(
      audioContext,
      frequency,
      currentInstrument,
      false
    );

    // Start all oscillators
    oscillators.forEach(osc => osc.start());

    // Auto-stop after instrument-specific time
    const stopTime = getInstrumentAutoStopTime(currentInstrument);
    setTimeout(() => {
      oscillators.forEach(osc => {
        try { osc.stop(); } catch {
          // Oscillator may already have stopped.
        }
      });
    }, stopTime * 1000);
  }, [getAudioContext, currentInstrument]);

  // Play/stop sustained MIDI note (for chord mode)
  const playMidiChordNote = useCallback((midiNote: number, shouldStop: boolean) => {
    const audioContext = getAudioContext();

    // If stopping, fade out and remove
    if (shouldStop) {
      const active = activeMidiNotesRef.current.get(midiNote);
      if (active) {
        const now = audioContext.currentTime;
        const releaseTime = getInstrumentReleaseTime(currentInstrument);
        
        active.gainNode.gain.cancelScheduledValues(now);
        active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
        active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
        
        active.oscillators.forEach(osc => {
          try { osc.stop(now + releaseTime); } catch {
            // Oscillator may already have stopped.
          }
        });
        activeMidiNotesRef.current.delete(midiNote);
      }
      return;
    }

    // If already playing, don't start again
    if (activeMidiNotesRef.current.has(midiNote)) return;

    // Calculate frequency from MIDI note
    const frequency = midiNoteToFrequency(midiNote);

    // Create instrument note
    const { oscillators, gainNode, filterNode } = createInstrumentNote(
      audioContext,
      frequency,
      currentInstrument,
      true
    );

    // Start all oscillators
    oscillators.forEach(osc => osc.start());
    
    activeMidiNotesRef.current.set(midiNote, { oscillators, gainNode, filterNode });
  }, [getAudioContext, currentInstrument]);

  const stopAllNotes = useCallback(() => {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    const releaseTime = getInstrumentReleaseTime(currentInstrument);

    // Stop on-screen piano notes
    activeNotesRef.current.forEach((active) => {
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
      active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
      active.oscillators.forEach(osc => {
        try { osc.stop(now + releaseTime); } catch {
          // Oscillator may already have stopped.
        }
      });
    });
    activeNotesRef.current.clear();

    // Stop MIDI notes
    activeMidiNotesRef.current.forEach((active) => {
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
      active.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
      active.oscillators.forEach(osc => {
        try { osc.stop(now + releaseTime); } catch {
          // Oscillator may already have stopped.
        }
      });
    });
    activeMidiNotesRef.current.clear();
  }, [getAudioContext, currentInstrument]);

  return { 
    playNote, 
    startNote,
    stopNote,
    playChordNote, 
    playMidiNote, 
    playMidiChordNote, 
    stopAllNotes,
    currentInstrument,
    setCurrentInstrument
  };
};
