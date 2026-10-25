export type PlayState = 'stopped' | 'playing' | 'recording';

export interface TransportSnapshot {
  bpm: number;
  playState: PlayState;
  currentBeat: number;
}

type TransportListener = (changes: Partial<TransportSnapshot>) => void;

/**
 * The transport clock.
 *
 * Uses a 25 ms setInterval loop + AudioContext.currentTime look-ahead so that
 * note events can be scheduled sample-accurately on the audio thread.
 */
export class Transport {
  private _bpm = 120;
  private _playState: PlayState = 'stopped';
  private _currentBeat = 0;

  private _startAudioTime = 0;
  private _startBeat = 0;
  private _loopHandle: ReturnType<typeof setInterval> | null = null;
  private _listeners = new Set<TransportListener>();

  /** 100 ms look-ahead window fed to the Scheduler each tick. */
  readonly SCHEDULE_AHEAD_TIME = 0.1;
  private readonly TICK_INTERVAL_MS = 25;

  constructor(private readonly audioContext: AudioContext) {}

  // ─── Getters ────────────────────────────────────────────────────────────

  get bpm(): number { return this._bpm; }
  get playState(): PlayState { return this._playState; }
  get currentBeat(): number { return this._currentBeat; }
  get secondsPerBeat(): number { return 60 / this._bpm; }
  get startAudioTime(): number { return this._startAudioTime; }
  get startBeat(): number { return this._startBeat; }

  // ─── Commands ───────────────────────────────────────────────────────────

  setBpm(bpm: number): void {
    this._bpm = Math.max(20, Math.min(300, bpm));
    this._emit({ bpm: this._bpm });
  }

  play(): void {
    if (this._playState !== 'stopped') return;
    this._playState = 'playing';
    this._startAudioTime = this.audioContext.currentTime;
    this._startBeat = this._currentBeat;
    this._startLoop();
    this._emit({ playState: this._playState });
  }

  record(): void {
    if (this._playState !== 'stopped') return;
    this._playState = 'recording';
    this._startAudioTime = this.audioContext.currentTime;
    this._startBeat = this._currentBeat;
    this._startLoop();
    this._emit({ playState: this._playState });
  }

  stop(): void {
    if (this._playState === 'stopped') return;
    this._playState = 'stopped';
    this._stopLoop();
    this._currentBeat = 0;
    this._emit({ playState: 'stopped', currentBeat: 0 });
  }

  // ─── Subscription ───────────────────────────────────────────────────────

  subscribe(listener: TransportListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private _startLoop(): void {
    this._loopHandle = setInterval(() => this._tick(), this.TICK_INTERVAL_MS);
  }

  private _stopLoop(): void {
    if (this._loopHandle !== null) {
      clearInterval(this._loopHandle);
      this._loopHandle = null;
    }
  }

  private _tick(): void {
    const elapsed = this.audioContext.currentTime - this._startAudioTime;
    this._currentBeat = this._startBeat + elapsed / this.secondsPerBeat;
    this._emit({ currentBeat: this._currentBeat });
  }

  private _emit(changes: Partial<TransportSnapshot>): void {
    this._listeners.forEach(l => l(changes));
  }

  dispose(): void {
    this._stopLoop();
    this._listeners.clear();
  }
}
