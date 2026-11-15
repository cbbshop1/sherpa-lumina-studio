// Plays a chart's four parts with plain, steady tones, so the tuning of each
// chord is easy to hear. Notes are handed to the browser a moment ahead of
// time, which keeps a long chart light.
import type { Chart } from "./musicxml.ts";

export type PlayNote = { midi: number; start: number; length: number; part: number };

/** Every sounding note with its start in quarter notes from the top; ties become one long note. */
export function chartNotes(chart: Chart): PlayNote[] {
  const notes: PlayNote[] = [];
  for (let part = 0; part < 4; part++) {
    let time = 0;
    let held: PlayNote | null = null;
    for (const bar of chart.bars) {
      for (const note of bar.parts[part]) {
        if (note.midi === null) {
          held = null;
          continue;
        }
        if (held && note.tieStop && held.midi === note.midi) held.length = time + note.at + note.length - held.start;
        else {
          held = { midi: note.midi, start: time + note.at, length: note.length, part };
          notes.push(held);
        }
        if (!note.tieStart) held = null;
      }
      time += bar.length;
    }
  }
  return notes.sort((a, b) => a.start - b.start);
}

export class ChartPlayer {
  private context: AudioContext | null = null;
  private gains: GainNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private live = new Set<OscillatorNode>();
  private startedAt = 0;
  private from = 0;
  private perQuarter = 0.5;
  private levels = [1, 1, 1, 1];
  playing = false;

  /** Where the music is, in quarter notes from the top. */
  position() {
    if (!this.playing || !this.context) return this.from;
    return this.from + (this.context.currentTime - this.startedAt) / this.perQuarter;
  }

  setLevel(part: number, level: number) {
    this.levels[part] = level;
    this.gains[part]?.gain.setTargetAtTime(level, this.context!.currentTime, 0.02);
  }

  async play(notes: PlayNote[], bpm: number, from: number, end: number, onEnd: () => void) {
    this.stop();
    if (!this.context) {
      this.context = new AudioContext();
      const master = this.context.createGain();
      master.gain.value = 0.2;
      const squeeze = this.context.createDynamicsCompressor();
      master.connect(squeeze);
      squeeze.connect(this.context.destination);
      this.gains = this.levels.map((level) => {
        const gain = this.context!.createGain();
        gain.gain.value = level;
        gain.connect(master);
        return gain;
      });
    }
    if (this.context.state === "suspended") await this.context.resume();
    const context = this.context;
    this.perQuarter = 60 / bpm;
    this.from = from;
    this.startedAt = context.currentTime + 0.08;
    this.playing = true;
    let next = notes.findIndex((note) => note.start >= from - 1e-6);
    if (next < 0) next = notes.length;
    const pump = () => {
      const horizon = this.position() + 0.5 / this.perQuarter;
      while (next < notes.length && notes[next].start < horizon) {
        const note = notes[next++];
        const at = this.startedAt + (note.start - from) * this.perQuarter;
        const length = Math.max(0.08, note.length * this.perQuarter - 0.03);
        const voice = context.createGain();
        voice.connect(this.gains[note.part]);
        voice.gain.setValueAtTime(0, at);
        voice.gain.linearRampToValueAtTime(0.5, at + 0.03);
        voice.gain.setValueAtTime(0.5, at + length);
        voice.gain.linearRampToValueAtTime(0, at + length + 0.06);
        const frequency = 440 * 2 ** ((note.midi - 69) / 12);
        for (const [type, multiple, level] of [
          ["triangle", 1, 1],
          ["sine", 2, 0.25],
        ] as const) {
          const tone = context.createOscillator();
          const amount = context.createGain();
          tone.type = type;
          tone.frequency.value = frequency * multiple;
          amount.gain.value = level;
          tone.connect(amount);
          amount.connect(voice);
          tone.start(at);
          tone.stop(at + length + 0.08);
          this.live.add(tone);
          tone.onended = () => {
            this.live.delete(tone);
            tone.disconnect();
            amount.disconnect();
          };
        }
      }
      if (this.position() >= end) {
        this.stop();
        onEnd();
      }
    };
    pump();
    this.timer = setInterval(pump, 100);
  }

  stop() {
    if (this.playing) this.from = this.position();
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const tone of this.live) {
      try {
        tone.stop();
      } catch {
        // Already finished.
      }
    }
    this.live.clear();
  }

  seek(time: number) {
    this.from = time;
  }

  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
