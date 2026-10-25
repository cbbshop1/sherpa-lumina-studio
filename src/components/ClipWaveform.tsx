import { useEffect, useMemo, useRef, useState } from "react";
import { waveformEnvelope, waveformWindow } from "../lib/toneRecording";

export default function ClipWaveform({ buffer }: { buffer: AudioBuffer }) {
  const overview = useRef<HTMLCanvasElement>(null),
    detail = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0),
    [windowMs, setWindowMs] = useState(30);
  const mono = useMemo(() => {
    const data = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++)
        data[i] += samples[i] / buffer.numberOfChannels;
    }
    return data;
  }, [buffer]);
  const envelope = useMemo(() => waveformEnvelope(mono, 1000), [mono]);
  const slice = waveformWindow(mono, buffer.sampleRate, time, windowMs);
  useEffect(() => {
    setTime(0);
  }, [buffer]);
  useEffect(() => {
    const context = overview.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 1000, 160);
    context.fillStyle = "#d9b17c";
    envelope.forEach((bin, i) => {
      context.fillRect(
        (i / envelope.length) * 1000,
        80 - bin.max * 70,
        Math.max(1, 1000 / envelope.length),
        Math.max(1, (bin.max - bin.min) * 70),
      );
    });
    context.fillStyle = "#d5807050";
    context.fillRect(
      (slice.startSeconds / buffer.duration) * 1000,
      0,
      Math.max(3, (windowMs / 1000 / buffer.duration) * 1000),
      160,
    );
  }, [envelope, buffer.duration, slice.startSeconds, windowMs]);
  useEffect(() => {
    const context = detail.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 1000, 230);
    context.strokeStyle = "#829a8440";
    context.lineWidth = 1;
    for (let y = 35; y < 230; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(1000, y);
      context.stroke();
    }
    context.strokeStyle = "#e7b17e";
    context.lineWidth = 2;
    context.beginPath();
    const step = Math.max(1, Math.floor(slice.samples.length / 2000));
    for (let i = 0; i < slice.samples.length; i += step) {
      const x = (i / Math.max(1, slice.samples.length - 1)) * 1000,
        y = 115 - slice.samples[i] * 100;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }, [mono, time, windowMs]);
  return (
    <div className="clip-waveform">
      <div className="clip-waveform-title">
        <strong>Your whole recording</strong>
        <span>{buffer.duration.toFixed(2)} seconds</span>
      </div>
      <canvas
        ref={overview}
        width="1000"
        height="160"
        role="img"
        aria-label="Whole recording waveform"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setTime(((event.clientX - rect.left) / rect.width) * buffer.duration);
        }}
      />
      <div className="recording-axis">
        <span>0 s</span>
        <span>{buffer.duration.toFixed(2)} s</span>
      </div>
      <div className="waveform-inspection">
        <label>
          Inspect time{" "}
          <input
            aria-label="Inspect recording time"
            type="range"
            min="0"
            max={Math.max(0, buffer.duration - windowMs / 1000)}
            step="0.001"
            value={Math.min(
              time,
              Math.max(0, buffer.duration - windowMs / 1000),
            )}
            onChange={(event) => setTime(Number(event.target.value))}
          />
          <span>{slice.startSeconds.toFixed(3)} s</span>
        </label>
        <label>
          Window{" "}
          <select
            aria-label="Waveform time window"
            value={windowMs}
            onChange={(event) => setWindowMs(Number(event.target.value))}
          >
            {[10, 30, 60, 100].map((value) => (
              <option key={value} value={value}>
                {value} ms
              </option>
            ))}
          </select>
        </label>
      </div>
      <canvas
        ref={detail}
        width="1000"
        height="230"
        role="img"
        aria-label="Magnified recording waveform"
      />
      <p className="scope-description">
        Click the overview or move Inspect time to look inside a note. The lower
        view shows a few milliseconds of its shape. Height shows recorded signal
        level.
      </p>
    </div>
  );
}
