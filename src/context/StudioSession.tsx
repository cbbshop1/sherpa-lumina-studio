import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AudioEngine, type SoundSettings } from "../lib/studioAudio";
import { midiToFrequency, voiceNotes } from "../lib/noteSelection";
import { useChordProgressions } from "../hooks/useChordProgressions";
import { useLocation } from "react-router-dom";

export type Selection = {
  name: string;
  notes: string[];
  kind: "chord" | "note" | "scale";
  frequency?: number;
};
const INITIAL_SOUND: SoundSettings = {
  waveform: "sine",
  volume: 0.3,
  cutoff: 6000,
  attack: 0.02,
  release: 0.2,
};
function useSessionState() {
  const [selection, setSelection] = useState<Selection>({
    name: "C major",
    notes: ["C", "E", "G"],
    kind: "chord",
  });
  const [sound, setSound] = useState(INITIAL_SOUND);
  const [octave, setOctave] = useState(4);
  const [strum, setStrum] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const engine = useRef<AudioEngine | null>(null);
  const latest = useRef({ selection, sound, octave, strum });
  latest.current = { selection, sound, octave, strum };
  const request = useRef(0);
  const active = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const library = useChordProgressions();
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const stop = useCallback(() => {
    ++request.current;
    active.current = false;
    clearTimers();
    engine.current?.stop(latest.current.sound.release);
    setPlaying(false);
  }, [clearTimers]);
  const play = useCallback(async (override?: Selection) => {
    const value = latest.current;
    const target = override || value.selection;
    if (!target.notes.length) return;
    const token = ++request.current;
    active.current = true;
    setError("");
    try {
      if (!engine.current) engine.current = new AudioEngine();
      const frequencies = target.frequency
        ? [target.frequency]
        : voiceNotes(target.notes, value.octave).map(midiToFrequency);
      const started = await engine.current.play(
        frequencies,
        value.sound,
        value.strum,
      );
      if (token !== request.current || !started) return;
      setAnalyser(engine.current.getAnalyser());
      setPlaying(true);
    } catch {
      if (token === request.current) {
        active.current = false;
        setPlaying(false);
        setError(
          "Audio could not start. Try Play again in a browser with Web Audio support.",
        );
      }
    }
  }, []);
  const select = useCallback(
    (next: Selection) => {
      setSelection(next);
      latest.current.selection = next;
      if (active.current) {
        clearTimers();
        if (next.notes.length) void play(next);
        else stop();
      }
    },
    [play, stop, clearTimers],
  );
  const updateSound = useCallback((patch: Partial<SoundSettings>) => {
    const next = { ...latest.current.sound, ...patch };
    latest.current.sound = next;
    setSound(next);
    engine.current?.update(next);
  }, []);
  const changeOctave = useCallback(
    (next: number) => {
      latest.current.octave = next;
      setOctave(next);
      if (active.current) void play();
    },
    [play],
  );
  const playProgression = useCallback(
    (chords: { name: string; notes: string[] }[], duration: number) => {
      stop();
      if (!chords.length || !Number.isFinite(duration) || duration < 250)
        return;
      chords.forEach((chord, i) => {
        timers.current.push(
          setTimeout(() => {
            const next: Selection = { ...chord, kind: "chord" };
            setSelection(next);
            latest.current.selection = next;
            void play(next);
          }, i * duration),
        );
      });
      timers.current.push(setTimeout(stop, chords.length * duration));
    },
    [stop, play],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    const onHide = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      clearTimers();
      engine.current?.dispose();
    };
  }, [stop, clearTimers]);
  return {
    selection,
    select,
    sound,
    updateSound,
    octave,
    setOctave: changeOctave,
    strum,
    setStrum,
    playing,
    play,
    stop,
    playProgression,
    analyser,
    error,
    library,
    resetSound: () => updateSound(INITIAL_SOUND),
  };
}
type Session = ReturnType<typeof useSessionState>;
const Context = createContext<Session | null>(null);
export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionState();
  const { pathname } = useLocation();
  const { stop } = session;
  useEffect(() => {
    stop();
  }, [pathname, stop]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useStudioSession() {
  const session = useContext(Context);
  if (!session) throw new Error("StudioSessionProvider is missing");
  return session;
}
