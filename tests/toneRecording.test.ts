import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ToneCapture,
  waveformEnvelope,
  waveformWindow,
  audioExtension,
  encodeWav,
} from "../src/lib/toneRecording.ts";
class FakeNode {
  connections: unknown[] = [];
  connect(node: unknown) {
    this.connections.push(node);
  }
  disconnect() {
    this.connections = [];
  }
}
class FakeContext {
  state = "suspended";
  destination = { speaker: true };
  source = new FakeNode();
  analyser = { fftSize: 0, smoothingTimeConstant: 0 };
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
  createAnalyser() {
    return this.analyser;
  }
  createMediaStreamSource() {
    return this.source;
  }
  async decodeAudioData() {
    return {
      duration: 0.5,
      sampleRate: 48000,
      numberOfChannels: 1,
      length: 24000,
      getChannelData: () => new Float32Array(24000),
    };
  }
}
class FakeRecorder {
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: any;
  onstop: any;
  onerror: any;
  finished = Promise.resolve();
  empty = false;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(this.empty ? [] : ["audio"]) });
    this.finished = Promise.resolve(this.onstop?.());
  }
}
function setup() {
  const context = new FakeContext(),
    recorder = new FakeRecorder();
  const track = {
    stopped: false,
    onended: null as null | (() => void),
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const states: string[] = [],
    clips: any[] = [],
    errors: string[] = [];
  const dependencies = {
    context: () => context as unknown as AudioContext,
    getStream: async () => stream as unknown as MediaStream,
    recorder: () => recorder as unknown as MediaRecorder,
  };
  const capture = new ToneCapture(
    {
      onStatus: (s) => states.push(s),
      onAnalyser: () => {},
      onClip: (c) => clips.push(c),
      onError: (e) => errors.push(e),
    },
    dependencies,
  );
  return {
    capture,
    context,
    recorder,
    track,
    stream,
    states,
    clips,
    errors,
    dependencies,
  };
}
test("recording routes microphone only to the analyser and releases it immediately on Stop", async () => {
  const s = setup();
  await s.capture.start();
  assert.equal(s.capture.status, "recording");
  assert.deepEqual(s.context.source.connections, [s.context.analyser]);
  s.capture.stop();
  assert.equal(s.track.stopped, true);
  await s.recorder.finished;
  assert.equal(s.clips.length, 1);
  assert.equal(s.clips[0].extension, "wav");
  assert.equal(s.context.state, "closed");
  assert.equal(s.capture.status, "idle");
});
test("canceling a pending microphone request stops a device that arrives late", async () => {
  const s = setup();
  let allow!: (stream: MediaStream) => void;
  s.dependencies.getStream = () =>
    new Promise((resolve) => {
      allow = resolve;
    });
  const pending = s.capture.start();
  s.capture.stop();
  allow(s.stream as unknown as MediaStream);
  await pending;
  assert.equal(s.track.stopped, true);
  assert.equal(s.context.state, "closed");
  assert.equal(s.recorder.state, "inactive");
  assert.equal(s.clips.length, 0);
});
test("leaving the view finishes a take while turning the microphone off", async () => {
  const s = setup();
  await s.capture.start();
  s.capture.dispose();
  assert.equal(s.track.stopped, true);
  await s.recorder.finished;
  assert.equal(s.clips.length, 1);
  assert.equal(s.context.state, "closed");
});
test("permission denial closes its context and leaves recording available to retry", async () => {
  const s = setup();
  s.dependencies.getStream = async () => {
    throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
  };
  await s.capture.start();
  assert.equal(s.capture.status, "idle");
  assert.equal(s.context.state, "closed");
  assert.match(s.errors.at(-1)!, /not allowed/);
});
test("a recorder setup failure stops every input track", async () => {
  const s = setup();
  s.dependencies.recorder = () => {
    throw new Error("unsupported");
  };
  await s.capture.start();
  assert.equal(s.track.stopped, true);
  assert.equal(s.context.state, "closed");
});
test("microphone removal stops and saves the current take", async () => {
  const s = setup();
  await s.capture.start();
  s.track.onended!();
  await s.recorder.finished;
  assert.equal(s.clips.length, 1);
  assert.equal(s.track.stopped, true);
});
test("an empty take reports an error rather than replacing an existing clip", async () => {
  const s = setup();
  s.recorder.empty = true;
  await s.capture.start();
  s.capture.stop();
  await s.recorder.finished;
  assert.equal(s.clips.length, 0);
  assert.ok(s.errors.at(-1));
  assert.equal(s.context.state, "closed");
});
test("recording ends automatically after thirty seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = setup();
  await s.capture.start();
  t.mock.timers.tick(30000);
  await s.recorder.finished;
  assert.equal(s.track.stopped, true);
  assert.equal(s.clips.length, 1);
  t.mock.timers.reset();
});
test("waveform overviews retain peaks and do not invent a zero crossing", () => {
  assert.deepEqual(
    waveformEnvelope(new Float32Array([0.5, 0.75, 0.25, 1]), 2),
    [
      { min: 0.5, max: 0.75 },
      { min: 0.25, max: 1 },
    ],
  );
  assert.deepEqual(waveformEnvelope(new Float32Array([])), []);
});
test("magnified waveform windows stop at the edge of the recording", () => {
  const data = new Float32Array(1000);
  const result = waveformWindow(data, 1000, 0.999, 30);
  assert.equal(result.startSeconds, 0.97);
  assert.equal(result.samples.length, 30);
  assert.equal(waveformWindow(data, 1000, -1, 30).startSeconds, 0);
  assert.equal(audioExtension("audio/mp4"), "m4a");
  assert.equal(audioExtension("audio/ogg;codecs=opus"), "ogg");
});

test("downloadable WAV keeps stereo sample order, duration metadata and clipped PCM levels", () => {
  const bytes = encodeWav({
    sampleRate: 48000,
    length: 2,
    numberOfChannels: 2,
    getChannelData: (channel) =>
      new Float32Array(channel === 0 ? [-2, 0.5] : [2, -0.5]),
  });
  const view = new DataView(bytes);
  assert.equal(bytes.byteLength, 52);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), 16384);
  assert.equal(view.getInt16(50, true), -16384);
});
