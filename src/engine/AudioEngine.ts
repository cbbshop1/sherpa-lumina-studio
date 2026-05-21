/** Singleton AudioContext manager and master bus. */
let _instance: AudioEngine | null = null;

export class AudioEngine {
  readonly audioContext: AudioContext;
  readonly masterGain: GainNode;

  private constructor() {
    this.audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.audioContext.destination);
  }

  static getInstance(): AudioEngine {
    if (!_instance) _instance = new AudioEngine();
    return _instance;
  }

  /** Must be called on a user gesture before any audio plays. */
  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, volume)),
      this.audioContext.currentTime + 0.01,
    );
  }

  /**
   * Creates a MediaStreamAudioDestinationNode tapped from the master bus.
   * The caller is responsible for disconnecting it when done.
   */
  createExportDestination(): MediaStreamAudioDestinationNode {
    const dest = this.audioContext.createMediaStreamDestination();
    this.masterGain.connect(dest);
    return dest;
  }
}
