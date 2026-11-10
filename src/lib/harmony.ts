// Read the chords out of four parts: name each one, place it in the key,
// and notice when the music leans on another chord for a while.
import type { Chart } from "./musicxml.ts";
import { keyVocabulary, type KeyChord, type KeyMode, type Quality } from "./keyChords.ts";
import { pitchClass, spellIntervals } from "./musicNotation.ts";
import { formatNote } from "./noteSelection.ts";

export type Harmony = {
  /** Start in quarter notes from the top of the chart, and how long it lasts. */
  start: number;
  length: number;
  bar: number;
  at: number;
  /** Chord name as Lumina writes it ("Bb7"), or "" when the notes make no clear chord. */
  name: string;
  root: number;
  kind: Kind | "";
  /** Roman numeral in the home key ("V7/V"). */
  numeral: string;
  /** Hour on the barbershop clock: home at 12, each step a fifth away. */
  clock: number;
  /** For a chord that points at another: the id of its target in the key. */
  target?: string;
};

export type Bracket = {
  start: number;
  end: number;
  kind: "lean" | "circle";
  label: string;
};

export type Reading = {
  tonic: string;
  mode: KeyMode;
  harmonies: Harmony[];
  brackets: Bracket[];
  /** Start of each bar in quarter notes, plus the end of the chart. */
  barStarts: number[];
};

type Kind = "" | "m" | "dim" | "aug" | "7" | "maj7" | "m7" | "m7b5" | "dim7" | "6" | "m6" | "9";

// Each shape is the set of half steps above the root. Order matters: when a
// handful of notes fits two names, the earlier shape wins.
const SHAPES: [number[], Kind][] = [
  [[0, 4, 7, 10], "7"],
  [[0, 2, 4, 7, 10], "9"],
  [[0, 2, 4, 10], "9"],
  [[0, 4, 7], ""],
  [[0, 3, 7], "m"],
  [[0, 4, 7, 11], "maj7"],
  [[0, 3, 7, 10], "m7"],
  [[0, 3, 6, 9], "dim7"],
  [[0, 3, 6, 10], "m7b5"],
  [[0, 4, 7, 9], "6"],
  [[0, 3, 7, 9], "m6"],
  [[0, 3, 6], "dim"],
  [[0, 4, 8], "aug"],
  [[0, 4, 10], "7"],
  [[0, 7, 10], "7"],
  [[0, 4], ""],
  [[0, 3], "m"],
];
const QUALITY: Record<Kind, Quality | null> = {
  "": "Major",
  m: "Minor",
  dim: "Diminished",
  aug: null,
  "7": "Dominant 7",
  maj7: "Major 7",
  m7: "Minor 7",
  m7b5: "Half-diminished 7",
  dim7: "Diminished 7",
  "6": "Major",
  m6: "Minor",
  "9": "Dominant 7",
};
const MAJOR_TONICS = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"];
const MINOR_TONICS = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"];
/** The scale step each half step above home is written on: a lowered 7th is still a 7th. */
const STEP_OF = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7];
const PLAIN = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const DEGREES = ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"];
const mod = (value: number) => ((value % 12) + 12) % 12;

/** Name a handful of sounding notes. The lowest note gets first say as the root. */
export function nameNotes(sounding: number[]): { root: number; kind: Kind } | null {
  const classes = [...new Set(sounding.map(mod))];
  if (classes.length < 2) return null;
  const bass = mod(Math.min(...sounding));
  // The lowest note is tried as the root against every shape before any
  // other note gets a turn, so C-E-G-A over C is C6 and over A is Am7.
  for (const root of [bass, ...classes.filter((pitch) => pitch !== bass)]) {
    const above = classes.map((pitch) => mod(pitch - root)).sort((x, y) => x - y);
    for (const [shape, kind] of SHAPES) {
      if (shape.length !== above.length) continue;
      const wanted = shape.map(mod).sort((x, y) => x - y);
      if (above.every((value, index) => value === wanted[index])) return { root, kind };
    }
  }
  return null;
}

const DOMINANT: Kind[] = ["7", "9"];

