// Plays a groove against the audio clock, a little ahead of time, so it never
// drifts or stutters. Used by the Rhythm room (looping forever, with live
// edits) and by the four-track (under a song, from any point).

import { playDrum, playPulse } from "./drumVoices";
import {
  INSTRUMENTS,
  hitGain,
  loopSeconds,
  stepStress,
  stepTime,
  totalSteps,
  type Groove,
} from "./groove";

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

export type GrooveVoices = {
  /** Drum hits from the pattern. */
  pattern: boolean;
  /** Ticks on every pulse, shaped by its stress. */
  pulses: boolean;
};

export class GrooveScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private next = 0;
  private shape = "";

  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
    /** Read on every tick, so edits are heard straight away. */
    private groove: () => Groove,
    /** Audio-clock time at which song time 0 of the groove sounds. */
    private zeroTime: number,
    private voices: () => GrooveVoices,
    /** Song time to stop at (Infinity loops forever). */
    private endSec = Infinity,
  ) {}

  /** The number of the first step at or after song time `fromSec`. */
  private stepAt(fromSec: number, groove: Groove) {
    const steps = totalSteps(groove);
    const loop = loopSeconds(groove);
    const base = Math.floor(fromSec / loop);
    for (let s = 0; s < steps; s++)
      if (base * loop + stepTime(s, groove) >= fromSec - 1e-6) return base * steps + s;
    return (base + 1) * steps;
  }

  private timeOf(n: number, groove: Groove) {
    const steps = totalSteps(groove);
    return Math.floor(n / steps) * loopSeconds(groove) + stepTime(n % steps, groove);
  }

  start(fromSec = 0) {
    this.stop();
    const groove = this.groove();
    this.shape = shapeKey(groove);
    this.next = this.stepAt(fromSec, groove);
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    let groove = this.groove();
    const shape = shapeKey(groove);
    if (shape !== this.shape) {
      // The meter or tempo changed while playing: carry on from where we are.
      const songNow = this.ctx.currentTime - this.zeroTime;
      this.shape = shape;
      this.next = this.stepAt(Math.max(0, songNow), groove);
    }
    const steps = totalSteps(groove);
    const voices = this.voices();
    for (;;) {
      const songTime = this.timeOf(this.next, groove);
      if (songTime >= this.endSec) return this.stop(false);
      const when = this.zeroTime + songTime;
      if (when > this.ctx.currentTime + LOOKAHEAD) break;
      if (when >= this.ctx.currentTime - 0.01) {
        const step = this.next % steps;
        const stress = stepStress(step, groove.meter);
        if (voices.pulses && stress !== "off")
          this.sources.push(...playPulse(this.ctx, this.out, when, stress));
        if (voices.pattern)
          for (const { id } of INSTRUMENTS) {
            const cell = groove.pattern[id][step];
            if (cell) this.sources.push(...playDrum(this.ctx, this.out, id, when, hitGain(cell, stress)));
          }
      }
      this.next++;
      groove = this.groove();
    }
    // Let finished sounds go so the list doesn't grow forever.
    if (this.sources.length > 400) this.sources = this.sources.slice(-200);
  }

  stop(silence = true) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (silence) {
      for (const source of this.sources) {
        try {
          source.stop();
        } catch {
          // Already finished.
        }
      }
      this.sources = [];
    }
  }
}

const shapeKey = (groove: Groove) =>
  `${groove.meter.top}/${groove.meter.subdivision}/${groove.bars}/${groove.tempo}/${groove.lean}`;
