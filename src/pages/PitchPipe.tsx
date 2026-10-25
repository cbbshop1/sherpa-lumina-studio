import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AudioLines, Radio, SlidersHorizontal, Waves } from "lucide-react";
import AppNavigation from "../components/AppNavigation";
import { SessionBar, useStopOnNavigation } from "../components/StudioChrome";
import SoundScope from "../components/SoundScope";
import OwnSoundRecorder from "../components/OwnSoundRecorder";
import { useOwnSound } from "../context/OwnSoundSession";
import { selectionNoteLabels } from "../lib/musicNotation";
import { useStudioSession } from "../context/StudioSession";
import { NOTE_NAMES, formatNote, midiToFrequency } from "../lib/noteSelection";

const voices = [
  {
    id: "sine" as const,
    name: "Sine",
    hint: "Pure & round",
    path: "M0 22C10 0 20 0 30 22S50 44 60 22S80 0 90 22",
  },
  {
    id: "triangle" as const,
    name: "Triangle",
    hint: "Soft & mellow",
    path: "M0 22L15 4L45 40L75 4L90 22",
  },
  {
    id: "square" as const,
    name: "Square",
    hint: "Hollow & woody",
    path: "M0 38V6H22V38H45V6H67V38H90",
  },
  {
    id: "sawtooth" as const,
    name: "Sawtooth",
    hint: "Bright & buzzy",
    path: "M0 38L30 6V38L60 6V38L90 6",
  },
];
const PitchPipe = () => {
  const [params, setParams] = useSearchParams();
  const view =
    params.get("view") === "waveform"
      ? "waveform"
      : params.get("view") === "tone"
        ? "tone"
        : "circle";
  const { clip } = useOwnSound();
  const ownSound =
    view === "waveform" &&
    (params.get("source") === "microphone" ||
      (!params.has("source") && !!clip));
  const [scope, setScope] = useState<"waveform" | "spectrum">("waveform");
  const s = useStudioSession();
  useStopOnNavigation();
  const root = s.selection.notes[0] || "A";
  const selectionLabels = selectionNoteLabels(s.selection);
  const noteLabel = (note: string) => {
    const index = s.selection.notes.indexOf(note);
    return index >= 0 ? selectionLabels[index] : formatNote(note);
  };
  const freq =
    s.selection.frequency ||
    midiToFrequency(
      (s.octave + 1) * 12 + Math.max(0, NOTE_NAMES.indexOf(root)),
    );
  const chooseFrequency = (frequency: number) => {
    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 16000)
      return;
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    s.select({
      name: `${frequency.toFixed(1)} Hz`,
      notes: [NOTE_NAMES[((midi % 12) + 12) % 12]],
      kind: "note",
      frequency,
    });
  };
  const changeView = (next: typeof view) => {
    s.stop();
    setParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      nextParams.set("view", next);
      return nextParams;
    });
  };
  return (
    <div className={`lumina-app ${ownSound ? "own-sound-page" : ""}`}>
      <AppNavigation />
      <main className="lumina-main">
        <nav
          className="workspace-nav pitch-subnav"
          aria-label="Pitch and tone views"
        >
          <div role="group" aria-label="Pitch and tone tools">
            <button
              className={view === "circle" ? "active" : ""}
              onClick={() => changeView("circle")}
              aria-pressed={view === "circle"}
            >
              <Radio size={15} />
              Pitch pipe
            </button>
            <button
              className={view === "waveform" ? "active" : ""}
              onClick={() => changeView("waveform")}
              aria-pressed={view === "waveform"}
            >
              <AudioLines size={15} />
              See the sound
            </button>
            <button
              className={view === "tone" ? "active" : ""}
              onClick={() => changeView("tone")}
              aria-pressed={view === "tone"}
            >
              <SlidersHorizontal size={15} />
              Tone generator
            </button>
          </div>
        </nav>
        <div className="workspace-title">
          <div>
            <p className="studio-eyebrow">GET A FEEL FOR FREQUENCY</p>
            <h1>
              {view === "circle"
                ? "Pitch pipe"
                : view === "waveform"
                  ? "See the sound"
                  : "Shape a tone"}
            </h1>
          </div>
          <p>
            {view === "circle"
              ? "A reference for your next musical thought."
              : view === "waveform"
                ? "Every sound has a fingerprint."
                : "Same pitch. A different character."}
          </p>
        </div>
        {view === "waveform" && (
          <div
            className="sound-source-switch"
            role="group"
            aria-label="Sound source"
          >
            <span>LOOK AT</span>
            <button
              aria-pressed={!ownSound}
              onClick={() => {
                s.stop();
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("source", "studio");
                  return next;
                });
              }}
            >
              A studio tone
            </button>
            <button
              aria-pressed={ownSound}
              onClick={() => {
                s.stop();
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("source", "microphone");
                  return next;
                });
              }}
            >
              My own sound
            </button>
          </div>
        )}
        {ownSound ? (
          <OwnSoundRecorder />
        ) : (
          <div className="sound-workspace">
            <section className="sound-instrument">
              <div className="panel-kicker">
                <span className="studio-eyebrow">
                  {view === "circle"
                    ? "THE CHROMATIC CIRCLE"
                    : view === "tone"
                      ? "THE CHARACTER OF A TONE"
                      : "LISTEN WITH YOUR EYES"}
                </span>
                <span className="subtle-label">A4 = 440 Hz</span>
              </div>
              {view === "circle" ? (
                <>
                  <div className="lumina-pitch-circle">
                    <div className="pitch-circle-track" />
                    <div className="pitch-center">
                      <span className="studio-eyebrow">SELECTED ROOT</span>
                      <strong>
                        {selectionNoteLabels(s.selection)[0] ||
                          formatNote(root)}
                        <small>{s.octave}</small>
                      </strong>
                      <span>
                        {freq.toFixed(2)} <small>Hz</small>
                      </span>
                    </div>
                    {NOTE_NAMES.map((note, i) => {
                      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
                      return (
                        <button
                          key={note}
                          className={
                            s.selection.notes.includes(note) ? "selected" : ""
                          }
                          aria-label={`Select ${noteLabel(note)}${s.octave}`}
                          aria-pressed={s.selection.notes.includes(note)}
                          style={{
                            left: `${50 + Math.cos(a) * 42}%`,
                            top: `${50 + Math.sin(a) * 42}%`,
                          }}
                          onClick={() =>
                            s.select({
                              name: `${noteLabel(note)}${s.octave}`,
                              notes: [note],
                              kind: "note",
                            })
                          }
                        >
                          {noteLabel(note)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pitch-circle-caption">
                    <span>
                      Pick a note, then press Play. Click another to change the
                      pitch.
                    </span>
                    <label>
                      Octave
                      <select
                        aria-label="Pitch octave"
                        value={s.octave}
                        onChange={(e) => s.setOctave(Number(e.target.value))}
                      >
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {view === "tone" && (
                    <div className="frequency-editor">
                      <label>
                        FREQUENCY
                        <input
                          aria-label="Tone frequency"
                          type="number"
                          min="20"
                          max="16000"
                          step="0.1"
                          value={Number(freq.toFixed(1))}
                          onChange={(e) =>
                            chooseFrequency(Number(e.target.value))
                          }
                        />
                      </label>
                      <span>Hz</span>
                      <input
                        aria-label="Tone frequency slider"
                        type="range"
                        min={Math.log(20)}
                        max={Math.log(16000)}
                        step="0.001"
                        value={Math.log(Math.max(20, Math.min(16000, freq)))}
                        onChange={(e) =>
                          chooseFrequency(Math.exp(Number(e.target.value)))
                        }
                      />
                    </div>
                  )}
                  <div
                    className="scope-switch"
                    role="group"
                    aria-label="Visualization type"
                  >
                    <button
                      className={scope === "waveform" ? "active" : ""}
                      aria-pressed={scope === "waveform"}
                      onClick={() => setScope("waveform")}
                    >
                      Waveform
                    </button>
                    <button
                      className={scope === "spectrum" ? "active" : ""}
                      aria-pressed={scope === "spectrum"}
                      onClick={() => setScope("spectrum")}
                    >
                      Spectrum
                    </button>
                  </div>
                  <SoundScope
                    analyser={s.analyser}
                    playing={s.playing}
                    mode={scope}
                  />
                  <p className="scope-description">
                    {scope === "waveform"
                      ? "The curve traces changes in air pressure over time. Switch waveforms to see how the shape changes."
                      : "Left to right: low to high frequencies. Taller bars mean more energy. Extra peaks reveal the harmonics that color a tone."}
                  </p>
                </>
              )}
            </section>
            <aside className="tone-controls">
              <div className="panel-kicker">
                <span className="studio-eyebrow">FIND YOUR SOUND</span>
                <Waves size={18} />
              </div>
              <div className="voice-options" role="group" aria-label="Waveform">
                {voices.map((v) => (
                  <button
                    key={v.id}
                    className={s.sound.waveform === v.id ? "selected" : ""}
                    aria-pressed={s.sound.waveform === v.id}
                    onClick={() => s.updateSound({ waveform: v.id })}
                  >
                    <svg viewBox="0 0 90 44" fill="none" aria-hidden="true">
                      <path
                        d={v.path}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                    <strong>{v.name}</strong>
                    <span>{v.hint}</span>
                  </button>
                ))}
              </div>
              <ToneRange
                label="Brightness"
                value={s.sound.cutoff}
                min={200}
                max={12000}
                step={100}
                unit={`${(s.sound.cutoff / 1000).toFixed(1)} kHz`}
                onChange={(v) => s.updateSound({ cutoff: v })}
              />
              <ToneRange
                label="Attack"
                value={s.sound.attack}
                min={0.005}
                max={1}
                step={0.005}
                unit={`${Math.round(s.sound.attack * 1000)} ms`}
                onChange={(v) => s.updateSound({ attack: v })}
              />
              <ToneRange
                label="Release"
                value={s.sound.release}
                min={0.02}
                max={2}
                step={0.01}
                unit={`${s.sound.release.toFixed(2)} s`}
                onChange={(v) => s.updateSound({ release: v })}
              />
              <button className="studio-text-link" onClick={s.resetSound}>
                Reset sound
              </button>
              <p className="control-footnote">
                These controls shape the shared preview. Piano and Studio keep
                their own instruments.
              </p>
            </aside>
          </div>
        )}
      </main>
      {!ownSound && <SessionBar />}
    </div>
  );
};
function ToneRange({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="tone-range">
      <span>
        {label}
        <strong>{unit}</strong>
      </span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export default PitchPipe;
