// The rhythm engine: any time signature, any grouping of its pulses, a stress
// on every pulse, a subdivision underneath, and a pattern of drum hits on
// top. Pure logic, so it can be tested on its own and shared by the groove
// maker, the four-track, and (later) the tap-along.

export const INSTRUMENTS = [
  { id: "kick", name: "Kick" },
  { id: "snare", name: "Snare" },
  { id: "hat", name: "Hi-hat" },
  { id: "clap", name: "Hand clap" },
  { id: "rim", name: "Rim / clave" },
  { id: "shaker", name: "Shaker" },
  { id: "cowbell", name: "Cowbell" },
] as const;

export type InstrumentId = (typeof INSTRUMENTS)[number]["id"];
export type Stress = "strong" | "medium" | "light";
export type Unit = 2 | 4 | 8 | 16;
export type Subdivision = 1 | 2 | 3 | 4;

export type Meter = {
  /** The top number: how many pulses in a bar. */
  top: number;
  /** The bottom number: which note value gets one pulse. */
  unit: Unit;
  /** How the pulses group, e.g. [2, 2, 3] for 7/8. Always sums to top. */
  groups: number[];
  /** How many grid steps each pulse is split into. */
  subdivision: Subdivision;
  /** One stress per pulse. */
  stresses: Stress[];
};

/** 0 = silent, 1 = a hit, 2 = an accented hit. */
export type Cell = 0 | 1 | 2;

export type Groove = {
  name: string;
  meter: Meter;
  bars: 1 | 2;
  /** Pulses per minute, counted in the meter's own unit. */
  tempo: number;
  /** 0 to 0.5: how far the in-between notes lean late (swing, samba). */
  lean: number;
  /** A soft pulse that sounds the stresses, so the meter can be heard. */
  pulseClick: boolean;
  pattern: Record<InstrumentId, Cell[]>;
};

export const MIN_TOP = 1;
export const MAX_TOP = 16;
export const MIN_TEMPO = 30;
export const MAX_TEMPO = 320;
export const UNITS: Unit[] = [2, 4, 8, 16];
export const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: 1, label: "Pulses only" },
  { value: 2, label: "Split in 2" },
  { value: 3, label: "Split in 3" },
  { value: 4, label: "Split in 4" },
];
export const STORAGE_KEY = "lumina-groove";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Strong on the downbeat, medium where each later group begins, light elsewhere. */
export function defaultStresses(groups: number[]): Stress[] {
  const stresses: Stress[] = [];
  groups.forEach((size, group) => {
    for (let i = 0; i < size; i++)
      stresses.push(i > 0 ? "light" : group === 0 ? "strong" : "medium");
  });
  return stresses;
}

/** The grouping most musicians would reach for first. */
export function defaultGroups(top: number, unit: Unit): number[] {
  if (unit <= 4 || top <= 3) return Array(top).fill(1);
  if (top % 3 === 0) return Array(top / 3).fill(3);
  const groups = Array(Math.floor(top / 2)).fill(2);
  if (top % 2) groups[groups.length - 1] = 3;
  return groups;
}

/** A few musical ways to group an odd or long bar, for the picker. */
export function groupingChoices(top: number, unit: Unit): number[][] {
  const choices: number[][] = [defaultGroups(top, unit)];
  const add = (groups: number[]) => {
    if (sum(groups) === top && !choices.some((c) => c.join() === groups.join()))
      choices.push(groups);
  };
  if (unit <= 4) add(top % 2 ? [] : Array(top / 2).fill(2));
  if (top === 5) [[3, 2], [2, 3]].forEach(add);
  if (top === 6) [[3, 3], [2, 2, 2]].forEach(add);
  if (top === 7) [[2, 2, 3], [3, 2, 2], [2, 3, 2], [3, 4], [4, 3]].forEach(add);
  if (top === 8) [[3, 3, 2], [2, 2, 2, 2], [3, 2, 3]].forEach(add);
  if (top === 9) [[2, 2, 2, 3], [3, 3, 3]].forEach(add);
  if (top === 10) [[3, 3, 2, 2], [2, 3, 2, 3]].forEach(add);
  if (top === 11) [[3, 3, 3, 2], [2, 2, 3, 2, 2]].forEach(add);
  if (top === 12) [[3, 3, 3, 3], [2, 2, 2, 2, 2, 2]].forEach(add);
  if (unit > 4) add(Array(top).fill(1));
  return choices.filter((c) => c.length);
}

