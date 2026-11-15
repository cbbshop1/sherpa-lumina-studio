// "What next" suggestions: a few natural moves from where the learner is now,
// carrying their chord, scale, note, or take along with them.

export type Room =
  | "piano"
  | "chords"
  | "scales"
  | "progressions"
  | "pitch-pipe"
  | "see-the-sound"
  | "tone"
  | "own-sound"
  | "studio";

/** Things the strip does on the spot instead of moving to another room. */
export type StepAction =
  | "play-target"
  | "show-spectrum"
  | "show-waveform"
  | "show-pitch";

export type NextStep = {
  id: string;
  label: string;
  hint: string;
  to?: string;
  action?: StepAction;
};

export type StepState = {
  /** Display name of the current selection, e.g. "C major". Empty if none. */
  selection: string;
  selectionKind: "chord" | "note" | "scale";
  hasTake: boolean;
  /** The open take's shelf id, so it can be carried to the four-track. */
  takeId?: string | null;
  /** Own-sound view only: which picture of the take is showing. */
  scope?: "pitch" | "waveform" | "spectrum";
};

const RECORD = "/pitch-pipe?view=waveform&source=microphone";
const SEE_TONE = "/pitch-pipe?view=waveform&source=studio";

export function roomFromLocation(pathname: string, search: string): Room {
  const path = pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);
  if (path === "/pitch-pipe") {
    const view = params.get("view");
    if (view === "tone") return "tone";
    if (view === "waveform")
      return params.get("source") === "microphone"
        ? "own-sound"
        : "see-the-sound";
    return "pitch-pipe";
  }
  if (path === "/studio") return "studio";
  if (path === "/chords" || path === "/scales" || path === "/progressions")
    return path.slice(1) as Room;
  return "piano";
}

/** At most three steps, most useful first. Never suggests the room you're in. */
export function nextSteps(room: Room, state: StepState): NextStep[] {
  const steps: NextStep[] = [];
  const it = state.selection || "it";
  const chosen = !!state.selection;

  if (room === "own-sound") {
    if (chosen)
      steps.push({
        id: "sing-again",
        label: state.hasTake ? `Hear ${it}, then sing again` : `Hear ${it} first`,
        hint: state.hasTake
          ? "Play the target, then record a new take to compare on your shelf."
          : "Get the sound in your ear before you record.",
        action: "play-target",
      });
    if (state.hasTake && state.takeId)
      steps.push({
        id: "tape",
        label: "Put it on a tape track",
        hint: "Make it one voice of a four-part song.",
        to: `/studio?take=${encodeURIComponent(state.takeId)}`,
      });
    if (state.hasTake)
      steps.push(
        state.scope === "waveform"
          ? {
              id: "pitch",
              label: "Check your pitch",
              hint: "See which notes you sang and how close you came.",
              action: "show-pitch",
            }
          : state.scope === "spectrum"
          ? {
              id: "waveform",
              label: "Back to the waveform",
              hint: "See the shape of your take over time.",
              action: "show-waveform",
            }
          : {
              id: "spectrum",
              label: "Look inside your tone",
              hint: "Press play to see which frequencies your voice made.",
              action: "show-spectrum",
            },
      );
    steps.push({
      id: "piano",
      label: chosen ? `Find ${it} on the piano` : "Pick a note on the piano",
      hint: chosen
        ? "See where those notes live on the keyboard."
        : "Choose a note to sing, then come back and record.",
      to: "/piano",
    });
    return steps.slice(0, 3);
  }

  if (!chosen) {
    if (room !== "chords")
      steps.push({
        id: "chords",
        label: "Choose a chord",
        hint: "Pick something to hear, and it will follow you around.",
        to: "/chords",
      });
    steps.push({
      id: "record",
      label: "Record your own sound",
      hint: "Sing a few notes and see their shape.",
      to: RECORD,
    });
    return steps.slice(0, 3);
  }

  steps.push({
    id: "record",
    label: `Sing ${it} and record`,
    hint: "Hear it, sing it back, and see how close you came.",
    to: RECORD,
  });
  if (room !== "see-the-sound")
    steps.push({
      id: "see",
      label: `See ${it} as a waveform`,
      hint: "Every sound has a shape. Look at this one.",
      to: SEE_TONE,
    });
  if (room === "see-the-sound")
    steps.push({
      id: "tone",
      label: "Change its character",
      hint: "Same notes, a different voice. Try a square or sawtooth.",
      to: "/pitch-pipe?view=tone",
    });
  if (room !== "piano")
    steps.push({
      id: "piano",
      label: `Find ${it} on the piano`,
      hint: "See where those notes live on the keyboard.",
      to: "/piano",
    });
  if (room === "piano" && state.selectionKind !== "scale")
    steps.push({
      id: "scales",
      label: "Find a scale that fits",
      hint: "See which notes belong with this one.",
      to: "/scales",
    });
  return steps.slice(0, 3);
}
