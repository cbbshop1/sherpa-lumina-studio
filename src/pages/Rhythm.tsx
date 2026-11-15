import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CassetteTape, Eraser, Minus, Play, Plus, Square } from "lucide-react";
import AppNavigation from "@/components/AppNavigation";
import { useStopOnNavigation } from "@/components/StudioChrome";
import { useStudioSession } from "@/context/StudioSession";
import { playDrum } from "@/lib/drumVoices";
import { GrooveScheduler } from "@/lib/grooveScheduler";
import {
  INSTRUMENTS,
  MAX_TEMPO,
  MAX_TOP,
  MIN_TEMPO,
  MIN_TOP,
  STORAGE_KEY,
  SUBDIVISIONS,
  UNITS,
  blankPattern,
  groupingChoices,
  groupsText,
  loopSeconds,
  makeMeter,
  meterLabel,
  nextCell,
  parseGroups,
  presets,
  readGroove,
  refitPattern,
  stepGroup,
  stepStress,
  stepTime,
  stepsPerBar,
  tempoLabel,
  totalSteps,
  type Groove,
  type InstrumentId,
  type Meter,
  type Stress,
  type Subdivision,
  type Unit,
} from "@/lib/groove";

const NEXT_STRESS: Record<Stress, Stress> = {
  strong: "medium",
  medium: "light",
  light: "strong",
};

function loadGroove() {
  try {
    return readGroove(localStorage.getItem(STORAGE_KEY));
  } catch {
    return readGroove(null);
  }
}

/** How musicians count each step: 1 e & a, 1 & , 1 trip let, group by group. */
function countLabel(step: number, meter: Meter) {
  const sub = step % meter.subdivision;
  if (sub) {
    const words = { 2: ["&"], 3: ["trip", "let"], 4: ["e", "&", "a"] }[
      meter.subdivision as 2 | 3 | 4
    ];
    return words[sub - 1];
  }
  let pulse = Math.floor(step / meter.subdivision) % meter.top;
  // Plain meters count straight through; grouped ones restart each group (1 2 1 2 1 2 3).
  if (meter.groups.every((size) => size === 1)) return String(pulse + 1);
  for (const size of meter.groups) {
    if (pulse < size) return String(pulse + 1);
    pulse -= size;
  }
  return "";
}

