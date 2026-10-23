import {
  createInstrumentNote,
  type InstrumentType,
} from "../utils/instrumentSynthesis.ts";
import type { SequenceTiming } from "./playbackPlan.ts";

export type SoundSettings = {
  waveform: OscillatorType;
  volume: number;
  cutoff: number;
  attack: number;
  release: number;
};
type Voice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  filter?: BiquadFilterNode;
  startAt: number;
  instrument?: InstrumentType;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices = new Set<Voice>();
  private generation = 0;
  private factory: () => AudioContext;

  constructor(factory: () => AudioContext = () => new AudioContext()) {
    this.factory = factory;
  }

  getAnalyser() {
    return this.analyser;
  }

  async play(
    frequencies: number[],
    settings: SoundSettings,
    strum = false,
    instrument?: InstrumentType,
    sequence?: SequenceTiming,
  ) {
    const generation = ++this.generation;
    if (!this.context) {
      this.context = this.factory();
      this.master = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 8192;
      this.analyser.smoothingTimeConstant = 0.72;
      this.master.connect(compressor);
      compressor.connect(this.analyser);
      this.analyser.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
    if (generation !== this.generation) return false;
    this.releaseVoices(0.025);
    this.master!.gain.setTargetAtTime(
      settings.volume,
      this.context.currentTime,
      0.015,
    );
    const context = this.context;
    frequencies.forEach((frequency, i) => {
      const startAt =
        context.currentTime +
        (sequence ? i * sequence.stepSeconds : strum ? i * 0.065 : 0);
      if (instrument) {
        const note = createInstrumentNote(
          context,
          frequency,
          instrument,
          true,
          this.master!,
          startAt,
        );
        const voice = {
          oscillators: note.oscillators,
          gain: note.gainNode,
          filter: note.filterNode,
          startAt,
          instrument,
        };
        this.voices.add(voice);
        let remaining = note.oscillators.length;
        note.oscillators.forEach((oscillator) => {
          oscillator.onended = () => {
            oscillator.disconnect();
            if (--remaining === 0) {
              note.gainNode.disconnect();
              note.filterNode?.disconnect();
              this.voices.delete(voice);
            }
          };
          oscillator.start(startAt);
          if (sequence)
            oscillator.stop(
              startAt + sequence.gateSeconds + sequence.releaseSeconds,
            );
        });
        if (sequence)
          note.gainNode.gain.setTargetAtTime(
            0,
            startAt + sequence.gateSeconds,
            sequence.releaseSeconds / 5,
          );
        return;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = settings.waveform;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      filter.type = "lowpass";
      filter.Q.value = 0.7;
      filter.frequency.value = settings.cutoff;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(
        sequence ? 0.55 : 0.7 / Math.max(1, frequencies.length),
        startAt +
          (sequence ? Math.min(settings.attack, 0.035) : settings.attack),
      );
      if (sequence)
        gain.gain.setTargetAtTime(
          0,
          startAt + sequence.gateSeconds,
          sequence.releaseSeconds / 5,
        );
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master!);
      const voice = { oscillators: [oscillator], gain, filter, startAt };
      this.voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        filter.disconnect();
        this.voices.delete(voice);
      };
      oscillator.start(startAt);
      if (sequence)
        oscillator.stop(
          startAt + sequence.gateSeconds + sequence.releaseSeconds,
        );
    });
    return true;
  }

  update(settings: SoundSettings) {
    if (!this.context) return;
    this.master!.gain.setTargetAtTime(
      settings.volume,
      this.context.currentTime,
      0.02,
    );
    this.voices.forEach((voice) => {
      // Instrument voices keep their own timbre; the common master controls volume.
      if (voice.instrument || !voice.filter) return;
      voice.oscillators[0].type = settings.waveform;
      voice.filter.frequency.setTargetAtTime(
        settings.cutoff,
        this.context!.currentTime,
        0.02,
      );
    });
  }

  stop(release = 0.12) {
    ++this.generation;
    this.releaseVoices(release);
  }

  private releaseVoices(release: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.voices.forEach((voice) => {
      const parameter = voice.gain.gain;
      if (voice.startAt > now) {
        parameter.cancelScheduledValues(now);
        parameter.setValueAtTime(0, now);
        voice.oscillators.forEach((oscillator) => oscillator.stop(now));
      } else {
        if (typeof parameter.cancelAndHoldAtTime === "function")
          parameter.cancelAndHoldAtTime(now);
        else {
          const value = parameter.value;
          parameter.cancelScheduledValues(now);
          parameter.setValueAtTime(value, now);
        }
        parameter.linearRampToValueAtTime(0, now + release);
        voice.oscillators.forEach((oscillator) =>
          oscillator.stop(now + release + 0.01),
        );
      }
    });
  }

  dispose() {
    this.stop(0);
    const context = this.context;
    this.context = null;
    this.master = null;
    this.analyser = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }
}
