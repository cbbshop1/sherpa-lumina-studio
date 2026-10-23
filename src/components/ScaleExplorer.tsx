import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import {
  ROOT_SPELLINGS,
  SCALE_FORMULAS,
  pitchClass,
  spellIntervals,
  type ScaleFormula,
} from "../lib/musicNotation";
import { NOTE_NAMES, formatNote } from "../lib/noteSelection";
import { useStudioSession } from "../context/StudioSession";
import type { ScalePlayback } from "../lib/playbackPlan";

const scales = SCALE_FORMULAS;
const majorIntervals = [0, 2, 4, 5, 7, 9, 11];

export default function ScaleExplorer({
  initialRoot = "C",
  initialScale,
  onScaleSelect,
}: {
  initialRoot?: string;
  initialScale?: string;
  onScaleSelect?: (
    notes: string[],
    name: string,
    descendingNotes?: string[],
  ) => void;
}) {
  const [selectedScale, setSelectedScale] = useState<keyof typeof scales>(
    () =>
      (Object.keys(scales).find(
        (name) => name.toLowerCase() === initialScale?.toLowerCase(),
      ) as keyof typeof scales) || "Major",
  );
  const [rootNote, setRootNote] = useState(
    ROOT_SPELLINGS.includes(initialRoot) ? initialRoot : "C",
  );
  const {
    scalePlayback,
    setScalePlayback,
    scaleStep,
    scaleDescending,
    playing,
    selection,
  } = useStudioSession();
  useEffect(() => {
    const root = pitchClass(rootNote);
    const current: ScaleFormula = scales[selectedScale];
    onScaleSelect?.(
      scales[selectedScale].intervals.map(
        (interval) => NOTE_NAMES[(root + interval) % 12],
      ),
      `${rootNote} ${selectedScale.toLowerCase()}`,
      current.descendingIntervals?.map(
        (interval) => NOTE_NAMES[(root + interval) % 12],
      ),
    );
  }, [rootNote, selectedScale, onScaleSelect]);
  const formula: ScaleFormula = scales[selectedScale];
  const descending =
    !!formula.descendingIntervals &&
    (scalePlayback.direction === "down" || (playing && scaleDescending));
  const intervals = descending
    ? formula.descendingIntervals!
    : formula.intervals;
  const spellings = spellIntervals(rootNote, intervals, formula.degrees).map(
    formatNote,
  );
  const labels = [...spellings, spellings[0]];
  const degrees = formula.degrees.map((degree, index) => {
    const difference = intervals[index] - majorIntervals[degree - 1];
    return (
      (difference < 0 ? "♭".repeat(-difference) : "♯".repeat(difference)) +
      degree
    );
  });
  return (
    <section className="scale-explorer" aria-label="Scale explorer">
      <div className="scale-choices">
        <div className="scale-root-choice">
          <label htmlFor="scale-root" className="studio-eyebrow">
            START ON
          </label>
          <select
            id="scale-root"
            value={rootNote}
            onChange={(event) => setRootNote(event.target.value)}
          >
            {ROOT_SPELLINGS.map((note) => (
              <option key={note} value={note}>
                {formatNote(note)}
              </option>
            ))}
          </select>
          <p>Choose a root, then listen for the pattern.</p>
        </div>
        <label className="scale-family-choice">
          Scale or mode
          <select
            aria-label="Scale type"
            value={selectedScale}
            onChange={(event) =>
              setSelectedScale(event.target.value as keyof typeof scales)
            }
          >
            <optgroup label="Major & minor">
              <option value="Major">Major (Ionian)</option>
              <option value="Natural Minor">Natural Minor (Aeolian)</option>
              <option>Harmonic Minor</option>
              <option>Melodic Minor</option>
            </optgroup>
            <optgroup label="More modes">
              {["Dorian", "Phrygian", "Lydian", "Mixolydian", "Locrian"].map(
                (name) => (
                  <option key={name}>{name}</option>
                ),
              )}
            </optgroup>
            <optgroup label="Pentatonic & blues">
              {["Pentatonic Major", "Pentatonic Minor", "Blues"].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </optgroup>
          </select>
          <p>
            {selectedScale === "Melodic Minor"
              ? "Classical form: raised sixth and seventh going up; natural minor coming down."
              : "Choose a sound, then follow the pattern."}
          </p>
        </label>
      </div>
      <div className="scale-listening">
        <label>
          Direction
          <select
            aria-label="Scale direction"
            value={scalePlayback.direction}
            onChange={(event) =>
              setScalePlayback({
                direction: event.target.value as ScalePlayback["direction"],
              })
            }
          >
            <option value="up">Ascending</option>
            <option value="down">Descending</option>
            <option value="up-down">Up and back</option>
          </select>
        </label>
        <label className="scale-pace">
          Pace <span>{scalePlayback.bpm} notes / min</span>
          <input
            type="range"
            aria-label="Scale pace"
            min="60"
            max="180"
            step="6"
            value={scalePlayback.bpm}
            onChange={(event) =>
              setScalePlayback({ bpm: Number(event.target.value) })
            }
          />
        </label>
        <p>
          One note at a time.
          <br />A little sustain between steps.
        </p>
      </div>
      <div className="scale-score">
        <div className="scale-score-heading">
          <h2>
            {formatNote(rootNote)} {selectedScale}
          </h2>
          <span className="studio-eyebrow">
            {selectedScale === "Melodic Minor"
              ? descending
                ? "DESCENDING FORM"
                : "ASCENDING FORM"
              : "LISTEN FOR THE STEPS"}
          </span>
        </div>
        <div
          className="scale-note-row"
          style={{ "--note-count": labels.length } as React.CSSProperties}
          aria-label="Scale notes"
        >
          {labels.map((note, index) => (
            <div
              key={index}
              className="scale-note"
              data-current={
                playing && selection.kind === "scale" && scaleStep === index
              }
              aria-current={
                playing && selection.kind === "scale" && scaleStep === index
                  ? "step"
                  : undefined
              }
            >
              <small>
                {index === labels.length - 1 ? "1 · OCTAVE" : degrees[index]}
              </small>
              <strong>{note}</strong>
              <span>
                {index === 0
                  ? "ROOT"
                  : index === labels.length - 1
                    ? "HOME AGAIN"
                    : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="scale-score-footer">
          <p>Press Play scale below. Follow each note as it sounds.</p>
          <Link to="/piano" className="studio-text-link">
            See it on the piano <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
