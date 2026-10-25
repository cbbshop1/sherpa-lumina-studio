type Reader = Pick<Storage, "getItem">;
export function isSavedChord(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const chord = value as Record<string, unknown>;
  return (
    typeof chord.id === "string" &&
    typeof chord.name === "string" &&
    Array.isArray(chord.notes) &&
    chord.notes.every((note) => typeof note === "string")
  );
}
export function isProgression(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const progression = value as Record<string, unknown>;
  return (
    typeof progression.id === "string" &&
    typeof progression.name === "string" &&
    Array.isArray(progression.chords) &&
    progression.chords.every(isSavedChord)
  );
}
export function readMusic<T>(
  storage: Reader,
  key: string,
  validate: (value: unknown) => boolean,
): { value: T[]; readable: boolean } {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { value: [], readable: true };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validate))
      return { value: [], readable: false };
    return { value: parsed, readable: true };
  } catch {
    return { value: [], readable: false };
  }
}
