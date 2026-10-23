import { useEffect, useRef, useCallback, useState } from "react";
import { Mic2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import AppNavigation from "@/components/AppNavigation";
import TransportBar from "@/components/TransportBar";
import SequencerView from "@/components/sequencer/SequencerView";
import { AudioEngine } from "@/engine/AudioEngine";
import { Transport } from "@/engine/Transport";
import { Mixer } from "@/engine/Mixer";
import { Scheduler } from "@/engine/Scheduler";
import type { ScheduledEvent } from "@/engine/Scheduler";
import { TrackManager } from "@/engine/tracks/TrackManager";
import { AudioExporter } from "@/engine/AudioExporter";
import { useMidiSession } from "@/context/MidiSession";
import type { InstrumentBackend } from "@/engine/instruments/InstrumentBackend";
import { useStudioStore, registerEngine } from "@/store/studioStore";
import { INSTRUMENTS, InstrumentType } from "@/utils/instrumentSynthesis";
import { exportMidi } from "@/utils/exportMidi";

// ─── Recording snap resolution (16th note) ───────────────────────────────────

const SNAP_BEATS = 0.25;

// ─── Instrument dropdown options ─────────────────────────────────────────────

const INSTRUMENT_OPTIONS = Object.entries(INSTRUMENTS) as [
  InstrumentType,
  { name: string; icon: string },
][];

// ─── Studio page ─────────────────────────────────────────────────────────────

const Studio = () => {
  const { registerTarget, panic } = useMidiSession();
  const [engineReady, setEngineReady] = useState(false);
  const owners = useRef(
    new Map<
      number,
      { backend: InstrumentBackend; ticket: object; trackId: number }
    >(),
  );
  const previewTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const generation = useRef(0);
  const stopLive = useCallback(() => {
    generation.current++;
    previewTimers.current.forEach(clearTimeout);
    previewTimers.current.clear();
    owners.current.clear();
    recordingNotesRef.current.clear();
    trackManagerRef.current?.stopAll();
  }, []);
  const previewNote = useCallback(async (trackId: number, note: number) => {
    const ae = engineRef.current,
      tm = trackManagerRef.current;
    if (!ae || !tm) return;
    const ticket = generation.current;
    await ae.resume();
    if (ticket !== generation.current) return;
    const backend = tm.tracks[trackId]?.backend;
    if (!backend) return;
    backend.noteOn(note, 100, ae.currentTime);
    const timer = setTimeout(() => {
      backend.noteOff(note, ae.currentTime);
      previewTimers.current.delete(timer);
    }, 350);
    previewTimers.current.add(timer);
  }, []);
  // Engine refs — created once, stable across re-renders
  const engineRef = useRef<AudioEngine | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const mixerRef = useRef<Mixer | null>(null);
  const trackManagerRef = useRef<TrackManager | null>(null);
  const schedulerRef = useRef<Scheduler | null>(null);
  const audioExporterRef = useRef<AudioExporter | null>(null);

  // Notes currently held down during recording: midiNote → { startBeat, velocity }
  const recordingNotesRef = useRef<
    Map<number, { startBeat: number; velocity: number; trackId: number }>
  >(new Map());

  const {
    tracks,
    playState,
    setTrackVolume,
    setTrackPan,
    setTrackMute,
    setTrackSolo,
    setTrackArm,
    setTrackInstrument,
  } = useStudioStore();

  // ── 1. Initialise audio engine on mount ───────────────────────────────────
  useEffect(() => {
    const ae = AudioEngine.getInstance();
    const transport = new Transport(ae.audioContext);
    const mixer = new Mixer(ae.audioContext, ae.masterGain, 5);
    const tm = new TrackManager(ae, mixer);
    const scheduler = new Scheduler(
      (trackId, midiNote, velocity, audioTime) => {
        ae.resume();
        tm.noteOn(trackId, midiNote, velocity, audioTime);
      },
      (trackId, midiNote, audioTime) => {
        tm.noteOff(trackId, midiNote, audioTime);
      },
    );

    engineRef.current = ae;
    transportRef.current = transport;
    mixerRef.current = mixer;
    trackManagerRef.current = tm;
    schedulerRef.current = scheduler;
    audioExporterRef.current = new AudioExporter(ae);

    const saved = useStudioStore.getState();
    transport.setBpm(saved.bpm);
    ae.setMasterVolume(saved.masterVolume);
    saved.tracks.forEach((track) => {
      tm.setInstrument(track.id, track.instrumentType);
      mixer.update(track.id, {
        volume: track.volume,
        pan: track.pan,
        mute: track.mute,
        solo: track.solo,
      });
      if (track.recordArm) tm.armTrack(track.id);
    });
    registerEngine({ transport, mixer, trackManager: tm });
    useStudioStore.setState({ playState: "stopped" });
    setEngineReady(true);

    return () => {
      stopLive();
      registerEngine({
        transport: undefined,
        mixer: undefined,
        trackManager: undefined,
      });
      useStudioStore.setState({ playState: "stopped" });
      transport.dispose();
      scheduler.dispose();
      tm.tracks.forEach((t) => t.backend.dispose());
    };
  }, []);

  // ── 2. Wire Transport → Scheduler (separate effect, runs after engine init) ─
  useEffect(() => {
    const transport = transportRef.current;
    const scheduler = schedulerRef.current;
    const ae = engineRef.current;
    if (!transport || !scheduler || !ae) return;

    const unsub = transport.subscribe((changes) => {
      // Sync playState changes to store
      if (changes.playState !== undefined) {
        useStudioStore.setState({ playState: changes.playState });
        if (changes.playState === "stopped") {
          scheduler.reset();
          panic();
          return;
        }
      }

      // Drive look-ahead scheduler on every tick while playing/recording
      if (
        changes.currentBeat !== undefined &&
        transport.playState !== "stopped"
      ) {
        const state = useStudioStore.getState();
        const patternLengthBeats = state.patternLengthBars * 4;

        // Flatten all track patterns into ScheduledEvents
        const events: ScheduledEvent[] = [];
        for (let tid = 0; tid < 5; tid++) {
          const trackNotes = state.patterns[tid] ?? [];
          for (const note of trackNotes) {
            events.push({
              id: `${tid}-${note.id}`,
              trackId: tid,
              midiNote: note.midiNote,
              velocity: note.velocity,
              startBeat: note.startBeat,
              durationBeats: note.durationBeats,
            });
          }
        }

        scheduler.setEvents(events);
        scheduler.tick(
          ae.currentTime + transport.SCHEDULE_AHEAD_TIME,
          transport.secondsPerBeat,
          transport.startAudioTime,
          transport.startBeat,
          patternLengthBeats,
        );
      }
    });

    return unsub;
  }, []); // refs are stable, safe to use with empty dep array

  // ── 3. MIDI → armed track routing ─────────────────────────────────────────

  const handleNoteOn = useCallback(
    async (midiNote: number, velocity: number) => {
      const ae = engineRef.current;
      const tm = trackManagerRef.current;
      const transport = transportRef.current;
      if (!ae || !tm || !transport) return;

      const armed = tm.getArmedTrack();
      if (!armed) return;
      const ticket = {};
      owners.current.set(midiNote, {
        backend: armed.backend,
        ticket,
        trackId: armed.id,
      });
      await ae.resume();
      if (owners.current.get(midiNote)?.ticket !== ticket) return;
      armed.backend.noteOn(midiNote, velocity, ae.currentTime);

      // Capture start beat when recording is active
      if (transport.playState === "recording") {
        const elapsed = ae.currentTime - transport.startAudioTime;
        const rawBeat =
          transport.startBeat + elapsed / transport.secondsPerBeat;
        const patternBeats = useStudioStore.getState().patternLengthBars * 4;
        const patBeat =
          ((rawBeat % patternBeats) + patternBeats) % patternBeats;
        const startBeat = Math.round(patBeat / SNAP_BEATS) * SNAP_BEATS;
        recordingNotesRef.current.set(midiNote, {
          startBeat,
          velocity,
          trackId: armed.id,
        });
      }
    },
    [],
  );

  const handleNoteOff = useCallback((midiNote: number) => {
    const ae = engineRef.current;
    const tm = trackManagerRef.current;
    const transport = transportRef.current;
    if (!ae || !tm || !transport) return;

    owners.current.get(midiNote)?.backend.noteOff(midiNote, ae.currentTime);
    owners.current.delete(midiNote);

    // Complete the recorded note
    const pending = recordingNotesRef.current.get(midiNote);
    recordingNotesRef.current.delete(midiNote);
    if (!pending || transport.playState !== "recording") return;

    const elapsed = ae.currentTime - transport.startAudioTime;
    const rawBeat = transport.startBeat + elapsed / transport.secondsPerBeat;
    const state = useStudioStore.getState();
    const patternBeats = state.patternLengthBars * 4;
    const patBeat = ((rawBeat % patternBeats) + patternBeats) % patternBeats;

    let durationBeats = patBeat - pending.startBeat;
    if (durationBeats <= 0) durationBeats += patternBeats; // note crossed loop boundary
    const maxDuration = patternBeats - pending.startBeat;
    durationBeats = Math.max(
      SNAP_BEATS,
      Math.min(
        maxDuration,
        Math.round(durationBeats / SNAP_BEATS) * SNAP_BEATS,
      ),
    );

    const armedTrackId = pending.trackId;
    if (armedTrackId === undefined) return;

    state.addNote(armedTrackId, {
      id: `rec-${armedTrackId}-${midiNote}-${pending.startBeat.toFixed(3)}-${Date.now()}`,
      midiNote,
      velocity: pending.velocity,
      startBeat: pending.startBeat,
      durationBeats,
    });
  }, []);

  // ── 4. Undo / Redo keyboard shortcuts ────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          e.target.closest("input,select,textarea"))
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useStudioStore.getState().undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        useStudioStore.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () =>
      registerTarget({
        noteOn: handleNoteOn,
        noteOff: handleNoteOff,
        parameter: (name, value) => {
          trackManagerRef.current?.tracks.forEach((track) =>
            track.backend.setParameter(name, value),
          );
        },
        stop: stopLive,
      }),
    [registerTarget, handleNoteOn, handleNoteOff, stopLive],
  );

  if (!engineReady || !transportRef.current)
    return (
      <div className="studio-page">
        <AppNavigation />
        <p>Opening studio…</p>
      </div>
    );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="studio-page bg-background">
      <AppNavigation />

      <div className="flex flex-1 min-h-0 flex-col">
        {/* Transport bar */}
        <TransportBar
          transport={transportRef.current}
          onResumeAudio={() => engineRef.current!.resume()}
          onExportMidi={() => {
            const { patterns, tracks, bpm } = useStudioStore.getState();
            exportMidi(
              patterns,
              tracks.map((t) => t.name),
              bpm,
            );
          }}
          onStartAudioCapture={() => audioExporterRef.current?.start()}
          onStopAudioCapture={() => audioExporterRef.current?.stop()}
          isCapturingAudio={() => audioExporterRef.current?.isActive ?? false}
        />

        {/* Main workspace */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Sequencer ───────────────────────────────────────────────── */}
          <SequencerView
            transport={transportRef.current}
            onPreviewNote={previewNote}
          />

          {/* ── Track strips ────────────────────────────────────────────── */}
          <div className="mx-6 mt-4 mb-6 rounded-2xl border border-border overflow-hidden">
            {[...tracks].reverse().map((track, idx) => (
              <div
                key={track.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-4 py-3",
                  idx !== 0 && "border-t border-border",
                  track.recordArm && "bg-destructive/5",
                )}
              >
                {/* Record arm */}
                <button
                  onClick={() => setTrackArm(track.id)}
                  title="Record arm"
                  aria-label={`Arm ${track.name} for MIDI recording`}
                  aria-pressed={track.recordArm}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors shrink-0",
                    track.recordArm
                      ? "bg-destructive border-destructive text-destructive-foreground"
                      : "border-border text-muted-foreground hover:border-destructive/50",
                  )}
                >
                  <Mic2 className="w-3 h-3" />
                </button>

                {/* Track name */}
                <span className="w-12 text-sm font-semibold text-foreground shrink-0">
                  {track.name}
                </span>

                {/* Instrument selector */}
                <select
                  aria-label={`${track.name} instrument`}
                  value={track.instrumentType}
                  onChange={(e) =>
                    setTrackInstrument(
                      track.id,
                      e.target.value as InstrumentType,
                    )
                  }
                  className="bg-muted border border-border rounded px-2 py-1 text-xs
                             focus:outline-none focus:ring-1 focus:ring-primary w-28 shrink-0"
                >
                  {INSTRUMENT_OPTIONS.map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.icon} {cfg.name}
                    </option>
                  ))}
                </select>

                {/* Volume */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground w-6 shrink-0">
                    Vol
                  </span>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[track.volume]}
                    onValueChange={([v]) => setTrackVolume(track.id, v)}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                    {Math.round(track.volume * 100)}
                  </span>
                </div>

                {/* Pan */}
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <span className="text-xs text-muted-foreground w-6 shrink-0">
                    Pan
                  </span>
                  <Slider
                    min={-1}
                    max={1}
                    step={0.01}
                    value={[track.pan]}
                    onValueChange={([v]) => setTrackPan(track.id, v)}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                    {track.pan === 0
                      ? "C"
                      : track.pan > 0
                        ? `R${Math.round(track.pan * 100)}`
                        : `L${Math.round(-track.pan * 100)}`}
                  </span>
                </div>

                {/* M / S */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setTrackMute(track.id, !track.mute)}
                    className={cn(
                      "w-7 h-7 rounded text-xs font-bold border transition-colors",
                      track.mute
                        ? "bg-yellow-500/80 border-yellow-500 text-white"
                        : "border-border text-muted-foreground hover:border-yellow-500/50",
                    )}
                  >
                    M
                  </button>
                  <button
                    onClick={() => setTrackSolo(track.id, !track.solo)}
                    className={cn(
                      "w-7 h-7 rounded text-xs font-bold border transition-colors",
                      track.solo
                        ? "bg-green-500/80 border-green-500 text-white"
                        : "border-border text-muted-foreground hover:border-green-500/50",
                    )}
                  >
                    S
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Studio;
