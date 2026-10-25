export type FavoriteChord = { id: string; name: string; notes: string[] };

// Old libraries can contain duplicates. One unfavorite removes every matching
// saved name without changing chords already used in a progression.
export function toggleFavoriteChord(
  favorites: FavoriteChord[],
  chord: FavoriteChord,
) {
  return favorites.some((favorite) => favorite.name === chord.name)
    ? favorites.filter((favorite) => favorite.name !== chord.name)
    : [...favorites, { ...chord, notes: [...chord.notes] }];
}
