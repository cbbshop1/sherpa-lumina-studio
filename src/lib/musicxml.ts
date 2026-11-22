// Read a MusicXML score (the open format notation programs and scanners
// export) into four singing parts Lumina can draw, play, and analyze.
// Scanned scores arrive with mistakes, so reading also means repairing:
// stray notes go back to a part, bars cut in two are rejoined, and anything
// that still doesn't add up is flagged instead of hidden.

export type ChartNote = {
  /** Start, in quarter notes from the beginning of its bar. */
  at: number;
  /** Length in quarter notes. */
  length: number;
  /** Sounding pitch as a MIDI number, or null for a rest. */
  midi: number | null;
  /** How it is written: letter, sharps (+) or flats (-), and octave as sounding. */
  step: string;
  alter: number;
  octave: number;
  tieStart: boolean;
  tieStop: boolean;
  /** The first verse's syllable, kept for anything that only wants one line. */
  lyric?: string;
  /** Every verse's syllable, by verse number (1 first). Gaps are empty strings. */
  verses?: string[];
};

export type ChartBar = {
  number: string;
  /** Four parts, top to bottom. */
  parts: [ChartNote[], ChartNote[], ChartNote[], ChartNote[]];
  /** Quarter notes this bar should hold. */
  length: number;
  /** A part's notes don't fill the bar, or overfill it. */
  uneven: boolean;
  /** A short opening bar, the pickup. */
  pickup: boolean;
  /** A short bar that is short on purpose: it closes or opens a section at a double bar. */
  partial?: boolean;
};

export type Chart = {
  title: string;
  composer: string;
  /** Sharps (positive) or flats (negative) in the key signature. */
  fifths: number;
  beats: number;
  beatUnit: number;
  bars: ChartBar[];
  /** The top staff carries the little 8: it sounds an octave below where it is written. */
  octaveTreble: boolean;
  /** True when Lumina lowered the top staff itself because the scan lost the 8. */
  loweredTop: boolean;
  voices: [string, string, string, string];
  repairs: {
    rejoinedBars: number;
    movedNotes: number;
    /** A note one beat short of the chord the other parts hold, lengthened to match (a lost dot). */
    lengthenedNotes: number;
    /** A part that stopped before the barline, given the rest it was missing. */
    filledRests: number;
    /** A last note that ran past the barline, cut back to fit. */
    trimmedNotes: number;
    unevenBars: number;
  };
};

// ---- A small, forgiving XML reader (no browser needed, so it can be tested).

export type XmlNode = {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
const decode = (text: string) =>
  text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, code: string) =>
    code[0] === "#"
      ? String.fromCodePoint(
          code[1] === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)),
        )
      : (ENTITIES[code] ?? whole),
  );

export function parseXml(source: string): XmlNode {
  const root: XmlNode = { tag: "", attrs: {}, children: [], text: "" };
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    const top = stack[stack.length - 1];
    if (match[1] !== undefined) top.text += match[1];
    else if (match[2]) {
      if (stack.length > 1) stack.pop();
    } else if (match[3]) {
      const node: XmlNode = { tag: match[3], attrs: {}, children: [], text: "" };
      const attr = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let pair: RegExpExecArray | null;
      while ((pair = attr.exec(match[4] ?? "")))
        node.attrs[pair[1]] = decode(pair[2] ?? pair[3] ?? "");
      top.children.push(node);
      if (!match[5]) stack.push(node);
    } else if (match[6]) top.text += decode(match[6]);
  }
  return root;
}

const child = (node: XmlNode | undefined, tag: string) =>
  node?.children.find((entry) => entry.tag === tag);
const children = (node: XmlNode | undefined, tag: string) =>
  node?.children.filter((entry) => entry.tag === tag) ?? [];
const textOf = (node: XmlNode | undefined, tag: string) =>
  child(node, tag)?.text.trim() ?? "";
const walk = (node: XmlNode | undefined, ...path: string[]) =>
  path.reduce<XmlNode | undefined>((at, tag) => child(at, tag), node);

// ---- Compressed .mxl files are zip archives holding the XML.

