/**
 * Common interface for all instrument backends (Synth, SoundFont, Sampler).
 * One instance per DAW track.
 */
export interface InstrumentBackend {
  readonly name: string;

  /**
   * Trigger a note-on event, sample-accurately scheduled at `audioTime`.
   * For live/immediate play, pass `audioContext.currentTime`.
   */
  noteOn(midiNote: number, velocity: number, audioTime: number): void;

  /**
   * Trigger a note-off event at `audioTime`.
   * Implementations must apply the instrument's release envelope.
   */
  noteOff(midiNote: number, audioTime: number): void;

  /** Generic parameter setter (e.g. filter cutoff, reverb amount). */
  setParameter(param: string, value: number): void;

  /** Wire the backend's output into the mixer chain. */
  connect(destination: AudioNode): void;

  /** Stop all notes and disconnect audio nodes. */
  dispose(): void;
}
