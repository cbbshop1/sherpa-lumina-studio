import type { InstrumentBackend } from '../instruments/InstrumentBackend';
import type { InstrumentType } from '@/utils/instrumentSynthesis';

export type TrackType = 'melodic' | 'drum';

/** A single MIDI note event stored in a pattern. */
export interface NoteEvent {
  id: string;
  midiNote: number;
  velocity: number;
  /** Beat position within the pattern (0 = first beat). */
  startBeat: number;
  durationBeats: number;
}

/** Runtime track object — holds both audio state and MIDI event data. */
export interface Track {
  id: number;
  name: string;
  type: TrackType;
  instrumentType: InstrumentType;
  backend: InstrumentBackend;
  events: NoteEvent[];
  volume: number;     // 0 – 1
  pan: number;        // -1 … 1
  mute: boolean;
  solo: boolean;
  recordArm: boolean;
}
