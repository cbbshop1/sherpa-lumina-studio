import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioEngine, type SoundSettings } from "../src/lib/studioAudio.ts";
import { voiceNotes, midiToFrequency } from "../src/lib/noteSelection.ts";

class Parameter {
  value = 0;
  events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "set", value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "ramp", value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.linearRampToValueAtTime(value, time);
  }
  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "target", value, time });
  }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
}
class Node {
  connections: Node[] = [];
  gain = new Parameter();
  frequency = new Parameter();
  detune = new Parameter();
  Q = new Parameter();
  type = "";
  startAt: number | null = null;
  stopAt: number | null = null;
  onended: (() => void) | null = null;
  connect(node: Node) {
    this.connections.push(node);
    return node;
  }
  disconnect() {
    this.connections = [];
  }
  start(time: number) {
    this.startAt = time;
  }
  stop(time: number) {
    this.stopAt = time;
  }
}
class Context {
  currentTime = 10;
  state = "running";
  destination = new Node();
  oscillators: Node[] = [];
  gains: Node[] = [];
  analyser: Node | null = null;
  closed = false;
  resume: () => Promise<void> = async () => {
    this.state = "running";
  };
  createOscillator() {
    const node = new Node();
    this.oscillators.push(node);
    return node;
  }
  createGain() {
    const node = new Node();
    this.gains.push(node);
    return node;
  }
  createBiquadFilter() {
    return new Node();
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createAnalyser() {
    this.analyser = new Node();
    return this.analyser;
  }
  async close() {
    this.state = "closed";
    this.closed = true;
  }
}
const sound: SoundSettings = {
  waveform: "sine",
  volume: 0.3,
  cutoff: 6000,
  attack: 0.02,
  release: 0.2,
};
const setup = () => {
  const context = new Context();
  return {
    context,
    engine: new AudioEngine(() => context as unknown as AudioContext),
  };
};

test("A440 and ascending chord extensions retain their actual octave", () => {
  assert.equal(midiToFrequency(69), 440);
  assert.deepEqual(
    voiceNotes(["C", "E", "G", "A#", "D"]),
    [60, 64, 67, 70, 74],
  );
  assert.deepEqual(voiceNotes(["G", "B", "D"]), [67, 71, 74]);
  assert.throws(() => voiceNotes(["invalid"]));
});
test("a single note replaced by a chord is still stopped by Stop", async () => {
  const { context, engine } = setup();
  await engine.play([440], sound);
  await engine.play([261.63, 329.63, 392], sound);
  engine.stop(0.1);
  assert.equal(context.oscillators.length, 4);
  for (const voice of context.oscillators)
    assert.ok(voice.stopAt !== null && voice.stopAt <= 10.12);
});
test("Stop cancels future strum voices before their scheduled onset", async () => {
  const { context, engine } = setup();
  await engine.play([261.63, 329.63, 392], sound, true);
  engine.stop();
  assert.ok(context.oscillators[1].startAt! > 10);
  assert.equal(context.oscillators[1].stopAt, 10);
  assert.equal(context.oscillators[2].stopAt, 10);
});
test("Stop during a suspended-context resume prevents late playback", async () => {
  const { context, engine } = setup();
  context.state = "suspended";
  let finish!: () => void;
  context.resume = () =>
    new Promise<void>((resolve) => {
      finish = () => {
        context.state = "running";
        resolve();
      };
    });
  const pending = engine.play([440], sound);
  engine.stop();
  finish();
  assert.equal(await pending, false);
  assert.equal(context.oscillators.length, 0);
});
test("a newer playback request wins a delayed resume race", async () => {
  const { context, engine } = setup();
  context.state = "suspended";
  const finishes: (() => void)[] = [];
  context.resume = () => new Promise<void>((resolve) => finishes.push(resolve));
  const first = engine.play([440], sound),
    second = engine.play([660], sound);
  context.state = "running";
  finishes.forEach((f) => f());
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].frequency.value, 660);
});
test("the first voice reaches output through the analyser, never a bypass", async () => {
  const { context, engine } = setup();
  await engine.play([440], sound);
  let current = context.oscillators[0];
  const graph: Node[] = [current];
  while (current.connections.length) {
    current = current.connections[0];
    graph.push(current);
  }
  assert.ok(graph.includes(context.analyser!));
  assert.equal(graph.at(-1), context.destination);
  assert.equal(
    engine.getAnalyser(),
    context.analyser as unknown as AnalyserNode,
  );
});
test("chord gain is normalized and live volume changes use the shared master", async () => {
  const { context, engine } = setup();
  await engine.play([220, 330, 440, 550, 660], sound);
  const total = context.gains
    .slice(1)
    .reduce((sum, node) => sum + node.gain.value, 0);
  assert.ok(total <= 0.701);
  engine.update({ ...sound, volume: 0.2, waveform: "triangle" });
  assert.equal(context.gains[0].gain.value, 0.2);
  assert.ok(context.oscillators.every((v) => v.type === "triangle"));
});
test("finished voices are disconnected and dispose closes the audio context", async () => {
  const { context, engine } = setup();
  await engine.play([440], sound);
  context.oscillators[0].onended?.();
  assert.equal(context.oscillators[0].connections.length, 0);
  engine.dispose();
  assert.equal(context.closed, true);
  assert.equal(engine.getAnalyser(), null);
});

test("the piano transport stops every instrument harmonic and can replay the same chord", async () => {
  const { context, engine } = setup();
  await engine.play([261.63, 311.13, 392], sound, false, "piano");
  assert.equal(context.oscillators.length, 9);
  engine.stop();
  assert.ok(context.oscillators.every((voice) => voice.stopAt !== null));
  await engine.play([261.63, 311.13, 392], sound, false, "piano");
  assert.equal(context.oscillators.length, 18);
  assert.ok(
    context.oscillators.slice(9).every((voice) => voice.stopAt === null),
  );
});

test("all six piano instruments share volume and preserve timbre when volume changes", async () => {
  for (const instrument of [
    "piano",
    "organ",
    "synth",
    "epiano",
    "strings",
    "bell",
  ] as const) {
    const { context, engine } = setup();
    await engine.play([440], sound, false, instrument);
    const timbres = context.oscillators.map((voice) => voice.type);
    engine.update({ ...sound, volume: 0 });
    assert.equal(context.gains[0].gain.value, 0);
    assert.deepEqual(
      context.oscillators.map((voice) => voice.type),
      timbres,
    );
    engine.stop();
    assert.ok(context.oscillators.every((voice) => voice.stopAt !== null));
  }
});

test("Stop cancels a piano chord while browser audio is still resuming", async () => {
  const { context, engine } = setup();
  context.state = "suspended";
  let finish!: () => void;
  context.resume = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const pending = engine.play([261.63, 392], sound, false, "organ");
  engine.stop();
  finish();
  assert.equal(await pending, false);
  assert.equal(context.oscillators.length, 0);
});
