import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, Download, AudioLines } from "lucide-react";
import { useOwnSound } from "../context/OwnSoundSession";
import { useStudioSession } from "../context/StudioSession";
import {
  ToneCapture,
  MAX_RECORD_SECONDS,
  MAX_AUDIO_BYTES,
  audioExtension,
  recordingError,
  type CaptureStatus,
} from "../lib/toneRecording";
import SoundScope from "./SoundScope";
import ClipWaveform from "./ClipWaveform";

export default function OwnSoundRecorder() {
  const { clip, setClip } = useOwnSound();
  const { stop: stopPreview } = useStudioSession();
  const [status, setStatus] = useState<CaptureStatus>("idle"),
    [error, setError] = useState("");
  const [captureAnalyser, setCaptureAnalyser] = useState<AnalyserNode | null>(
    null,
  );
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(
    null,
  );
  const [playing, setPlaying] = useState(false),
    [mode, setMode] = useState<"waveform" | "spectrum">("waveform");
  const [url, setUrl] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [importing, setImporting] = useState(false);
  const capture = useRef<ToneCapture | null>(null),
    audio = useRef<HTMLAudioElement>(null),
    file = useRef<HTMLInputElement>(null);
  const playbackElement = useRef<HTMLAudioElement | null>(null);
  const playback = useRef<AudioContext | null>(null),
    mounted = useRef(true),
    importToken = useRef(0);
  const [supported] = useState(
    () =>
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
  );
  const busy = status !== "idle" || importing;
  useEffect(() => {
    mounted.current = true;
    const engine = new ToneCapture({
      onStatus: setStatus,
      onAnalyser: setCaptureAnalyser,
      onClip: setClip,
      onError: setError,
    });
    capture.current = engine;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        engine.stop();
        audio.current?.pause();
      }
    };
    const hide = () => {
      if (document.hidden) {
        engine.stop();
        audio.current?.pause();
      }
    };
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      importToken.current++;
      engine.dispose();
      audio.current?.pause();
      void playback.current?.close().catch(() => {});
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [setClip]);
  useEffect(() => {
    if (!clip) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(clip.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [clip]);
  useEffect(() => {
    if (status !== "recording") return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed((Date.now() - start) / 1000),
      100,
    );
    return () => clearInterval(timer);
  }, [status]);
  const start = () => {
    audio.current?.pause();
    stopPreview();
    setError("");
    void capture.current?.start();
  };
  const importFile = async (selected: File) => {
    if (selected.size > MAX_AUDIO_BYTES) {
      setError(
        "Choose an audio file smaller than 12 MB and up to 30 seconds long.",
      );
      return;
    }
    const token = ++importToken.current;
    audio.current?.pause();
    stopPreview();
    setImporting(true);
    setError("");
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const buffer = await context.decodeAudioData(
        await selected.arrayBuffer(),
      );
      if (buffer.duration > MAX_RECORD_SECONDS + 0.1)
        throw new Error("too-long");
      if (token === importToken.current)
        setClip({
          blob: selected,
          buffer,
          name: selected.name,
          extension: audioExtension(
            selected.type || `audio/${selected.name.split(".").at(-1)}`,
          ),
        });
    } catch (error) {
      if (mounted.current && token === importToken.current)
        setError(
          (error as Error).message === "too-long"
            ? "Choose a recording up to 30 seconds long so you can look closely at a few notes."
            : recordingError(error),
        );
    } finally {
      void context?.close().catch(() => {});
      if (mounted.current && token === importToken.current) setImporting(false);
    }
  };
  const startPlayback = async () => {
    if (busy) {
      audio.current?.pause();
      return;
    }
    stopPreview();
    if (playback.current && playbackElement.current !== audio.current) {
      void playback.current.close().catch(() => {});
      playback.current = null;
    }

    try {
      if (!playback.current) {
        const context = new AudioContext();
        playback.current = context;
        playbackElement.current = audio.current;
        const analyser = context.createAnalyser();
        analyser.fftSize = 4096;
        context.createMediaElementSource(audio.current!).connect(analyser);
        analyser.connect(context.destination);
        setPlaybackAnalyser(analyser);
      }
      await playback.current.resume();
      if (mounted.current) setPlaying(true);
    } catch {
      audio.current?.pause();
      setError("Playback could not start. Try Play again.");
    }
  };
  return (
    <section className="own-sound" aria-label="Your own sound">
      <div className="own-sound-intro">
        <div>
          <p className="studio-eyebrow">YOUR VOICE. YOUR INSTRUMENT.</p>
          <h2>Give your own sound a shape.</h2>
          <p>
            Sing or play a few notes. Record up to 30 seconds, then look closer.
          </p>
        </div>
        <span
          className={`recording-status ${status === "recording" ? "recording" : ""}`}
          role="status"
        >
          {status === "requesting"
            ? "Waiting for microphone permission"
            : status === "recording"
              ? "Microphone recording"
              : status === "processing" || importing
                ? "Preparing your sound…"
                : "Microphone off"}
        </span>
      </div>
      <div className="recording-actions">
        {status === "recording" ? (
          <button
            className="record-button recording"
            onClick={() => capture.current?.stop()}
          >
            <Square size={15} fill="currentColor" /> Stop recording
          </button>
        ) : status === "requesting" ? (
          <button onClick={() => capture.current?.stop()}>
            Cancel microphone request
          </button>
        ) : (
          <button
            className="record-button"
            disabled={!supported || busy}
            onClick={start}
          >
            <Mic size={16} /> {clip ? "Record a new take" : "Record my sound"}
          </button>
        )}
        <button disabled={busy} onClick={() => file.current?.click()}>
          <Upload size={15} /> Import audio
        </button>
        <input
          ref={file}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
          aria-label="Import an audio recording"
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (selected) void importFile(selected);
          }}
        />
        {clip && (
          <>
            <a href={url} download={`lumina-my-sound.${clip.extension}`}>
              <Download size={15} /> Download recording
            </a>
            <button
              disabled={busy}
              onClick={() => {
                audio.current?.pause();
                setClip(null);
                setError("");
              }}
            >
              Clear recording
            </button>
          </>
        )}
      </div>
      {status === "recording" && (
        <div className="recording-progress">
          <progress max={MAX_RECORD_SECONDS} value={elapsed} />
          <span>
            {elapsed.toFixed(1)} / {MAX_RECORD_SECONDS} s
          </span>
        </div>
      )}
      {!supported && (
        <p className="recording-message">
          Microphone recording is unavailable in this browser. You can still
          import a short recording.
        </p>
      )}
      {error && (
        <p className="recording-message error" role="alert">
          {error}
        </p>
      )}
      <div
        className="scope-switch"
        role="group"
        aria-label="Your sound visualization"
      >
        <button
          className={mode === "waveform" ? "active" : ""}
          aria-pressed={mode === "waveform"}
          onClick={() => setMode("waveform")}
        >
          Waveform
        </button>
        <button
          className={mode === "spectrum" ? "active" : ""}
          aria-pressed={mode === "spectrum"}
          onClick={() => setMode("spectrum")}
        >
          Spectrum
        </button>
      </div>
      {status === "recording" ? (
        <SoundScope
          analyser={captureAnalyser}
          playing={true}
          mode={mode}
          sourceLabel="MICROPHONE INPUT"
        />
      ) : clip && mode === "waveform" ? (
        <ClipWaveform buffer={clip.buffer} />
      ) : clip ? (
        <SoundScope
          analyser={playbackAnalyser}
          playing={playing}
          mode="spectrum"
          sourceLabel="YOUR RECORDING"
          emptyTitle="Look inside your tone."
          emptyHint="Press Play on your recording to see its frequency spectrum."
        />
      ) : (
        <div className="recording-empty">
          <AudioLines size={38} strokeWidth={1} />
          <strong>A few notes are plenty.</strong>
          <p>
            Record your voice or an instrument, or import a short audio file.
            Your waveform will stay here after you stop.
          </p>
        </div>
      )}
      {clip && (
        <div className="recording-playback">
          <div>
            <strong>{clip.name}</strong>
            <span>
              {clip.buffer.duration.toFixed(2)} seconds ·{" "}
              {clip.buffer.numberOfChannels === 1 ? "mono" : "stereo"}
            </span>
          </div>
          <audio
            ref={audio}
            controls={!busy}
            src={url || undefined}
            aria-label="Your recording playback"
            onPlay={() => void startPlayback()}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => {
              if (url)
                setError(
                  "This browser could not play the recording. Download it or try another audio format.",
                );
            }}
          />
        </div>
      )}
      <p className="recording-footnote">
        Recordings stay in this browser tab while you explore Lumina. Download a
        take to keep it before closing or refreshing. Your microphone turns off
        when you stop, leave this view, or press Escape.
      </p>
    </section>
  );
}
