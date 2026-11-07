import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ToneClip } from "../lib/toneRecording";
import {
  cleanName,
  newTakeId,
  nextTakeName,
  openTakeStore,
  shelfRoomProblem,
  sortTakes,
  type TakeMeta,
  type TakeRecord,
  type TakeStore,
} from "../lib/shelf";
import { useStudioSession } from "./StudioSession";

type ShelfStatus = "loading" | "ready";

type ShelfSession = {
  /** The take that is open right now, decoded and ready to draw or play. */
  clip: ToneClip | null;
  activeId: string | null;
  /** Shelving a new clip adds it as a take and opens it. Null just closes it. */
  setClip: (clip: ToneClip | null) => void;
  takes: TakeMeta[];
  status: ShelfStatus;
  /** False when the browser refused storage, so takes end with the tab. */
  persistent: boolean;
  problem: string;
  clearProblem: () => void;
  openTake: (id: string) => Promise<void>;
  renameTake: (id: string, name: string) => void;
  deleteTake: (id: string) => void;
  takeBlob: (id: string) => Blob | null;
  /** Puts audio on the shelf without opening it. Returns its id, or null if
   * the shelf is full (the problem message says why). */
  shelveTake: (
    blob: Blob,
    buffer: AudioBuffer,
    options: { prefix?: string; target?: string },
  ) => string | null;
  /** Decodes a shelf take, for the four-track. */
  takeAudio: (id: string) => Promise<AudioBuffer | null>;
};

const Context = createContext<ShelfSession | null>(null);

async function decode(blob: Blob) {
  // An offline context can decode before the learner has touched the page.
  const context = new OfflineAudioContext(1, 1, 44100);
  return context.decodeAudioData(await blob.arrayBuffer());
}

export { decode as decodeAudio };

export function OwnSoundProvider({ children }: { children: ReactNode }) {
  const { selection } = useStudioSession();
  const [clip, setOpenClip] = useState<ToneClip | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [records, setRecords] = useState<TakeRecord[]>([]);
  const [status, setStatus] = useState<ShelfStatus>("loading");
  const [persistent, setPersistent] = useState(true);
  const [problem, setProblem] = useState("");
  const store = useRef<TakeStore | null>(null);
  const latest = useRef({ records, selection });
  latest.current = { records, selection };
  const openToken = useRef(0);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    let cancelled = false;
    void openTakeStore().then(async (opened) => {
      store.current = opened;
      let loaded: TakeRecord[] = [];
      try {
        loaded = await opened.list();
      } catch {
        if (!cancelled)
          setProblem("Your saved takes could not be read in this browser.");
      }
      if (cancelled) return;
      setPersistent(opened.persistent);
      setRecords(sortTakes(loaded));
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((take: TakeRecord) => {
    void store.current?.put(take).catch(() =>
      setProblem(
        "This take is on your shelf for now, but the browser would not save it. Download it to keep it.",
      ),
    );
  }, []);

  const setClip = useCallback(
    (next: ToneClip | null) => {
      openToken.current++;
      if (!next) {
        setOpenClip(null);
        setActiveId(null);
        return;
      }
      const { records: current, selection: chosen } = latest.current;
      const room = shelfRoomProblem(current, next.blob.size);
      const fromMicrophone = next.name === "My recording";
      const take: TakeRecord = {
        id: newTakeId(),
        name: fromMicrophone
          ? nextTakeName(current)
          : cleanName(next.name.replace(/\.[^.]+$/, ""), nextTakeName(current)),
        createdAt: Date.now(),
        duration: next.buffer.duration,
        channels: next.buffer.numberOfChannels,
        source: fromMicrophone ? "microphone" : "import",
        target: chosen.name || undefined,
        bytes: next.blob.size,
        type: next.blob.type || `audio/${next.extension}`,
        blob: next.blob,
      };
      // A full shelf never loses the fresh take: it stays open, unsaved.
      if (room) {
        setProblem(room);
        setOpenClip({ ...next, name: take.name });
        setActiveId(null);
        return;
      }
      setRecords((list) => [take, ...list]);
      setOpenClip({ ...next, name: take.name });
      setActiveId(take.id);
      save(take);
    },
    [save],
  );

  const openTake = useCallback(async (id: string) => {
    const take = latest.current.records.find((item) => item.id === id);
    if (!take) return;
    const token = ++openToken.current;
    try {
      const buffer = await decode(take.blob);
      if (token !== openToken.current) return;
      setOpenClip({
        blob: take.blob,
        buffer,
        name: take.name,
        extension: take.type.includes("wav") ? "wav" : "webm",
      });
      setActiveId(id);
    } catch {
      if (token === openToken.current)
        setProblem(`"${take.name}" could not be opened in this browser.`);
    }
  }, []);

  const renameTake = useCallback(
    (id: string, name: string) => {
      const take = latest.current.records.find((item) => item.id === id);
      if (!take) return;
      const renamed = { ...take, name: cleanName(name, take.name) };
      setRecords((list) =>
        list.map((item) => (item.id === id ? renamed : item)),
      );
      setOpenClip((open) =>
        open && activeIdRef.current === id
          ? { ...open, name: renamed.name }
          : open,
      );
      save(renamed);
    },
    [save],
  );

  const deleteTake = useCallback((id: string) => {
    setRecords((list) => list.filter((item) => item.id !== id));
    if (activeIdRef.current === id) {
      openToken.current++;
      setOpenClip(null);
      setActiveId(null);
    }
    void store.current?.remove(id).catch(() => {});
  }, []);

  const shelveTake = useCallback(
    (
      blob: Blob,
      buffer: AudioBuffer,
      options: { prefix?: string; target?: string },
    ) => {
      const current = latest.current.records;
      const room = shelfRoomProblem(current, blob.size);
      if (room) {
        setProblem(room);
        return null;
      }
      const name = nextTakeName(current);
      const take: TakeRecord = {
        id: newTakeId(),
        name: options.prefix ? `${options.prefix} · ${name}` : name,
        createdAt: Date.now(),
        duration: buffer.duration,
        channels: buffer.numberOfChannels,
        source: "microphone",
        target: options.target || undefined,
        bytes: blob.size,
        type: blob.type || "audio/wav",
        blob,
      };
      // Update the ref now so two quick takes never get the same number.
      latest.current = { ...latest.current, records: [take, ...current] };
      setRecords((list) => [take, ...list]);
      save(take);
      return take.id;
    },
    [save],
  );

  const takeAudio = useCallback(async (id: string) => {
    const take = latest.current.records.find((item) => item.id === id);
    if (!take) return null;
    try {
      return await decode(take.blob);
    } catch {
      return null;
    }
  }, []);

  const takeBlob = useCallback(
    (id: string) =>
      latest.current.records.find((item) => item.id === id)?.blob ?? null,
    [],
  );

  const takes: TakeMeta[] = records.map(({ blob: _blob, ...meta }) => meta);

  return (
    <Context.Provider
      value={{
        clip,
        activeId,
        setClip,
        takes,
        status,
        persistent,
        problem,
        clearProblem: () => setProblem(""),
        openTake,
        renameTake,
        deleteTake,
        takeBlob,
        shelveTake,
        takeAudio,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useOwnSound() {
  const session = useContext(Context);
  if (!session) throw new Error("OwnSoundProvider missing");
  return session;
}

export const useShelf = useOwnSound;
