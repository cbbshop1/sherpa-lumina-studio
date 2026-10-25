export interface RecordedEvent {
  id: string;
  trackId: number;
  midiNote: number;
  velocity: number;
  startBeat: number;
  durationBeats: number;
}

/**
 * Captures MIDI note events during recording and returns them as a list
 * of timestamped events that the Scheduler can play back.
 */
export class Recorder {
  private _recording = false;
  private _events: RecordedEvent[] = [];
  private _pending = new Map<number, { startBeat: number; velocity: number }>();
  private _nextId = 0;

  startRecording(): void {
    this._recording = true;
    this._events = [];
    this._pending.clear();
  }

  stopRecording(): RecordedEvent[] {
    this._recording = false;
    // Close any notes still held when stop is pressed
    this._pending.clear();
    return this._events;
  }

  noteOn(trackId: number, midiNote: number, velocity: number, currentBeat: number): void {
    if (!this._recording) return;
    this._pending.set(midiNote, { startBeat: currentBeat, velocity });
  }

  noteOff(trackId: number, midiNote: number, currentBeat: number): void {
    if (!this._recording) return;
    const pending = this._pending.get(midiNote);
    if (!pending) return;

    this._events.push({
      id: `rec-${this._nextId++}`,
      trackId,
      midiNote,
      velocity: pending.velocity,
      startBeat: pending.startBeat,
      durationBeats: Math.max(0.125, currentBeat - pending.startBeat),
    });

    this._pending.delete(midiNote);
  }

  getEvents(): RecordedEvent[] {
    return [...this._events];
  }

  isRecording(): boolean {
    return this._recording;
  }
}
