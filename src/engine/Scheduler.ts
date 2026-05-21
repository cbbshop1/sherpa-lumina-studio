export interface ScheduledEvent {
  id: string;
  trackId: number;
  midiNote: number;
  velocity: number;
  /** Beat position within the pattern (0 = first beat). */
  startBeat: number;
  durationBeats: number;
}

export type NoteOnHandler  = (trackId: number, midiNote: number, velocity: number, audioTime: number) => void;
export type NoteOffHandler = (trackId: number, midiNote: number, audioTime: number) => void;

/**
 * Look-ahead event scheduler with seamless loop support.
 *
 * Called every 25 ms (Transport tick) with a `scheduleUntil` horizon of
 * AudioContext.currentTime + 100 ms.  For each event and loop iteration N,
 * the absolute audio time is:
 *
 *   audioTime = startAudioTime + (N * patternLengthBeats + event.startBeat) * secondsPerBeat
 *
 * The `_scheduled` set tracks "eventId@N" keys so no event fires twice per
 * iteration.  Cleared on reset() when the transport stops.
 */
export class Scheduler {
  private _events: ScheduledEvent[] = [];
  private _scheduled = new Set<string>();

  constructor(
    private readonly _onNoteOn: NoteOnHandler,
    private readonly _onNoteOff: NoteOffHandler,
  ) {}

  setEvents(events: ScheduledEvent[]): void {
    this._events = events;
  }

  /**
   * Schedule all events whose audio time falls within [now … scheduleUntil],
   * looping the pattern indefinitely.
   *
   * @param scheduleUntil      audioContext.currentTime + SCHEDULE_AHEAD_TIME
   * @param secondsPerBeat     60 / bpm
   * @param startAudioTime     audioContext.currentTime when transport.play() fired
   * @param startBeat          transport._startBeat (0 after stop+play)
   * @param patternLengthBeats patternLengthBars * 4
   */
  tick(
    scheduleUntil: number,
    secondsPerBeat: number,
    startAudioTime: number,
    startBeat: number,
    patternLengthBeats: number,
  ): void {
    if (patternLengthBeats <= 0 || this._events.length === 0) return;

    // How many complete loop iterations can fit before the schedule horizon?
    // Add 1 to always check at least one iteration ahead.
    const maxN = Math.ceil(
      (scheduleUntil - startAudioTime) / (patternLengthBeats * secondsPerBeat),
    );

    for (let N = 0; N <= maxN; N++) {
      const loopStartAudio = startAudioTime + N * patternLengthBeats * secondsPerBeat;

      for (const event of this._events) {
        const key          = `${event.id}@${N}`;
        if (this._scheduled.has(key)) continue;

        const noteOnTime   = loopStartAudio + event.startBeat * secondsPerBeat;
        const noteOffTime  = noteOnTime + event.durationBeats * secondsPerBeat;

        if (noteOnTime > scheduleUntil) continue; // future iterations, skip

        this._scheduled.add(key);
        this._onNoteOn(event.trackId, event.midiNote, event.velocity, noteOnTime);
        this._onNoteOff(event.trackId, event.midiNote, noteOffTime);
      }
    }
  }

  /** Clear all scheduled state — call when transport stops. */
  reset(): void {
    this._scheduled.clear();
  }

  dispose(): void {
    this.reset();
    this._events = [];
  }
}
