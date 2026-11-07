// The shelf keeps every take a learner makes, so a recording made in one room
// can be picked up in another and survives a refresh. Takes live only in this
// browser (IndexedDB). Nothing is uploaded anywhere.

export type TakeSource = "microphone" | "import";

export type TakeMeta = {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  channels: number;
  source: TakeSource;
  /** What was selected in Lumina when the take was made, e.g. "C major". */
  target?: string;
  bytes: number;
  type: string;
};

export type TakeRecord = TakeMeta & { blob: Blob };

export const MAX_TAKES = 40;
export const MAX_SHELF_BYTES = 200 * 1024 * 1024;
export const MAX_NAME_LENGTH = 60;

export interface TakeStore {
  readonly persistent: boolean;
  list(): Promise<TakeRecord[]>;
  put(take: TakeRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

export function isTakeRecord(value: unknown): value is TakeRecord {
  if (!value || typeof value !== "object") return false;
  const take = value as Record<string, unknown>;
  return (
    typeof take.id === "string" &&
    typeof take.name === "string" &&
    typeof take.createdAt === "number" &&
    typeof take.duration === "number" &&
    typeof take.channels === "number" &&
    (take.source === "microphone" || take.source === "import") &&
    typeof take.bytes === "number" &&
    typeof take.type === "string" &&
    (take.target === undefined || typeof take.target === "string") &&
    typeof Blob !== "undefined" &&
    take.blob instanceof Blob
  );
}

/** Newest first, the way a learner looks for the take they just made. */
export function sortTakes<T extends Pick<TakeMeta, "createdAt">>(takes: T[]) {
  return [...takes].sort((a, b) => b.createdAt - a.createdAt);
}

/** "Take 1", "Take 2"… never reusing a number that is still on the shelf. */
export function nextTakeName(takes: Pick<TakeMeta, "name">[]) {
  let highest = 0;
  for (const { name } of takes) {
    const match = /^Take (\d+)$/.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `Take ${highest + 1}`;
}

export function cleanName(name: string, fallback: string) {
  const cleaned = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return cleaned || fallback;
}

/** Explains, in plain words, why a take can't be shelved, or returns "". */
export function shelfRoomProblem(
  takes: Pick<TakeMeta, "bytes">[],
  incomingBytes: number,
) {
  if (takes.length >= MAX_TAKES)
    return `Your shelf holds up to ${MAX_TAKES} takes. Delete one you no longer need, then try again.`;
  const used = takes.reduce((sum, take) => sum + take.bytes, 0);
  if (used + incomingBytes > MAX_SHELF_BYTES)
    return "Your shelf is full. Delete a few longer takes, then try again.";
  return "";
}

export function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

export function newTakeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `take-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Used when the browser refuses storage (some private windows). Takes then
 * last until the tab closes, and the shelf says so. */
export class MemoryTakeStore implements TakeStore {
  readonly persistent = false;
  private takes = new Map<string, TakeRecord>();
  async list() {
    return [...this.takes.values()];
  }
  async put(take: TakeRecord) {
    this.takes.set(take.id, take);
  }
  async remove(id: string) {
    this.takes.delete(id);
  }
}

const DB_NAME = "lumina-shelf";
const STORE = "takes";

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbTakeStore implements TakeStore {
  readonly persistent = true;
  private db: IDBDatabase;
  private constructor(db: IDBDatabase) {
    this.db = db;
  }
  static async open() {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE))
        open.result.createObjectStore(STORE, { keyPath: "id" });
    };
    return new IndexedDbTakeStore(await request(open));
  }
  private store(mode: IDBTransactionMode) {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }
  async list() {
    const all = await request(this.store("readonly").getAll());
    // Skip anything unreadable instead of failing the whole shelf.
    return (all as unknown[]).filter(isTakeRecord);
  }
  async put(take: TakeRecord) {
    await request(this.store("readwrite").put(take));
  }
  async remove(id: string) {
    await request(this.store("readwrite").delete(id));
  }
}

export async function openTakeStore(): Promise<TakeStore> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("unavailable");
    return await IndexedDbTakeStore.open();
  } catch {
    return new MemoryTakeStore();
  }
}