/** Reads a grouping typed as "2+2+3". Returns null unless it adds up. */
export function parseGroups(text: string, top: number): number[] | null {
  const parts = text.split("+").map((part) => part.trim());
  if (!parts.length || parts.some((part) => !/^\d+$/.test(part))) return null;
  const groups = parts.map(Number);
  if (groups.some((g) => g < 1) || sum(groups) !== top) return null;
  return groups;
}

export const groupsText = (groups: number[]) => groups.join("+");

export function meterLabel(meter: Meter) {
  const grouped =
    meter.groups.length > 1 && meter.groups.some((g) => g > 1)
      ? ` · ${groupsText(meter.groups)}`
      : "";
  return `${meter.top}/${meter.unit}${grouped}`;
}

const UNIT_NAMES: Record<Unit, string> = {
  2: "half note",
  4: "♩",
  8: "♪",
  16: "16th",
};
export const tempoLabel = (unit: Unit, tempo: number) =>
  `${UNIT_NAMES[unit]} = ${Math.round(tempo)}`;

export function makeMeter(
  top: number,
  unit: Unit,
  subdivision: Subdivision,
  groups = defaultGroups(top, unit),
): Meter {
  return { top, unit, groups, subdivision, stresses: defaultStresses(groups) };
}

export const stepsPerBar = (meter: Meter) => meter.top * meter.subdivision;
export const totalSteps = (groove: Pick<Groove, "meter" | "bars">) =>
  stepsPerBar(groove.meter) * groove.bars;
export const pulseSeconds = (tempo: number) => 60 / tempo;
export const barSeconds = (meter: Meter, tempo: number) =>
  meter.top * pulseSeconds(tempo);
export const loopSeconds = (groove: Pick<Groove, "meter" | "bars" | "tempo">) =>
  barSeconds(groove.meter, groove.tempo) * groove.bars;

/** When a step sounds, in seconds from the start of the loop, with lean applied. */
export function stepTime(
  step: number,
  groove: Pick<Groove, "meter" | "tempo" | "lean">,
) {
  const { subdivision } = groove.meter;
  const stepSec = pulseSeconds(groove.tempo) / subdivision;
  const sub = step % subdivision;
  // Only even splits lean: the "and" of each pair arrives a little late.
  const leans = (subdivision === 2 || subdivision === 4) && sub % 2 === 1;
  return step * stepSec + (leans ? groove.lean * stepSec : 0);
}

/** The stress of the pulse a step starts, or "off" for steps between pulses. */
export function stepStress(step: number, meter: Meter): Stress | "off" {
  if (step % meter.subdivision) return "off";
  const pulse = Math.floor(step / meter.subdivision) % meter.top;
  return meter.stresses[pulse] ?? "light";
}

/** Which group (counting from 0) a step belongs to, for colouring the grid. */
export function stepGroup(step: number, meter: Meter) {
  let pulse = Math.floor(step / meter.subdivision) % meter.top;
  for (let group = 0; group < meter.groups.length; group++) {
    if (pulse < meter.groups[group]) return group;
    pulse -= meter.groups[group];
  }
  return 0;
}

/** How loud a hit is: accents are full, other hits follow the meter's stress. */
export function hitGain(cell: Cell, stress: Stress | "off") {
  if (cell === 0) return 0;
  if (cell === 2) return 1;
  return { strong: 0.85, medium: 0.72, light: 0.6, off: 0.5 }[stress];
}

