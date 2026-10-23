import { useEffect, useRef, useState } from "react";
import { staffNotes, type StaffNote } from "../../lib/staffNotation";

export default function StaffPreview({
  notes,
  beats,
  preferred,
  flats,
  selectedId,
  onSelect,
}: {
  notes: StaffNote[];
  beats: number;
  preferred: string[];
  flats: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(700);
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      setAvailable(holder.current?.clientWidth ?? 700),
    );
    if (holder.current) observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);
  const model = staffNotes(notes, preferred, flats);
  const width = Math.max(660, available, beats * 88 + 64);
  const minY = Math.min(0, ...model.map((note) => note.y - 40));
  const height = Math.max(240, ...model.map((note) => note.y + 40)) - minY;
  const xFor = (beat: number) => 78 + (beat / beats) * (width - 100);
  return (
    <section className="staff-preview" aria-label="Staff preview">
      <div className="staff-caption">
        <strong>On the staff</strong>
        <span>
          Pitch preview ·{" "}
          {notes.length
            ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}`
            : "Place a note in the grid below"}
        </span>
      </div>
      <div className="staff-scroll" ref={holder}>
        <svg
          width={width}
          height={height}
          viewBox={`0 ${minY} ${width} ${height}`}
          role="group"
          aria-label="Treble and bass staff"
        >
          {[45, 55, 65, 75, 85, 145, 155, 165, 175, 185].map((y) => (
            <line
              key={y}
              x1="42"
              x2={width - 15}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth=".7"
              opacity=".45"
            />
          ))}
          <text className="staff-clef" x="43" y="82" fontSize="54">
            𝄞
          </text>
          <text className="staff-clef" x="44" y="174" fontSize="42">
            𝄢
          </text>
          {Array.from({ length: Math.floor(beats / 4) + 1 }, (_, bar) => (
            <g key={bar}>
              <line
                x1={xFor(bar * 4) - 13}
                x2={xFor(bar * 4) - 13}
                y1="45"
                y2="185"
                stroke="currentColor"
                opacity=".3"
              />
              {bar * 4 < beats && (
                <text x={xFor(bar * 4)} y="24" fontSize="10" opacity=".6">
                  BAR {bar + 1}
                </text>
              )}
            </g>
          ))}
          {model.map((note, index) => {
            const simultaneous = model
              .slice(0, index)
              .filter(
                (other) =>
                  other.startBeat === note.startBeat &&
                  Math.abs(other.y - note.y) <= 5,
              ).length;
            const x = xFor(note.startBeat) + simultaneous * 10;
            const middle = note.clef === "treble" ? 65 : 165;
            const up = note.y >= middle;
            const stemX = x + (up ? 5 : -5);
            const stemY = note.y + (up ? -28 : 28);
            return (
              <g
                key={note.id}
                className={
                  selectedId === note.id
                    ? "staff-event selected"
                    : "staff-event"
                }
                role="button"
                tabIndex={0}
                aria-label={`Select ${note.name}, beat ${note.startBeat + 1}`}
                onClick={() => onSelect(note.id)}
                onKeyDown={(event) => {
                  if (["Enter", " "].includes(event.key)) {
                    event.preventDefault();
                    onSelect(note.id);
                  }
                }}
              >
                <title>
                  {note.name} · {note.durationBeats} beats
                </title>
                <rect
                  x={x - 17}
                  y={note.y - 36}
                  width="36"
                  height="72"
                  fill="transparent"
                />
                {note.ledger.map((y) => (
                  <line
                    key={y}
                    x1={x - 10}
                    x2={x + 10}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                  />
                ))}
                {note.sign && (
                  <text
                    x={x - 19 - simultaneous * 4}
                    y={note.y + 5}
                    fontSize="19"
                    className="staff-accidental"
                  >
                    {note.sign}
                  </text>
                )}
                <ellipse
                  cx={x}
                  cy={note.y}
                  rx="5.5"
                  ry="3.7"
                  transform={`rotate(-18 ${x} ${note.y})`}
                  fill={note.hollow ? "#f1ecdf" : "currentColor"}
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                {note.stem && (
                  <line
                    x1={stemX}
                    x2={stemX}
                    y1={note.y}
                    y2={stemY}
                    stroke="currentColor"
                    strokeWidth="1.1"
                  />
                )}
                {Array.from({ length: note.flags }, (_, flag) => (
                  <path
                    key={flag}
                    d={`M${stemX},${stemY + (up ? 1 : -1) * flag * 6} q12,${up ? 8 : -8} 5,${up ? 17 : -17}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                ))}
                {note.dotted && (
                  <circle
                    cx={x + 12}
                    cy={note.y - 2}
                    r="1.6"
                    fill="currentColor"
                  />
                )}
              </g>
            );
          })}
          {!notes.length && (
            <text
              x={width / 2}
              y="119"
              textAnchor="middle"
              fontSize="13"
              opacity=".5"
            >
              Your notes will appear here.
            </text>
          )}
        </svg>
      </div>
    </section>
  );
}
