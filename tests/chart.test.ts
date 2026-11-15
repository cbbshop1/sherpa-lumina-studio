import { test } from "node:test";
import assert from "node:assert/strict";
import { parseXml, readChart, readScoreFile } from "../src/lib/musicxml.ts";
import { nameNotes, readHarmony } from "../src/lib/harmony.ts";
import { chartNotes } from "../src/lib/chartPlayer.ts";

const STEPS = ["C", "", "D", "", "E", "F", "", "G", "", "A", "", "B"];
/** Write one note. Black keys are spelled as flats. */
function note(midi: number | null, length: number, voice: number, stem: string, extra = "") {
  if (midi === null)
    return `<note><rest/><duration>${length * 2}</duration><voice>${voice}</voice>${extra}</note>`;
  const flat = STEPS[midi % 12] === "";
  const step = STEPS[(midi + (flat ? 1 : 0)) % 12];
  return `<note><pitch><step>${step}</step>${flat ? "<alter>-1</alter>" : ""}<octave>${Math.floor(midi / 12) - 1}</octave></pitch><duration>${length * 2}</duration><voice>${voice}</voice><stem>${stem}</stem>${extra}</note>`;
}
type Bar = [number | null, number | null, number | null, number | null, number][];
/** A barbershop-style score: two staves, two voices each, top staff written an octave up. */
function score(bars: Bar[], options: { beats?: number; eight?: boolean; split?: number } = {}) {
  const beats = options.beats ?? 4;
  const measure = (bar: Bar, index: number, staff: 0 | 1) => {
    const lift = staff === 0 ? 12 : 0;
    const voice = (which: 0 | 1) =>
      bar
        .map((chord) => {
          const midi = chord[staff * 2 + which];
          return note(midi === null ? null : midi + lift, chord[4], which + 1, which ? "down" : "up");
        })
        .join("");
    const total = bar.reduce((sum, chord) => sum + chord[4], 0) * 2;
    const attributes =
      index === 0
        ? `<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>${beats}</beats><beat-type>4</beat-type></time><clef><sign>${staff ? "F" : "G"}</sign><line>${staff ? 4 : 2}</line>${options.eight && staff === 0 ? "<clef-octave-change>-1</clef-octave-change>" : ""}</clef></attributes>`
        : "";
    return `<measure number="${index + 1}">${attributes}${voice(0)}<backup><duration>${total}</duration></backup>${voice(1)}</measure>`;
  };
  const part = (staff: 0 | 1) =>
    `<part id="P${staff + 1}">${bars.map((bar, index) => measure(bar, index, staff)).join("")}</part>`;
  return `<?xml version="1.0"?><!DOCTYPE score-partwise><score-partwise version="4.0"><work><work-title>Test &amp; Tune</work-title></work><part-list><score-part id="P1"><part-name>Voice</part-name></score-part><score-part id="P2"><part-name>Voice</part-name></score-part></part-list>${part(0)}${part(1)}</score-partwise>`;
}
// Sounding pitches, top to bottom: tenor, lead, bari, bass.
const C: [number, number, number, number] = [64, 60, 55, 48];
const A7: [number, number, number, number] = [61, 57, 55, 52];
const A7r: [number, number, number, number] = [64, 61, 55, 45];
const D7: [number, number, number, number] = [66, 60, 57, 50];
const G7: [number, number, number, number] = [65, 62, 59, 43];
const G: [number, number, number, number] = [62, 59, 55, 43];

test("the XML reader copes with declarations, entities and self-closing tags", () => {
  const root = parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><b/><c>hi &lt;there&gt;</c><!-- no --></a>');
  assert.equal(root.children[0].attrs.x, "1 & 2");
  assert.deepEqual(root.children[0].children.map((node) => node.tag), ["b", "c"]);
  assert.equal(root.children[0].children[1].text, "hi <there>");
});

test("a two-staff score becomes four parts, lowered an octave when the 8 is missing", () => {
  const xml = score([[[...C, 4]], [[...G7, 2], [...C, 2]]]);
  const chart = readChart(xml);
  assert.equal(chart.title, "Test & Tune");
  assert.deepEqual(chart.voices, ["Tenor", "Lead", "Bari", "Bass"]);
  assert.equal(chart.loweredTop, true);
  assert.deepEqual(chart.bars[0].parts.map((part) => part[0].midi), C);
  assert.equal(chart.bars[0].parts[0][0].octave, 4);
  assert.equal(chart.bars.every((bar) => !bar.uneven), true);
  // With the 8 marked in the file, the notes are already where they sound.
  const marked = readChart(score([[[...C, 4]]], { eight: true }));
  assert.equal(marked.loweredTop, false);
  assert.equal(marked.octaveTreble, true);
  assert.equal(marked.bars[0].parts[1][0].midi, 72);
  // The reader's guess can be overruled.
  assert.equal(readChart(xml, false).bars[0].parts[0][0].midi, 76);
});

