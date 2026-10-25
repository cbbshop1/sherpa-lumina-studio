import { create } from "zustand";
import type { PlayState } from "@/engine/Transport";
import type { InstrumentType } from "@/utils/instrumentSynthesis";
import { DEFAULT_TRACKS } from "@/engine/tracks/TrackManager";
import type { NoteEvent } from "@/engine/tracks/Track";

// ─── Engine registry ─────────────────────────────────────────────────────────
// Set by Studio.tsx after initialisation so store actions can call through
// to the audio engine without importing it at module level (which would create
// the AudioContext before a user gesture).

import type { Transport } from "@/engine/Transport";
import type { Mixer } from "@/engine/Mixer";
import type { TrackManager } from "@/engine/tracks/TrackManager";

interface EngineRefs {
  transport?: Transport;
  mixer?: Mixer;
  trackManager?: TrackManager;
}

const engine: EngineRefs = {};

export function registerEngine(refs: EngineRefs): void {
  Object.assign(engine, refs);
}

// ─── Pattern history (undo / redo) ───────────────────────────────────────────
// Stored at module level (not in Zustand state) — same pattern as engine registry.

const patternHistory: Array<Record<number, NoteEvent[]>> = [];
const patternFuture: Array<Record<number, NoteEvent[]>> = [];
const MAX_HISTORY = 50;

function deepClonePatterns(
  p: Record<number, NoteEvent[]>,
): Record<number, NoteEvent[]> {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [...v]]));
}

function pushHistory(patterns: Record<number, NoteEvent[]>): void {
  patternHistory.push(deepClonePatterns(patterns));
  patternFuture.length = 0; // clear redo stack on any new mutation
  if (patternHistory.length > MAX_HISTORY) patternHistory.shift();
}

// ─── Store types ─────────────────────────────────────────────────────────────

export interface TrackUIState {
  id: number;
  name: string;
  instrumentType: InstrumentType;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  recordArm: boolean;
}

interface StudioState {
  // Transport mirror
  bpm: number;
  playState: PlayState;

  // Track UI mirrors
  tracks: TrackUIState[];

  // Master
  masterVolume: number;

  // Pattern state
  patterns: Record<number, NoteEvent[]>;
  patternLengthBars: number;
  selectedTrackId: number;

  // ── Transport actions ───────────────────────────────────────────────────
  setBpm: (bpm: number) => void;
  setPlayState: (state: PlayState) => void;
  play: () => void;
  stop: () => void;
  record: () => void;

  // ── Track actions ───────────────────────────────────────────────────────
  setTrackVolume: (trackId: number, volume: number) => void;
  setTrackPan: (trackId: number, pan: number) => void;
  setTrackMute: (trackId: number, mute: boolean) => void;
  setTrackSolo: (trackId: number, solo: boolean) => void;
  setTrackArm: (trackId: number) => void;
  setTrackInstrument: (trackId: number, instrument: InstrumentType) => void;

  // ── Master ──────────────────────────────────────────────────────────────
  setMasterVolume: (volume: number) => void;

  // ── Pattern actions ─────────────────────────────────────────────────────
  toggleDrumStep: (
    trackId: number,
    midiNote: number,
    stepIndex: number,
    totalSteps: number,
  ) => void;
  addNote: (trackId: number, note: NoteEvent) => void;
  removeNote: (trackId: number, noteId: string) => void;
  updateNote: (
    trackId: number,
    noteId: string,
    patch: Partial<Pick<NoteEvent, "midiNote" | "startBeat" | "durationBeats">>,
  ) => void;
  setSelectedTrack: (trackId: number) => void;
  setPatternLengthBars: (bars: number) => void;

  // ── Undo / Redo ─────────────────────────────────────────────────────────
  undo: () => void;
  redo: () => void;

  // ── Drum samples ────────────────────────────────────────────────────────
  drumSampleNames: Record<number, string>; // midiNote → filename
  loadDrumSample: (midiNote: number, file: File) => Promise<void>;
}

// ─── Initial track state (mirrors DEFAULT_TRACKS) ────────────────────────────

const initialTracks: TrackUIState[] = DEFAULT_TRACKS.map((def, i) => ({
  id: i,
  name: def.name,
  instrumentType: def.instrument,
  volume: 1.0,
  pan: 0,
  mute: false,
  solo: false,
  recordArm: i === 2,
}));

// ─── Store ───────────────────────────────────────────────────────────────────

// Initial empty patterns for all 5 tracks
const initialPatterns: Record<number, NoteEvent[]> = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
};

