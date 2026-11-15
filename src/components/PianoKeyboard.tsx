import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { ChevronLeft, ChevronRight, Play, Radio, RotateCcw } from "lucide-react";
import { useStudioSession } from "../context/StudioSession";
import { useMidiSession } from "../context/MidiSession";
import { NOTE_NAMES, formatNote, voiceNotes } from "../lib/noteSelection";
import { FLAT_NAMES } from "../lib/staffNotation";
import { selectionNoteLabels } from "../lib/musicNotation";
import { pianoSelection } from "../lib/pianoSelection";
import { describeInterval } from "../lib/intervals";
import {
  POSITION_NAMES,
  inversionOf,
  invert,
  rootPosition,
} from "../lib/inversions";
import type { Selection } from "../context/StudioSession";
import InstrumentSelector from "./InstrumentSelector";
import MidiSettings from "./MidiSettings";

const NATURALS = [0, 2, 4, 5, 7, 9, 11];
type Mode = "single" | "chord" | "interval";
const MODE_LABELS: Record<Mode, string> = {
  single: "Single notes",
  chord: "Build a chord",
  interval: "Two notes",
};

/** The keys on show: every white key from C up to the top C, and the black keys between. */
function keyLayout(octave: number, octaves: number) {
  const base = (octave + 1) * 12;
  const whites: number[] = [];
  for (let step = 0; step <= 12 * octaves; step++)
    if (NATURALS.includes(step % 12)) whites.push(base + step);
  const blacks = whites
    .slice(0, -1)
    .map((white, index) => ({ midi: white + 1, after: index + 1 }))
    .filter(({ midi }) => !NATURALS.includes(midi % 12));
  return { whites, blacks };
}

