import { useEffect, useRef } from "react";
import { AudioLines } from "lucide-react";
export default function SoundScope({
  analyser,
  playing,
  mode,
}: {
  analyser: AnalyserNode | null;
  playing: boolean;
  mode: "waveform" | "spectrum";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let frame = 0;
    const values = analyser
      ? new Uint8Array(
          mode === "waveform" ? analyser.fftSize : analyser.frequencyBinCount,
        )
      : null;
    const draw = () => {
      const w = element.width,
        h = element.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#33443d";
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * h) / 6);
        ctx.lineTo(w, (i * h) / 6);
        ctx.stroke();
      }
      if (analyser && values && playing) {
        if (mode === "waveform") {
          analyser.getByteTimeDomainData(values);
          ctx.beginPath();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#e9b580";
          const count = Math.min(
            values.length,
            Math.round(analyser.context.sampleRate / 70),
          );
          for (let i = 0; i < count; i++) {
            const x = (i / (count - 1)) * w,
              y = (values[i] / 255) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          analyser.getByteFrequencyData(values);
          const binWidth = analyser.context.sampleRate / analyser.fftSize,
            max = Math.min(20000, analyser.context.sampleRate / 2);
          for (let i = 0; i < 100; i++) {
            const lo = 20 * (max / 20) ** (i / 100),
              hi = 20 * (max / 20) ** ((i + 1) / 100);
            const start = Math.max(1, Math.floor(lo / binWidth)),
              end = Math.min(
                values.length - 1,
                Math.max(start, Math.ceil(hi / binWidth)),
              );
            let value = 0;
            for (let j = start; j <= end; j++)
              value = Math.max(value, values[j]);
            const height = (value / 255) * (h - 12);
            ctx.fillStyle = i < 55 ? "#91b7a4" : "#e9b580";
            ctx.fillRect((i * w) / 100, h - height, w / 100 - 2, height);
          }
        }
      }
      if (playing) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [analyser, playing, mode]);
  return (
    <div className="sound-scope">
      <div className="scope-heading">
        <span>
          <i className={`status-light ${playing ? "on" : ""}`} />
          {playing ? "LIVE OUTPUT" : "STANDBY"}
        </span>
        <span>
          {mode === "waveform" ? "AMPLITUDE / TIME" : "LOG FREQUENCY / Hz"}
        </span>
      </div>
      <div className="scope-canvas">
        <canvas
          ref={canvas}
          width={1000}
          height={340}
          role="img"
          aria-label={
            mode === "waveform"
              ? "Live audio waveform"
              : "Live frequency spectrum"
          }
        />
        {!playing && (
          <div className="scope-empty">
            <AudioLines size={34} strokeWidth={1} />
            <strong>Give the silence a shape.</strong>
            <span>Play your selection to look inside the sound.</span>
          </div>
        )}
      </div>
      <div className="scope-axis">
        {(mode === "spectrum"
          ? ["20", "100", "1k", "10k", "20k"]
          : ["0", "TIME →"]
        ).map((label, index, labels) => {
          const frequency = [20, 100, 1000, 10000, 20000][index];
          const position = mode === "spectrum" ? Math.log(frequency / 20) / Math.log(1000) * 100 : index * 100;
          return <span key={label} style={{position: "absolute", left: `${position}%`, transform: index === 0 ? "none" : index === labels.length - 1 ? "translateX(-100%)" : "translateX(-50%)"}}>{label}</span>;
        })}
      </div>
    </div>
  );
}
