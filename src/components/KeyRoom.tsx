import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useStudioSession } from "../context/StudioSession";
import { formatNote } from "../lib/noteSelection";
import { spelledChordNotes } from "../lib/musicNotation";
import {
  MAJOR_KEYS,
  MINOR_KEYS,
  STARTERS,
  keyChords,
  keyVocabulary,
  moveToKey,
  placeInKey,
  pointerChords,
  type KeyChord,
  type KeyMode,
} from "../lib/keyChords";

type Step = { name: string; notes: string[] };
type Draft = { root: string; mode: KeyMode; sevenths: boolean; steps: Step[] };

const STORE = "lumina-key-room";
const PACES = [
  { label: "Slow", seconds: 2.4 },
  { label: "Medium", seconds: 1.6 },
  { label: "Quick", seconds: 1 },
];

function readDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (
      saved &&
      (saved.mode === "major" || saved.mode === "minor") &&
      (saved.mode === "major" ? MAJOR_KEYS : MINOR_KEYS).includes(saved.root) &&
      Array.isArray(saved.steps) &&
      saved.steps.every(
        (step: Step) =>
          typeof step?.name === "string" &&
          Array.isArray(step.notes) &&
          step.notes.every((note) => typeof note === "string"),
      )
    )
      return { ...saved, sevenths: saved.sevenths === true };
  } catch {
    // Fall through to a fresh start.
  }
  return { root: "C", mode: "major", sevenths: false, steps: [] };
}

