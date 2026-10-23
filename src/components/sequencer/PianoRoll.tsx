import { useEffect, useRef, useState } from "react";
import { useStudioStore } from "@/store/studioStore";
import { useStudioSession } from "@/context/StudioSession";
import { selectionNoteLabels } from "@/lib/musicNotation";
import { writtenPitch, rollCell, durationName } from "@/lib/staffNotation";
import { NOTE_NAMES } from "@/lib/noteSelection";
import type { Transport } from "@/engine/Transport";
import StaffPreview from "./StaffPreview";

const DURATIONS = [0.25, 0.5, 1, 2, 4];
export default function PianoRoll({
  trackId,
  transport,
  onPreviewNote,
}: {
  trackId: number;
  transport: Transport;
  onPreviewNote: (trackId: number, midi: number) => void;
}) {
  const notes = useStudioStore((s) => s.patterns[trackId] ?? []);
  const beats = useStudioStore((s) => s.patternLengthBars * 4);
  const { addNote, removeNote, updateNote, undo, redo } = useStudioStore();
  const { selection } = useStudioSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pitch, setPitch] = useState(60);
  const [length, setLength] = useState(0.25);
  const [start, setStart] = useState(0);
  const [spelling, setSpelling] = useState("context");
  const [audition, setAudition] = useState(true);
  const [hover, setHover] = useState<{
    midiNote: number;
    startBeat: number;
  } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const preferred =
    spelling === "context" ? selectionNoteLabels(selection) : [];
  const flats = spelling === "flats";
  const name = (midi: number) => writtenPitch(midi, preferred, flats).name;
  const writtenOctave = writtenPitch(pitch, preferred, flats).octave;
  const selected = notes.find((note) => note.id === selectedId);
  const select = (id: string) => {
    const note = notes.find((note) => note.id === id);
    if (!note) return;
    setSelectedId(id);
    setPitch(note.midiNote);
    setStart(note.startBeat);
    setLength(note.durationBeats);
  };
  useEffect(() => {
    setSelectedId(null);
    if (scroll.current) scroll.current.scrollTop = 240;
  }, [trackId]);
  useEffect(() => {
    if (!selected) return;
    setPitch(selected.midiNote);
    setStart(selected.startBeat);
    setLength(selected.durationBeats);
  }, [selected]);
  useEffect(
    () =>
      transport.subscribe(({ currentBeat, playState }) => {
        if (!playhead.current) return;
        if (playState === "stopped") playhead.current.style.display = "none";
        else if (currentBeat !== undefined) {
          playhead.current.style.display = "block";
          playhead.current.style.left = `${((((currentBeat % beats) + beats) % beats) / beats) * 100}%`;
        }
      }),
    [transport, beats],
  );
  const change = (next: {
    midiNote?: number;
    startBeat?: number;
    durationBeats?: number;
  }) => {
    if (next.midiNote !== undefined) setPitch(next.midiNote);
    if (next.startBeat !== undefined) setStart(next.startBeat);
    if (next.durationBeats !== undefined) setLength(next.durationBeats);
    if (selected) updateNote(trackId, selected.id, next);
  };
  const place = (midiNote: number, startBeat: number) => {
    const existing = notes.find(
      (n) =>
        n.midiNote === midiNote &&
        startBeat >= n.startBeat &&
        startBeat < n.startBeat + n.durationBeats,
    );
    if (existing) {
      select(existing.id);
      return;
    }
    const id = crypto.randomUUID();
    addNote(trackId, {
      id,
      midiNote,
      startBeat,
      durationBeats: Math.min(length, beats - startBeat),
      velocity: 100,
    });
    setSelectedId(id);
    setPitch(midiNote);
    setStart(startBeat);
    if (audition) onPreviewNote(trackId, midiNote);
  };
  const cell = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rollCell(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      beats,
    );
  };
  return (
    <div className="note-composer">
      <div className="composer-intro">
        <div>
          <h2>Write a melody</h2>
          <p>
            Place a note in the grid. Select it here or on the staff to change
            it.
          </p>
        </div>
        <label>
          Spelling{" "}
          <select
            aria-label="Note spelling"
            value={spelling}
            onChange={(e) => setSpelling(e.target.value)}
          >
            <option value="context">Follow lesson</option>
            <option value="sharps">Sharps</option>
            <option value="flats">Flats</option>
          </select>
        </label>
      </div>
      <StaffPreview
        notes={notes.filter((n) => n.startBeat < beats)}
        beats={beats}
        preferred={preferred}
        flats={flats}
        selectedId={selectedId}
        onSelect={select}
      />
      <div className="note-inspector" aria-label="Note editor">
        <strong>
          {selected ? "Selected" : "New note"}
          <span>{name(pitch)}</span>
        </strong>
        <label>
          Pitch{" "}
          <select
            aria-label="Note pitch"
            value={pitch % 12}
            onChange={(e) =>
              change({
                midiNote:
                  60 +
                  Number(e.target.value) +
                  12 *
                    (writtenOctave -
                      writtenPitch(
                        60 + Number(e.target.value),
                        preferred,
                        flats,
                      ).octave),
              })
            }
          >
            {NOTE_NAMES.map((_, pc) => (
              <option key={pc} value={pc}>
                {writtenPitch(60 + pc, preferred, flats).spelling}
              </option>
            ))}
          </select>
        </label>
        <label>
          Octave{" "}
          <select
            aria-label="Note octave"
            value={writtenOctave}
            onChange={(e) =>
              change({
                midiNote: pitch + 12 * (Number(e.target.value) - writtenOctave),
              })
            }
          >
            {[...new Set([2, 3, 4, 5, 6, writtenOctave])].sort().map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          Length{" "}
          <select
            aria-label="Note length"
            value={length}
            onChange={(e) => change({ durationBeats: Number(e.target.value) })}
          >
            {!DURATIONS.includes(length) && (
              <option value={length}>{length} beats</option>
            )}
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {durationName(d)} note
              </option>
            ))}
          </select>
        </label>
        <label>
          Beat{" "}
          <input
            aria-label="Note start beat"
            type="number"
            min={1}
            max={beats + 0.75}
            step={0.25}
            value={start + 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n))
                change({
                  startBeat: Math.max(0, Math.min(beats - 0.25, n - 1)),
                });
            }}
          />
        </label>
        <button onClick={() => onPreviewNote(trackId, pitch)}>Hear note</button>
        {selected ? (
          <>
            <button
              onClick={() => {
                removeNote(trackId, selected.id);
                setSelectedId(null);
              }}
            >
              Delete note
            </button>
            <button onClick={() => setSelectedId(null)}>New note</button>
          </>
        ) : (
          <button onClick={() => place(pitch, start)}>Add note</button>
        )}
      </div>
      <div className="roll-tools">
        <label>
          <input
            type="checkbox"
            checked={audition}
            onChange={(e) => setAudition(e.target.checked)}
          />{" "}
          Hear as I place
        </label>
        <span aria-live="polite">
          {hover
            ? `${name(hover.midiNote)} · beat ${hover.startBeat + 1}`
            : "C2–C6 · sixteenth-note grid"}
        </span>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>
      <div className="piano-roll-scroll" ref={scroll} aria-label="Piano roll">
        <div
          className="piano-roll-content"
          style={{ minWidth: Math.max(720, beats * 120 + 62) }}
        >
          <div className="roll-ruler">
            <span>Pitch</span>
            <div>
              {Array.from({ length: beats }, (_, i) => (
                <span key={i} style={{ left: `${(i / beats) * 100}%` }}>
                  {Math.floor(i / 4) + 1}.{(i % 4) + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="roll-body">
            <div className="roll-key-labels">
              {Array.from({ length: 49 }, (_, i) => 84 - i).map((midi) => (
                <button
                  key={midi}
                  className={
                    [1, 3, 6, 8, 10].includes(midi % 12) ? "black" : ""
                  }
                  aria-label={`Hear ${name(midi)}`}
                  onClick={() => {
                    setPitch(midi);
                    if (selected)
                      updateNote(trackId, selected.id, { midiNote: midi });
                    onPreviewNote(trackId, midi);
                  }}
                >
                  {name(midi)}
                </button>
              ))}
            </div>
            <div
              className="roll-grid"
              style={{
                backgroundSize: `${100 / (beats * 4)}% 20px, ${100 / beats}% 100%`,
              }}
              onMouseMove={(e) => setHover(cell(e))}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                const target = cell(e);
                place(target.midiNote, target.startBeat);
              }}
            >
              {notes
                .filter(
                  (n) =>
                    n.midiNote >= 36 && n.midiNote <= 84 && n.startBeat < beats,
                )
                .map((note) => (
                  <button
                    key={note.id}
                    className={`roll-note ${selectedId === note.id ? "selected" : ""}`}
                    aria-label={`Select ${name(note.midiNote)}, beat ${note.startBeat + 1}, ${durationName(note.durationBeats)} note`}
                    title={`${name(note.midiNote)} · beat ${note.startBeat + 1} · ${note.durationBeats} beats`}
                    style={{
                      left: `${(note.startBeat / beats) * 100}%`,
                      top: (84 - note.midiNote) * 20 + 1,
                      width: `${(Math.min(note.durationBeats, beats - note.startBeat) / beats) * 100}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      select(note.id);
                    }}
                  >
                    {name(note.midiNote)}
                  </button>
                ))}
              <div className="roll-playhead" ref={playhead} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
