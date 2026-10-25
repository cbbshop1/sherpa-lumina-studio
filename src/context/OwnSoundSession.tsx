import { createContext, useContext, useState, type ReactNode } from "react";
import type { ToneClip } from "../lib/toneRecording";
const Context = createContext<{
  clip: ToneClip | null;
  setClip: (clip: ToneClip | null) => void;
} | null>(null);
export function OwnSoundProvider({ children }: { children: ReactNode }) {
  const [clip, setClip] = useState<ToneClip | null>(null);
  return (
    <Context.Provider value={{ clip, setClip }}>{children}</Context.Provider>
  );
}
export function useOwnSound() {
  const session = useContext(Context);
  if (!session) throw new Error("OwnSoundProvider missing");
  return session;
}