export default function PianoKeyboard() {
  const {
    selection,
    select,
    playing,
    play,
    stop,
    octave,
    setOctave,
    instrument,
    setInstrument,
  } = useStudioSession();
  const [mode, setMode] = useState<Mode>("single");
  // Two octaves when there's room, one on a narrow screen.
  const [octaves, setOctaves] = useState(1);
  const workspace = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = workspace.current;
    if (!element) return;
    const measure = () => setOctaves(element.clientWidth >= 700 ? 2 : 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const highest = 7 - octaves;
  const shown = Math.max(1, Math.min(octave, highest));
  const { whites, blacks } = keyLayout(shown, octaves);
  const noteName = (note: number) =>
    `${NOTE_NAMES[note % 12].replace("#", "♯")}${Math.floor(note / 12) - 1}`;
  // Two notes: the pair being measured, in the order they were tapped.
  const [pair, setPair] = useState<number[]>([]);
  const [step, setStep] = useState<number | null>(null);
  const intervalTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopIntervalSteps = useCallback(() => {
    intervalTimers.current.forEach(clearTimeout);
    intervalTimers.current = [];
    setStep(null);
  }, []);
  const keyboard = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; target: HTMLElement } | null>(null);
  const midi = useMidiSession();
  const screenHeld = useRef<number | null>(null);
  const { scaleMidi, scaleDescending, scalePlayback } = useStudioSession();
  const descending =
    scalePlayback.direction === "down" || (playing && scaleDescending);
  const selectedNotes =
    selection.kind === "scale" && descending
      ? (selection.descendingNotes ?? selection.notes)
      : selection.notes;
  const selectedMidi = selection.midiNotes ?? voiceNotes(selectedNotes, octave);
  const labels = selectionNoteLabels({ ...selection, descending });
  const soundHeld = useCallback(() => {
    const held: number[] = [];
    if (screenHeld.current !== null) held.push(screenHeld.current);
    if (!held.length) {
      stop();
      return;
    }
    const next = pianoSelection(held);
    select(next);
    void play(next);
  }, [play, select, stop]);
  useEffect(() => {
    if (!playing) {
      screenHeld.current = null;
      stopIntervalSteps();
    }
  }, [playing, stopIntervalSteps]);
  useEffect(() => stopIntervalSteps, [stopIntervalSteps]);
  // If the selection changes somewhere else, the pair follows it.
  const chosenKey = (selection.midiNotes ?? []).join(",");
  useEffect(() => {
    if (mode !== "interval") return;
    setPair((current) =>
      [...current].sort((a, b) => a - b).join(",") === chosenKey
        ? current
        : chosenKey && chosenKey.split(",").length <= 2
          ? chosenKey.split(",").map(Number)
          : [],
    );
  }, [chosenKey, mode]);
  const interval = pair.length === 2 ? describeInterval(pair[0], pair[1]) : null;
  /** Lower note, upper note, then both together. */
  const hearInterval = (both: Selection) => {
    stopIntervalSteps();
    const [low, high] = both.midiNotes!;
    const single = (note: number): Selection => ({
      name: noteName(note),
      notes: [NOTE_NAMES[note % 12]],
      midiNotes: [note],
      kind: "note",
    });
    setStep(low);
    void play(single(low));
    intervalTimers.current.push(
      setTimeout(() => {
        setStep(high);
        void play(single(high));
      }, 700),
      setTimeout(() => {
        setStep(null);
        intervalTimers.current = [];
        void play(both);
      }, 1400),
    );
  };
  const pairSelection = (notes: number[]): Selection => {
    const [low, high] = [...notes].sort((a, b) => a - b);
    const info = describeInterval(low, high);
    return {
      name: `${formatNote(info.spellings[0])} to ${formatNote(info.spellings[1])}`,
      notes: [NOTE_NAMES[low % 12], NOTE_NAMES[high % 12]],
      midiNotes: [low, high],
      kind: "chord",
      spellings: info.spellings,
    };
  };
  const tapInterval = (note: number) => {
    const next = pair.includes(note)
      ? pair.filter((held) => held !== note)
      : pair.length < 2
        ? [...pair, note]
        : [pair[0], note];
    setPair(next);
    stopIntervalSteps();
    if (!next.length) {
      stop();
      select(pianoSelection([]));
    } else if (next.length === 1) {
      const one = pianoSelection(next);
      select(one);
      void play(one);
    } else {
      const both = pairSelection(next);
      select(both);
      hearInterval(both);
    }
  };
  // Inversions: the same chord with a different note on the bottom.
  const stack = mode === "interval" ? null : rootPosition(selection, shown);
  const position = stack ? inversionOf(stack, selectedMidi) : 0;
  const bassIndex = selectedMidi.indexOf(Math.min(...selectedMidi));
  const setPosition = (steps: number) => {
    if (!stack) return;
    const notes = invert(stack, steps);
    const next: Selection = {
      name: selection.name,
      notes: notes.map((note) => NOTE_NAMES[note % 12]),
      midiNotes: notes,
      kind: "chord",
    };
    select(next);
    void play(next);
  };
  const shiftOctave = (change: number) => {
    const next = shown + change;
    if (next < 1 || next > highest) return;
    // Anything built by hand moves with the keyboard, so it stays in view.
    if (selection.midiNotes) {
      const moved = selection.midiNotes.map((note) => note + 12 * change);
      setPair((current) => current.map((note) => note + 12 * change));
      select({ ...selection, midiNotes: moved });
    }
    setOctave(next);
  };
  const setPointerNote = (note: number | null) => {
    if (screenHeld.current === note) return;
    screenHeld.current = note;
    soundHeld();
  };
  const releasePointer = (id: number) => {
    if (pointer.current?.id !== id) return;
    setPointerNote(null);
    const held = pointer.current;
    pointer.current = null;
    if (held.target.hasPointerCapture(id))
      held.target.releasePointerCapture(id);
  };
  const toggleChord = (note: number) => {
    const notes = new Set(selectedMidi);
    if (notes.has(note)) notes.delete(note);
    else notes.add(note);
    const next = pianoSelection([...notes]);
    select(next);
    if (notes.size) void play(next);
    else stop();
  };
  const press = (event: PointerEvent<HTMLButtonElement>, note: number) => {
    event.preventDefault();
    if (mode === "chord") {
      toggleChord(note);
      return;
    }
    if (mode === "interval") {
      tapInterval(note);
      return;
    }
    if (pointer.current && pointer.current.id !== event.pointerId) return;
    pointer.current = { id: event.pointerId, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerNote(note);
  };
  const clear = () => {
    stop();
    midi.panic();
    pointer.current = null;
    setPair([]);
    stopIntervalSteps();
    select(pianoSelection([]));
  };
  const keyLabel = (note: number) => {
    const index = selectedNotes.indexOf(NOTE_NAMES[note % 12]);
    if (index >= 0) return labels[index];
    // With nothing chosen a black key has two equally good names, so show both.
    const sharp = NOTE_NAMES[note % 12];
    return sharp.includes("#")
      ? `${formatNote(sharp)} ${formatNote(FLAT_NAMES[note % 12])}`
      : sharp;
  };
  /** In Two notes mode, number each key on the way up: the half steps, counted. */
  const halfStep = (note: number) => {
    if (!interval) return null;
    const low = Math.min(...pair),
      high = Math.max(...pair);
    return note > low && note <= high ? (
      <em className="piano-step" aria-hidden="true">
        {note - low}
      </em>
    ) : null;
  };
  const keyProps = (note: number) => ({
    type: "button" as const,
    "data-piano-note": note,
    "data-selected": selectedMidi.includes(note),
    "data-sounding":
      (playing &&
        (selection.kind === "scale"
          ? scaleMidi === note
          : step !== null
            ? step === note
            : selectedMidi.includes(note))) ||
      midi.activeNotes.includes(note),
    "aria-label": `${NOTE_NAMES[note % 12].replace("#", " sharp ")} ${Math.floor(note / 12) - 1}`,
    "aria-pressed": selectedMidi.includes(note),
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
      press(event, note),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (![" ", "Enter"].includes(event.key) || event.repeat) return;
      event.preventDefault();
      if (mode === "chord") toggleChord(note);
      else if (mode === "interval") tapInterval(note);
      else {
        screenHeld.current = note;
        soundHeld();
      }
    },
    onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (mode === "single" && [" ", "Enter"].includes(event.key)) {
        event.preventDefault();
        setPointerNote(null);
      }
    },
    onBlur: () => {
      if (mode === "single" && screenHeld.current === note)
        setPointerNote(null);
    },
  });
  return (
    <section
      className="piano-workspace"
      aria-label="Interactive piano"
      ref={workspace}
    >
      <div className="piano-toolbar">
        <InstrumentSelector selected={instrument} onSelect={setInstrument} />
        <div className="piano-mode" role="group" aria-label="Playing mode">
          {(["single", "chord", "interval"] as const).map((choice) => (
            <button
              key={choice}
              aria-pressed={mode === choice}
              onClick={() => {
                if (mode !== choice) {
                  clear();
                  setMode(choice);
                }
              }}
            >
              {MODE_LABELS[choice]}
            </button>
          ))}
        </div>
        <div className="piano-midi">
          <span>
            <Radio size={13} />{" "}
            {!midi.enabled
              ? "MIDI muted"
              : midi.selectedDevice
                ? "MIDI connected"
                : "MIDI"}
          </span>
          <MidiSettings
            devices={midi.devices}
            selectedDeviceId={midi.selectedDeviceId}
            onSelectDevice={midi.selectDevice}
            isSupported={midi.isSupported}
            error={midi.error || midi.audioError || null}
            onRequestAccess={midi.requestMidiAccess}
            onPanic={midi.panic}
            enabled={midi.enabled}
            onToggleEnabled={midi.toggleEnabled}
            onUnlock={midi.unlock}
            audioReady={midi.audioReady}
          />
        </div>
      </div>
      <div className="piano-instruction">
        <p>
          {mode === "single"
            ? "Press, hold, and wander. Slide between notes."
            : mode === "chord"
              ? "Tap keys to add or remove notes. Use the player below to stop or replay your chord."
              : "Tap two keys. You'll hear the lower note, the upper note, then both together."}
        </p>
        <button onClick={clear} disabled={!selection.notes.length}>
          <RotateCcw size={13} /> Clear
        </button>
      </div>
      {mode === "interval" && (
        <div className="interval-readout" role="status">
          {interval ? (
            <>
              <div>
                <span className="studio-eyebrow">
                  {formatNote(interval.spellings[0])} UP TO{" "}
                  {formatNote(interval.spellings[1])}
                </span>
                <strong>{interval.name}</strong>
              </div>
              <p>{interval.why}</p>
              <button onClick={() => hearInterval(pairSelection(pair))}>
                <Play size={12} fill="currentColor" /> Hear it again
              </button>
            </>
          ) : (
            <p>
              {pair.length
                ? `${noteName(pair[0])} is your first note. Tap a second key to measure the distance.`
                : "The distance between two notes is called an interval. Tap any two keys and Lumina will name it and count the half steps on the keys."}
            </p>
          )}
        </div>
      )}
      {stack && (
        <div
          className="inversion-row"
          role="group"
          aria-label="Chord position"
        >
          <span className="studio-eyebrow">NOTE ON THE BOTTOM</span>
          {stack.map((_, index) => (
            <button
              key={index}
              aria-pressed={position === index}
              onClick={() => setPosition(index)}
            >
              {POSITION_NAMES[index]}
            </button>
          ))}
          <span className="inversion-name">
            {position === 0
              ? `${formatNote(selection.name)}, stacked from its root`
              : `${formatNote(selection.name)}/${labels[bassIndex]}, with ${labels[bassIndex]} on the bottom`}
          </span>
        </div>
      )}
      <div
        className="piano-keybed"
        ref={keyboard}
        onPointerMove={(event) => {
          if (mode !== "single" || pointer.current?.id !== event.pointerId)
            return;
          const key = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>("[data-piano-note]");
          setPointerNote(
            key && keyboard.current?.contains(key)
              ? Number(key.dataset.pianoNote)
              : null,
          );
        }}
        onPointerLeave={(event) => {
          if (mode === "single" && pointer.current?.id === event.pointerId)
            setPointerNote(null);
        }}
        onPointerUp={(event) => releasePointer(event.pointerId)}
        onPointerCancel={(event) => releasePointer(event.pointerId)}
        onLostPointerCapture={(event) => releasePointer(event.pointerId)}
      >
        <div
          className="piano-white-keys"
          style={{
            gridTemplateColumns: `repeat(${whites.length}, minmax(0, 1fr))`,
          }}
        >
          {whites.map((note) => (
            <button key={note} className="piano-white-key" {...keyProps(note)}>
              {halfStep(note)}
              <span>
                {keyLabel(note)}
                <small>{Math.floor(note / 12) - 1}</small>
              </span>
            </button>
          ))}
        </div>
        {blacks.map(({ midi: note, after }) => (
          <button
            key={note}
            className="piano-black-key"
            style={{
              left: `${(after / whites.length) * 100}%`,
              width: `${60 / whites.length}%`,
            }}
            {...keyProps(note)}
          >
            {halfStep(note)}
            <span>{keyLabel(note)}</span>
          </button>
        ))}
      </div>
      <div className="piano-footnote">
        <span className="octave-switch" role="group" aria-label="Keyboard range">
          <button
            aria-label="Move the keyboard an octave lower"
            disabled={shown <= 1}
            onClick={() => shiftOctave(-1)}
          >
            <ChevronLeft size={14} /> Lower
          </button>
          <strong>
            C{shown} <i /> C{shown + octaves}
          </strong>
          <button
            aria-label="Move the keyboard an octave higher"
            disabled={shown >= highest}
            onClick={() => shiftOctave(1)}
          >
            Higher <ChevronRight size={14} />
          </button>
        </span>
        <span>
          {mode === "chord"
            ? "A little harmony, one note at a time."
            : mode === "interval"
              ? "Every tune is made of these distances."
              : "Your next melody starts anywhere."}
        </span>
      </div>
    </section>
  );
}
