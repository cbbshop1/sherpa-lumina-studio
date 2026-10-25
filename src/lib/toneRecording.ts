export type ToneClip = {
  blob: Blob;
  buffer: AudioBuffer;
  name: string;
  extension: string;
};
export type CaptureStatus = "idle" | "requesting" | "recording" | "processing";
export const MAX_RECORD_SECONDS = 30;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

// Give microphone takes a portable PCM file with a finite duration and seek bar.
export function encodeWav(
  buffer: Pick<
    AudioBuffer,
    "numberOfChannels" | "length" | "sampleRate" | "getChannelData"
  >,
) {
  const channels = buffer.numberOfChannels;
  const bytes = new ArrayBuffer(44 + buffer.length * channels * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, buffer.length * channels * 2, true);
  const samples = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame++)
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(-1, Math.min(1, samples[channel][frame]));
      view.setInt16(
        offset,
        Math.round(value * (value < 0 ? 32768 : 32767)),
        true,
      );
      offset += 2;
    }
  return bytes;
}

export function recordingError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was not allowed. Allow the microphone in your browser, then try Record my sound again.";
  if (name === "NotFoundError")
    return "No microphone was found. Connect one or import a short audio file.";
  if (name === "NotReadableError")
    return "The microphone is busy or unavailable. Close another app using it, or import a recording.";
  return "This recording could not be opened. Try recording again, or import a short WAV, MP3, M4A, or WebM file.";
}
export function audioExtension(type: string) {
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg")) return "mp3";
  return "webm";
}
export function waveformEnvelope(samples: Float32Array, bins = 800) {
  if (!samples.length) return [];
  const count = Math.max(1, Math.min(bins, samples.length));
  return Array.from({ length: count }, (_, i) => {
    let min = Infinity,
      max = -Infinity;
    const start = Math.floor((i * samples.length) / count),
      end = Math.floor(((i + 1) * samples.length) / count);
    for (let j = start; j < end; j++) {
      min = Math.min(min, samples[j]);
      max = Math.max(max, samples[j]);
    }
    return { min, max };
  });
}
export function waveformWindow(
  samples: Float32Array,
  sampleRate: number,
  seconds: number,
  milliseconds: number,
) {
  const length = Math.min(
    samples.length,
    Math.max(2, Math.round((sampleRate * milliseconds) / 1000)),
  );
  const start = Math.max(
    0,
    Math.min(samples.length - length, Math.round(seconds * sampleRate)),
  );
  return {
    startSeconds: start / sampleRate,
    samples: samples.subarray(start, start + length),
  };
}

type Callbacks = {
  onStatus: (status: CaptureStatus) => void;
  onAnalyser: (analyser: AnalyserNode | null) => void;
  onClip: (clip: ToneClip) => void;
  onError: (message: string) => void;
};
type Dependencies = {
  getStream: () => Promise<MediaStream>;
  context: () => AudioContext;
  recorder: (stream: MediaStream) => MediaRecorder;
};
const browserDependencies: Dependencies = {
  getStream: () =>
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    }),
  context: () => new AudioContext(),
  recorder: (stream) => {
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  },
};

/** Owns the microphone and all cancellation paths. The input is never monitored
 * through speakers. A stopped take can finish decoding after leaving the page. */
export class ToneCapture {
  private callbacks: Callbacks;
  private deps: Dependencies;
  private generation = 0;
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  status: CaptureStatus = "idle";
  constructor(
    callbacks: Callbacks,
    dependencies: Dependencies = browserDependencies,
  ) {
    this.callbacks = callbacks;
    this.deps = dependencies;
  }
  private setStatus(status: CaptureStatus) {
    this.status = status;
    if (!this.disposed) this.callbacks.onStatus(status);
  }
  private releaseInput() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    if (!this.disposed) this.callbacks.onAnalyser(null);
  }
  private closeContext() {
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }
  async start() {
    if (this.status !== "idle" || this.disposed) return;
    const generation = ++this.generation;
    this.setStatus("requesting");
    if (!this.disposed) this.callbacks.onError("");
    try {
      const context = this.deps.context();
      this.context = context;
      let resumeError: unknown;
      const ready = context.resume().catch((error) => {
        resumeError = error;
      });
      const stream = await this.deps.getStream();
      if (generation !== this.generation || this.disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      await ready;
      if (generation !== this.generation || this.disposed) return;
      if (resumeError) throw resumeError;
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.7;
      this.source = context.createMediaStreamSource(stream);
      this.source.connect(analyser);
      const recorder = this.deps.recorder(stream);
      this.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (!this.disposed)
          this.callbacks.onError(
            "The microphone stopped unexpectedly. Try another take or import a recording.",
          );
        this.stop();
      };
      recorder.onstop = async () => {
        this.releaseInput();
        this.setStatus("processing");
        try {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || chunks[0]?.type || "audio/webm",
          });
          if (!blob.size) throw new Error("Empty take");
          const buffer = await context.decodeAudioData(
            await blob.arrayBuffer(),
          );
          if (generation === this.generation)
            this.callbacks.onClip({
              blob: new Blob([encodeWav(buffer)], { type: "audio/wav" }),
              buffer,
              name: "My recording",
              extension: "wav",
            });
        } catch (error) {
          if (!this.disposed) this.callbacks.onError(recordingError(error));
        } finally {
          if (generation === this.generation) {
            this.recorder = null;
            this.closeContext();
            this.setStatus("idle");
          }
        }
      };
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => this.stop();
      });
      recorder.start(250);
      this.setStatus("recording");
      this.callbacks.onAnalyser(analyser);
      this.timer = setTimeout(() => this.stop(), MAX_RECORD_SECONDS * 1000);
    } catch (error) {
      if (generation !== this.generation) return;
      this.releaseInput();
      this.closeContext();
      this.recorder = null;
      this.setStatus("idle");
      if (!this.disposed) this.callbacks.onError(recordingError(error));
    }
  }
  stop() {
    if (this.status === "requesting") {
      this.generation++;
      this.releaseInput();
      this.closeContext();
      this.setStatus("idle");
      return;
    }
    if (this.recorder?.state === "recording") {
      this.setStatus("processing");
      this.recorder.stop();
      this.releaseInput();
    }
  }
  dispose() {
    this.stop();
    this.disposed = true;
    if (this.status === "idle") this.closeContext();
  }
}
