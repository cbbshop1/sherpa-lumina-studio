import { Circle, Drum, Headphones, Play, SkipBack, Square, X } from "lucide-react";
import {
  BAR_CHOICES,
  MAX_BPM,
  MIN_BPM,
  clockText,
  counterText,
  type SongSettings,
  type TimeGrid,
} from "../../lib/fourTrack";
import { meterLabel, tempoLabel } from "../../lib/groove";

export type DeckMode = "stopped" | "playing" | "count-in" | "recording" | "arming";

type Props = {
  song: SongSettings;
  mode: DeckMode;
  position: number;
  songSec: number;
  grid: TimeGrid;
  armedName: string | null;
  onRemoveGroove: () => void;
  onOpenRhythm: () => void;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onRewind: () => void;
  onChange: (patch: Partial<SongSettings>) => void;
};

/** A late-90s portable cassette player, more or less. */
export default function CassetteDeck({
  song,
  mode,
  position,
  songSec,
  grid,
  armedName,
  onRemoveGroove,
  onOpenRhythm,
  onPlay,
  onStop,
  onRecord,
  onRewind,
  onChange,
}: Props) {
  const moving = mode === "playing" || mode === "recording" || mode === "count-in";
  const busy = mode !== "stopped";
  const progress = Math.min(1, position / songSec);
  const meter = song.groove ? meterLabel(song.groove.meter) : "4/4";
  const tempoText = song.groove
    ? tempoLabel(grid.unit, song.bpm)
    : `${song.bpm} BPM`;
  return (
    <section className="cassette-deck" aria-label="Four-track tape deck">
      <div className="deck-body">
        <div className="deck-top">
          <span className="deck-badge">LUMINA</span>
          <span className="deck-model">4·TRACK PORTABLE</span>
          <span className="deck-stripe" aria-hidden="true" />
        </div>
        <div className="deck-face">
          <div className={`cassette-window ${moving ? "moving" : ""}`} aria-hidden="true">
            <div className="cassette-label">
              <span>SIDE A</span>
              <em>
                {song.bars} BARS · {meter}
              </em>
            </div>
            <div className="cassette-tape">
              {/* Tape moves from the left reel to the right as the song plays. */}
              <div className="reel" style={{ ["--wound" as string]: 1 - progress }}>
                <i />
              </div>
              <div className="tape-path" />
              <div className="reel" style={{ ["--wound" as string]: progress }}>
                <i />
              </div>
            </div>
          </div>
          <div className="deck-panel">
            <div className="deck-lcd" role="status" aria-live="off">
              <div className="lcd-row">
                <span className={`lcd-rec ${mode === "recording" || mode === "count-in" ? "on" : ""}`}>
                  ● REC
                </span>
                <span>{mode === "count-in" ? "COUNT-IN" : mode === "arming" ? "MIC…" : moving ? "PLAY" : "STOP"}</span>
              </div>
              <div className="lcd-counter">
                <small>BAR</small>
                {counterText(Math.min(position, songSec), grid)}
              </div>
              <div className="lcd-row">
                <span>{clockText(position)}</span>
                <span>{tempoText}</span>
              </div>
            </div>
            <div className="deck-transport" role="group" aria-label="Transport">
              <button onClick={onRewind} disabled={busy} aria-label="Rewind to the start">
                <SkipBack size={18} fill="currentColor" />
              </button>
              <button
                className={mode === "playing" ? "down" : ""}
                onClick={onPlay}
                disabled={busy}
                aria-label="Play"
              >
                <Play size={18} fill="currentColor" />
              </button>
              <button onClick={onStop} disabled={!busy} aria-label="Stop">
                <Square size={16} fill="currentColor" />
              </button>
              <button
                className={`deck-rec ${mode === "recording" || mode === "count-in" ? "down" : ""}`}
                onClick={onRecord}
                disabled={busy || !armedName}
                aria-label={armedName ? `Record on ${armedName}` : "Arm a track to record"}
              >
                <Circle size={16} fill="currentColor" />
              </button>
            </div>
            <p className="deck-armed">
              {armedName ? <>Recording goes to <b>{armedName}</b></> : "Press REC on a track to arm it"}
            </p>
          </div>
        </div>
        <div className="deck-switches">
          <label className="deck-tempo">
            <span>TEMPO</span>
            <button
              disabled={busy || song.bpm <= MIN_BPM}
              onClick={() => onChange({ bpm: Math.max(MIN_BPM, song.bpm - 1) })}
              aria-label="Slower"
            >
              −
            </button>
            <input
              type="number"
              min={MIN_BPM}
              max={MAX_BPM}
              value={song.bpm}
              disabled={busy}
              aria-label={`Tempo, ${tempoText}`}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value >= MIN_BPM && value <= MAX_BPM) onChange({ bpm: value });
              }}
            />
            <button
              disabled={busy || song.bpm >= MAX_BPM}
              onClick={() => onChange({ bpm: Math.min(MAX_BPM, song.bpm + 1) })}
              aria-label="Faster"
            >
              +
            </button>
          </label>
          <label>
            <span>LENGTH</span>
            <select
              value={song.bars}
              disabled={busy}
              aria-label="Song length in bars"
              onChange={(event) =>
                onChange({ bars: Number(event.target.value) as SongSettings["bars"] })
              }
            >
              {BAR_CHOICES.map((bars) => (
                <option key={bars} value={bars}>
                  {bars} bars
                </option>
              ))}
            </select>
          </label>
          <button
            className={`deck-switch ${song.click ? "on" : ""}`}
            aria-pressed={song.click}
            onClick={() => onChange({ click: !song.click })}
          >
            <i /> CLICK
          </button>
          {song.groove && (
            <span className="deck-groove">
              <button
                className={`deck-switch ${song.grooveOn ? "on" : ""}`}
                aria-pressed={song.grooveOn}
                onClick={() => onChange({ grooveOn: !song.grooveOn })}
                title={`${song.groove.name}, ${meter}`}
              >
                <i /> GROOVE
              </button>
              <button className="deck-groove-name" onClick={onOpenRhythm} title="Change it in the rhythm room">
                <Drum size={12} /> {song.groove.name}
              </button>
              <button
                className="deck-groove-remove"
                disabled={busy}
                onClick={onRemoveGroove}
                aria-label="Take the groove off the tape and go back to 4/4"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button
            className={`deck-switch ${song.countIn ? "on" : ""}`}
            aria-pressed={song.countIn}
            onClick={() => onChange({ countIn: !song.countIn })}
          >
            <i /> COUNT-IN
          </button>
          <span className="deck-phones"><Headphones size={14} /> Headphones keep the other tracks out of your mic.</span>
        </div>
      </div>
    </section>
  );
}