async function inflate(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Pull the score's XML text out of a file, whether plain or compressed. */
export async function readScoreFile(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return new TextDecoder().decode(bytes);
  // Find the archive's table of contents at the end of the file.
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("This file could not be opened.");
  let at = view.getUint32(end + 16, true);
  const count = view.getUint16(end + 10, true);
  const entries: { name: string; method: number; size: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = view.getUint16(at + 28, true);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      method: view.getUint16(at + 10, true),
      size: view.getUint32(at + 20, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  const read = async (entry: (typeof entries)[number]) => {
    const start =
      entry.offset +
      30 +
      view.getUint16(entry.offset + 26, true) +
      view.getUint16(entry.offset + 28, true);
    const body = bytes.subarray(start, start + entry.size);
    return new TextDecoder().decode(entry.method === 8 ? await inflate(body) : body);
  };
  // The container file names the score; fall back to the first XML that isn't it.
  const container = entries.find((entry) => entry.name === "META-INF/container.xml");
  const named = container
    ? /full-path\s*=\s*"([^"]+)"/.exec(await read(container))?.[1]
    : undefined;
  const score =
    entries.find((entry) => entry.name === named) ??
    entries.find(
      (entry) => !entry.name.startsWith("META-INF") && /\.(xml|musicxml)$/i.test(entry.name),
    );
  if (!score) throw new Error("No score was found inside this file.");
  return read(score);
}

// ---- From XML to four parts.

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const snap = (value: number) => Math.round(value * 96) / 96;
const median = (values: number[]) =>
  values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : 0;

type Raw = ChartNote & { voice: string; staff: number; stemUp: boolean | null };

/** One staff's worth of bars, each a list of notes tagged with their written voice. */
function readStaves(part: XmlNode) {
  const staves: Raw[][][] = [];
  const info = {
    fifths: 0,
    beats: 4,
    beatUnit: 4,
    clefDrop: [] as boolean[],
    numbers: [] as string[],
    /** The bar ends at a double bar, a final bar, or a repeat: a section edge. */
    sectionEnd: [] as boolean[],
  };
  let divisions = 1;
  children(part, "measure").forEach((measure, barIndex) => {
    info.numbers[barIndex] = measure.attrs.number ?? String(barIndex + 1);
    info.sectionEnd[barIndex] = children(measure, "barline").some((line) => {
      const style = textOf(line, "bar-style");
      return (
        (line.attrs.location ?? "right") === "right" &&
        (/^(light-light|light-heavy|heavy-light|heavy-heavy|heavy)$/.test(style) ||
          !!child(line, "repeat"))
      );
    });
    let position = 0,
      last = 0;
    for (const entry of measure.children) {
      if (entry.tag === "attributes") {
        const perQuarter = Number(textOf(entry, "divisions"));
        if (perQuarter > 0) divisions = perQuarter;
        const key = child(entry, "key");
        if (key && barIndex === 0) info.fifths = Number(textOf(key, "fifths")) || 0;
        const time = child(entry, "time");
        if (time && barIndex === 0) {
          info.beats = Number(textOf(time, "beats")) || 4;
          info.beatUnit = Number(textOf(time, "beat-type")) || 4;
        }
        for (const clef of children(entry, "clef")) {
          const staff = Number(clef.attrs.number ?? 1) - 1;
          if (barIndex === 0)
            info.clefDrop[staff] = Number(textOf(clef, "clef-octave-change")) === -1;
        }
      } else if (entry.tag === "backup")
        position -= Number(textOf(entry, "duration")) / divisions;
      else if (entry.tag === "forward")
        position += Number(textOf(entry, "duration")) / divisions;
      else if (entry.tag === "note" && !child(entry, "grace")) {
        const length = Number(textOf(entry, "duration")) / divisions || 0;
        const stacked = !!child(entry, "chord");
        const at = stacked ? last : position;
        if (!stacked) {
          last = position;
          position += length;
        }
        const pitch = child(entry, "pitch");
        const step = textOf(pitch, "step"),
          alter = Math.round(Number(textOf(pitch, "alter")) || 0),
          octave = Number(textOf(pitch, "octave"));
        const ties = children(entry, "tie").map((tie) => tie.attrs.type);
        const stem = textOf(entry, "stem");
        const staff = Number(textOf(entry, "staff") || 1) - 1;
        // Each verse is its own <lyric>; a syllable split by an elision has several <text>s.
        const verses: string[] = [];
        children(entry, "lyric").forEach((line, order) => {
          const verse = Math.max(1, Number(line.attrs.number) || order + 1);
          const words = children(line, "text").map((piece) => piece.text.trim()).filter(Boolean).join("‿");
          if (words) verses[verse - 1] = words;
        });
        for (let i = 0; i < verses.length; i++) verses[i] ??= "";
        const lyric = verses.find(Boolean) ?? "";
        ((staves[staff] ??= [])[barIndex] ??= []).push({
          at: snap(at),
          length: snap(length),
          midi: pitch ? (octave + 1) * 12 + STEPS[step] + alter : null,
          step,
          alter,
          octave,
          tieStart: ties.includes("start"),
          tieStop: ties.includes("stop"),
          lyric: lyric || undefined,
          verses: verses.length ? verses : undefined,
          voice: textOf(entry, "voice") || "1",
          staff,
          stemUp: stem === "up" ? true : stem === "down" ? false : null,
        });
      }
    }
  });
  const bars = info.numbers.length;
  return { staves: staves.map((staff) => Array.from({ length: bars }, (_, i) => staff?.[i] ?? [])), info };
}

/** Split one staff into an upper and a lower part, sweeping strays back in. */
function splitStaff(bars: Raw[][]) {
  const counts = new Map<string, number>();
  for (const bar of bars)
    for (const note of bar)
      if (note.midi !== null) counts.set(note.voice, (counts.get(note.voice) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  let moved = 0;
  const pitchOf = (voice: string) =>
    median(bars.flat().filter((n) => n.voice === voice && n.midi !== null).map((n) => n.midi!));
  // Two real voices: the higher one is the upper part.
  const two = ranked.length >= 2 && ranked[1][1] >= ranked[0][1] * 0.3;
  const [upperVoice, lowerVoice] = two
    ? pitchOf(ranked[0][0]) >= pitchOf(ranked[1][0])
      ? [ranked[0][0], ranked[1][0]]
      : [ranked[1][0], ranked[0][0]]
    : [ranked[0]?.[0] ?? "1", ""];
  const upper: ChartNote[][] = [],
    lower: ChartNote[][] = [];
  bars.forEach((bar, index) => {
    const up: Raw[] = [],
      down: Raw[] = [];
    const overlaps = (list: Raw[], note: Raw) =>
      list.some((held) => held.at < note.at + note.length && note.at < held.at + held.length);
    const strays: Raw[] = [];
    if (two) {
      for (const note of bar)
        if (note.voice === upperVoice) up.push(note);
        else if (note.voice === lowerVoice) down.push(note);
        else strays.push(note);
    } else {
      // Both parts were written as one stack of notes: top note up, bottom note down.
      const starts = new Map<number, Raw[]>();
      for (const note of bar)
        if (note.voice === upperVoice) starts.set(note.at, [...(starts.get(note.at) ?? []), note]);
        else strays.push(note);
      for (const stack of starts.values()) {
        const sorted = [...stack].sort((a, b) => (b.midi ?? -1) - (a.midi ?? -1));
        up.push(sorted[0]);
        down.push(sorted[sorted.length - 1]);
      }
    }
    // A rest never keeps a sung note out of a part.
    const sounding = (list: Raw[], note: Raw) =>
      list.some(
        (held) =>
          held.midi !== null && held.at < note.at + note.length && note.at < held.at + held.length,
      );
    const place = (list: Raw[], note: Raw) => {
      for (let i = list.length - 1; i >= 0; i--)
        if (list[i].midi === null && overlaps([list[i]], note)) list.splice(i, 1);
      list.push(note);
      moved++;
    };
    for (const note of strays) {
      if (note.midi === null) continue;
      const order = (note.stemUp ?? true) ? [up, down] : [down, up];
      const target = order.find((list) => !sounding(list, note));
      if (target) {
        place(target, note);
        continue;
      }
      // A stray carrying words is a sung note whose held neighbour was read too long:
      // end the held note where this one begins.
      if (note.lyric) {
        const list = order[0];
        const held = list.filter((n) => n.midi !== null && overlaps([n], note));
        if (held.every((n) => n.at < note.at)) {
          for (const n of held) n.length = snap(note.at - n.at);
          place(list, note);
        }
      }
    }
    // Within one part, a stack keeps its outer note.
    const tidy = (list: Raw[], top: boolean) => {
      const byStart = new Map<number, Raw>();
      for (const note of list) {
        const held = byStart.get(note.at);
        const wins =
          !held ||
          (held.midi === null && note.midi !== null) ||
          (note.midi !== null && held.midi !== null && (top ? note.midi > held.midi : note.midi < held.midi));
        const [kept, lost] = wins ? [note, held] : [held, note];
        // The outer note stays, and keeps the words of the note it replaced.
        if (lost && !kept.lyric && lost.lyric) {
          kept.lyric = lost.lyric;
          kept.verses = lost.verses;
        }
        byStart.set(note.at, kept);
      }
      return [...byStart.values()].sort((a, b) => a.at - b.at);
    };
    upper[index] = tidy(up, true);
    lower[index] = tidy(down, false);
  });
  return { upper, lower, moved };
}

const filled = (notes: ChartNote[]) =>
  notes.length ? snap(Math.max(...notes.map((note) => note.at + note.length))) : 0;

/**
 * Even out a bar the scanner got almost right. A scan often loses a dot or a
 * small rest that is plainly on the page, so a part stops short of the barline.
 * When at least one part fills the bar, the others are mended the way a singer
 * would read the page: a note that starts with the others' held chord but stops
 * a beat early takes their length; anything else short gets its missing rest;
 * a last note that spills over the barline is cut back. A part with no notes,
 * or a note that starts past the barline, is left alone and stays flagged.
 */
function evenOut(parts: ChartNote[][], length: number) {
  const mended = { lengthened: 0, rests: 0, trimmed: 0 };
  if (!parts.some((part) => part.length && filled(part) === length)) return { parts, mended };
  const out = parts.map((part, index) => {
    if (!part.length || part.some((note) => note.at >= length - 1e-6)) return part;
    const end = filled(part);
    if (end > length) {
      mended.trimmed++;
      return part.map((note) =>
        note.at + note.length > length ? { ...note, length: snap(length - note.at) } : note,
      );
    }
    if (end === length) return part;
    const last = part.find((note) => snap(note.at + note.length) === end)!;
    const held = parts.filter(
      (other, at) =>
        at !== index &&
        other.some(
          (note) => note.midi !== null && note.at === last.at && snap(note.at + note.length) === length,
        ),
    ).length;
    if (last.midi !== null && held >= 2) {
      mended.lengthened++;
      return part.map((note) => (note === last ? { ...note, length: snap(length - note.at) } : note));
    }
    mended.rests++;
    const rest: ChartNote = {
      at: end,
      length: snap(length - end),
      midi: null,
      step: "",
      alter: 0,
      octave: 0,
      tieStart: false,
      tieStop: false,
    };
    return [...part, rest];
  });
  return { parts: out, mended };
}

/**
 * `lowerTop` overrides Lumina's own guess about whether the top staff
 * sounds an octave below where it is written.
 */
export function readChart(source: string, lowerTop?: boolean): Chart {
  const root = child(parseXml(source), "score-partwise");
  if (!root) throw new Error("This doesn't look like a MusicXML score.");
  const read = children(root, "part").map(readStaves);
  if (!read.length) throw new Error("This score has no parts in it.");
  const info = read[0].info;
  const staves = read.flatMap((part) => part.staves);
  const drops = read.flatMap((part) => part.staves.map((_, i) => part.info.clefDrop[i] ?? false));
  // Four separate staves are four parts already; otherwise split the top two.
  let parts: ChartNote[][][];
  let moved = 0;
  if (staves.length >= 4) {
    parts = staves.slice(0, 4).map((staff) => splitStaff(staff).upper);
  } else {
    const top = splitStaff(staves[0]),
      bottom = splitStaff(staves[1] ?? staves[0].map(() => []));
    moved = top.moved + bottom.moved;
    parts = [top.upper, top.lower, bottom.upper, bottom.lower];
  }
  const barLength = (info.beats * 4) / info.beatUnit;
  const count = info.numbers.length;
  // Rejoin bars the scanner cut in two at the end of a line.
  const joined: { number: string; parts: ChartNote[][]; edge: boolean; afterEdge: boolean }[] = [];
  let rejoined = 0;
  const lengthOf = (index: number) =>
    Math.max(...parts.map((part) => filled(part[index] ?? [])));
  for (let index = 0; index < count; index++) {
    const here = lengthOf(index);
    const next = index + 1 < count ? lengthOf(index + 1) : 0;
    const sectionEdge = info.sectionEnd[index] === true;
    if (
      index > 0 &&
      !sectionEdge &&
      here > 0 &&
      here < barLength &&
      next > 0 &&
      snap(here + next) === barLength
    ) {
      joined.push({
        number: info.numbers[index],
        edge: info.sectionEnd[index + 1] === true,
        afterEdge: info.sectionEnd[index - 1] === true,
        parts: parts.map((part) => [
          ...part[index],
          ...part[index + 1].map((note) => ({ ...note, at: snap(note.at + here) })),
        ]),
      });
      rejoined++;
      index++;
    } else
      joined.push({
        number: info.numbers[index],
        edge: sectionEdge,
        afterEdge: index > 0 && info.sectionEnd[index - 1] === true,
        parts: parts.map((part) => part[index] ?? []),
      });
  }
  // A top staff that sits far above the bottom one was written an octave up.
  const sounding = (part: number) =>
    median(joined.flatMap((bar) => bar.parts[part]).filter((n) => n.midi !== null).map((n) => n.midi!));
  const marked = drops[0] === true;
  const lowered =
    !marked &&
    (lowerTop ?? (staves.length < 4 && sounding(1) - sounding(2) >= 10));
  const shift = (note: ChartNote): ChartNote =>
    note.midi === null ? note : { ...note, midi: note.midi - 12, octave: note.octave - 1 };
  const mended = { lengthened: 0, rests: 0, trimmed: 0 };
  const bars: ChartBar[] = joined.map((bar, index) => {
    const shifted = bar.parts.map((part, at) => (lowered && at < 2 ? part.map(shift) : part));
    const raw = shifted.filter((part) => part.length).map(filled);
    const longest = Math.max(0, ...raw);
    const pickup = index === 0 && longest > 0 && longest < barLength;
    // Songs end a verse on a short bar and start the chorus with a pickup.
    const partial = !pickup && longest > 0 && longest < barLength && (bar.edge || bar.afterEdge);
    const length = pickup || partial ? longest : barLength;
    const even = evenOut(shifted, length);
    mended.lengthened += even.mended.lengthened;
    mended.rests += even.mended.rests;
    mended.trimmed += even.mended.trimmed;
    const four = even.parts as ChartBar["parts"];
    const lengths = four.filter((part) => part.length).map(filled);
    return {
      number: bar.number,
      parts: four,
      length,
      pickup,
      partial: partial || undefined,
      uneven: lengths.length < 4 || lengths.some((each) => each !== length),
    };
  });
  const title =
    textOf(walk(root, "work"), "work-title") || textOf(root, "movement-title");
  const creators = children(child(root, "identification"), "creator");
  return {
    title,
    composer: (creators.find((c) => c.attrs.type === "composer") ?? creators[0])?.text.trim() ?? "",
    fifths: info.fifths,
    beats: info.beats,
    beatUnit: info.beatUnit,
    bars,
    octaveTreble: marked || lowered,
    loweredTop: lowered,
    voices:
      marked || lowered
        ? ["Tenor", "Lead", "Bari", "Bass"]
        : ["Soprano", "Alto", "Tenor", "Bass"],
    repairs: {
      rejoinedBars: rejoined,
      movedNotes: moved,
      lengthenedNotes: mended.lengthened,
      filledRests: mended.rests,
      trimmedNotes: mended.trimmed,
      unevenBars: bars.filter((bar) => bar.uneven).length,
    },
  };
}
