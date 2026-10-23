import { SynthBackend } from "../engine/instruments/SynthBackend.ts";
import type { InstrumentType } from "../utils/instrumentSynthesis.ts";

export interface MidiTarget {
  noteOn(note: number, velocity: number): void | Promise<void>;
  noteOff(note: number): void;
  parameter(name: string, value: number): void;
  stop(): void;
}

/** Live voices are independent of lesson previews. A released pending note never starts late. */
export class LiveMidiEngine implements MidiTarget {
  private context: AudioContext | null = null;
  private synth: SynthBackend | null = null;
  private tickets = new Map<number, object>();
  private instrument: InstrumentType = "piano";
  private volume = 0.3;
  private bend = 0;
  private sustain = 0;
  private factory: () => AudioContext;
  constructor(factory: () => AudioContext = () => new AudioContext()) {
    this.factory = factory;
  }
  private ensure() {
    if (!this.context) {
      this.context = this.factory();
      this.synth = new SynthBackend(this.context, this.instrument);
      const limiter = this.context.createDynamicsCompressor();
      this.synth.connect(limiter);
      limiter.connect(this.context.destination);
      this.synth.setParameter("volume", this.volume);
      this.synth.setParameter("pitchBend", this.bend);
      this.synth.setParameter("sustain", this.sustain);
    }
    return this.context;
  }
  async unlock() {
    const context = this.ensure();
    if (context.state === "suspended") await context.resume();
  }
  async noteOn(note: number, velocity: number) {
    if (!Number.isInteger(note) || note < 0 || note > 127) return;
    const ticket = {};
    this.tickets.set(note, ticket);
    try {
      await this.unlock();
    } catch (error) {
      this.tickets.delete(note);
      throw error;
    }
    if (this.tickets.get(note) !== ticket || !this.context) return;
    this.synth!.noteOn(note, velocity, this.context.currentTime);
  }
  noteOff(note: number) {
    this.tickets.delete(note);
    if (this.context) this.synth?.noteOff(note, this.context.currentTime);
  }
  parameter(name: string, value: number) {
    if (name === "volume") this.volume = value;
    if (name === "pitchBend") this.bend = value;
    if (name === "sustain") this.sustain = value;
    this.synth?.setParameter(name, value);
  }
  setInstrument(instrument: InstrumentType) {
    if (instrument === this.instrument) return;
    this.stop();
    this.instrument = instrument;
    this.synth?.setInstrument(instrument);
  }
  stop() {
    this.tickets.clear();
    this.sustain = 0;
    this.bend = 0;
    this.synth?.setParameter("sustain", 0);
    this.synth?.setParameter("pitchBend", 0);
    if (this.context)
      for (let note = 0; note <= 127; note++)
        this.synth?.noteOff(note, this.context.currentTime);
  }
  dispose() {
    this.stop();
    this.synth?.dispose();
    this.synth = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }
}

/** Note-off always reaches the owner that received note-on, including after a target change. */
export class MidiRouter {
  private fallback: MidiTarget;
  private target: MidiTarget;
  private owners = new Map<number, MidiTarget>();
  constructor(fallback: MidiTarget) {
    this.fallback = fallback;
    this.target = fallback;
  }
  async noteOn(note: number, velocity: number) {
    this.owners.get(note)?.noteOff(note);
    const owner = this.target;
    this.owners.set(note, owner);
    await owner.noteOn(note, velocity);
  }
  noteOff(note: number) {
    this.owners.get(note)?.noteOff(note);
    this.owners.delete(note);
  }
  parameter(name: string, value: number) {
    this.target.parameter(name, value);
  }
  stop() {
    new Set([this.fallback, this.target, ...this.owners.values()]).forEach(
      (owner) => owner.stop(),
    );
    this.owners.clear();
  }
  register(target: MidiTarget) {
    this.stop();
    this.target = target;
    return () => {
      if (this.target === target) {
        this.stop();
        this.target = this.fallback;
      }
    };
  }
}

export function decodeMidi(data: Uint8Array | readonly number[]) {
  const command = data[0] & 0xf0;
  if (data.length < 3) return null;
  if (command === 0x90 && data[2] > 0)
    return { type: "on" as const, note: data[1], velocity: data[2] };
  if (command === 0x80 || (command === 0x90 && data[2] === 0))
    return { type: "off" as const, note: data[1] };
  if (command === 0xe0)
    return {
      type: "bend" as const,
      value: ((((data[2] << 7) | data[1]) - 8192) / 8192) * 2,
    };
  if (command === 0xb0)
    return { type: "cc" as const, number: data[1], value: data[2] };
  return null;
}
