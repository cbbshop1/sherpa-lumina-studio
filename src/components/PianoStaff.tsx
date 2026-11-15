import { useEffect, useRef, useState } from "react";
import { useStudioSession } from "../context/StudioSession";
import { useMidiSession } from "../context/MidiSession";
import { formatNote, voiceNotes } from "../lib/noteSelection";
import { selectionNoteLabels } from "../lib/musicNotation";
import { flatName, liveStaff, needsFlats, staffBounds } from "../lib/liveStaff";

const LINES = [45, 55, 65, 75, 85, 145, 155, 165, 175, 185];
const LEFT = 40;
const FIRST = 128;
const STEP = 46;
/** Drawn a little larger than print size so it reads at a glance. */
const SCALE = 1.1;

/** A grand staff that writes down whatever the piano is playing. */
export default function PianoStaff() {
  const {
    selection,
    playing,
    octave,
    scaleMidi,
    scaleDescending,
    scalePlayback,
  } = useStudioSession();
  const midi = useMidiSession();
  const holder = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(600);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setAvailable(element.clientWidth || 600),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The same reading of "what's chosen" and "what's sounding" as the keys use.
  const descending =
    scalePlayback.direction === "down" || (playing && scaleDescending);
  const chosenNames =
    selection.kind === "scale" && descending
      ? (selection.descendingNotes ?? selection.notes)
      : selection.notes;
  const chosen = selection.midiNotes ?? voiceNotes(chosenNames, octave);
  const playingNow = playing
    ? selection.kind === "scale"
      ? scaleMidi === null || scaleMidi === undefined
        ? []
        : [scaleMidi]
      : chosen
    : [];
  const spellings = selectionNoteLabels({ ...selection, descending });
  const columns = liveStaff({
    selected: chosen,
    sounding: [...playingNow, ...midi.activeNotes],
    kind: selection.kind,
    spellings,
  });
  const { top, bottom } = staffBounds(columns);
  const width = Math.max(
    available / SCALE,
    FIRST + columns.length * STEP + 30,
  );
  const height = bottom - top;
  const names = columns.flatMap((column) =>
    column.notes.map((note) => note.name),
  );
  const named = selection.name ? formatNote(selection.name) : "";
  const heading = needsFlats(spellings) ? flatName(named) : named;

  return (
    <section className="piano-staff" aria-label="Notes on the staff">
      <div className="piano-staff-caption">
        <span className="studio-eyebrow">ON THE STAFF</span>
        <strong>{heading || "Play a key"}</strong>
        <span aria-live="polite">
          {names.length
            ? names.join("  ")
            : "Every note you play is written here as you play it."}
        </span>
      </div>
      <div className="piano-staff-scroll" ref={holder}>
        <svg
          width={width * SCALE}
          height={height * SCALE}
          viewBox={`0 ${top} ${width} ${height}`}
          role="img"
          aria-label={
            names.length
              ? `Grand staff showing ${names.join(", ")}`
              : "Empty grand staff"
          }
        >
          {LINES.map((y) => (
            <line
              key={y}
              x1={LEFT}
              x2={width - 12}
              y1={y}
              y2={y}
              className="staff-line"
            />
          ))}
          <line x1={LEFT} x2={LEFT} y1={45} y2={185} className="staff-line" />
          {/* The brace that joins the two staves into one grand staff. */}
          <path
            className="staff-brace"
            d={`M ${LEFT - 6} 45 C ${LEFT - 22} 52, ${LEFT - 4} 100, ${LEFT - 18} 115 C ${LEFT - 4} 130, ${LEFT - 22} 178, ${LEFT - 6} 185 C ${LEFT - 15} 170, ${LEFT + 1} 132, ${LEFT - 12} 115 C ${LEFT + 1} 98, ${LEFT - 15} 60, ${LEFT - 6} 45 Z`}
          />
          <text className="staff-clef" x={LEFT + 4} y={83} fontSize="54">
            𝄞
          </text>
          <text className="staff-clef" x={LEFT + 6} y={175} fontSize="42">
            𝄢
          </text>
          {columns.map((column, index) => {
            const x = FIRST + index * STEP;
            const anyShift = column.notes.some((note) => note.shifted);
            // Accidentals close together step leftward so they never collide.
            const signX = new Map<number, number>();
            let lastY = -Infinity;
            let nudge = 0;
            for (const note of [...column.notes].reverse())
              if (note.sign) {
                nudge = note.y - lastY < 26 ? nudge + 11 : 0;
                lastY = note.y;
                signX.set(note.midi, x - 24 - nudge);
              }
            return (
              <g key={index}>
                {column.notes.map((note) => {
                  const cx = x + (note.shifted ? 13 : 0);
                  return (
                    <g
                      key={note.midi}
                      className={`staff-note ${note.sounding ? "sounding" : ""}`}
                    >
                      {note.ledger.map((y) => (
                        <line
                          key={y}
                          x1={x - 11}
                          x2={x + (anyShift ? 24 : 11)}
                          y1={y}
                          y2={y}
                          className="staff-ledger"
                        />
                      ))}
                      {note.sign && (
                        <text
                          x={signX.get(note.midi) ?? x - 24}
                          y={note.y + 6}
                          fontSize="19"
                          className="staff-sign"
                        >
                          {note.sign}
                        </text>
                      )}
                      <ellipse
                        cx={cx}
                        cy={note.y}
                        rx="7.4"
                        ry="5.2"
                        transform={`rotate(-20 ${cx} ${note.y})`}
                        className="staff-head"
                      />
                      <ellipse
                        cx={cx}
                        cy={note.y}
                        rx="3.6"
                        ry="2.2"
                        transform={`rotate(-35 ${cx} ${note.y})`}
                        className="staff-hole"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
