import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studioStore";
import type { Transport } from "@/engine/Transport";
import DrumGrid from "./DrumGrid";
import PianoRoll from "./PianoRoll";

interface SequencerViewProps {
  transport: Transport;
  onPreviewNote: (trackId: number, midi: number) => void;
}

const BAR_OPTIONS = [1, 2, 4] as const;

const SequencerView = ({ transport, onPreviewNote }: SequencerViewProps) => {
  const tracks = useStudioStore((s) => s.tracks);
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);
  const setSelectedTrack = useStudioStore((s) => s.setSelectedTrack);
  const patternLengthBars = useStudioStore((s) => s.patternLengthBars);
  const setPatternLengthBars = useStudioStore((s) => s.setPatternLengthBars);

  const isDrumTrack = selectedTrackId === 0;

  return (
    <div className="mx-6 mt-6 rounded-2xl border border-border bg-card overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
        {/* Track tabs */}
        <div className="flex gap-1">
          {tracks.map((track) => (
            <button
              key={track.id}
              aria-pressed={selectedTrackId === track.id}
              onClick={() => setSelectedTrack(track.id)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                selectedTrackId === track.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {track.name}
            </button>
          ))}
        </div>

        {/* Bar count selector */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Bars:</span>
          {BAR_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => setPatternLengthBars(b)}
              className={cn(
                "w-7 h-6 rounded text-xs font-mono transition-colors",
                patternLengthBars === b
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor area ─────────────────────────────────────────────────── */}
      <div className={isDrumTrack ? "h-64 overflow-x-auto" : ""}>
        {isDrumTrack ? (
          <DrumGrid trackId={selectedTrackId} transport={transport} />
        ) : (
          <PianoRoll
            key={selectedTrackId}
            trackId={selectedTrackId}
            transport={transport}
            onPreviewNote={onPreviewNote}
          />
        )}
      </div>
    </div>
  );
};

export default SequencerView;
