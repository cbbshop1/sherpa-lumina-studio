import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { Radio, RotateCcw } from "lucide-react";
import { useStudioSession } from "../context/StudioSession";
import { useMidiKeyboard } from "../hooks/useMidiKeyboard";
import { NOTE_NAMES, voiceNotes } from "../lib/noteSelection";
import { selectionNoteLabels } from "../lib/musicNotation";
import { pianoSelection } from "../lib/pianoSelection";
import InstrumentSelector from "./InstrumentSelector";
import MidiSettings from "./MidiSettings";

const whites = [60, 62, 64, 65, 67, 69, 71, 72];
const blacks = [
  { midi: 61, left: 1 },
  { midi: 63, left: 2 },
  { midi: 66, left: 4 },
  { midi: 68, left: 5 },
  { midi: 70, left: 6 },
];

export default function PianoKeyboard() {
  const {
    selection,
    select,
    playing,
    play,
    stop,
    octave,
    instrument,
    setInstrument,
  } = useStudioSession();
  const [mode, setMode] = useState<"single" | "chord">("single");
  const keyboard = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; target: HTMLElement } | null>(null);
  const midiHeld = useRef(new Set<number>());
  const screenHeld = useRef<number | null>(null);
  const selectedMidi =
    selection.midiNotes ?? voiceNotes(selection.notes, octave);
  const labels = selectionNoteLabels(selection);
  const soundHeld = useCallback(() => {
    const held = [...midiHeld.current];
    if (screenHeld.current !== null) held.push(screenHeld.current);
    if (!held.length) {
      stop();
      return;
    }
    const next = pianoSelection(held);
    select(next);
    void play(next);
  }, [play, select, stop]);
  const onMidiPress = useCallback(
    (note: number) => {
      midiHeld.current.add(note);
      soundHeld();
    },
    [soundHeld],
  );
  const onMidiRelease = useCallback(
    (note: number) => {
      if (midiHeld.current.delete(note)) soundHeld();
    },
    [soundHeld],
  );
  const midi = useMidiKeyboard({
    onNotePress: onMidiPress,
    onNoteRelease: onMidiRelease,
    enabled: true,
  });
  useEffect(() => {
    if (!playing) {
      midiHeld.current.clear();
      screenHeld.current = null;
    }
  }, [playing]);
  useEffect(() => {
    midiHeld.current.clear();
    screenHeld.current = null;
    stop();
  }, [midi.selectedDeviceId, stop]);
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
    if (pointer.current && pointer.current.id !== event.pointerId) return;
    pointer.current = { id: event.pointerId, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerNote(note);
  };
  const clear = () => {
    stop();
    pointer.current = null;
    select(pianoSelection([]));
  };
  const keyLabel = (note: number) => {
    const index = selection.notes.indexOf(NOTE_NAMES[note % 12]);
    return index >= 0 ? labels[index] : NOTE_NAMES[note % 12].replace("#", "♯");
  };
  const keyProps = (note: number) => ({
    type: "button" as const,
    "data-piano-note": note,
    "data-selected": selectedMidi.includes(note),
    "data-sounding": playing && selectedMidi.includes(note),
    "aria-label": `${NOTE_NAMES[note % 12].replace("#", " sharp ")} ${Math.floor(note / 12) - 1}`,
    "aria-pressed": selectedMidi.includes(note),
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
      press(event, note),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (![" ", "Enter"].includes(event.key) || event.repeat) return;
      event.preventDefault();
      if (mode === "chord") toggleChord(note);
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
    <section className="piano-workspace" aria-label="Interactive piano">
      <div className="piano-toolbar">
        <InstrumentSelector selected={instrument} onSelect={setInstrument} />
        <div className="piano-mode" role="group" aria-label="Playing mode">
          {(["single", "chord"] as const).map((choice) => (
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
              {choice === "single" ? "Single notes" : "Build a chord"}
            </button>
          ))}
        </div>
        <div className="piano-midi">
          <span>
            <Radio size={13} />{" "}
            {midi.selectedDevice ? "MIDI connected" : "MIDI"}
          </span>
          <MidiSettings
            devices={midi.devices}
            selectedDeviceId={midi.selectedDeviceId}
            onSelectDevice={midi.selectDevice}
            isSupported={midi.isSupported}
            error={midi.error}
          />
        </div>
      </div>
      <div className="piano-instruction">
        <p>
          {mode === "single"
            ? "Press, hold, and wander. Slide between notes."
            : "Tap keys to add or remove notes. Use the player below to stop or replay your chord."}
        </p>
        <button onClick={clear} disabled={!selection.notes.length}>
          <RotateCcw size={13} /> Clear
        </button>
      </div>
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
        <div className="piano-white-keys">
          {whites.map((note) => (
            <button key={note} className="piano-white-key" {...keyProps(note)}>
              <span>
                {keyLabel(note)}
                <small>{Math.floor(note / 12) - 1}</small>
              </span>
            </button>
          ))}
        </div>
        {blacks.map(({ midi: note, left }) => (
          <button
            key={note}
            className="piano-black-key"
            style={{ left: `${left * 12.5}%` }}
            {...keyProps(note)}
          >
            <span>{keyLabel(note)}</span>
          </button>
        ))}
      </div>
      <div className="piano-footnote">
        <span>
          C4 <i /> C5
        </span>
        <span>
          {mode === "chord"
            ? "A little harmony, one note at a time."
            : "Your next melody starts anywhere."}
        </span>
      </div>
    </section>
  );
}
