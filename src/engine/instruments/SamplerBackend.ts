import type { InstrumentBackend } from './InstrumentBackend';

/**
 * One-shot sample player for percussion.
 *
 * Signal path per hit:
 *   BufferSourceNode → velocityGain → _outputGain → Mixer input
 *
 * Falls back to procedural synthesis when no sample is loaded for a note.
 */
export class SamplerBackend implements InstrumentBackend {
  private _buffers     = new Map<number, AudioBuffer>();
  private _sampleNames = new Map<number, string>();
  private _outputGain: GainNode;

  get name(): string { return 'Sampler'; }

  constructor(private readonly _ctx: AudioContext) {
    this._outputGain = _ctx.createGain();
    this._outputGain.gain.value = 1.0;
  }

  // ─── InstrumentBackend ────────────────────────────────────────────────────

  noteOn(midiNote: number, velocity: number, audioTime: number): void {
    const safeTime = Math.max(audioTime, this._ctx.currentTime);
    const velGain  = this._ctx.createGain();
    velGain.gain.value = velocity / 127;
    velGain.connect(this._outputGain);

    const buf = this._buffers.get(midiNote);
    if (buf) {
      this._playBuffer(buf, velGain, safeTime);
    } else {
      this._playFallback(midiNote, velGain, safeTime);
    }
  }

  /** No-op — one-shots stop naturally when the buffer ends. */
  noteOff(_midiNote: number, _audioTime: number): void {}

  setParameter(_param: string, _value: number): void {}

  connect(destination: AudioNode): void {
    this._outputGain.disconnect();
    this._outputGain.connect(destination);
  }

  dispose(): void {
    this._outputGain.disconnect();
  }

  // ─── Sample loading ───────────────────────────────────────────────────────

  /** Decode a File and store as an AudioBuffer for the given MIDI note. */
  async loadSampleFromFile(midiNote: number, file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
    this._buffers.set(midiNote, audioBuffer);
    this._sampleNames.set(midiNote, file.name);
  }

  /** Returns the loaded filename, or 'Built-in' if using procedural fallback. */
  getSampleName(midiNote: number): string {
    return this._sampleNames.get(midiNote) ?? 'Built-in';
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _playBuffer(buf: AudioBuffer, destination: AudioNode, when: number): void {
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    src.connect(destination);
    src.start(when);
    // Auto-disconnect velocity gain once the buffer finishes
    src.onended = () => { try { destination.disconnect(); } catch { /* ok */ } };
  }

  /**
   * Procedural drum sounds — used when no sample has been loaded.
   * Each sound matches the standard GM drum map entry for that note.
   */
  private _playFallback(midiNote: number, destination: AudioNode, when: number): void {
    switch (midiNote) {
      case 36: this._kick(destination, when);   break;
      case 38: this._snare(destination, when);  break;
      case 39: this._clap(destination, when);   break;
      case 42: this._hihat(destination, when, 0.06);  break;
      case 46: this._hihat(destination, when, 0.35);  break;
      case 47: this._tom(destination, when, 100, 60, 0.35); break;
      case 50: this._tom(destination, when, 140, 80, 0.30); break;
      case 51: this._ride(destination, when);   break;
      default: this._hihat(destination, when, 0.08);  break;
    }
  }

  // ── Kick ──────────────────────────────────────────────────────────────────

  private _kick(dest: AudioNode, when: number): void {
    const dur = 0.45;

    // Sub body — sine with pitch drop
    const osc = this._ctx.createOscillator();
    const env = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.4);
    env.gain.setValueAtTime(1.0, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(when);
    osc.stop(when + dur);

    // Attack click — short noise burst
    const click = this._noiseSource(0.02);
    const clickEnv = this._ctx.createGain();
    clickEnv.gain.setValueAtTime(0.8, when);
    clickEnv.gain.exponentialRampToValueAtTime(0.001, when + 0.02);
    click.connect(clickEnv);
    clickEnv.connect(dest);
    click.start(when);
    click.stop(when + 0.02);

    this._autoDisconnect(dest, when + dur);
  }

  // ── Snare ─────────────────────────────────────────────────────────────────

  private _snare(dest: AudioNode, when: number): void {
    const dur = 0.22;

    // Noise component — filtered
    const noise = this._noiseSource(dur);
    const hpf   = this._ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1500;
    const noiseEnv = this._ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.8, when);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, when + dur);
    noise.connect(hpf);
    hpf.connect(noiseEnv);
    noiseEnv.connect(dest);
    noise.start(when);
    noise.stop(when + dur);