/** Click a cell: off → hit → accent → off. */
export const nextCell = (cell: Cell): Cell => ((cell + 1) % 3) as Cell;

export function blankPattern(steps: number) {
  return Object.fromEntries(
    INSTRUMENTS.map(({ id }) => [id, Array<Cell>(steps).fill(0)]),
  ) as Record<InstrumentId, Cell[]>;
}

/**
 * Keeps as much of a pattern as still fits when the meter, subdivision or
 * number of bars changes: each hit stays on the same bar, pulse and split.
 */
export function refitPattern(
  pattern: Record<InstrumentId, Cell[]>,
  from: { meter: Meter; bars: number },
  to: { meter: Meter; bars: number },
) {
  const next = blankPattern(stepsPerBar(to.meter) * to.bars);
  const fromSteps = stepsPerBar(from.meter);
  for (const { id } of INSTRUMENTS)
    (pattern[id] ?? []).forEach((cell, step) => {
      if (!cell) return;
      const bar = Math.floor(step / fromSteps);
      const pulse = Math.floor((step % fromSteps) / from.meter.subdivision);
      const sub = step % from.meter.subdivision;
      // Map the split position proportionally (2 → 4 keeps the "and").
      const target = Math.round((sub / from.meter.subdivision) * to.meter.subdivision);
      if (bar >= to.bars || pulse >= to.meter.top || target >= to.meter.subdivision)
        return;
      next[id][bar * stepsPerBar(to.meter) + pulse * to.meter.subdivision + target] =
        cell;
    });
  return next;
}

type Hits = Partial<Record<InstrumentId, number[] | { on: number[]; accent?: number[] }>>;

function preset(
  name: string,
  meter: Meter,
  options: { tempo: number; bars?: 1 | 2; lean?: number; hits: Hits },
): Groove {
  const bars = options.bars ?? 1;
  const pattern = blankPattern(stepsPerBar(meter) * bars);
  for (const [id, value] of Object.entries(options.hits) as [InstrumentId, Hits[InstrumentId]][]) {
    const spec = Array.isArray(value) ? { on: value } : value!;
    spec.on.forEach((step) => (pattern[id][step] = 1));
    spec.accent?.forEach((step) => (pattern[id][step] = 2));
  }
  return {
    name,
    meter,
    bars,
    tempo: options.tempo,
    lean: options.lean ?? 0,
    pulseClick: false,
    pattern,
  };
}

const every = (steps: number, gap = 1, start = 0) =>
  Array.from({ length: Math.ceil((steps - start) / gap) }, (_, i) => start + i * gap);

