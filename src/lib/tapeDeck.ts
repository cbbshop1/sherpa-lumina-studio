// The four-track's sound: playback, the click, overdub recording, and effects.
// One AudioContext is shared by everything so recording lines up with the
// tracks the singer is hearing.

import {
  echoSettings,
  effectiveStart,
  placeTake,
  renderLength,
  reverbSettings,
  roomImpulse,
  type TimeGrid,
} from "./fourTrack";
import type { Groove, Stress } from "./groove";
import { playPulse } from "./drumVoices";
import { GrooveScheduler } from "./grooveScheduler";

export type DeckTrack = {
  buffer: AudioBuffer | null;
  startSec: number;
  nudgeMs: number;
  volume: number;
  pan: number;
  audible: boolean;
};

export type CapturedTake = {
  buffer: AudioBuffer;
  startSec: number;
};

const CAPTURE_WORKLET = `
class LuminaCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage({ frame: currentFrame, data: channel.slice(0) });
    return true;
  }
}
registerProcessor("lumina-capture", LuminaCapture);
`;

type Recording = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  sink: GainNode;
  chunks: { frame: number; data: Float32Array }[];
  songZeroFrame: number;
  fromSec: number;
  songLengthSec: number;
};

export class TapeDeck {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: AudioScheduledSourceNode[] = [];
  private recording: Recording | null = null;
  private workletReady: Promise<void> | null = null;
  /** Audio-clock time at which song time `fromSec` sounds. */
  private songZeroTime = 0;
  private fromSec = 0;
  private groove: GrooveScheduler | null = null;
  running = false;

  get ctx() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  /** Current song time, or null when the tape isn't moving. */
  position() {
    if (!this.running || !this.context) return null;
    return this.fromSec + (this.context.currentTime - this.songZeroTime);
  }

  /** True while the count-in is still clicking. */
  countingIn() {
    return !!this.context && this.running && this.context.currentTime < this.songZeroTime;
  }

  private click(when: number, stress: Stress) {
    this.voices.push(...playPulse(this.ctx, this.master!, when, stress));
  }

  /** The click on every pulse, with the meter's stresses, plus the count-in. */
  private scheduleClicks(fromSec: number, toSec: number, grid: TimeGrid, countIn: boolean) {
    const beat = grid.pulseSec;
    const stress = (n: number) => grid.stresses[n % grid.pulsesPerBar] ?? "light";
    if (countIn)
      for (let i = 0; i < grid.pulsesPerBar; i++)
        this.click(this.songZeroTime - (grid.pulsesPerBar - i) * beat, stress(i));
    if (toSec <= fromSec) return;
    const first = Math.ceil(fromSec / beat - 1e-6);
    for (let n = first; n * beat < toSec; n++)
      this.click(this.songZeroTime + (n * beat - fromSec), stress(n));
  }

  private scheduleTracks(tracks: DeckTrack[], fromSec: number, toSec: number) {
    const ctx = this.ctx;
    for (const track of tracks) {
      if (!track.buffer || !track.audible) continue;
      const start = effectiveStart(track);
      const end = Math.min(start + track.buffer.duration, toSec);
      if (end <= fromSec) continue;
      const source = ctx.createBufferSource();
      source.buffer = track.buffer;
      const gain = ctx.createGain();
      gain.gain.value = track.volume;
      const pan = ctx.createStereoPanner();
      pan.pan.value = track.pan;
      source.connect(gain).connect(pan).connect(this.master!);
      const offset = Math.max(0, fromSec - start);
      const when = this.songZeroTime + Math.max(0, start - fromSec);
      source.start(when, offset, end - Math.max(start, fromSec));
      this.voices.push(source);
    }
  }

  async play(options: {
    tracks: DeckTrack[];
    fromSec: number;
    toSec: number;
    grid: TimeGrid;
    click: boolean;
    countIn?: boolean;
    /** Drums from the rhythm room, played under the tape. */
    groove?: Groove | null;
  }) {
    this.stopSound();
    const ctx = this.ctx;
    await ctx.resume();
    const { grid } = options;
    const lead = options.countIn ? grid.pulsesPerBar * grid.pulseSec : 0;
    this.fromSec = options.fromSec;
    this.songZeroTime = ctx.currentTime + 0.12 + lead;
    if (options.click || options.countIn)
      this.scheduleClicks(
        options.fromSec,
        options.click ? options.toSec : options.fromSec,
        grid,
        !!options.countIn,
      );
    if (options.groove) {
      // The groove loops from the top of the song, at the song's tempo.
      const groove = { ...options.groove, tempo: 60 / grid.pulseSec };
      this.groove = new GrooveScheduler(
        ctx,
        this.master!,
        () => groove,
        this.songZeroTime - options.fromSec,
        () => ({ pattern: true, pulses: false }),
        options.toSec,
      );
      this.groove.start(options.fromSec);
    }
    this.scheduleTracks(options.tracks, options.fromSec, options.toSec);
    this.running = true;
  }

