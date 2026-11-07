import { useEffect, useRef } from "react";
import { waveformEnvelope } from "../../lib/toneRecording";
import { BEATS_PER_BAR } from "../../lib/fourTrack";

type Props = {
  original: AudioBuffer | null;
  processed: AudioBuffer | null;
  startSec: number;
  songSec: number;
  bars: number;
  position: number;
  recording: boolean;
  onSeek: (seconds: number) => void;
  label: string;
};

const HEIGHT = 84;

function drawTake(
  context: CanvasRenderingContext2D,
  buffer: AudioBuffer,
  startSec: number,
  songSec: number,
  width: number,
  color: string,
) {
  const left = (startSec / songSec) * width;
  const span = (buffer.duration / songSec) * width;
  const bins = Math.max(1, Math.round(Math.min(span, width - left)));
  if (bins <= 0 || left >= width) return;
  const visible = Math.min(
    buffer.length,
    Math.round(((width - left) / span) * buffer.length),
  );
  const envelope = waveformEnvelope(
    buffer.getChannelData(0).subarray(0, visible),
    bins,
  );
  const middle = HEIGHT / 2;
  context.fillStyle = color;
  envelope.forEach(({ min, max }, i) => {
    const top = middle - Math.min(1, max) * (middle - 4);
    const bottom = middle - Math.max(-1, min) * (middle - 4);
    context.fillRect(left + i, top, 1, Math.max(1, bottom - top));
  });
}

/** One track's stretch of tape: bar lines, the take, and the playhead. */
export default function LaneWaveform({
  original,
  processed,
  startSec,
  songSec,
  bars,
  position,
  recording,
  onSeek,
  label,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const width = Math.max(1, Math.floor(element.clientWidth));
      const ratio = window.devicePixelRatio || 1;
      element.width = width * ratio;
      element.height = HEIGHT * ratio;
      const context = element.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, HEIGHT);
      for (let beat = 0; beat <= bars * BEATS_PER_BAR; beat++) {
        const x = Math.round((beat / (bars * BEATS_PER_BAR)) * width) + 0.5;
        const downbeat = beat % BEATS_PER_BAR === 0;
        context.fillStyle = downbeat ? "#ffffff1c" : "#ffffff08";
        context.fillRect(x, 0, 1, HEIGHT);
      }
      context.fillStyle = "#ffffff10";
      context.fillRect(0, HEIGHT / 2, width, 1);
      // The untouched take shows faintly behind, so effects are easy to see.
      if (original && processed && processed !== original)
        drawTake(context, original, startSec, songSec, width, "#f2e9d830");
      if (processed)
        drawTake(context, processed, startSec, songSec, width, "#e6b98b");
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [original, processed, startSec, songSec, bars]);

  const seek = (clientX: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    onSeek(
      Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * songSec,
    );
  };

  return (
    <div
      className={`lane-wave ${recording ? "is-recording" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label={`${label} timeline. Click to move the tape.`}
      aria-valuemin={0}
      aria-valuemax={Math.round(songSec)}
      aria-valuenow={Math.round(position)}
      onClick={(event) => seek(event.clientX, event.currentTarget)}
      onKeyDown={(event) => {
        const step = songSec / bars;
        if (event.key === "ArrowRight")
          onSeek(Math.min(songSec, position + step));
        if (event.key === "ArrowLeft") onSeek(Math.max(0, position - step));
      }}
    >
      <canvas ref={canvas} style={{ height: HEIGHT }} />
      {!processed && !recording && <span className="lane-blank">BLANK TAPE</span>}
      <i
        className="lane-playhead"
        style={{ left: `${(Math.min(position, songSec) / songSec) * 100}%` }}
      />
    </div>
  );
}