export default function Rhythm() {
  const navigate = useNavigate();
  const { stop: stopPreview } = useStudioSession();
  useStopOnNavigation();
  const [groove, setGroove] = useState<Groove>(loadGroove);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [customGroups, setCustomGroups] = useState("");
  const latest = useRef(groove);
  latest.current = groove;
  const audio = useRef<{ ctx: AudioContext; out: GainNode } | null>(null);
  const scheduler = useRef<GrooveScheduler | null>(null);
  const zero = useRef(0);
  const { meter } = groove;
  const steps = totalSteps(groove);
  const perBar = stepsPerBar(meter);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groove));
    } catch {
      // Private windows may refuse; the groove still works for this visit.
    }
  }, [groove]);

  const getAudio = () => {
    if (!audio.current) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      const out = ctx.createGain();
      out.gain.value = 0.8;
      out.connect(ctx.destination);
      audio.current = { ctx, out };
    }
    return audio.current;
  };

  const startAt = useCallback((fromSec: number) => {
    const { ctx, out } = getAudio();
    scheduler.current?.stop();
    zero.current = ctx.currentTime + 0.06 - fromSec;
    scheduler.current = new GrooveScheduler(
      ctx,
      out,
      () => latest.current,
      zero.current,
      () => ({ pattern: true, pulses: latest.current.pulseClick }),
    );
    scheduler.current.start(fromSec);
  }, []);

  const play = async () => {
    stopPreview();
    const { ctx } = getAudio();
    await ctx.resume();
    startAt(0);
    setPlaying(true);
  };

  const stop = useCallback(() => {
    scheduler.current?.stop();
    scheduler.current = null;
    setPlaying(false);
    setStep(-1);
  }, []);

  // A change to tempo, meter or length restarts the loop at the same place.
  const shape = `${meter.top}/${meter.subdivision}/${groove.bars}/${groove.tempo}/${groove.lean}`;
  const lastShape = useRef(shape);
  const lastLoop = useRef(loopSeconds(groove));
  useEffect(() => {
    if (shape === lastShape.current) return;
    const ctx = audio.current?.ctx;
    if (playing && ctx) {
      const at = (ctx.currentTime - zero.current) % lastLoop.current;
      const fraction = Math.max(0, at) / lastLoop.current;
      startAt(fraction * loopSeconds(latest.current));
    }
    lastShape.current = shape;
    lastLoop.current = loopSeconds(latest.current);
  }, [shape, playing, startAt]);

  // Move the playhead with the sound.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const ctx = audio.current?.ctx;
      if (ctx) {
        const current = latest.current;
        const loop = loopSeconds(current);
        const songTime = (ctx.currentTime - zero.current) % loop;
        let found = -1;
        for (let s = 0; s < totalSteps(current); s++)
          if (stepTime(s, current) <= songTime + 1e-6) found = s;
        setStep(songTime < 0 ? -1 : found);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    const onHide = () => document.hidden && stop();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [stop]);
  useEffect(
    () => () => {
      scheduler.current?.stop();
      void audio.current?.ctx.close().catch(() => {});
      audio.current = null;
    },
    [],
  );

  const reshape = (nextMeter: Meter, bars = groove.bars) =>
    setGroove((current) => ({
      ...current,
      meter: nextMeter,
      bars,
      pattern: refitPattern(current.pattern, current, { meter: nextMeter, bars }),
    }));

  const changeTop = (top: number) => {
    const clamped = Math.max(MIN_TOP, Math.min(MAX_TOP, top));
    if (clamped !== meter.top) reshape(makeMeter(clamped, meter.unit, meter.subdivision));
  };
  const changeUnit = (unit: Unit) =>
    reshape(makeMeter(meter.top, unit, meter.subdivision));
  const changeGroups = (groups: number[]) =>
    reshape(makeMeter(meter.top, meter.unit, meter.subdivision, groups));
  const changeSubdivision = (subdivision: Subdivision) =>
    reshape({ ...meter, subdivision });

  const toggleCell = (id: InstrumentId, index: number) =>
    setGroove((current) => ({
      ...current,
      pattern: {
        ...current.pattern,
        [id]: current.pattern[id].map((cell, i) => (i === index ? nextCell(cell) : cell)),
      },
    }));

  const cycleStress = (pulse: number) =>
    setGroove((current) => ({
      ...current,
      meter: {
        ...current.meter,
        stresses: current.meter.stresses.map((s, i) => (i === pulse ? NEXT_STRESS[s] : s)),
      },
    }));

  const audition = async (id: InstrumentId) => {
    const { ctx, out } = getAudio();
    await ctx.resume();
    playDrum(ctx, out, id, ctx.currentTime + 0.01, 0.85);
  };

  const choices = useMemo(() => groupingChoices(meter.top, meter.unit), [meter.top, meter.unit]);
  const customValid = customGroups ? parseGroups(customGroups, meter.top) : null;
  const leanable = meter.subdivision === 2 || meter.subdivision === 4;
  const allPresets = useMemo(() => presets(), []);

  const sendToFourTrack = () => {
    stop();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groove));
    } catch {
      // Still navigate; the four-track reads the groove from the address too.
    }
    navigate("/studio?groove=1");
  };

  return (
    <div className="lumina-app rhythm-page">
      <AppNavigation />
      <main className="lumina-main">
        <div className="workspace-title">
          <div>
            <p className="studio-eyebrow">FEEL THE PULSE</p>
            <h1>The rhythm room</h1>
          </div>
          <p>Build a groove in any meter, hear where the weight falls, then sing over it.</p>
        </div>

        <section className="meter-picker" aria-label="Meter">
          <div className="meter-signature" aria-label={`Time signature ${meter.top}/${meter.unit}`}>
            <div className="meter-top">
              <button onClick={() => changeTop(meter.top - 1)} disabled={meter.top <= MIN_TOP} aria-label="Fewer pulses">
                <Minus size={14} />
              </button>
              <span>{meter.top}</span>
              <button onClick={() => changeTop(meter.top + 1)} disabled={meter.top >= MAX_TOP} aria-label="More pulses">
                <Plus size={14} />
              </button>
            </div>
            <i />
            <select
              value={meter.unit}
              onChange={(event) => changeUnit(Number(event.target.value) as Unit)}
              aria-label="Which note gets one pulse"
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div className="meter-field">
            <span className="studio-eyebrow">GROUP THE PULSES</span>
            <div className="meter-chips" role="group" aria-label="Grouping">
              {choices.map((groups) => (
                <button
                  key={groups.join()}
                  className={groups.join() === meter.groups.join() ? "on" : ""}
                  aria-pressed={groups.join() === meter.groups.join()}
                  onClick={() => changeGroups(groups)}
                >
                  {groups.every((g) => g === 1) ? "Each pulse" : groupsText(groups)}
                </button>
              ))}
              <input
                value={customGroups}
                placeholder="Your own, e.g. 3+3+2"
                aria-label="Type your own grouping"
                className={customGroups && !customValid ? "invalid" : ""}
                onChange={(event) => setCustomGroups(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && customValid) {
                    changeGroups(customValid);
                    setCustomGroups("");
                  }
                }}
              />
              {customGroups && (
                <button
                  disabled={!customValid}
                  onClick={() => {
                    if (customValid) changeGroups(customValid);
                    setCustomGroups("");
                  }}
                >
                  {customValid ? "Use it" : `Must add up to ${meter.top}`}
                </button>
              )}
            </div>
          </div>

          <div className="meter-field">
            <span className="studio-eyebrow">SPLIT EACH PULSE</span>
            <div className="meter-chips" role="group" aria-label="Subdivision">
              {SUBDIVISIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={meter.subdivision === value ? "on" : ""}
                  aria-pressed={meter.subdivision === value}
                  onClick={() => changeSubdivision(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="groove-transport" aria-label="Groove controls">
          <button className={`groove-play ${playing ? "on" : ""}`} onClick={() => (playing ? stop() : void play())}>
            {playing ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            {playing ? "Stop" : "Play"}
          </button>
          <label className="groove-tempo">
            <span className="studio-eyebrow">TEMPO</span>
            <b>{tempoLabel(meter.unit, groove.tempo)}</b>
            <input
              type="range"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              value={groove.tempo}
              aria-label="Tempo"
              onChange={(event) => setGroove((g) => ({ ...g, tempo: Number(event.target.value) }))}
            />
          </label>
          <label className="groove-lean" title={leanable ? "" : "Lean works when pulses split in 2 or 4"}>
            <span className="studio-eyebrow">LEAN</span>
            <b>{leanable ? (groove.lean === 0 ? "Straight" : `${Math.round(groove.lean * 100)}%`) : "—"}</b>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={groove.lean}
              disabled={!leanable}
              aria-label="Lean, how late the in-between notes fall"
              onChange={(event) => setGroove((g) => ({ ...g, lean: Number(event.target.value) }))}
            />
          </label>
          <div className="meter-chips" role="group" aria-label="Bars">
            {([1, 2] as const).map((bars) => (
              <button
                key={bars}
                className={groove.bars === bars ? "on" : ""}
                aria-pressed={groove.bars === bars}
                onClick={() => reshape(meter, bars)}
              >
                {bars} bar{bars > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <button
            className={`deck-switch groove-pulse ${groove.pulseClick ? "on" : ""}`}
            aria-pressed={groove.pulseClick}
            onClick={() => setGroove((g) => ({ ...g, pulseClick: !g.pulseClick }))}
          >
            <i /> HEAR THE PULSE
          </button>
          <label className="groove-preset">
            <span className="studio-eyebrow">START FROM</span>
            <select
              value=""
              aria-label="Start from a preset groove"
              onChange={(event) => {
                const chosen = allPresets.find((p) => p.name === event.target.value);
                if (chosen) setGroove(readGroove(JSON.stringify(chosen)));
              }}
            >
              <option value="">{groove.name}</option>
              {allPresets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="groove-clear"
            onClick={() => setGroove((g) => ({ ...g, name: "My groove", pattern: blankPattern(steps) }))}
          >
            <Eraser size={14} /> Clear
          </button>
        </section>

        <section className="groove-grid-wrap" aria-label={`Groove grid, ${meterLabel(meter)}`}>
          <div
            className="groove-grid"
            style={{ gridTemplateColumns: `112px repeat(${steps}, minmax(26px, 1fr))` }}
          >
            <span className="groove-corner">
              <b>{meterLabel(meter)}</b>
              <small>tap a pulse to change its weight</small>
            </span>
            {Array.from({ length: steps }, (_, index) => {
              const stress = stepStress(index, meter);
              const pulse = Math.floor((index % perBar) / meter.subdivision);
              return stress === "off" ? (
                <span key={`s${index}`} className={`groove-count sub ${step === index ? "now" : ""}`}>
                  {countLabel(index, meter)}
                </span>
              ) : (
                <button
                  key={`s${index}`}
                  className={`groove-count ${stress} ${step === index ? "now" : ""}`}
                  onClick={() => cycleStress(pulse)}
                  aria-label={`Pulse ${pulse + 1}: ${stress}. Change its weight.`}
                >
                  <i />
                  {countLabel(index, meter)}
                </button>
              );
            })}
            {INSTRUMENTS.map(({ id, name }) => (
              <div key={id} className="groove-row" style={{ display: "contents" }}>
                <button className="groove-name" onClick={() => void audition(id)} title="Hear this sound">
                  {name}
                </button>
                {groove.pattern[id].map((cell, index) => {
                  const group = stepGroup(index, meter);
                  const barStart = index % perBar === 0;
                  const groupStart =
                    index % meter.subdivision === 0 && stepGroup(index - 1, meter) !== group;
                  return (
                    <button
                      key={index}
                      className={[
                        "groove-cell",
                        `g${group % 2}`,
                        cell === 1 ? "hit" : cell === 2 ? "accent" : "",
                        step === index ? "now" : "",
                        barStart && index > 0 ? "bar-start" : groupStart ? "group-start" : "",
                        index % meter.subdivision ? "between" : "",
                      ].join(" ")}
                      aria-label={`${name}, step ${index + 1}: ${["off", "on", "accented"][cell]}`}
                      aria-pressed={cell > 0}
                      onClick={() => toggleCell(id, index)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <div className="groove-footer">
          <p>
            <b>Tap a square</b> once for a hit and twice for an accent. The dots
            on top show the weight of each pulse: big for strong, middle for
            medium, small for light. Tap one to change it, and turn on{" "}
            <b>Hear the pulse</b> to hear the meter on its own.
          </p>
          <button className="groove-send" onClick={sendToFourTrack}>
            <CassetteTape size={16} /> Sing over this in the four-track
          </button>
        </div>
      </main>
    </div>
  );
}
