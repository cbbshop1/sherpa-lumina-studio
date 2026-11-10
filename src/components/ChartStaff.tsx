import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart, ChartNote } from "../lib/musicxml";
import type { Reading } from "../lib/harmony";
import { formatNote } from "../lib/noteSelection";

const G = 9, // distance between staff lines
  BASE_UNIT = 34, // width of one quarter note before stretching
  PAD = 16,
  TOP = 44,
  BOTTOM = TOP + 4 * G + 90,
  CHORDS = BOTTOM + 4 * G + 36,
  HEIGHT = CHORDS + 96;
const LETTERS = "CDEFGAB";
const SHARP_ORDER = "FCGDAEB",
  FLAT_ORDER = "BEADGCF";
// Where each key-signature sign sits, counted in steps up from the bottom line of the treble staff.
const SHARP_SPOTS = [8, 5, 9, 6, 3, 7, 4],
  FLAT_SPOTS = [4, 7, 3, 6, 2, 5, 1];
const SIGNS: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "♮", 1: "♯", 2: "𝄪" };
const GLYPHS = '"Noto Music", "Segoe UI Symbol", "Apple Symbols", Symbola, serif';

type Props = {
  chart: Chart;
  reading: Reading;
  naming: "numerals" | "clock";
  /** Where playback is, in quarter notes from the top, or null when stopped at the start. */
  time: number | null;
  onSeek: (time: number) => void;
};

type System = { first: number; last: number; unit: number; lead: number; x: number[] };