    // Body tone
    const osc = this._ctx.createOscillator();
    const env = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 180;
    env.gain.setValueAtTime(0.5, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    osc.connect(env);
    env.connect(dest);
    osc.start(when);
    osc.stop(when + 0.12);

    this._autoDisconnect(dest, when + dur);
  }

  // ── Clap ──────────────────────────────────────────────────────────────────

  private _clap(dest: AudioNode, when: number): void {
    // Three short noise bursts with slight gaps — classic clap texture
    const offsets = [0, 0.01, 0.022];
    offsets.forEach(offset => {
      const dur   = 0.04;
      const noise = this._noiseSource(dur);
      const hpf   = this._ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 1200;
      const env = this._ctx.createGain();
      env.gain.setValueAtTime(0.9, when + offset);
      env.gain.exponentialRampToValueAtTime(0.001, when + offset + dur);
      noise.connect(hpf);
      hpf.connect(env);
      env.connect(dest);
      noise.start(when + offset);
      noise.stop(when + offset + dur);
    });

    this._autoDisconnect(dest, when + 0.18);
  }

  // ── Hi-hat (closed or open depending on decay) ────────────────────────────

  private _hihat(dest: AudioNode, when: number, decay: number): void {
    const noise = this._noiseSource(decay + 0.01);
    const hpf   = this._ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 7000;
    const env = this._ctx.createGain();
    env.gain.setValueAtTime(0.7, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + decay);
    noise.connect(hpf);
    hpf.connect(env);
    env.connect(dest);
    noise.start(when);
    noise.stop(when + decay + 0.01);

    this._autoDisconnect(dest, when + decay + 0.02);
  }

  // ── Tom ───────────────────────────────────────────────────────────────────

  private _tom(dest: AudioNode, when: number, freqStart: number, freqEnd: number, dur: number): void {
    const osc = this._ctx.createOscillator();
    const env = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, when);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, when + dur * 0.8);
    env.gain.setValueAtTime(1.0, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(when);
    osc.stop(when + dur);

    this._autoDisconnect(dest, when + dur);
  }

  // ── Ride ──────────────────────────────────────────────────────────────────

  private _ride(dest: AudioNode, when: number): void {
    const dur   = 0.55;
    const noise = this._noiseSource(dur);
    const hpf   = this._ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 6000;
    const peak  = this._ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 9000;
    peak.gain.value = 8;
    peak.Q.value = 2;
    const env = this._ctx.createGain();
    env.gain.setValueAtTime(0.6, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    noise.connect(hpf);
    hpf.connect(peak);
    peak.connect(env);
    env.connect(dest);
    noise.start(when);
    noise.stop(when + dur);

    this._autoDisconnect(dest, when + dur + 0.02);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Create an AudioBufferSourceNode containing white noise. */
  private _noiseSource(durationSeconds: number): AudioBufferSourceNode {
    const sampleRate  = this._ctx.sampleRate;
    const frameCount  = Math.ceil(sampleRate * durationSeconds);
    const buf         = this._ctx.createBuffer(1, frameCount, sampleRate);
    const data        = buf.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /**
   * Disconnect the velocity GainNode after the sound finishes so it can
   * be garbage-collected. We use a silent OscillatorNode as a timer because
   * setTimeout isn't sample-accurate (and is fine here since it's just cleanup).
   */
  private _autoDisconnect(dest: AudioNode, when: number): void {
    const delay = Math.max(0, (when - this._ctx.currentTime) * 1000 + 50);
    setTimeout(() => {
      try { dest.disconnect(); } catch { /* already disconnected */ }
    }, delay);
  }
}
