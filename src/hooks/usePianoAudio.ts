import { useCallback, useRef } from 'react';

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

export const usePianoAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

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

  return { playNote };
};