export function presets(): Groove[] {
  const samba = makeMeter(2, 4, 4);
  // In samba the big surdo lands on beat 2: the second pulse is the strong one.
  samba.stresses = ["medium", "strong"];
  return [
    preset("Rock beat", makeMeter(4, 4, 2), {
      tempo: 100,
      hits: { kick: [0, 4, 5], snare: [2, 6], hat: every(8) },
    }),
    preset("Waltz", makeMeter(3, 4, 1), {
      tempo: 132,
      hits: { kick: { on: [0], accent: [0] }, rim: [1, 2], hat: [0, 1, 2] },
    }),
    preset("Samba", samba, {
      tempo: 96,
      bars: 2,
      lean: 0.12,
      hits: {
        kick: { on: [0, 8], accent: [4, 12] },
        shaker: { on: every(16), accent: [3, 7, 11, 15] },
        rim: [0, 2, 4, 5, 7, 9, 11, 12, 14],
        cowbell: [0, 3, 6, 8, 10, 13],
      },
    }),
    preset("Son clave 3-2", makeMeter(4, 4, 2), {
      tempo: 104,
      bars: 2,
      hits: {
        rim: { on: [0, 3, 6, 10, 12] },
        kick: [3, 6, 11, 14],
        cowbell: every(16, 2),
        shaker: every(16),
      },
    }),
    preset("Son clave 2-3", makeMeter(4, 4, 2), {
      tempo: 104,
      bars: 2,
      hits: {
        rim: { on: [2, 4, 8, 11, 14] },
        kick: [3, 6, 11, 14],
        cowbell: every(16, 2),
        shaker: every(16),
      },
    }),
    preset("6/8 bell pattern", makeMeter(12, 8, 1, [3, 3, 3, 3]), {
      tempo: 270,
      hits: {
        cowbell: { on: [0, 2, 4, 5, 7, 9, 11], accent: [0] },
        kick: [0, 6],
        shaker: every(12),
        clap: [3, 9],
      },
    }),
    preset("7/8 · 2+2+3", makeMeter(7, 8, 1, [2, 2, 3]), {
      tempo: 220,
      hits: { kick: { on: [0], accent: [0] }, snare: [2, 4], hat: every(7), clap: [4] },
    }),
    preset("7/8 · 3+4", makeMeter(7, 8, 1, [3, 4]), {
      tempo: 200,
      hits: { kick: { on: [0], accent: [0] }, snare: [3, 5], hat: every(7), rim: [3] },
    }),
    preset("5/4 · 3+2 swing", makeMeter(5, 4, 2, [3, 2]), {
      tempo: 160,
      lean: 0.33,
      hits: {
        hat: [0, 2, 3, 4, 6, 8, 9],
        kick: [0, 6],
        snare: [4, 8],
        rim: [7],
      },
    }),
    preset("Blank 4/4", makeMeter(4, 4, 2), { tempo: 100, hits: {} }),
  ];
}

export const defaultGroove = () => presets()[0];

const clampNumber = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(high, Math.max(low, value))
    : fallback;

/** Reads a saved groove, falling back to the default if anything is off. */
export function readGroove(raw: unknown): Groove {
  const fallback = defaultGroove();
  let saved: Record<string, unknown>;
  try {
    saved = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  } catch {
    return fallback;
  }
  if (!saved || typeof saved !== "object") return fallback;
  const m = saved.meter as Partial<Meter> | undefined;
  if (!m || typeof m !== "object") return fallback;
  const top = Math.round(clampNumber(m.top, MIN_TOP, MAX_TOP, 0));
  const unit = UNITS.includes(m.unit as Unit) ? (m.unit as Unit) : null;
  const subdivision = [1, 2, 3, 4].includes(m.subdivision as number)
    ? (m.subdivision as Subdivision)
    : null;
  if (!top || !unit || !subdivision) return fallback;
  const groups =
    Array.isArray(m.groups) &&
    m.groups.every((g) => Number.isInteger(g) && g > 0) &&
    sum(m.groups as number[]) === top
      ? (m.groups as number[])
      : defaultGroups(top, unit);
  const stresses =
    Array.isArray(m.stresses) &&
    m.stresses.length === top &&
    m.stresses.every((s) => s === "strong" || s === "medium" || s === "light")
      ? (m.stresses as Stress[])
      : defaultStresses(groups);
  const meter: Meter = { top, unit, groups, subdivision, stresses };
  const bars = saved.bars === 2 ? 2 : 1;
  const steps = stepsPerBar(meter) * bars;
  const pattern = blankPattern(steps);
  const savedPattern = (saved.pattern ?? {}) as Record<string, unknown>;
  for (const { id } of INSTRUMENTS) {
    const row = savedPattern[id];
    if (Array.isArray(row))
      for (let i = 0; i < steps; i++)
        pattern[id][i] = row[i] === 1 || row[i] === 2 ? (row[i] as Cell) : 0;
  }
  return {
    name:
      typeof saved.name === "string" && saved.name.trim()
        ? saved.name.trim().slice(0, 40)
        : "My groove",
    meter,
    bars,
    tempo: Math.round(clampNumber(saved.tempo, MIN_TEMPO, MAX_TEMPO, fallback.tempo)),
    lean: clampNumber(saved.lean, 0, 0.5, 0),
    pulseClick: saved.pulseClick === true,
    pattern,
  };
}
