export interface MixerTrackConfig {
  volume: number;  // 0 – 1
  pan: number;     // -1 (left) … 0 (center) … 1 (right)
  mute: boolean;
  solo: boolean;
}

interface MixerTrack extends MixerTrackConfig {
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
}

/**
 * Per-track volume / pan / mute / solo.
 *
 * Signal chain per track:
 *   SynthBackend.outputGain → track.gainNode → track.pannerNode → masterGain
 */
export class Mixer {
  private _tracks: MixerTrack[];
  private _rampTime = 0.01; // 10 ms smoothing

  constructor(
    private readonly _audioContext: AudioContext,
    destination: AudioNode,
    trackCount = 5,
  ) {
    this._tracks = Array.from({ length: trackCount }, () => {
      const gainNode   = _audioContext.createGain();
      const pannerNode = _audioContext.createStereoPanner();

      gainNode.gain.value   = 1.0;
      pannerNode.pan.value  = 0;

      gainNode.connect(pannerNode);
      pannerNode.connect(destination);

      return { gainNode, pannerNode, volume: 1.0, pan: 0, mute: false, solo: false };
    });
  }

  /** Returns the AudioNode that a SynthBackend should connect its output to. */
  getInputNode(trackIndex: number): AudioNode {
    return this._tracks[trackIndex].gainNode;
  }

  /** Partial-update one track and re-apply gain / pan. */
  update(trackIndex: number, config: Partial<MixerTrackConfig>): void {
    const track = this._tracks[trackIndex];
    if (!track) return;
    Object.assign(track, config);
    this._apply(trackIndex);
    // Solo change can affect ALL tracks
    if ('solo' in config) this._tracks.forEach((_, i) => this._apply(i));
  }

  private _apply(index: number): void {
    const track    = this._tracks[index];
    const anySolo  = this._tracks.some(t => t.solo);
    const now      = this._audioContext.currentTime;

    const effectiveVol =
      track.mute           ? 0 :
      anySolo && !track.solo ? 0 :
      track.volume;

    track.gainNode.gain.linearRampToValueAtTime(effectiveVol, now + this._rampTime);
    track.pannerNode.pan.value = track.pan;
  }

  getConfig(trackIndex: number): MixerTrackConfig {
    const { volume, pan, mute, solo } = this._tracks[trackIndex];
    return { volume, pan, mute, solo };
  }
}