/** Pick a key, see the chords that live in it, and string them into a progression. */
export default function KeyRoom() {
  const session = useStudioSession();
  const { library, selection, playing } = session;
  const [draft, setDraft] = useState(readDraft);
  const [pace, setPace] = useState(1);
  const [running, setRunning] = useState<number | null>(null);
  const [saveName, setSaveName] = useState("");
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const { root, mode, sevenths, steps } = draft;
  const chords = useMemo(
    () => keyChords(root, mode, sevenths),
    [root, mode, sevenths],
  );
  const pointers = useMemo(() => pointerChords(root, mode), [root, mode]);
  // Everything nameable in this key, whichever size of chord is on show.
  const vocabulary = useMemo(() => keyVocabulary(root, mode), [root, mode]);
  const main = chords.filter((chord) => !chord.alternate);
  const extras = chords.filter((chord) => chord.alternate);
  const shown = [...chords, ...pointers];
  const keyName = `${formatNote(root)} ${mode}`;

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(draft));
    } catch {
      // The draft simply lasts for this visit.
    }
  }, [draft]);
  const stopClock = () => {
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
    setRunning(null);
  };
  useEffect(() => {
    if (!playing) stopClock();
  }, [playing]);
  useEffect(() => stopClock, []);

  const changeKey = (nextRoot: string, nextMode: KeyMode) => {
    session.stop();
    const keys = nextMode === "major" ? MAJOR_KEYS : MINOR_KEYS;
    const safeRoot = keys.includes(nextRoot) ? nextRoot : keys[0];
    setDraft((current) => ({
      ...current,
      root: safeRoot,
      mode: nextMode,
      // The progression keeps its shape and moves with the key.
      steps:
        nextMode === current.mode
          ? moveToKey(
              current.steps,
              vocabulary,
              keyVocabulary(safeRoot, nextMode),
            )
          : current.steps,
    }));
  };
  const changeSize = (next: boolean) => {
    if (next === sevenths) return;
    session.stop();
    const from = keyChords(root, mode, sevenths),
      to = keyChords(root, mode, next);
    // Chords already placed grow or shrink with the switch.
    setDraft((current) => ({
      ...current,
      sevenths: next,
      steps: moveToKey(current.steps, from, to),
    }));
  };
  const hear = (chord: Step) => {
    stopClock();
    session.togglePlay({ name: chord.name, notes: chord.notes, kind: "chord" });
  };
  const add = (chord: Step) =>
    setDraft((current) => ({
      ...current,
      steps: [...current.steps, { name: chord.name, notes: chord.notes }],
    }));
  const setSteps = (next: Step[]) => {
    session.stop();
    setDraft((current) => ({ ...current, steps: next }));
  };
  const move = (index: number, change: number) => {
    const next = [...steps];
    const [taken] = next.splice(index, 1);
    next.splice(index + change, 0, taken);
    setSteps(next);
  };
  const playAll = () => {
    if (running !== null) {
      session.stop();
      return;
    }
    if (!steps.length) return;
    const milliseconds = PACES[pace].seconds * 1000;
    session.playProgression(steps, milliseconds);
    const started = Date.now();
    setRunning(0);
    clock.current = setInterval(
      () =>
        setRunning(
          Math.min(
            steps.length - 1,
            Math.floor((Date.now() - started) / milliseconds),
          ),
        ),
      80,
    );
  };

  // What usually comes next: read from the last chord placed, or the one being heard.
  const anchor =
    steps.length > 0
      ? placeInKey(steps[steps.length - 1], vocabulary)
      : selection.kind === "chord"
        ? placeInKey(selection, vocabulary)
        : undefined;
  const leads = (chord: KeyChord) =>
    !!anchor && anchor.id !== chord.id && anchor.leadsTo.includes(chord.id);
  const numeralOf = (step: Step) =>
    placeInKey(step, vocabulary)?.numeral ?? "";
  const spelled = (chord: Step) =>
    spelledChordNotes(chord.name, chord.notes).map(formatNote).join(" · ");
  const sounding = (chord: Step) =>
    playing && selection.kind === "chord" && selection.name === chord.name;
  const outside = library.favorites.filter(
    (favorite) => !placeInKey(favorite, vocabulary),
  );

  const card = (chord: KeyChord) => (
    <div
      key={chord.id}
      className="key-chord"
      data-leads={leads(chord)}
      data-sounding={sounding(chord)}
    >
      <button
        className="key-chord-hear"
        aria-label={`${sounding(chord) ? "Stop" : "Hear"} ${chord.numeral}, ${formatNote(chord.name)}`}
        onClick={() => hear(chord)}
      >
        <span className="key-chord-numeral">{chord.numeral}</span>
        <strong>{formatNote(chord.name)}</strong>
        <small>{spelled(chord)}</small>
        {leads(chord) && <em>often next</em>}
      </button>
      <button
        className="key-chord-add"
        aria-label={`Add ${chord.numeral}, ${formatNote(chord.name)}, to your progression`}
        onClick={() => add(chord)}
      >
        <Plus size={13} /> Add
      </button>
    </div>
  );

  return (
    <section className="key-room" aria-label="Progressions in a key">
      <div className="key-room-key">
        <label>
          <span className="studio-eyebrow">KEY</span>
          <select
            aria-label="Key note"
            value={root}
            onChange={(event) => changeKey(event.target.value, mode)}
          >
            {(mode === "major" ? MAJOR_KEYS : MINOR_KEYS).map((key) => (
              <option key={key} value={key}>
                {formatNote(key)}
              </option>
            ))}
          </select>
        </label>
        <div className="piano-mode" role="group" aria-label="Major or minor">
          {(["major", "minor"] as const).map((choice) => (
            <button
              key={choice}
              aria-pressed={mode === choice}
              onClick={() => mode !== choice && changeKey(root, choice)}
            >
              {choice === "major" ? "Major" : "Minor"}
            </button>
          ))}
        </div>
        <div className="piano-mode" role="group" aria-label="Chord size">
          <button aria-pressed={!sevenths} onClick={() => changeSize(false)}>
            Three notes
          </button>
          <button aria-pressed={sevenths} onClick={() => changeSize(true)}>
            Sevenths
          </button>
        </div>
        <p>
          These are the chords that live in {keyName}. Each one is built from
          every other note of the scale
          {sevenths ? ", four notes high" : ""}. Tap a chord to hear it, and
          press Add to place it in your progression.
        </p>
      </div>

      <div className="key-chords" role="group" aria-label={`Chords in ${keyName}`}>
        {main.map(card)}
      </div>
      {extras.length > 0 && (
        <div className="key-extras">
          <span className="studio-eyebrow">ALSO USED IN MINOR</span>
          <div className="key-chords">{extras.map(card)}</div>
        </div>
      )}

      <div className="key-extras">
        <span className="studio-eyebrow">CHORDS THAT POINT AT OTHER CHORDS</span>
        <p className="key-pointer-note">
          Each of these is the V7 of another chord in the key. The music leans
          on that chord as if it were home for a moment, without ever changing
          key.
          {mode === "major"
            ? " String them together and each seventh hands on to the next, all the way home."
            : ""}
        </p>
        <div
          className="key-chords key-pointers"
          role="group"
          aria-label="Sevenths that point at another chord"
        >
          {pointers.map(card)}
        </div>
      </div>

      <div className="key-progression" aria-label="Your progression">
        <div className="key-progression-head">
          <span className="studio-eyebrow">YOUR PROGRESSION</span>
          <div className="key-starters">
            <span>Start from</span>
            {STARTERS[mode].map((starter) => (
              <button
                key={starter.label}
                onClick={() =>
                  setSteps(
                    starter.ids.map((id) => {
                      const chord = shown.find((entry) => entry.id === id)!;
                      return { name: chord.name, notes: chord.notes };
                    }),
                  )
                }
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>
        {steps.length === 0 ? (
          <p className="key-empty">
            Nothing here yet. Add chords from the row above, or start from one
            of the well-worn paths.
          </p>
        ) : (
          <ol className="key-steps">
            {steps.map((step, index) => (
              <li key={index} data-now={running === index}>
                <button
                  className="key-step-hear"
                  aria-label={`Hear chord ${index + 1}, ${formatNote(step.name)}`}
                  onClick={() => hear(step)}
                >
                  <span>{numeralOf(step) || "outside"}</span>
                  <strong>{formatNote(step.name)}</strong>
                </button>
                <div>
                  <button
                    aria-label={`Move ${formatNote(step.name)} earlier`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    aria-label={`Move ${formatNote(step.name)} later`}
                    disabled={index === steps.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight size={12} />
                  </button>
                  <button
                    aria-label={`Remove ${formatNote(step.name)}`}
                    onClick={() =>
                      setSteps(steps.filter((_, at) => at !== index))
                    }
                  >
                    <X size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="key-transport">
          <button
            className={`key-play ${running !== null ? "on" : ""}`}
            disabled={!steps.length}
            onClick={playAll}
          >
            {running !== null ? (
              <>
                <Square size={12} fill="currentColor" /> Stop
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> Play progression
              </>
            )}
          </button>
          <label>
            Pace
            <select
              aria-label="Progression pace"
              value={pace}
              onChange={(event) => setPace(Number(event.target.value))}
            >
              {PACES.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!steps.length} onClick={() => setSteps([])}>
            <Trash2 size={12} /> Clear
          </button>
          <form
            className="key-save"
            onSubmit={(event) => {
              event.preventDefault();
              if (!steps.length) return;
              library.saveProgression(
                saveName.trim() ||
                  `${steps.map((step) => numeralOf(step) || formatNote(step.name)).join(" ")} in ${keyName}`,
                steps,
              );
              setSaveName("");
            }}
          >
            <input
              aria-label="Name for this progression"
              placeholder="Name it (optional)"
              value={saveName}
              maxLength={60}
              onChange={(event) => setSaveName(event.target.value)}
            />
            <button disabled={!steps.length}>
              <Save size={12} /> Save
            </button>
          </form>
        </div>
      </div>

      <div className="key-lower">
        <div className="key-map" aria-label="Where each chord usually leads">
          <span className="studio-eyebrow">WHERE EACH CHORD LEADS</span>
          <ul>
            {shown.map((chord) => (
              <li
                key={chord.id}
                data-current={anchor?.id === chord.id}
                data-pointer={chord.pointer}
              >
                <strong>{chord.numeral}</strong>
                <span className="key-map-to">
                  {chord.leadsTo.length
                    ? chord.leadsTo
                        .map((id) => shown.find((entry) => entry.id === id)!.numeral)
                        .join("  or  ")
                    : "anywhere"}
                </span>
                <span>{chord.role}</span>
              </li>
            ))}
          </ul>
          <p>
            These are habits, not rules. They are the paths most songs take,
            and breaking them on purpose is half the fun.
          </p>
        </div>
        <div className="key-side">
          <div>
            <span className="studio-eyebrow">FROM OUTSIDE THE KEY</span>
            {outside.length ? (
              <div className="key-outside">
                {outside.map((favorite) => (
                  <span key={favorite.id}>
                    <button
                      aria-label={`Hear ${formatNote(favorite.name)}`}
                      onClick={() => hear(favorite)}
                    >
                      {formatNote(favorite.name)}
                    </button>
                    <button
                      aria-label={`Add ${formatNote(favorite.name)} to your progression`}
                      onClick={() => add(favorite)}
                    >
                      <Plus size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p>
                Chords you save with the heart in the Chord library show up
                here when they don't belong to this key.
              </p>
            )}
          </div>
          <div>
            <span className="studio-eyebrow">SAVED PROGRESSIONS</span>
            {library.progressions.length ? (
              <ul className="key-saved">
                {library.progressions.map((saved) => (
                  <li key={saved.id}>
                    <button
                      onClick={() =>
                        setSteps(
                          saved.chords.map(({ name, notes }) => ({ name, notes })),
                        )
                      }
                      aria-label={`Open ${saved.name}`}
                    >
                      <strong>{saved.name}</strong>
                      <small>
                        {saved.chords
                          .map((chord) => formatNote(chord.name))
                          .join("  ")}
                      </small>
                    </button>
                    <button
                      aria-label={`Delete ${saved.name}`}
                      onClick={() => library.deleteProgression(saved.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Save a progression and it will wait for you here.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
