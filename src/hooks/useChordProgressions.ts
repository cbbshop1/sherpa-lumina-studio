import { useState, useEffect } from "react";

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
  const [favorites, setFavorites] = useState<SavedChord[]>([]);
  const [progressions, setProgressions] = useState<ChordProgression[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    const savedProgressions = localStorage.getItem(STORAGE_KEYS.PROGRESSIONS);

    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
    if (savedProgressions) {
      setProgressions(JSON.parse(savedProgressions));
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROGRESSIONS, JSON.stringify(progressions));
  }, [progressions]);

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
          : prog
      )
    );
  };

  const removeChordFromProgression = (progressionId: string, chordIndex: number) => {
    setProgressions((prev) =>
      prev.map((prog) =>
        prog.id === progressionId
          ? { ...prog, chords: prog.chords.filter((_, idx) => idx !== chordIndex) }
          : prog
      )
    );
  };

  const reorderChordInProgression = (
    progressionId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    setProgressions((prev) =>
      prev.map((prog) => {
        if (prog.id !== progressionId) return prog;
        const newChords = [...prog.chords];
        const [removed] = newChords.splice(fromIndex, 1);
        newChords.splice(toIndex, 0, removed);
        return { ...prog, chords: newChords };
      })
    );
  };

  return {
    favorites,
    progressions,
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