  private loadWorklet() {
    if (!this.workletReady) {
      const url = URL.createObjectURL(
        new Blob([CAPTURE_WORKLET], { type: "application/javascript" }),
      );
      this.workletReady = this.ctx.audioWorklet
        .addModule(url)
        .finally(() => URL.revokeObjectURL(url));
    }
    return this.workletReady;
  }

  /** Asks for the microphone, then counts in and records over the other tracks. */
  async record(options: {
    tracks: DeckTrack[];
    fromSec: number;
    songLengthSec: number;
    grid: TimeGrid;
    click: boolean;
    countIn: boolean;
    groove?: Groove | null;
  }) {
    this.stop();
    const ctx = this.ctx;
    await ctx.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    try {
      await this.loadWorklet();
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "lumina-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
    });
    // The microphone is never sent to the speakers, only into the capture.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(node).connect(sink).connect(ctx.destination);
    const recording: Recording = {
      stream,
      source,
      node,
      sink,
      chunks: [],
      songZeroFrame: 0,
      fromSec: options.fromSec,
      songLengthSec: options.songLengthSec,
    };
    node.port.onmessage = (event) => recording.chunks.push(event.data);
    this.recording = recording;
    await this.play({
      tracks: options.tracks,
      fromSec: options.fromSec,
      toSec: options.songLengthSec,
      grid: options.grid,
      click: options.click,
      countIn: options.countIn,
      groove: options.groove,
    });
    recording.songZeroFrame = Math.round(this.songZeroTime * ctx.sampleRate);
  }

  get isRecording() {
    return !!this.recording;
  }

  private stopSound() {
    this.groove?.stop();
    this.groove = null;
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        // Already finished.
      }
      voice.disconnect();
    }
    this.voices = [];
    this.running = false;
  }

  /** Stops the tape. If it was recording, returns the new take. */
  stop(): CapturedTake | null {
    const recording = this.recording;
    this.recording = null;
    this.stopSound();
    if (!recording || !this.context) return null;
    recording.node.port.onmessage = null;
    recording.source.disconnect();
    recording.node.disconnect();
    recording.sink.disconnect();
    recording.stream.getTracks().forEach((track) => track.stop());
    const { chunks } = recording;
    if (!chunks.length) return null;
    const total = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const ctx = this.context;
    // How late the voice arrives compared with what the singer heard.
    const latencySec = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    const { skip, keep, startSec } = placeTake({
      firstFrame: chunks[0].frame,
      songZeroFrame: recording.songZeroFrame,
      sampleRate: ctx.sampleRate,
      fromSec: recording.fromSec,
      latencySec,
      length: total,
      songLengthSec: recording.songLengthSec,
    });
    if (keep < ctx.sampleRate * 0.1) return null;
    const buffer = ctx.createBuffer(1, keep, ctx.sampleRate);
    const out = buffer.getChannelData(0);
    let read = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.data.length; i++, read++) {
        const at = read - skip;
        if (at >= 0 && at < keep) out[at] = chunk.data[i];
      }
    }
    return { buffer, startSec };
  }

  dispose() {
    this.stop();
    const ctx = this.context;
    this.context = null;
    this.master = null;
    this.workletReady = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  }
}

/**
 * Prints reverb and echo into a copy of the take, so the change shows in the
 * waveform. The original is kept separately, so effects can always be undone.
 */
export async function renderEffects(
  original: AudioBuffer,
  reverb: number,
  echo: number,
  bpm: number,
  maxSeconds: number,
) {
  if (reverb <= 0 && echo <= 0) return original;
  const rate = original.sampleRate;
  const seconds = Math.min(
    renderLength(original.duration, reverb, echo, bpm),
    Math.max(original.duration, maxSeconds),
  );
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const source = ctx.createBufferSource();
  source.buffer = original;
  const dry = ctx.createGain();
  dry.gain.value = reverb > 0 ? reverbSettings(reverb).dry : 1;
  source.connect(dry).connect(ctx.destination);
  if (reverb > 0) {
    const room = reverbSettings(reverb);
    const impulse = ctx.createBuffer(1, Math.round(room.seconds * rate), rate);
    impulse.copyToChannel(roomImpulse(impulse.length), 0);
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = room.wet;
    source.connect(convolver).connect(wet).connect(ctx.destination);
  }
  if (echo > 0) {
    const settings = echoSettings(echo, bpm);
    const delay = ctx.createDelay(4);
    delay.delayTime.value = settings.delaySec;
    const feedback = ctx.createGain();
    feedback.gain.value = settings.feedback;
    const wet = ctx.createGain();
    wet.gain.value = settings.wet;
    source.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
  }
  source.start();
  const rendered = await ctx.startRendering();
  // Keep the loudest moment just under full scale so nothing distorts.
  const data = rendered.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0.98) for (let i = 0; i < data.length; i++) data[i] *= 0.98 / peak;
  return rendered;
}
