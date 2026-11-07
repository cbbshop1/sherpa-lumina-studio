import { useState } from "react";
import { ChevronDown, Circle } from "lucide-react";
import LaneWaveform from "./LaneWaveform";
import { MAX_NUDGE_MS, type TrackSettings } from "../../lib/fourTrack";
import type { TakeMeta } from "../../lib/shelf";

type Props = {
  index: number;
  track: TrackSettings;
  original: AudioBuffer | null;
  processed: AudioBuffer | null;
  armed: boolean;
  recording: boolean;
  busy: boolean;
  heard: boolean;
  songSec: number;
  bars: number;
  position: number;
  takes: TakeMeta[];
  takeName: string | null;
  onChange: (patch: Partial<TrackSettings>) => void;
  onArm: () => void;
  onSeek: (seconds: number) => void;
  onLoad: (takeId: string) => void;
  onClear: () => void;
};

const percent = (value: number) => `${Math.round(value * 100)}`;

export default function TapeLane({
  index,
  track,
  original,
  processed,
  armed,
  recording,
  busy,
  heard,
  songSec,
  bars,
  position,
  takes,
  takeName,
  onChange,
  onArm,
  onSeek,
  onLoad,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false);
  const label = `Track ${index + 1}, ${track.name}`;
  return (
    <section
      className={`tape-lane ${armed ? "armed" : ""} ${heard ? "" : "silent"}`}
      aria-label={label}
    >
      <div className="lane-head">
        <span className="lane-number">{index + 1}</span>
        <div className="lane-name">
          <strong>{track.name}</strong>
          <small>{takeName ?? "Blank tape"}</small>
        </div>
        <div className="lane-buttons">
          <button
            className={`lane-arm ${armed ? "on" : ""}`}
            aria-pressed={armed}
            disabled={busy}
            onClick={onArm}
            title="Record on this track"
          >
            <Circle size={10} fill="currentColor" /> REC
          </button>
          <button
            className={`lane-toggle ${track.mute ? "on" : ""}`}
            aria-pressed={track.mute}
            onClick={() => onChange({ mute: !track.mute })}
            title="Mute"
          >
            M
          </button>
          <button
            className={`lane-toggle solo ${track.solo ? "on" : ""}`}
            aria-pressed={track.solo}
            onClick={() => onChange({ solo: !track.solo })}
            title="Solo"
          >
            S
          </button>
        </div>
        <label className="lane-fader">
          <span>LEVEL {percent(track.volume)}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            aria-label={`${track.name} volume`}
            onChange={(event) => onChange({ volume: Number(event.target.value) })}
          />
        </label>
        <div className="lane-fx">
          <label>
            <span>REVERB {percent(track.reverb)}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={track.reverb}
              disabled={!original}
              aria-label={`${track.name} reverb`}
              onChange={(event) =>
                onChange({ reverb: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>ECHO {percent(track.echo)}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={track.echo}
              disabled={!original}
              aria-label={`${track.name} echo`}
              onChange={(event) => onChange({ echo: Number(event.target.value) })}
            />
          </label>
        </div>
        <button
          className={`lane-more ${open ? "open" : ""}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          More <ChevronDown size={13} />
        </button>
      </div>
      <LaneWaveform
        original={original}
        processed={processed}
        startSec={track.startSec + track.nudgeMs / 1000}
        songSec={songSec}
        bars={bars}
        position={position}
        recording={recording}
        onSeek={onSeek}
        label={label}
      />
      {open && (
        <div className="lane-drawer">
          <label>
            <span>PAN {track.pan === 0 ? "C" : track.pan < 0 ? `L${percent(-track.pan)}` : `R${percent(track.pan)}`}</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={track.pan}
              aria-label={`${track.name} left and right position`}
              onChange={(event) => onChange({ pan: Number(event.target.value) })}
            />
          </label>
          <label title="Slide the take a little earlier or later if it sounds out of time.">
            <span>
              TIMING {track.nudgeMs > 0 ? "+" : ""}
              {Math.round(track.nudgeMs)} ms
            </span>
            <input
              type="range"
              min={-MAX_NUDGE_MS}
              max={MAX_NUDGE_MS}
              step="5"
              value={track.nudgeMs}
              disabled={!original}
              aria-label={`${track.name} timing nudge`}
              onChange={(event) =>
                onChange({ nudgeMs: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>NAME</span>
            <input
              type="text"
              maxLength={24}
              value={track.name}
              aria-label={`Track ${index + 1} name`}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </label>
          <label>
            <span>LOAD FROM SHELF</span>
            <select
              value=""
              disabled={busy || !takes.length}
              aria-label={`Load a shelf take onto ${track.name}`}
              onChange={(event) => event.target.value && onLoad(event.target.value)}
            >
              <option value="">
                {takes.length ? "Choose a take…" : "Your shelf is empty"}
              </option>
              {takes.map((take) => (
                <option key={take.id} value={take.id}>
                  {take.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !track.takeId} onClick={onClear}>
            Clear this track
          </button>
          <p>
            Clearing or recording over a track never deletes the take. It stays
            on your shelf.
          </p>
        </div>
      )}
    </section>
  );
}