export const useStudioStore = create<StudioState>((set, get) => ({
  bpm: 120,
  playState: "stopped",
  tracks: initialTracks,
  masterVolume: 1.0,
  patterns: initialPatterns,
  patternLengthBars: 2,
  selectedTrackId: 2,
  drumSampleNames: {},

  // ── Transport ─────────────────────────────────────────────────────────────

  setBpm: (bpm) => {
    engine.transport?.setBpm(bpm);
    set({ bpm });
  },

  setPlayState: (playState) => set({ playState }),

  play: () => {
    engine.transport?.play();
    set({ playState: "playing" });
  },

  stop: () => {
    engine.transport?.stop();
    engine.trackManager?.stopAll();
    set({ playState: "stopped" });
  },

  record: () => {
    // Clear the armed track's pattern before recording (replace, not overdub).
    // Push to undo history first so the wipe can be undone.
    const armedId = get().tracks.find((t) => t.recordArm)?.id;
    if (armedId !== undefined) {
      pushHistory(get().patterns);
      set((s) => ({ patterns: { ...s.patterns, [armedId]: [] } }));
    }
    engine.transport?.record();
    set({ playState: "recording" });
  },

  // ── Tracks ────────────────────────────────────────────────────────────────

  setTrackVolume: (trackId, volume) => {
    engine.mixer?.update(trackId, { volume });
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, volume } : t)),
    }));
  },

  setTrackPan: (trackId, pan) => {
    engine.mixer?.update(trackId, { pan });
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, pan } : t)),
    }));
  },

  setTrackMute: (trackId, mute) => {
    engine.mixer?.update(trackId, { mute });
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, mute } : t)),
    }));
  },

  setTrackSolo: (trackId, solo) => {
    engine.mixer?.update(trackId, { solo });
    // Solo change re-applies all tracks in Mixer already; mirror in store too
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, solo } : t)),
    }));
  },

  setTrackArm: (trackId) => {
    engine.trackManager?.armTrack(trackId);
    set((s) => ({
      tracks: s.tracks.map((t) => ({ ...t, recordArm: t.id === trackId })),
    }));
  },

  setTrackInstrument: (trackId, instrument) => {
    engine.trackManager?.setInstrument(trackId, instrument);
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, instrumentType: instrument } : t,
      ),
    }));
  },

  // ── Master ────────────────────────────────────────────────────────────────

  setMasterVolume: (masterVolume) => {
    set({ masterVolume });
  },

  // ── Patterns ──────────────────────────────────────────────────────────────

  toggleDrumStep: (trackId, midiNote, stepIndex, totalSteps) =>
    set((s) => {
      pushHistory(s.patterns);
      const beatsPerStep = (s.patternLengthBars * 4) / totalSteps;
      const startBeat = stepIndex * beatsPerStep;
      const existing = s.patterns[trackId] ?? [];
      const hit = existing.find(
        (n) =>
          n.midiNote === midiNote && Math.abs(n.startBeat - startBeat) < 0.001,
      );
      const next = hit
        ? existing.filter((n) => n.id !== hit.id)
        : [
            ...existing,
            {
              id: `d-${trackId}-${midiNote}-${stepIndex}`,
              midiNote,
              velocity: 100,
              startBeat,
              durationBeats: beatsPerStep * 0.9,
            },
          ];
      return { patterns: { ...s.patterns, [trackId]: next } };
    }),

  addNote: (trackId, note) =>
    set((s) => {
      pushHistory(s.patterns);
      return {
        patterns: {
          ...s.patterns,
          [trackId]: [...(s.patterns[trackId] ?? []), note],
        },
      };
    }),

  removeNote: (trackId, noteId) =>
    set((s) => {
      pushHistory(s.patterns);
      return {
        patterns: {
          ...s.patterns,
          [trackId]: (s.patterns[trackId] ?? []).filter((n) => n.id !== noteId),
        },
      };
    }),

  updateNote: (trackId, noteId, patch) =>
    set((s) => {
      if (!(s.patterns[trackId] ?? []).some((note) => note.id === noteId))
        return s;
      pushHistory(s.patterns);
      return {
        patterns: {
          ...s.patterns,
          [trackId]: s.patterns[trackId].map((note) => {
            if (note.id !== noteId) return note;
            const next = { ...note, ...patch };
            next.midiNote = Math.max(
              0,
              Math.min(127, Math.round(next.midiNote)),
            );
            next.startBeat = Math.max(
              0,
              Math.min(s.patternLengthBars * 4 - 0.25, next.startBeat),
            );
            next.durationBeats = Math.max(
              0.25,
              Math.min(
                s.patternLengthBars * 4 - next.startBeat,
                next.durationBeats,
              ),
            );
            return next;
          }),
        },
      };
    }),

  setSelectedTrack: (selectedTrackId) => set({ selectedTrackId }),
  setPatternLengthBars: (patternLengthBars) => set({ patternLengthBars }),

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  undo: () => {
    const prev = patternHistory.pop();
    if (!prev) return;
    patternFuture.push(deepClonePatterns(get().patterns));
    set({ patterns: prev });
  },

  redo: () => {
    const next = patternFuture.pop();
    if (!next) return;
    patternHistory.push(deepClonePatterns(get().patterns));
    set({ patterns: next });
  },

  // ── Drum samples ──────────────────────────────────────────────────────────

  loadDrumSample: async (midiNote, file) => {
    await engine.trackManager?.loadDrumSample(midiNote, file);
    set((s) => ({
      drumSampleNames: { ...s.drumSampleNames, [midiNote]: file.name },
    }));
  },
}));
