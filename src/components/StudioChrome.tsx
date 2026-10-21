import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Play, Square, Volume2, Waves } from "lucide-react";
import { useStudioSession } from "../context/StudioSession";
import { formatNote } from "../lib/noteSelection";
import { selectionNoteLabels } from "../lib/musicNotation";

export function SessionBar() {
  const { selection, playing, play, stop, sound, updateSound, error, library } =
    useStudioSession();
  return (
    <>
      <div className="session-bar">
        <div className="session-inner">
          <div className="session-selection">
            <i className={playing ? "status-light on" : "status-light"} />
            <div>
              <span className="studio-eyebrow">
                {playing ? "PREVIEW PLAYING" : "YOUR SELECTION"}
              </span>
              <strong>
                {formatNote(selection.name) || "Choose something to hear"}
                <small>{selectionNoteLabels(selection).join(" · ")}</small>
              </strong>
            </div>
          </div>
          <div className="session-controls">
            <button
              className={`session-play ${playing ? "is-playing" : ""}`}
              disabled={!selection.notes.length}
              onClick={() => (playing ? stop() : void play())}
            >
              {playing ? (
                <Square size={15} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
              {playing ? "Stop preview" : "Play selection"}
            </button>
            <span className="escape-label">ESC TO STOP</span>
          </div>
          <label className="session-volume">
            <Volume2 size={18} />
            <span className="sr-only">Preview volume</span>
            <input
              aria-label="Preview volume"
              type="range"
              min="0"
              max="0.8"
              step="0.01"
              value={sound.volume}
              onChange={(e) => updateSound({ volume: Number(e.target.value) })}
            />
            <span>{Math.round(sound.volume * 100)}%</span>
          </label>
        </div>
      </div>
      {(error || library.storageError) && (
        <div className="session-error" role="alert">
          {error || library.storageError}
        </div>
      )}
    </>
  );
}

export function SelectionPreview() {
  const { selection, select, strum, setStrum } = useStudioSession();
  return (
    <aside className="selection-card">
      <div className="panel-kicker">
        <span className="studio-eyebrow">THE CONNECTING THREAD</span>
        <Waves size={17} />
      </div>
      <h3>{formatNote(selection.name) || "Your next discovery"}</h3>
      <div className="selection-notes" aria-label="Selected notes">
        {selectionNoteLabels(selection).map((note, i) => (
          <span key={`${note}-${i}`}>{formatNote(note)}</span>
        ))}
      </div>
      <p>
        This selection follows you between tools. You can see the notes before
        you play them.
      </p>
      <label className="strum-choice">
        <input
          type="checkbox"
          checked={strum}
          onChange={(e) => setStrum(e.target.checked)}
        />{" "}
        Strum notes on next playback
      </label>
      <Link className="studio-text-link" to="/piano">
        View on the existing piano <ArrowUpRight size={15} />
      </Link>
      <button
        className="clear-selection"
        onClick={() => select({ name: "", notes: [], kind: "note" })}
      >
        Clear selection
      </button>
    </aside>
  );
}

export function useStopOnNavigation() {
  const { pathname } = useLocation();
  const { stop } = useStudioSession();
  useEffect(() => {
    stop();
    window.scrollTo(0, 0);
  }, [pathname, stop]);
}
