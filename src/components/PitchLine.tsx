import { useEffect, useMemo, useRef, useState } from "react";
import { NOTE_NAMES, formatNote } from "../lib/noteSelection";
import { selectionNoteLabels } from "../lib/musicNotation";
import {
  trackPitch,
  summarizePitch,
  pitchVerdict,
  closeness,
  nearestNote,
  ON_NOTE_CENTS,
  type PitchFrame,
} from "../lib/pitchTrack";

type Target = {
  name: string;
  notes: readonly string[];
  kind: "chord" | "note" | "scale";
  descendingNotes?: readonly string[];
};

const TOP = 12,
  BOTTOM = 24;
const ON = "#8fd0c2",
  NEAR = "#e7b17e",
  OFF = "#d58070";

/** Draws the sung pitch of a take against the notes the learner was aiming for. */
export default function PitchLine({
  buffer,
  target,
}: {
  buffer: AudioBuffer;
  target: Target;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<PitchFrame[] | null>(null);
  // Draw at the size the picture is actually shown, so labels stay readable
  // on a phone as well as a wide screen.
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(280, element.clientWidth || 900));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const WIDTH = width,
    HEIGHT = width < 560 ? 300 : 380,
    GUTTER = width < 560 ? 42 : 58;

  // Listening takes a moment on a long take, so let the page paint first.
  useEffect(() => {
    setFrames(null);
    const timer = setTimeout(() => {
      const mono = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < mono.length; i++)
          mono[i] += samples[i] / buffer.numberOfChannels;
      }
      setFrames(trackPitch(mono, buffer.sampleRate));
    }, 30);
    return () => clearTimeout(timer);
  }, [buffer]);

  const targetKey = [...target.notes, "|", ...(target.descendingNotes ?? [])].join(",");
  const { pitchClasses, names } = useMemo(() => {
    const labels = target.notes.length
      ? selectionNoteLabels({ ...target, notes: [...target.notes] })
      : [];
    const names = new Map<number, string>();
    target.notes.forEach((note, index) => {
      const pitchClass = NOTE_NAMES.indexOf(note);
      if (pitchClass >= 0 && !names.has(pitchClass))
        names.set(pitchClass, labels[index] ?? formatNote(note));
    });
    // Melodic minor comes down by different notes; those count as targets too.
    target.descendingNotes?.forEach((note) => {
      const pitchClass = NOTE_NAMES.indexOf(note);
      if (pitchClass >= 0 && !names.has(pitchClass))
        names.set(pitchClass, formatNote(note));
    });
    return { pitchClasses: [...names.keys()], names };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.name, target.kind, targetKey]);

  const summary = useMemo(
    () => (frames ? summarizePitch(frames, pitchClasses) : null),
    [frames, pitchClasses],
  );
  const noteName = (midi: number) => {
    const pitchClass = ((midi % 12) + 12) % 12;
    return (
      (names.get(pitchClass) ?? formatNote(NOTE_NAMES[pitchClass])) +
      (Math.floor(midi / 12) - 1)
    );
  };
  const targetName = formatNote(target.name);
  const aim = !pitchClasses.length
    ? ""
    : target.kind === "note"
      ? targetName
      : `the notes of ${targetName}`;
  const verdict = summary ? pitchVerdict(summary, aim) : "";

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !frames || !summary) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    let low = Math.floor(summary.low ?? 57) - 2,
      high = Math.ceil(summary.high ?? 69) + 2;
    while (high - low < 12) {
      low--;
      high++;
    }
    const rows = high - low + 1;
    const rowHeight = (HEIGHT - TOP - BOTTOM) / rows;
    const y = (midi: number) => TOP + (high + 0.5 - midi) * rowHeight;
    const x = (time: number) =>
      GUTTER + (time / buffer.duration) * (WIDTH - GUTTER - 8);
    const isTarget = (midi: number) =>
      pitchClasses.includes(((midi % 12) + 12) % 12);
    const labelEvery = rows > 26 ? 12 : 1;
    context.textBaseline = "middle";
    for (let midi = low; midi <= high; midi++) {
      const top = y(midi + 0.5);
      const aimed = isTarget(midi);
      if (aimed) {
        // The whole row is the note; the brighter stripe is "on it".
        context.fillStyle = "#8fd0c214";
        context.fillRect(GUTTER, top, WIDTH - GUTTER, rowHeight);
        context.fillStyle = "#8fd0c226";
        const stripe = (rowHeight * ON_NOTE_CENTS) / 100;
        context.fillRect(GUTTER, y(midi) - stripe, WIDTH - GUTTER, stripe * 2);
      }
      context.strokeStyle = "#829a8428";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(GUTTER, Math.round(top) + 0.5);
      context.lineTo(WIDTH, Math.round(top) + 0.5);
      context.stroke();
      const natural = !NOTE_NAMES[((midi % 12) + 12) % 12].includes("#");
      if (
        aimed ||
        (labelEvery === 1 ? natural || !pitchClasses.length : midi % 12 === 0)
      ) {
        context.fillStyle = aimed ? "#dff3ec" : "#839b7c";
        context.font = `${aimed ? "bold " : ""}${Math.min(15, Math.max(10, rowHeight * 0.7))}px "Courier New", monospace`;
        context.fillText(noteName(midi), 8, y(midi));
      }
    }
    context.fillStyle = "#839b7c";
    context.font = '11px "Courier New", monospace';
    context.textBaseline = "alphabetic";
    context.fillText("0 s", GUTTER, HEIGHT - 6);
    context.textAlign = "right";
    context.fillText(`${buffer.duration.toFixed(1)} s`, WIDTH - 8, HEIGHT - 6);
    context.textAlign = "left";
    context.lineWidth = width < 560 ? 3 : 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    let previous: { time: number; midi: number } | null = null;
    for (const frame of frames) {
      if (frame.midi === null) {
        previous = null;
        continue;
      }
      const nearest = nearestNote(frame.midi, pitchClasses);
      const cents = Math.abs(frame.midi - nearest) * 100;
      context.strokeStyle = cents <= ON_NOTE_CENTS ? ON : cents <= 50 ? NEAR : OFF;
      context.beginPath();
      if (previous) context.moveTo(x(previous.time), y(previous.midi));
      else context.moveTo(x(frame.time) - 0.5, y(frame.midi));
      context.lineTo(x(frame.time), y(frame.midi));
      context.stroke();
      previous = { time: frame.time, midi: frame.midi };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, summary, pitchClasses, buffer.duration, names, width]);

  const shown = summary?.notes.slice(0, 16) ?? [];
  return (
    <div className="clip-waveform pitch-line">
      <div className="clip-waveform-title">
        <strong>
          {pitchClasses.length
            ? `Your pitch against ${targetName}`
            : "The pitch of your take"}
        </strong>
        <span>{buffer.duration.toFixed(2)} seconds</span>
      </div>
      <canvas
        ref={canvas}
        width={Math.round(WIDTH * (window.devicePixelRatio || 1))}
        height={Math.round(HEIGHT * (window.devicePixelRatio || 1))}
        style={{ height: HEIGHT }}
        role="img"
        aria-label={
          frames ? `Pitch line. ${verdict}` : "Pitch line, still listening"
        }
      />
      {!frames ? (
        <p className="pitch-verdict" role="status">
          Listening to your take…
        </p>
      ) : (
        <>
          <p className="pitch-verdict" role="status">
            {verdict}
          </p>
          {shown.length > 0 && (
            <ul className="pitch-notes" aria-label="Notes you held">
              {shown.map((note, index) => (
                <li
                  key={index}
                  data-fit={
                    !note.onTarget
                      ? "off"
                      : Math.abs(note.cents) <= ON_NOTE_CENTS
                        ? "on"
                        : "near"
                  }
                >
                  <strong>
                    {noteName(note.onTarget ? note.nearest : Math.round(note.midi))}
                  </strong>
                  <span>
                    {note.onTarget
                      ? closeness(note.cents)
                      : `not in ${targetName}`}
                  </span>
                </li>
              ))}
              {summary!.notes.length > shown.length && (
                <li data-fit="more">
                  <span>and {summary!.notes.length - shown.length} more</span>
                </li>
              )}
            </ul>
          )}
          <div className="pitch-key" aria-hidden="true">
            <span data-fit="on">on the note</span>
            <span data-fit="near">close</span>
            <span data-fit="off">off the note</span>
          </div>
        </>
      )}
      <p className="scope-description">
        The line is your voice, moving left to right through the take. Each row
        is one note, higher notes toward the top.{" "}
        {pitchClasses.length
          ? `The lit rows are ${target.kind === "note" ? targetName : `the notes of ${targetName}`}, in any octave, so sing wherever your voice is comfortable. `
          : "Choose a note, chord, or scale first and its rows will light up as targets. "}
        Riding above the middle of a row is sharp, below it is flat. This works
        for one voice or one instrument at a time.
      </p>
    </div>
  );
}