export function readHarmony(chart: Chart): Reading {
  // ---- One reading per beat.
  const beat = 4 / chart.beatUnit;
  const barStarts: number[] = [];
  let clockTime = 0;
  type Slice = { start: number; bar: number; at: number; chord: { root: number; kind: Kind } | null };
  const slices: Slice[] = [];
  chart.bars.forEach((bar, index) => {
    barStarts.push(clockTime);
    for (let at = 0; at < bar.length - 1e-6; at += beat) {
      const sounding = bar.parts.flatMap((part) =>
        part
          .filter((note) => note.midi !== null && note.at <= at + 1e-6 && at < note.at + note.length - 1e-6)
          .map((note) => note.midi!),
      );
      slices.push({ start: clockTime + at, bar: index, at, chord: sounding.length ? nameNotes(sounding) : null });
    }
    clockTime += bar.length;
  });
  barStarts.push(clockTime);

  // ---- Context: a chord missing its root is heard as the chord beside it.
  const neighbour = (index: number, step: number) => {
    for (let i = index + step; i >= 0 && i < slices.length && Math.abs(i - index) <= 3; i += step) {
      const other = slices[i].chord;
      if (other && (other.root !== slices[index].chord?.root || other.kind !== slices[index].chord?.kind))
        return other;
    }
    return null;
  };
  slices.forEach((slice, index) => {
    const chord = slice.chord;
    if (!chord) return;
    for (const beside of [neighbour(index, -1), neighbour(index, 1)]) {
      if (!beside || !DOMINANT.includes(beside.kind)) continue;
      // Fm6 beside Bb7 is Bb9 without its root; so is Dm7b5.
      if (
        (chord.kind === "m6" && mod(chord.root - beside.root) === 7) ||
        (chord.kind === "m7b5" && mod(chord.root - beside.root) === 4)
      ) {
        slice.chord = { root: beside.root, kind: "9" };
        return;
      }
      // D-F-Ab beside Bb7 is Bb7 without its root.
      if (chord.kind === "dim" && mod(chord.root - beside.root) === 4) {
        slice.chord = { root: beside.root, kind: "7" };
        return;
      }
    }
  });

  // ---- The key: the signature says which pair, the last chord says which one.
  const named = slices.filter((slice) => slice.chord);
  const majorTonic = MAJOR_TONICS[chart.fifths + 7] ?? "C";
  const minorTonic = MINOR_TONICS[chart.fifths + 7] ?? "A";
  const closing = named[named.length - 1]?.chord;
  const mode: KeyMode =
    closing && closing.root === pitchClass(minorTonic) && ["m", "m7", "m6"].includes(closing.kind)
      ? "minor"
      : "major";
  const tonic = mode === "major" ? majorTonic : minorTonic;
  const home = pitchClass(tonic);
  const words = keyVocabulary(tonic, mode);
  const rootOf = (chord: KeyChord) => pitchClass(/^[A-G][#b]*/.exec(chord.name)![0]);

  const place = (root: number, kind: Kind) => {
    const quality = QUALITY[kind];
    const found = quality && words.find((word) => word.quality === quality && rootOf(word) === root);
    // A plain major chord on a pointer's root still points.
    const pointing =
      !found && kind === ""
        ? words.find((word) => word.pointer && rootOf(word) === root)
        : undefined;
    const match = found || pointing;
    const away = mod(root - home);
    const spelled = spellIntervals(tonic, [away], [STEP_OF[away]])[0];
    const letter = match
      ? /^[A-G][#b]*/.exec(match.name)![0]
      : // Outside the key, a plain name beats a double flat.
        /##|bb/.test(spelled)
        ? PLAIN[root]
        : spelled;
    let numeral: string;
    if (found) {
      numeral = found.numeral;
      if (kind === "9") numeral = numeral.replace("7", "9");
      if (kind === "6" || kind === "m6") numeral += "add6";
    } else if (pointing) numeral = pointing.numeral.replace("V7/", "V/");
    else {
      const degree = DEGREES[mod(root - home)];
      const small = ["m", "dim", "m7", "m7b5", "dim7", "m6"].includes(kind);
      const marks: Partial<Record<Kind, string>> = {
        dim: "°",
        dim7: "°7",
        m7b5: "ø7",
        aug: "+",
        "7": "7",
        "9": "9",
        maj7: "maj7",
        m7: "7",
      };
      numeral = (small ? degree.toLowerCase() : degree) + (marks[kind] ?? "");
    }
    return {
      name: letter + kind,
      numeral,
      target: match?.pointer ? match.id.slice(1) : undefined,
    };
  };

  // ---- Join beats that hold the same chord.
  const harmonies: Harmony[] = [];
  slices.forEach((slice, index) => {
    const end = index + 1 < slices.length ? slices[index + 1].start : clockTime;
    const last = harmonies[harmonies.length - 1];
    const chord = slice.chord;
    if (last && ((chord && last.kind === chord.kind && last.root === chord.root && last.name) || (!chord && !last.name))) {
      last.length = end - last.start;
      return;
    }
    harmonies.push({
      start: slice.start,
      length: end - slice.start,
      bar: slice.bar,
      at: slice.at,
      root: chord?.root ?? -1,
      kind: chord?.kind ?? "",
      clock: chord ? mod((chord.root - home) * 7) || 12 : 0,
      ...(chord ? place(chord.root, chord.kind) : { name: "", numeral: "" }),
    });
  });

  // ---- Brackets: circles of sevenths first, then longer leans on one chord.
  const real = harmonies.filter((harmony) => harmony.name && harmony.length >= beat);
  const brackets: Bracket[] = [];
  const isSeventh = (harmony: Harmony) => DOMINANT.includes(harmony.kind as Kind);
  // A circle: sevenths whose roots fall by fifths, three or more in a row.
  // A chord may linger on its root in another form, and a one-beat passing
  // chord doesn't break the chain.
  for (let i = 0; i < real.length; i++) {
    if (!isSeventh(real[i])) continue;
    const hours = [real[i].clock];
    let root = real[i].root,
      last = i,
      j = i + 1;
    for (; j < real.length; j++) {
      const here = real[j];
      if (here.root === root) last = j;
      else if (isSeventh(here) && mod(here.root - root) === 5) {
        root = here.root;
        hours.push(here.clock);
        last = j;
      } else if (here.length > beat) break;
    }
    if (hours.length < 3) continue;
    const landing = real[last + 1];
    const lands = landing && mod(landing.root - root) === 5;
    const end = lands ? landing : real[last];
    brackets.push({
      start: real[i].start,
      end: end.start + end.length,
      kind: "circle",
      label: `Circle of sevenths: ${hours.join(", ")} o'clock${lands && landing.root === home ? ", then home" : ""}`,
    });
    i = last;
  }
  const barLength = (chart.beats * 4) / chart.beatUnit;
  for (let i = 0; i < real.length; i++) {
    const first = real[i];
    if (!first.target) continue;
    const goal = words.find((word) => word.id === first.target && !word.alternate)!;
    const goalRoot = rootOf(goal);
    let j = i,
      pointers = 0;
    while (j < real.length) {
      const here = real[j];
      const pointsThere = here.target === first.target;
      const isGoal = here.root === goalRoot && !isSeventh(here);
      if (pointsThere) pointers++;
      else if (!isGoal && !(here.length <= beat && j > i)) break;
      j++;
    }
    // Step back over anything that isn't part of the lean at the end.
    while (j > i && real[j - 1].target !== first.target && real[j - 1].root !== goalRoot) j--;
    const end = j > i ? real[j - 1].start + real[j - 1].length : first.start;
    if (pointers >= 2 && end - first.start >= barLength * 2) {
      brackets.push({
        start: first.start,
        end,
        kind: "lean",
        label: `Leaning on ${goal.numeral} (${formatNote(goal.name)}), without leaving ${formatNote(tonic)} ${mode}`,
      });
      i = j - 1;
    }
  }
  brackets.sort((a, b) => a.start - b.start);
  return { tonic, mode, harmonies, brackets, barStarts };
}
