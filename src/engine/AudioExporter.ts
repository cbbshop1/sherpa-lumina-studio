import type { AudioEngine } from './AudioEngine';

/**
 * Taps the master bus via MediaRecorder and downloads the captured audio.
 *
 * Usage:
 *   exporter.start()    — begin recording
 *   exporter.stop()     — end recording and trigger download
 *   exporter.isActive   — true while recording
 */
export class AudioExporter {
  private _recorder: MediaRecorder | null = null;
  private _chunks:   Blob[] = [];
  private _destNode: MediaStreamAudioDestinationNode | null = null;

  constructor(private readonly _engine: AudioEngine) {}

  get isActive(): boolean {
    return this._recorder?.state === 'recording';
  }

  start(): void {
    if (this.isActive) return;
    this._chunks  = [];
    this._destNode = this._engine.createExportDestination();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this._recorder = new MediaRecorder(this._destNode.stream, { mimeType });
    this._recorder.ondataavailable = e => { if (e.data.size > 0) this._chunks.push(e.data); };
    this._recorder.onstop          = () => this._download();
    this._recorder.start(100); // collect chunks every 100 ms
  }

  stop(): void {
    if (!this.isActive) return;
    this._recorder?.stop();
    this._destNode?.disconnect();
    this._destNode = null;
    this._recorder = null;
  }

  private _download(): void {
    const blob   = new Blob(this._chunks, { type: 'audio/webm' });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = 'recording.webm';
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
