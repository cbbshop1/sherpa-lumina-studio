import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useStudioStore } from '@/store/studioStore';
import type { Transport } from '@/engine/Transport';
import type { NoteEvent } from '@/engine/tracks/Track';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIDI_MIN    = 36;   // C2
const MIDI_MAX    = 84;   // C6
const PITCH_RANGE = MIDI_MAX - MIDI_MIN + 1;   // 49 semitones
const SNAP_BEATS  = 0.25; // 16th-note snap
const DEFAULT_NOTE_DURATION = 0.25;

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // semitone offsets from C
const isBlackKey = (midi: number) => BLACK_KEYS.has(midi % 12);

// ─── Colours (match Tailwind CSS vars used in the app) ────────────────────────
const COLOUR = {
  bgWhite:    '#1e2746',
  bgBlack:    '#161d38',
  gridBeat:   '#2e3a5c',
  gridBar:    '#3d4e70',
  note:       '#6366f1',
  noteBorder: '#818cf8',
  noteOn:     '#a5b4fc',
  playhead:   '#f43f5e',
} as const;

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  notes: NoteEvent[],
  patternLengthBeats: number,
) {
  ctx.clearRect(0, 0, w, h);
  const rowH  = h / PITCH_RANGE;
  const beatW = w / patternLengthBeats;

  // ── Pitch rows ──────────────────────────────────────────────────────────
  for (let i = 0; i < PITCH_RANGE; i++) {
    const midi = MIDI_MAX - i;
    ctx.fillStyle = isBlackKey(midi) ? COLOUR.bgBlack : COLOUR.bgWhite;
    ctx.fillRect(0, i * rowH, w, rowH);
  }

  // ── Beat grid lines ──────────────────────────────────────────────────────
  for (let beat = 0; beat <= patternLengthBeats; beat++) {
    ctx.strokeStyle = beat % 4 === 0 ? COLOUR.gridBar : COLOUR.gridBeat;
    ctx.lineWidth   = beat % 4 === 0 ? 1.5 : 0.5;
    const x = beat * beatW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  for (const note of notes) {
    if (note.midiNote < MIDI_MIN || note.midiNote > MIDI_MAX) continue;
    const x  = note.startBeat * beatW;
    const y  = (MIDI_MAX - note.midiNote) * rowH;
    const nw = Math.max(4, note.durationBeats * beatW - 2);
    const nh = rowH - 1;

    ctx.fillStyle   = COLOUR.note;
    ctx.fillRect(x + 1, y + 0.5, nw, nh);

    ctx.strokeStyle = COLOUR.noteBorder;
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(x + 1, y + 0.5, nw, nh);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PianoRollProps {
  trackId:   number;
  transport: Transport;
}

const PianoRoll = ({ trackId, transport }: PianoRollProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const playheadRef  = useRef<HTMLDivElement>(null);
  // Keep a stable ref to the latest draw function so ResizeObserver always
  // uses current notes/patternLength without needing to re-subscribe.
  const drawRef = useRef<() => void>(() => {});

  const notes             = useStudioStore(s => s.patterns[trackId] ?? []);
  const patternLengthBars = useStudioStore(s => s.patternLengthBars);
  const addNote           = useStudioStore(s => s.addNote);
  const removeNote        = useStudioStore(s => s.removeNote);

  const patternLengthBeats = patternLengthBars * 4;

  // ── Canvas draw function ────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    drawCanvas(ctx, w, h, notes, patternLengthBeats);
  }, [notes, patternLengthBeats]);

  // Keep drawRef in sync so ResizeObserver always calls the latest redraw
  useLayoutEffect(() => { drawRef.current = redraw; }, [redraw]);

  // Redraw when notes or pattern length changes
  useEffect(() => { redraw(); }, [redraw]);

  // ResizeObserver — resize canvas and redraw
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Playhead subscription ───────────────────────────────────────────────

  useEffect(() => {
    const unsub = transport.subscribe(({ currentBeat, playState: ps }) => {
      const ph = playheadRef.current;
      if (!ph) return;
      if (ps === 'stopped') { ph.style.display = 'none'; return; }
      if (currentBeat !== undefined) {
        const patBeat  = ((currentBeat % patternLengthBeats) + patternLengthBeats) % patternLengthBeats;
        ph.style.display = 'block';
        ph.style.left    = `${(patBeat / patternLengthBeats) * 100}%`;
      }
    });
    return unsub;
  }, [transport, patternLengthBeats]);

  // ── Click handler — add / remove notes ─────────────────────────────────

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const rowH = h / PITCH_RANGE;
    const beatW = w / patternLengthBeats;

    const rawMidi  = MIDI_MAX - Math.floor(y / rowH);
    const midiNote = Math.max(MIDI_MIN, Math.min(MIDI_MAX, rawMidi));
    const rawBeat  = x / beatW;
    const startBeat = Math.floor(rawBeat / SNAP_BEATS) * SNAP_BEATS;

    // Check for existing note at this cell to toggle it off
    const existing = notes.find(
      n =>
        n.midiNote === midiNote &&
        startBeat >= n.startBeat &&
        startBeat < n.startBeat + n.durationBeats,
    );

    if (existing) {
      removeNote(trackId, existing.id);
    } else {
      const newNote: NoteEvent = {
        id:            `p-${trackId}-${midiNote}-${startBeat.toFixed(3)}-${Date.now()}`,
        midiNote,
        velocity:      100,
        startBeat,
        durationBeats: DEFAULT_NOTE_DURATION,
      };
      addNote(trackId, newNote);
    }
  }, [notes, trackId, patternLengthBeats, addNote, removeNote]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair overflow-hidden"
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {/* Playhead overlay — updated via direct DOM manipulation, no re-render */}
      <div
        ref={playheadRef}
        style={{
          display:   'none',
          position:  'absolute',
          top:       0,
          bottom:    0,
          width:     '2px',
          background: COLOUR.playhead,
          pointerEvents: 'none',
          transform: 'translateX(-1px)',
        }}
      />
    </div>
  );
};

export default PianoRoll;
