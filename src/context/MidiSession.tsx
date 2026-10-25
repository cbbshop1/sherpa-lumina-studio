import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useMidiKeyboard } from "../hooks/useMidiKeyboard";
import { LiveMidiEngine, MidiRouter, type MidiTarget } from "../lib/liveMidi";
import { useStudioSession } from "./StudioSession";

function useMidiState() {
  const { pathname } = useLocation();
  const { instrument, sound, stop: stopPreview } = useStudioSession();
  const [enabled, setEnabled] = useState(true);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [audioError, setAudioError] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const [live] = useState(() => new LiveMidiEngine());
  const [router] = useState(() => new MidiRouter(live));
  const held = useRef(new Set<number>());
  const panic = useCallback(() => {
    router.stop();
    held.current.clear();
    setActiveNotes([]);
  }, [router]);
  const unlock = useCallback(async () => {
    try {
      await live.unlock();
      setAudioReady(true);
      setAudioError("");
    } catch {
      setAudioError("Sound could not start. Try Enable MIDI sound again.");
    }
  }, [live]);
  useEffect(() => {
    live.setInstrument(instrument);
  }, [live, instrument]);
  useEffect(() => {
    live.parameter("volume", sound.volume);
  }, [live, sound.volume]);
  useEffect(() => {
    panic();
  }, [pathname, panic]);
  useEffect(() => {
    const stop = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        panic();
        stopPreview();
      }
    };
    const hide = () => {
      if (document.hidden) panic();
    };
    // A normal interaction unlocks browser audio before the next hardware note.
    const gesture = () => {
      if (enabled && !audioReady) void unlock();
    };
    window.addEventListener("keydown", stop);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pointerdown", gesture);
    return () => {
      window.removeEventListener("keydown", stop);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pointerdown", gesture);
    };
  }, [panic, stopPreview, unlock, enabled, audioReady]);
  useEffect(
    () => () => {
      router.stop();
      live.dispose();
    },
    [router, live],
  );
  const midi = useMidiKeyboard({
    enabled,
    onNotePress: (note, velocity) => {
      held.current.add(note);
      setActiveNotes([...held.current]);
      void router.noteOn(note, velocity).catch(() => {
        panic();
        setAudioError("MIDI sound could not start. Try Enable MIDI sound.");
      });
    },
    onNoteRelease: (note) => {
      router.noteOff(note);
      held.current.delete(note);
      setActiveNotes([...held.current]);
    },
    onPitchBend: (value) => router.parameter("pitchBend", value),
    onCC: (number, value) => {
      if (number === 64) router.parameter("sustain", value);
      if (number === 120 || number === 123) panic();
    },
    onReset: panic,
  });
  const registerTarget = useCallback(
    (target: MidiTarget) => {
      held.current.clear();
      setActiveNotes([]);
      return router.register(target);
    },
    [router],
  );
  const toggleEnabled = useCallback(() => {
    panic();
    setEnabled((value) => !value);
    if (!enabled) void unlock();
  }, [enabled, panic, unlock]);
  return {
    ...midi,
    enabled,
    toggleEnabled,
    activeNotes,
    panic,
    unlock,
    audioReady,
    audioError,
    registerTarget,
  };
}
const MidiContext = createContext<ReturnType<typeof useMidiState> | null>(null);
export function MidiSessionProvider({ children }: { children: ReactNode }) {
  const midi = useMidiState();
  return <MidiContext.Provider value={midi}>{children}</MidiContext.Provider>;
}
export function useMidiSession() {
  const midi = useContext(MidiContext);
  if (!midi) throw new Error("MidiSessionProvider is missing");
  return midi;
}
