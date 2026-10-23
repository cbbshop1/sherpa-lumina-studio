import { useEffect, useRef, useState } from "react";
import {
  Play,
  Square,
  Circle,
  ChevronUp,
  ChevronDown,
  Download,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studioStore";
import type { Transport } from "@/engine/Transport";

interface TransportBarProps {
  /** Pass the live Transport instance so this component can subscribe
   *  to beat updates without going through Zustand (avoids 40 Hz re-renders
   *  of the whole store). */
  transport: Transport;
  onResumeAudio: () => Promise<void>;
  onExportMidi: () => void;
  onStartAudioCapture: () => void;
  onStopAudioCapture: () => void;
  /** Polled on each render to reflect live capture state. */
  isCapturingAudio: () => boolean;
}

export const TransportBar = ({
  transport,
  onResumeAudio,
  onExportMidi,
  onStartAudioCapture,
  onStopAudioCapture,
  isCapturingAudio,
}: TransportBarProps) => {
  const { bpm, playState, setBpm, play, stop, record } = useStudioStore();
  const [displayBeat, setDisplayBeat] = useState("1.1");
  const [audioCapture, setAudioCapture] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);

  // Subscribe directly to Transport for the beat counter — high-frequency
  // updates stay local to this component, not in the global Zustand store.
  useEffect(() => {
    const unsub = transport.subscribe(({ currentBeat, playState: ps }) => {
      if (currentBeat !== undefined) {
        const bar = Math.floor(currentBeat / 4) + 1;
        const beat = Math.floor(currentBeat % 4) + 1;
        setDisplayBeat(`${bar}.${beat}`);
      }
      if (ps === "stopped") setDisplayBeat("1.1");
    });
    return unsub;
  }, [transport]);

  const handleBpmChange = (delta: number) => {
    setBpm(Math.max(20, Math.min(300, bpm + delta)));
  };

  const handleBpmInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setBpm(val);
  };

  const toggleAudioCapture = () => {
    if (isCapturingAudio()) {
      onStopAudioCapture();
      setAudioCapture(false);
    } else {
      onStartAudioCapture();
      setAudioCapture(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-card border-b border-border">
      {/* Play / Stop / Record */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={stop}
          disabled={playState === "stopped"}
          className="h-9 w-9"
          title="Stop"
        >
          <Square className="w-4 h-4 fill-current" />
        </Button>

        <Button
          variant={playState === "playing" ? "default" : "ghost"}
          size="icon"
          onClick={async () => {
            await onResumeAudio();
            play();
          }}
          disabled={playState === "playing"}
          className="h-9 w-9"
          title="Play"
        >
          <Play className="w-4 h-4 fill-current" />
        </Button>

        <Button
          variant={playState === "recording" ? "destructive" : "ghost"}
          size="icon"
          onClick={async () => {
            await onResumeAudio();
            record();
          }}
          disabled={playState !== "stopped"}
          className={cn(
            "h-9 w-9",
            playState === "recording" && "animate-pulse",
          )}
          title="Record"
        >
          <Circle className="w-4 h-4 fill-current" />
        </Button>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* BPM */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground w-8">BPM</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => handleBpmChange(-1)}
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
        <input
          ref={bpmInputRef}
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={handleBpmInput}
          className="w-14 text-center bg-muted rounded text-sm font-mono font-bold h-8
                     border border-border focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => handleBpmChange(1)}
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* Beat counter */}
      <div className="font-mono text-lg font-bold tabular-nums text-primary min-w-[4rem]">
        {displayBeat}
      </div>

      {/* Playstate badge */}
      {playState !== "stopped" && (
        <span
          className={cn(
            "text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider",
            playState === "playing" && "bg-primary/20 text-primary",
            playState === "recording" &&
              "bg-destructive/20 text-destructive animate-pulse",
          )}
        >
          {playState}
        </span>
      )}

      {/* ── Export controls ─────────────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* MIDI export */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onExportMidi}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Export MIDI (.mid)"
        >
          <Download className="w-3 h-3" />
          MIDI
        </Button>

        {/* Audio capture */}
        <Button
          variant={audioCapture ? "destructive" : "ghost"}
          size="sm"
          onClick={toggleAudioCapture}
          className={cn(
            "h-7 gap-1.5 text-xs",
            !audioCapture && "text-muted-foreground hover:text-foreground",
            audioCapture && "animate-pulse",
          )}
          title={
            audioCapture
              ? "Stop audio capture and download"
              : "Start audio capture"
          }
        >
          <Mic className="w-3 h-3" />
          {audioCapture ? "Stop" : "Audio"}
        </Button>
      </div>
    </div>
  );
};

export default TransportBar;