export default function ChartStaff({ chart, reading, naming, time, onSeek }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(320, element.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const keyWidth = Math.abs(chart.fifths) * 9 + (chart.fifths ? 6 : 0);
  // A narrow screen gets tighter spacing so at least two bars share a line.
  const UNIT = width < 560 ? 25 : BASE_UNIT;
  const systems = useMemo(() => {
    const list: System[] = [];
    let first = 0;
    while (first < chart.bars.length) {
      const lead = 52 + keyWidth + (first === 0 ? 24 : 0);
      const room = width - lead - 10;
      let last = first,
        used = PAD + chart.bars[first].length * UNIT;
      while (
        last + 1 < chart.bars.length &&
        used + PAD + chart.bars[last + 1].length * UNIT <= room
      ) {
        last++;
        used += PAD + chart.bars[last].length * UNIT;
      }
      const count = last - first + 1;
      const music = used - PAD * count;
      const final = last === chart.bars.length - 1;
      const stretch = Math.min(final ? 1.25 : 3, (room - PAD * count) / music);
      const unit = UNIT * Math.max(0.6, stretch);
      const x: number[] = [];
      let at = lead;
      for (let bar = first; bar <= last; bar++) {
        x.push(at);
        at += PAD + chart.bars[bar].length * unit;
      }
      x.push(at);
      list.push({ first, last, unit, lead, x });
      first = last + 1;
    }
    return list;
  }, [chart, width, keyWidth, UNIT]);

  // Which part carries the words.
  const wordsPart = useMemo(() => {
    const counts = [0, 1, 2, 3].map(
      (part) => chart.bars.flatMap((bar) => bar.parts[part]).filter((note) => note.lyric).length,
    );
    const most = Math.max(...counts);
    return most ? counts.indexOf(most) : -1;
  }, [chart]);

  const keyAlter = (step: string) =>
    chart.fifths > 0
      ? SHARP_ORDER.slice(0, chart.fifths).includes(step)
        ? 1
        : 0
      : FLAT_ORDER.slice(0, -chart.fifths).includes(step)
        ? -1
        : 0;

  return (
    <div className="chart-staff" ref={holder}>
      {systems.map((system) => {
        const start = reading.barStarts[system.first],
          end = reading.barStarts[system.last + 1];
        const xOf = (bar: number, at: number) =>
          system.x[bar - system.first] + PAD + at * system.unit;
        const xAt = (when: number) => {
          if (when >= end) return system.x[system.x.length - 1];
          let bar = system.first;
          while (bar < system.last && reading.barStarts[bar + 1] <= when) bar++;
          return xOf(bar, when - reading.barStarts[bar]);
        };
        const right = system.x[system.x.length - 1];
        const staffTop = (staff: number) => (staff === 0 ? TOP : BOTTOM);
        // Steps above the bottom line of the staff the note is written on.
        const spot = (note: ChartNote, staff: number) =>
          (note.octave + (staff === 0 && chart.octaveTreble ? 1 : 0)) * 7 +
          LETTERS.indexOf(note.step) -
          (staff === 0 ? 30 : 18);
        const yOf = (place: number, staff: number) =>
          staffTop(staff) + 4 * G - (place * G) / 2;

        const marks: JSX.Element[] = [];
        for (let bar = system.first; bar <= system.last; bar++) {
          const data = chart.bars[bar];
          for (const staff of [0, 1]) {
            const upper = data.parts[staff * 2],
              lower = data.parts[staff * 2 + 1];
            // Sharps, flats and naturals last until the barline, as on paper.
            const state = new Map<string, number>();
            const shown = new Map<ChartNote, string>();
            [...upper, ...lower]
              .filter((note) => note.midi !== null)
              .sort((a, b) => a.at - b.at)
              .forEach((note) => {
                const key = `${note.step}${note.octave}`;
                const current = state.get(key) ?? keyAlter(note.step);
                if (note.alter !== current && !note.tieStop)
                  shown.set(note, SIGNS[note.alter] ?? "");
                state.set(key, note.alter);
              });
            [upper, lower].forEach((part, which) => {
              const up = which === 0;
              const other = which === 0 ? lower : upper;
              part.forEach((note, index) => {
                const key = `${bar}-${staff}-${which}-${index}`;
                if (note.midi === null) {
                  // One rest serves both parts when they rest together.
                  const shared = other.some(
                    (twin) => twin.midi === null && twin.at === note.at && twin.length === note.length,
                  );
                  if (shared && !up) return;
                  const y = staffTop(staff) + (shared ? 2 : up ? 1 : 3) * G;
                  const whole = note.length >= data.length || note.length >= 4;
                  const x = whole
                    ? (system.x[bar - system.first] + system.x[bar - system.first + 1]) / 2
                    : xOf(bar, note.at);
                  marks.push(
                    whole || note.length >= 2 ? (
                      <rect
                        key={key}
                        x={x - 6}
                        y={whole ? y - (shared ? G : 0) : y - 4 + (shared ? 0 : 0)}
                        width={12}
                        height={4}
                        className="chart-ink"
                      />
                    ) : (
                      <text key={key} x={x} y={y + 6} className="chart-glyph" fontSize={24} textAnchor="middle">
                        {note.length >= 1 ? "𝄽" : "𝄾"}
                      </text>
                    ),
                  );
                  return;
                }
                const place = spot(note, staff);
                const twin = other.find((n) => n.midi !== null && n.at === note.at);
                const crowded = !!twin && Math.abs(spot(twin, staff) - place) === 1 && !up;
                const x = xOf(bar, note.at) + (crowded ? 11 : 0);
                const y = yOf(place, staff);
                const hollow = note.length >= 2;
                const stem = note.length < 4;
                const flags = note.length < 1 ? (note.length <= 0.25 ? 2 : 1) : 0;
                const dotted = [6, 3, 1.5, 0.75].includes(note.length);
                const stemX = up ? x + 5 : x - 5;
                const tip = up ? y - 29 : y + 29;
                const ledgers: number[] = [];
                for (let line = -2; line >= place; line -= 2) ledgers.push(line);
                for (let line = 10; line <= place; line += 2) ledgers.push(line);
                marks.push(
                  <g key={key}>
                    {ledgers.map((line) => (
                      <line
                        key={line}
                        x1={x - 9}
                        x2={x + 9}
                        y1={yOf(line, staff)}
                        y2={yOf(line, staff)}
                        className="chart-line"
                      />
                    ))}
                    {shown.has(note) && (
                      <text x={x - 15} y={y + 5} className="chart-glyph" fontSize={16} textAnchor="middle">
                        {shown.get(note)}
                      </text>
                    )}
                    <ellipse
                      cx={x}
                      cy={y}
                      rx={5.6}
                      ry={4}
                      transform={`rotate(-20 ${x} ${y})`}
                      className={hollow ? "chart-hollow" : "chart-ink"}
                    />
                    {stem && <line x1={stemX} x2={stemX} y1={y} y2={tip} className="chart-stem" />}
                    {Array.from({ length: flags }, (_, flag) => {
                      const from = tip + (up ? 1 : -1) * flag * 7;
                      return (
                        <path
                          key={flag}
                          d={`M${stemX} ${from} q 9 ${up ? 7 : -7} 6 ${up ? 17 : -17}`}
                          className="chart-flag"
                        />
                      );
                    })}
                    {dotted && (
                      <circle cx={x + 10} cy={place % 2 === 0 ? y - G / 2 : y} r={1.7} className="chart-ink" />
                    )}
                    {note.tieStart && (
                      <path
                        d={`M${x + 4} ${y + (up ? 7 : -7)} q ${(note.length * system.unit) / 2 - 4} ${up ? 8 : -8} ${note.length * system.unit - 8} 0`}
                        className="chart-flag"
                      />
                    )}
                    {note.lyric && staff * 2 + which === wordsPart && (
                      <text x={x} y={TOP + 4 * G + 52} className="chart-lyric" textAnchor="middle">
                        {note.lyric}
                      </text>
                    )}
                  </g>,
                );
              });
            });
          }
        }

        // Chord names, on two rows so close neighbours don't sit on each other.
        const edge = [0, 0];
        const labels = reading.harmonies
          .filter((harmony) => harmony.name && harmony.bar >= system.first && harmony.bar <= system.last)
          .map((harmony) => {
            const x = xOf(harmony.bar, harmony.at);
            const name = formatNote(harmony.name);
            const under = naming === "clock" ? `${harmony.clock} o'clock` : harmony.numeral;
            const wide = Math.max(name.length * 8.5, under.length * 6.6) + 10;
            const row = x >= edge[0] ? 0 : 1;
            edge[row] = x + wide;
            return (
              <g key={harmony.start} transform={`translate(${x - 5} ${CHORDS + row * 32})`}>
                <text className="chart-chord">{name}</text>
                <text className="chart-numeral" y={14}>
                  {under}
                </text>
              </g>
            );
          });

        const spans = reading.brackets
          .filter((bracket) => bracket.start < end && bracket.end > start)
          .map((bracket) => {
            const from = xAt(Math.max(bracket.start, start)) - 6,
              to = xAt(Math.min(bracket.end, end)) - 10;
            const y = CHORDS + 66 + (bracket.kind === "circle" ? 16 : 0);
            const opens = bracket.start >= start,
              closes = bracket.end <= end;
            return (
              <g key={`${bracket.kind}${bracket.start}`} className={`chart-bracket ${bracket.kind}`}>
                <path
                  d={`M${from} ${y - (opens ? 6 : 0)} V${y} H${to} V${y - (closes ? 6 : 0)}`}
                />
                {/* A label that would run off the page is tucked back against the edge. */}
                {from + 6 + bracket.label.length * 5.6 > width - 8 ? (
                  <text x={Math.min(to, width - 8)} y={y + 12} textAnchor="end">
                    {opens ? bracket.label : "…continues"}
                  </text>
                ) : (
                  <text x={from + 6} y={y + 12}>
                    {opens ? bracket.label : "…continues"}
                  </text>
                )}
              </g>
            );
          });

        const cursor = time !== null && time >= start && time < end ? xAt(time) : null;
        return (
          <svg
            key={system.first}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={`Bars ${chart.bars[system.first].number} to ${chart.bars[system.last].number}`}
          >
            {[0, 1].map((staff) =>
              [0, 1, 2, 3, 4].map((line) => (
                <line
                  key={`${staff}${line}`}
                  x1={10}
                  x2={right}
                  y1={staffTop(staff) + line * G}
                  y2={staffTop(staff) + line * G}
                  className="chart-line"
                />
              )),
            )}
            <line x1={10} x2={10} y1={TOP} y2={BOTTOM + 4 * G} className="chart-stem" />
            <text x={14} y={TOP + 4 * G - 2} fontSize={48} className="chart-glyph">
              𝄞
            </text>
            {chart.octaveTreble && (
              <text x={25} y={TOP + 4 * G + 21} fontSize={11} className="chart-eight">
                8
              </text>
            )}
            <text x={16} y={BOTTOM + 27} fontSize={38} className="chart-glyph">
              𝄢
            </text>
            {[0, 1].map((staff) =>
              Array.from({ length: Math.abs(chart.fifths) }, (_, index) => {
                const place =
                  (chart.fifths > 0 ? SHARP_SPOTS : FLAT_SPOTS)[index] - (staff === 1 ? 2 : 0);
                return (
                  <text
                    key={`${staff}${index}`}
                    x={52 + index * 9}
                    y={yOf(place, staff) + 5}
                    fontSize={16}
                    textAnchor="middle"
                    className="chart-glyph"
                  >
                    {chart.fifths > 0 ? "♯" : "♭"}
                  </text>
                );
              }),
            )}
            {system.first === 0 &&
              [0, 1].map((staff) => (
                <g key={staff} className="chart-time">
                  <text x={52 + keyWidth + 8} y={staffTop(staff) + 2 * G - 1} textAnchor="middle">
                    {chart.beats}
                  </text>
                  <text x={52 + keyWidth + 8} y={staffTop(staff) + 4 * G - 1} textAnchor="middle">
                    {chart.beatUnit}
                  </text>
                </g>
              ))}
            {system.x.slice(1).map((x, index) => (
              <line key={x} x1={x} x2={x} y1={TOP} y2={BOTTOM + 4 * G} className="chart-line">
                <title>{index}</title>
              </line>
            ))}
            {Array.from({ length: system.last - system.first + 1 }, (_, index) => {
              const bar = system.first + index;
              const left = system.x[index],
                wide = system.x[index + 1] - left;
              return (
                <g key={bar}>
                  <rect
                    x={left}
                    y={TOP - 14}
                    width={wide}
                    height={BOTTOM + 4 * G + 14 - TOP + 14}
                    className="chart-bar"
                    onClick={() => onSeek(reading.barStarts[bar])}
                  >
                    <title>{`Play from bar ${chart.bars[bar].number}`}</title>
                  </rect>
                  {(index === 0 || chart.bars[bar].uneven) && (
                    <text x={left + 4} y={TOP - 18} className={`chart-number ${chart.bars[bar].uneven ? "uneven" : ""}`}>
                      {chart.bars[bar].number}
                      {chart.bars[bar].uneven ? " ?" : ""}
                      {chart.bars[bar].uneven && (
                        <title>The notes in this bar don't add up in the scan, so it may play unevenly.</title>
                      )}
                    </text>
                  )}
                </g>
              );
            })}
            <g className="chart-marks">
              {marks}
              {labels}
              {spans}
            </g>
            {cursor !== null && (
              <line x1={cursor} x2={cursor} y1={TOP - 10} y2={BOTTOM + 4 * G + 10} className="chart-cursor" />
            )}
          </svg>
        );
      })}
    </div>
  );
}