test("a bar the scan cut in two is rejoined, and a short opening bar is a pickup", () => {
  const whole: Bar = [[...C, 2], [...G7, 1]];
  const cut = score([[[...C, 1]], whole, [[...C, 2]], [[...G7, 1]], whole], { beats: 3 });
  const chart = readChart(cut);
  assert.equal(chart.bars.length, 4);
  assert.equal(chart.bars[0].pickup, true);
  assert.equal(chart.repairs.rejoinedBars, 1);
  assert.deepEqual(chart.bars[2].parts[3].map((n) => [n.at, n.length]), [[0, 2], [2, 1]]);
  assert.equal(chart.repairs.unevenBars, 0);
});

test("a stray note in an extra voice goes back to the part with room for it", () => {
  const xml = score([[[64, 60, 55, 48, 2], [null, 60, 55, 48, 2]]]).replace(
    "<note><rest/><duration>4</duration><voice>1</voice></note>",
    note(76, 2, 3, "up"),
  );
  const chart = readChart(xml);
  assert.equal(chart.repairs.movedNotes, 1);
  assert.deepEqual(chart.bars[0].parts[0].map((n) => n.midi), [64, 64]);
});

test("a compressed .mxl file opens like a plain one", async () => {
  const xml = score([[[...C, 4]]]);
  const name = new TextEncoder().encode("score.xml");
  const body = new TextEncoder().encode(xml);
  const packed = new Uint8Array(
    await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer(),
  );
  const local = new Uint8Array(30 + name.length + packed.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, 8, true);
  lv.setUint32(18, packed.length, true);
  lv.setUint32(22, body.length, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(packed, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(20, packed.length, true);
  cv.setUint32(24, body.length, true);
  cv.setUint16(28, name.length, true);
  central.set(name, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);
  const zip = new Uint8Array(local.length + central.length + end.length);
  zip.set(local);
  zip.set(central, local.length);
  zip.set(end, local.length + central.length);
  assert.equal(await readScoreFile(zip.buffer), xml);
  assert.equal(await readScoreFile(new TextEncoder().encode(xml).buffer as ArrayBuffer), xml);
});

test("chords are named with the lowest note given first say", () => {
  assert.deepEqual(nameNotes([48, 55, 60, 64]), { root: 0, kind: "" });
  assert.deepEqual(nameNotes([50, 57, 60, 66]), { root: 2, kind: "7" });
  assert.deepEqual(nameNotes([45, 60, 64, 67]), { root: 9, kind: "m7" });
  assert.deepEqual(nameNotes([48, 57, 64, 67]), { root: 0, kind: "6" });
  assert.equal(nameNotes([60, 61, 62, 63]), null);
});

test("a circle of sevenths is read against the home key and the clock", () => {
  const chart = readChart(score([[[...C, 4]], [[...A7r, 2], [...A7, 2]], [[...D7, 4]], [[...G7, 4]], [[...C, 4]]]));
  const reading = readHarmony(chart);
  assert.equal(`${reading.tonic} ${reading.mode}`, "C major");
  assert.deepEqual(
    reading.harmonies.map((h) => `${h.name} ${h.numeral} ${h.clock}`),
    ["C I 12", "A7 V7/ii 3", "D7 V7/V 2", "G7 V7 1", "C I 12"],
  );
  assert.equal(reading.brackets.length, 1);
  assert.equal(reading.brackets[0].kind, "circle");
  assert.match(reading.brackets[0].label, /3, 2, 1 o'clock, then home/);
  assert.deepEqual([reading.brackets[0].start, reading.brackets[0].end], [4, 20]);
});

test("a long stay on V7 of V is bracketed as leaning on V, not a key change", () => {
  const chart = readChart(
    score([[[...C, 4]], [[...D7, 4]], [[...G, 2], [...D7, 2]], [[...G, 2], [...D7, 2]], [[...G7, 4]], [[...C, 4]]]),
  );
  const reading = readHarmony(chart);
  const lean = reading.brackets.find((bracket) => bracket.kind === "lean")!;
  assert.match(lean.label, /Leaning on V \(G\), without leaving C major/);
  assert.deepEqual([lean.start, lean.end], [4, 16]);
});

test("a ninth chord missing its root takes its name from the seventh beside it", () => {
  // F A C E-flat, then A C E-flat G (no F): still F, now F9.
  const chart = readChart(score([[[63, 60, 57, 53, 2], [67, 63, 60, 57, 2]], [[62, 58, 53, 46, 4]]]));
  const names = readHarmony(chart).harmonies.map((h) => h.name);
  assert.deepEqual(names, ["F7", "F9", "Bb"]);
});

test("playback joins tied notes and keeps each part's notes in order", () => {
  const xml = score([[[...C, 4]], [[...C, 4]]])
    .replace("<voice>1</voice><stem>up</stem></note><backup>", '<voice>1</voice><stem>up</stem><tie type="start"/></note><backup>')
    .replace(/(<measure number="2">.*?<voice>1<\/voice><stem>up<\/stem>)/, '$1<tie type="stop"/>');
  const notes = chartNotes(readChart(xml));
  const tenor = notes.filter((n) => n.part === 0);
  assert.deepEqual(tenor.map((n) => [n.start, n.length]), [[0, 8]]);
  assert.equal(notes.filter((n) => n.part === 3).length, 2);
});
