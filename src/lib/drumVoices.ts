// Seven drum sounds made from scratch in the browser: no samples to download.
// Each one is a few oscillators or a burst of noise, shaped quickly.

import type { InstrumentId, Stress } from "./groove";

let noiseCache: WeakMap<BaseAudioContext, AudioBuffer> = new WeakMap();

function noise(ctx: BaseAudioContext) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

/** Forget cached noise, e.g. after an audio context is closed. */
export function resetDrumVoices() {
  noiseCache = new WeakMap();
}

function envelope(
  ctx: BaseAudioContext,
  when: number,
  peak: number,
  decay: number,
  attack = 0.001,
) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  return gain;
}

function noiseBurst(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  options: {
    peak: number;
    decay: number;
    type: BiquadFilterType;
    frequency: number;
    q?: number;
    attack?: number;
  },
) {
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.type;
  filter.frequency.value = options.frequency;
  filter.Q.value = options.q ?? 1;
  const gain = envelope(ctx, when, options.peak, options.decay, options.attack);
  source.connect(filter).connect(gain).connect(out);
  source.start(when, Math.random() * 0.5);
  source.stop(when + (options.attack ?? 0.001) + options.decay + 0.05);
  return source;
}

function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  options: {
    type: OscillatorType;
    from: number;
    to?: number;
    sweep?: number;
    peak: number;
    decay: number;
  },
) {
  const osc = ctx.createOscillator();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.from, when);
  if (options.to)
    osc.frequency.exponentialRampToValueAtTime(options.to, when + (options.sweep ?? 0.1));
  const gain = envelope(ctx, when, options.peak, options.decay);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + options.decay + 0.05);
  return osc;
}

/** Plays one hit. `level` is 0 to 1. Returns the sources, so they can be stopped. */
export function playDrum(
  ctx: BaseAudioContext,
  out: AudioNode,
  id: InstrumentId,
  when: number,
  level: number,
): AudioScheduledSourceNode[] {
  const v = Math.max(0.05, Math.min(1, level));
  switch (id) {
    case "kick":
      return [
        tone(ctx, out, when, { type: "sine", from: 150, to: 45, sweep: 0.12, peak: v, decay: 0.38 }),
        tone(ctx, out, when, { type: "triangle", from: 900, to: 120, sweep: 0.02, peak: v * 0.25, decay: 0.03 }),
      ];
    case "snare":
      return [
        noiseBurst(ctx, out, when, { peak: v * 0.7, decay: 0.18, type: "highpass", frequency: 1400 }),
        tone(ctx, out, when, { type: "triangle", from: 230, to: 170, sweep: 0.06, peak: v * 0.45, decay: 0.1 }),
      ];
    case "hat":
      return [
        noiseBurst(ctx, out, when, { peak: v * 0.35, decay: 0.045, type: "highpass", frequency: 7500 }),
      ];
    case "clap": {
      // A clap is several hands landing a hair apart, then a short room tail.
      const parts = [0, 0.011, 0.022].map((offset) =>
        noiseBurst(ctx, out, when + offset, { peak: v * 0.55, decay: 0.012, type: "bandpass", frequency: 1200, q: 0.9 }),
      );
      parts.push(
        noiseBurst(ctx, out, when + 0.03, { peak: v * 0.45, decay: 0.16, type: "bandpass", frequency: 1100, q: 0.8 }),
      );
      return parts;
    }
    case "rim":
      return [
        tone(ctx, out, when, { type: "triangle", from: 2500, peak: v * 0.5, decay: 0.035 }),
        tone(ctx, out, when, { type: "sine", from: 1700, peak: v * 0.3, decay: 0.05 }),
      ];
    case "shaker":
      return [
        noiseBurst(ctx, out, when, { peak: v * 0.22, decay: 0.06, type: "bandpass", frequency: 6000, q: 1.2, attack: 0.012 }),
      ];
    case "cowbell": {
      // Two square waves a little apart, through a narrow filter: the classic bell.
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2640;
      filter.Q.value = 1;
      filter.connect(out);
      return [
        tone(ctx, filter, when, { type: "square", from: 587, peak: v * 0.5, decay: 0.28 }),
        tone(ctx, filter, when, { type: "square", from: 845, peak: v * 0.5, decay: 0.28 }),
      ];
    }
  }
}

/** A soft wood-block tick that says the stress out loud, for hearing the meter. */
export function playPulse(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  stress: Stress,
): AudioScheduledSourceNode[] {
  const pitch = { strong: 1900, medium: 1500, light: 1150 }[stress];
  const level = { strong: 0.4, medium: 0.26, light: 0.15 }[stress];
  return [tone(ctx, out, when, { type: "sine", from: pitch, peak: level, decay: 0.05 })];
}
