import { Play, Square } from "lucide-react";
import { useStudioSession, type Selection } from "../context/StudioSession";
import { NOTE_NAMES, formatNote } from "../lib/noteSelection";
import {
  CHORD_FORMULAS,
  ROOT_SPELLINGS,
  SCALE_FORMULAS,
  chordsForRoot,
  pitchClass,
  selectionRoot,
} from "../lib/musicNotation";

const ROOT = /^([A-G](?:#{1,2}|b{1,2}|♯{1,2}|♭{1,2}|𝄪|𝄫)?)(.*)$/u;

/** Read the current selection back into the picker's two choices. */
function readSelection(selection: Selection) {
  if (!selection.notes.length) return { root: "", type: "" };
  const root = selectionRoot(selection.name, selection.notes[0]);
  const rest = ROOT.exec(selection.name)?.[2] ?? "";
  if (selection.kind === "scale") {
    const scale = Object.keys(SCALE_FORMULAS).find(
      (name) => name.toLowerCase() === rest.trim().toLowerCase(),
    );
    return { root, type: scale ? `scale:${scale}` : "" };
  }
  if (selection.kind === "chord") {
    const known =
      !selection.spellings &&
      !selection.name.includes("·") &&
      CHORD_FORMULAS.some((formula) => formula.suffix === rest.trim());
    return { root, type: known ? `chord:${rest.trim()}` : "" };
  }
  return { root, type: selection.frequency ? "" : "note" };
}

function build(root: string, type: string, octave: number): Selection {
  const start = pitchClass(root);
  if (type.startsWith("chord:")) {
    const suffix = type.slice(6);
    const chord = chordsForRoot(root).find((entry) => entry.suffix === suffix)!;
    return { name: root + suffix, notes: chord.notes, kind: "chord" };
  }
  if (type.startsWith("scale:")) {
    const name = type.slice(6) as keyof typeof SCALE_FORMULAS;
    const formula: { intervals: number[]; descendingIntervals?: number[] } =
      SCALE_FORMULAS[name];
    const names = (intervals: number[]) =>
      intervals.map((interval) => NOTE_NAMES[(start + interval) % 12]);
    return {
      name: `${root} ${name.toLowerCase()}`,
      notes: names(formula.intervals),
      kind: "scale",
      descendingNotes: formula.descendingIntervals
        ? names(formula.descendingIntervals)
        : undefined,
    };
  }
  return { name: `${root}${octave}`, notes: [NOTE_NAMES[start]], kind: "note" };
}

/**
 * Change the note, chord, or scale you're working with, right where you are.
 * It also carries its own Hear and Stop button for rooms without a player bar.
 */
export default function TargetPicker({ label = "WORKING WITH" }: { label?: string }) {
  const { selection, select, octave, playing, togglePlay } = useStudioSession();
  const current = readSelection(selection);
  const choose = (root: string, type: string) =>
    select(build(root || "C", type || "note", octave));
  return (
    <div className="target-picker" role="group" aria-label="Choose a note, chord, or scale">
      <span className="studio-eyebrow">{label}</span>
      <select
        aria-label="Root note"
        value={ROOT_SPELLINGS.includes(current.root) ? current.root : ""}
        onChange={(event) => choose(event.target.value, current.type)}
      >
        {!ROOT_SPELLINGS.includes(current.root) && (
          <option value="">Root</option>
        )}
        {ROOT_SPELLINGS.map((root) => (
          <option key={root} value={root}>
            {formatNote(root)}
          </option>
        ))}
      </select>
      <select
        aria-label="Note, chord, or scale"
        value={current.type}
        onChange={(event) => choose(current.root, event.target.value)}
      >
        {!current.type && (
          <option value="">
            {selection.notes.length ? formatNote(selection.name) : "Choose…"}
          </option>
        )}
        <option value="note">Single note</option>
        <optgroup label="Chords">
          {CHORD_FORMULAS.map((formula) => (
            <option key={formula.suffix} value={`chord:${formula.suffix}`}>
              {formula.name} chord
            </option>
          ))}
        </optgroup>
        <optgroup label="Scales">
          {Object.keys(SCALE_FORMULAS).map((name) => (
            <option key={name} value={`scale:${name}`}>
              {name} scale
            </option>
          ))}
        </optgroup>
      </select>
      <button
        className={`target-hear ${playing ? "on" : ""}`}
        disabled={!selection.notes.length}
        onClick={() => togglePlay()}
      >
        {playing ? (
          <>
            <Square size={11} fill="currentColor" /> Stop
          </>
        ) : (
          <>
            <Play size={12} fill="currentColor" /> Hear it
          </>
        )}
      </button>
    </div>
  );
}
