import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveMidiEngine, MidiRouter, decodeMidi } from "../src/lib/liveMidi.ts";
import { Context } from "./webAudioMock.ts";
const setup = () => {
  const context = new Context();
  return {
    context,
    engine: new LiveMidiEngine(() => context as unknown as AudioContext),
  };
};
test("MIDI decodes channels, velocity-zero release, pedal and pitch wheel", () => {
  assert.deepEqual(decodeMidi([0x95, 60, 100]), {
    type: "on",
    note: 60,
    velocity: 100,
  });
  assert.deepEqual(decodeMidi([0x90, 60, 0]), { type: "off", note: 60 });
  assert.deepEqual(decodeMidi([0x81, 60, 20]), { type: "off", note: 60 });
  assert.deepEqual(decodeMidi([0xb0, 64, 127]), {
    type: "cc",
    number: 64,
    value: 127,
  });
  assert.equal(decodeMidi([0xe0, 0, 64])?.value, 0);
  assert.equal(decodeMidi([0xe0, 0, 0])?.value, -2);
  assert.equal(decodeMidi([0xf8]), null);
});
test("polyphonic notes release separately and sustain releases on pedal-up", async () => {
  const { context, engine } = setup();
  engine.setInstrument("organ");
  await engine.noteOn(60, 30);
  const first = [...context.oscillators];
  await engine.noteOn(64, 120);
  const second = context.oscillators.slice(first.length);
  assert.ok(first.length && second.length);
  engine.parameter("sustain", 127);
  engine.noteOff(60);
  assert.ok(first.every((n) => n.stopAt === null));
  engine.parameter("sustain", 0);
  assert.ok(first.every((n) => n.stopAt !== null));
  assert.ok(second.every((n) => n.stopAt === null));
  engine.stop();
  assert.ok(second.every((n) => n.stopAt !== null));
  engine.dispose();
});
test("release or panic while browser audio resumes cancels the pending note", async () => {
  for (const stop of [false, true]) {
    const { context, engine } = setup();
    context.state = "suspended";
    let resume!: () => void;
    context.resume = () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      });
    const pending = engine.noteOn(60, 100);
    if (stop) engine.stop();
    else engine.noteOff(60);
    context.state = "running";
    resume();
    await pending;
    assert.equal(context.oscillators.length, 0);
    engine.dispose();
  }
});
test("instrument changes stop old voices and pitch bend reaches held voices", async () => {
  const { context, engine } = setup();
  engine.setInstrument("organ");
  await engine.noteOn(69, 100);
  const first = [...context.oscillators];
  const frequency = first[0].frequency.value;
  engine.parameter("pitchBend", 2);
  assert.ok(first[0].frequency.value > frequency);
  engine.setInstrument("bell");
  assert.ok(first.every((n) => n.stopAt !== null));
  await engine.noteOn(60, 60);
  engine.stop();
  assert.ok(context.oscillators.every((n) => n.stopAt !== null));
  engine.dispose();
});
test("one MIDI owner receives each press, and workspace handoff silences the previous owner", async () => {
  const make = () => {
    const calls: unknown[] = [];
    return {
      calls,
      noteOn: (n: number, v: number) => {
        calls.push(["on", n, v]);
      },
      noteOff: (n: number) => {
        calls.push(["off", n]);
      },
      parameter: (p: string, v: number) => {
        calls.push([p, v]);
      },
      stop: () => {
        calls.push("stop");
      },
    };
  };
  const lesson = make(),
    studio = make(),
    router = new MidiRouter(lesson);
  await router.noteOn(60, 100);
  const detach = router.register(studio);
  assert.ok(lesson.calls.includes("stop"));
  await router.noteOn(64, 100);
  router.noteOff(64);
  assert.equal(
    lesson.calls.filter((c) => Array.isArray(c) && c[0] === "on").length,
    1,
  );
  assert.deepEqual(
    studio.calls.filter((c) => Array.isArray(c)),
    [
      ["on", 64, 100],
      ["off", 64],
    ],
  );
  detach();
  await router.noteOn(67, 100);
  router.noteOff(67);
  assert.deepEqual(lesson.calls.at(-1), ["off", 67]);
});
