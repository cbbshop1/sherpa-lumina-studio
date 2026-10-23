import type { InstrumentType } from "../../utils/instrumentSynthesis.ts";
import type { InstrumentBackend } from "./InstrumentBackend";
import {
  createInstrumentNote,
  getInstrumentReleaseTime,
} from "../../utils/instrumentSynthesis.ts";

const midiToFreq = (midiNote: number): number =>
  440 * Math.pow(2, (midiNote - 69) / 12);

interface ActiveNote {
  oscillators: OscillatorNode[];
  /** Base frequency of each oscillator at noteOn time (before any pitch bend). */
  baseFrequencies: number[];
  gainNode: GainNode;
  velocityGain: GainNode;
  filterNode?: BiquadFilterNode;
}

/**
 * Wraps the existing instrumentSynthesis oscillator chains.
 *
 * Signal path per note:
 *   oscillators → note gainNode (ADSR) → velocityGain → outputGain → Mixer input
 *
 * Supported setParameter keys:
 *   'pitchBend'  — value in semitones (±2 for N-32 wheel range)
 *   'sustain'    — value 0–127; ≥64 activates sustain hold
 *   'volume'     — value 0–1
 */
export class SynthBackend implements InstrumentBackend {
  private _instrument: InstrumentType;
  private _outputGain: GainNode;
  private _activeNotes = new Map<number, ActiveNote>();

  // Pitch bend state
  private _pitchBendSemitones = 0;

  // Sustain pedal state
  private _isSustained = false;
  private _sustainedNotes = new Set<number>();

  get name(): string {
    return `Synth · ${this._instrument}`;
  }

  private readonly _audioContext: AudioContext;
  constructor(
    audioContext: AudioContext,
    instrument: InstrumentType = "piano",
  ) {
    this._audioContext = audioContext;
    this._instrument = instrument;
    this._outputGain = audioContext.createGain();
    this._outputGain.gain.value = 1;
  }

  // ─── InstrumentBackend ───────────────────────────────────────────────────

  noteOn(midiNote: number, velocity: number, audioTime: number): void {
    // Retrigger: kill any currently-playing note on this pitch first
    if (this._activeNotes.has(midiNote)) {
      this._release(
        midiNote,
        Math.max(audioTime, this._audioContext.currentTime),
      );
    }
    // Also remove from sustained set if re-pressed
    this._sustainedNotes.delete(midiNote);

    const safeTime = Math.max(audioTime, this._audioContext.currentTime);
    const frequency = midiToFreq(midiNote);

    // Per-note velocity gain sitting between the ADSR gain and our output
    const velocityGain = this._audioContext.createGain();
    velocityGain.gain.value = velocity / 127;
    velocityGain.connect(this._outputGain);

    const { oscillators, gainNode, filterNode } = createInstrumentNote(
      this._audioContext,
      frequency,
      this._instrument,
      true, // isSustained — SynthBackend owns the release
      velocityGain, // destination: route into velocity gain
      safeTime, // startTime: sample-accurate envelope scheduling
    );

    oscillators.forEach((osc) => osc.start(safeTime));

    // Capture base frequencies so pitch bend can modulate them correctly
    const baseFrequencies = oscillators.map((o) => o.frequency.value);

    // Apply any active pitch bend immediately to the new note
    if (this._pitchBendSemitones !== 0) {
      const ratio = Math.pow(2, this._pitchBendSemitones / 12);
      oscillators.forEach((osc, i) => {
        osc.frequency.setValueAtTime(baseFrequencies[i] * ratio, safeTime);
      });
    }

    this._activeNotes.set(midiNote, {
      oscillators,
      baseFrequencies,
      gainNode,
      velocityGain,
      filterNode,
    });
  }

  noteOff(midiNote: number, audioTime: number): void {
    // If sustain pedal is held, defer the release until pedal is lifted
    if (this._isSustained && this._activeNotes.has(midiNote)) {
      this._sustainedNotes.add(midiNote);
      return;
    }
    this._release(midiNote, audioTime);
  }

  setParameter(param: string, value: number): void {
    switch (param) {
      case "volume": {
        this._outputGain.gain.linearRampToValueAtTime(
          Math.max(0, Math.min(1, value)),
          this._audioContext.currentTime + 0.01,
        );
        break;
      }
      case "pitchBend": {
        this._pitchBendSemitones = value;
        const ratio = Math.pow(2, value / 12);
        const now = this._audioContext.currentTime;
        for (const note of this._activeNotes.values()) {
          note.oscillators.forEach((osc, i) => {
            osc.frequency.setValueAtTime(note.baseFrequencies[i] * ratio, now);
          });
        }
        break;
      }
      case "sustain": {
        this._isSustained = value >= 64;
        if (!this._isSustained) {
          // Release all notes that were held by the pedal
          const now = this._audioContext.currentTime;
          for (const note of this._sustainedNotes) {
            this._release(note, now);
          }
          this._sustainedNotes.clear();
        }
        break;
      }
    }
  }

  connect(destination: AudioNode): void {
    this._outputGain.disconnect();
    this._outputGain.connect(destination);
  }

  dispose(): void {
    const now = this._audioContext.currentTime;
    this._activeNotes.forEach((_, note) => this._release(note, now));
    this._activeNotes.clear();
    this._sustainedNotes.clear();
    this._outputGain.disconnect();
  }

  // ─── SynthBackend-specific ───────────────────────────────────────────────

  setInstrument(instrument: InstrumentType): void {
    const now = this._audioContext.currentTime;
    this._activeNotes.forEach((_, note) => this._release(note, now));
    this._sustainedNotes.clear();
    this._instrument = instrument;
  }

  getInstrument(): InstrumentType {
    return this._instrument;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _release(midiNote: number, audioTime: number): void {
    const active = this._activeNotes.get(midiNote);
    if (!active) return;

    const releaseTime = getInstrumentReleaseTime(this._instrument);
    const safeTime = Math.max(audioTime, this._audioContext.currentTime);
    const stopAt = safeTime + releaseTime;

    active.gainNode.gain.cancelScheduledValues(safeTime);
    active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, safeTime);
    active.gainNode.gain.linearRampToValueAtTime(0, stopAt);

    let remaining = active.oscillators.length;
    active.oscillators.forEach((osc) => {
      osc.onended = () => {
        osc.disconnect();
        if (--remaining === 0) {
          active.gainNode.disconnect();
          active.velocityGain.disconnect();
          active.filterNode?.disconnect();
        }
      };
      try {
        osc.stop(stopAt);
      } catch {
        /* already stopped */
      }
    });

    this._activeNotes.delete(midiNote);
  }
}
