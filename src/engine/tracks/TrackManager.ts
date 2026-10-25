import type { Track, TrackType } from "./Track";
import { SynthBackend } from "../instruments/SynthBackend";
import { SamplerBackend } from "../instruments/SamplerBackend";
import type { AudioEngine } from "../AudioEngine";
import type { Mixer } from "../Mixer";
import type { InstrumentType } from "@/utils/instrumentSynthesis";

interface TrackDef {
  name: string;
  type: TrackType;
  instrument: InstrumentType;
}

export const DEFAULT_TRACKS: TrackDef[] = [
  { name: "Drums", type: "drum", instrument: "bell" },
  { name: "Bass", type: "melodic", instrument: "strings" },
  { name: "Keys", type: "melodic", instrument: "epiano" },
  { name: "Pad", type: "melodic", instrument: "strings" },
  { name: "Lead", type: "melodic", instrument: "synth" },
];

export class TrackManager {
  readonly tracks: Track[];

  constructor(engine: AudioEngine, mixer: Mixer) {
    this.tracks = DEFAULT_TRACKS.map((def, i) => {
      // Track 0 (Drums) uses SamplerBackend for one-shot percussive sounds.
      // All other tracks use SynthBackend.
      const backend =
        i === 0
          ? new SamplerBackend(engine.audioContext)
          : new SynthBackend(engine.audioContext, def.instrument);
      backend.connect(mixer.getInputNode(i));

      return {
        id: i,
        name: def.name,
        type: def.type,
        instrumentType: def.instrument,
        backend,
        events: [],
        volume: 1.0,
        pan: 0,
        mute: false,
        solo: false,
        recordArm: i === 2, // Keys armed by default
      };
    });
  }

  getArmedTrack(): Track | null {
    return this.tracks.find((t) => t.recordArm) ?? null;
  }

  /** Arms exactly one track; disarms all others. */
  armTrack(trackId: number): void {
    this.tracks.forEach((t) => {
      t.recordArm = t.id === trackId;
    });
  }

  noteOn(
    trackId: number,
    midiNote: number,
    velocity: number,
    audioTime: number,
  ): void {
    this.tracks[trackId]?.backend.noteOn(midiNote, velocity, audioTime);
  }

  noteOff(trackId: number, midiNote: number, audioTime: number): void {
    this.tracks[trackId]?.backend.noteOff(midiNote, audioTime);
  }

  /** Only applies to melodic tracks (SynthBackend). Drums track is ignored. */
  setInstrument(trackId: number, instrument: InstrumentType): void {
    const track = this.tracks[trackId];
    if (!track || !(track.backend instanceof SynthBackend)) return;
    (track.backend as SynthBackend).setInstrument(instrument);
    track.instrumentType = instrument;
  }

  /** Load a WAV/MP3 sample for a specific drum note (track 0 only). */
  async loadDrumSample(midiNote: number, file: File): Promise<void> {
    const track = this.tracks[0];
    if (track?.backend instanceof SamplerBackend) {
      await track.backend.loadSampleFromFile(midiNote, file);
    }
  }

  stopAll(): void {
    this.tracks.forEach((t) => {
      t.backend.setParameter("sustain", 0);
      t.backend.setParameter("pitchBend", 0);
      for (let note = 0; note <= 127; note++) {
        t.backend.noteOff(note, 0);
      }
    });
  }
}
