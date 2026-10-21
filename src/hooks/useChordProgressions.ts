import { useState, useEffect } from "react";
import { readMusic, isSavedChord, isProgression } from "../lib/musicStorage";

export interface SavedChord {
  id: string;
  name: string;
  notes: string[];
}

export interface ChordProgression {
  id: string;
  name: string;
  chords: SavedChord[];
}

const STORAGE_KEYS = {
  FAVORITES: "piano-favorites",
  PROGRESSIONS: "piano-progressions",
};

export const useChordProgressions = () => {
  const read = <T>(
    key: string,
    validate: (value: unknown) => boolean,
  ): { value: T[]; readable: boolean } => {
    try {
      return readMusic<T>(localStorage, key, validate);
    } catch {
      return { value: [], readable: false };
    }
  };
  const [initialFavorites] = useState(() =>
    read<SavedChord>(STORAGE_KEYS.FAVORITES, isSavedChord),
  );
  const [initialProgressions] = useState(() =>
    read<ChordProgression>(STORAGE_KEYS.PROGRESSIONS, isProgression),
  );
  const [favorites, setFavorites] = useState<SavedChord[]>(
    initialFavorites.value,
  );
  const [progressions, setProgressions] = useState<ChordProgression[]>(
    initialProgressions.value,
  );
  const [storageError, setStorageError] = useState(
    !initialFavorites.readable || !initialProgressions.readable
      ? "Some saved music could not be read. The original saved data has been kept; new edits may only last for this session."
      : "",
  );

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!initialFavorites.readable) return;
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch {
      setStorageError(
        "Browser storage is unavailable. New favorites and progressions will only last for this session.",
      );
    }
  }, [favorites, initialFavorites.readable]);

  useEffect(() => {
    if (!initialProgressions.readable) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.PROGRESSIONS,
        JSON.stringify(progressions),
      );
    } catch {
      setStorageError(
        "Browser storage is unavailable. New favorites and progressions will only last for this session.",
      );
    }
  }, [progressions, initialProgressions.readable]);

  const addFavorite = (name: string, notes: string[]) => {
    const newFavorite: SavedChord = {
      id: Date.now().toString(),
      name,
      notes,
    };
    setFavorites((prev) => [...prev, newFavorite]);
  };

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== id));
  };

  const isFavorite = (name: string) => {
    return favorites.some((fav) => fav.name === name);
  };

  const createProgression = (name: string) => {
    const newProgression: ChordProgression = {
      id: Date.now().toString(),
      name,
      chords: [],
    };
    setProgressions((prev) => [...prev, newProgression]);
    return newProgression.id;
  };

  const deleteProgression = (id: string) => {
    setProgressions((prev) => prev.filter((prog) => prog.id !== id));
  };

  const addChordToProgression = (progressionId: string, chord: SavedChord) => {
    setProgressions((prev) =>
      prev.map((prog) =>
        prog.id === progressionId
          ? { ...prog, chords: [...prog.chords, chord] }
          : prog,
      ),
    );
  };

  const removeChordFromProgression = (
    progressionId: string,
    chordIndex: number,
  ) => {
    setProgressions((prev) =>
      prev.map((prog) =>
        prog.id === progressionId
          ? {
              ...prog,
              chords: prog.chords.filter((_, idx) => idx !== chordIndex),
            }
          : prog,
      ),
    );
  };

  const reorderChordInProgression = (
    progressionId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    setProgressions((prev) =>
      prev.map((prog) => {
        if (prog.id !== progressionId) return prog;
        const newChords = [...prog.chords];
        const [removed] = newChords.splice(fromIndex, 1);
        newChords.splice(toIndex, 0, removed);
        return { ...prog, chords: newChords };
      }),
    );
  };

  return {
    favorites,
    progressions,
    storageError,
    addFavorite,
    removeFavorite,
    isFavorite,
    createProgression,
    deleteProgression,
    addChordToProgression,
    removeChordFromProgression,
    reorderChordInProgression,
  };
};
