import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Play, Square, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ROOT_SPELLINGS,
  chordsForRoot,
  spelledChordNotes,
} from "../lib/musicNotation";
import { formatNote } from "../lib/noteSelection";
import type { SavedChord } from "../hooks/useChordProgressions";

export default function ChordLibrary({
  initialKey = "C",
  onChordSelect,
  selectedChordNotes,
  onPlayChord,
  playingChordName,
  onToggleFavorite,
  isFavorite,
  favorites,
}: {
  initialKey?: string;
  onChordSelect: (notes: string[], name: string) => void;
  selectedChordNotes: string[];
  onPlayChord: (notes: string[], name?: string) => void;
  playingChordName?: string;
  onToggleFavorite: (name: string, notes: string[]) => void;
  isFavorite: (name: string) => boolean;
  favorites: SavedChord[];
}) {
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState(
    ROOT_SPELLINGS.includes(initialKey) ? initialKey : "C",
  );
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const chords = chordsForRoot(selectedKey);
  const saved = [
    ...new Map(favorites.map((chord) => [chord.name, chord])).values(),
  ];
  const rows = onlyFavorites
    ? saved.map((chord) => ({
        ...chord,
        label: "Saved chord",
        spellings: spelledChordNotes(chord.name, chord.notes),
      }))
    : chords.map((chord) => ({
        id: selectedKey + chord.suffix,
        name: selectedKey + chord.suffix,
        label: chord.name,
        notes: chord.notes,
        spellings: chord.spellings,
      }));
  const selected = (notes: string[]) =>
    notes.length === selectedChordNotes.length &&
    notes.every((note) => selectedChordNotes.includes(note));
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <Card className="glass-effect p-8 rounded-3xl">
          <div className="chord-library-toolbar">
            <div
              className="scope-switch"
              role="group"
              aria-label="Chord collection"
            >
              <button
                aria-pressed={!onlyFavorites}
                className={!onlyFavorites ? "active" : ""}
                onClick={() => setOnlyFavorites(false)}
              >
                All chords
              </button>
              <button
                aria-pressed={onlyFavorites}
                className={onlyFavorites ? "active" : ""}
                onClick={() => setOnlyFavorites(true)}
              >
                Favorites ({saved.length})
              </button>
            </div>
            {!onlyFavorites && (
              <label className="chord-root-label">
                Root
                <Select
                  value={selectedKey}
                  onValueChange={(next) => {
                    const index = chords.findIndex((chord) =>
                      selected(chord.notes),
                    );
                    setSelectedKey(next);
                    if (index >= 0) {
                      const chord = chordsForRoot(next)[index];
                      onChordSelect(chord.notes, next + chord.suffix);
                    }
                  }}
                >
                  <SelectTrigger aria-label="Chord root" className="w-32">
                    <SelectValue>{formatNote(selectedKey)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROOT_SPELLINGS.map((root) => (
                      <SelectItem key={root} value={root}>
                        {formatNote(root)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
          <p className="favorite-hint">
            {onlyFavorites
              ? "Your saved chords from every root. Tap a filled heart to remove one."
              : "Tap a heart to save a chord. Tap it again to unfavorite."}
          </p>
          {onlyFavorites && !rows.length && (
            <div className="favorites-empty">
              <Heart size={26} />
              <h2>No favorites yet</h2>
              <p>Find a chord you like in All chords and tap its heart.</p>
              <button onClick={() => setOnlyFavorites(false)}>
                Browse all chords
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((chord) => {
              const isSelected = selected(chord.notes),
                isFav = isFavorite(chord.name),
                isPlaying = isSelected && playingChordName === chord.name;
              return (
                <div key={chord.id} className="relative group">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    className="chord-choice w-full h-auto py-4 flex flex-col items-center gap-2"
                    aria-pressed={isSelected}
                    aria-label={`Select ${formatNote(chord.name)} ${chord.label}`}
                    onClick={() =>
                      onChordSelect(
                        isSelected ? [] : chord.notes,
                        isSelected ? "" : chord.name,
                      )
                    }
                  >
                    <BookOpen className="w-4 h-4" />
                    <span className="font-bold">{formatNote(chord.name)}</span>
                    <span className="text-xs opacity-80">{chord.label}</span>
                    <span className="text-xs opacity-60">
                      {chord.spellings.map(formatNote).join(" · ")}
                    </span>
                  </Button>
                  <div
                    className={`chord-card-actions absolute -top-2 -right-2 flex gap-1 transition-opacity ${isPlaying ? "is-playing" : ""} ${isFav ? "is-favorite" : ""}`}
                  >
                    <Button
                      size="icon"
                      variant="secondary"
                      className="w-8 h-8 rounded-full shadow-lg"
                      aria-pressed={isPlaying}
                      aria-label={`${isPlaying ? "Stop" : "Play"} ${formatNote(chord.name)} ${chord.label}`}
                      onClick={() => onPlayChord(chord.notes, chord.name)}
                    >
                      {isPlaying ? (
                        <Square className="w-3 h-3" fill="currentColor" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant={isFav ? "default" : "secondary"}
                      className="w-8 h-8 rounded-full shadow-lg"
                      aria-pressed={isFav}
                      title={
                        isFav ? "Remove from favorites" : "Add to favorites"
                      }
                      aria-label={
                        isFav
                          ? `Remove ${formatNote(chord.name)} from favorites`
                          : `Save ${formatNote(chord.name)} to favorites`
                      }
                      onClick={() => {
                        onToggleFavorite(chord.name, chord.notes);
                        toast({
                          title: isFav ? "Chord unfavorited" : "Chord saved",
                          description: `${formatNote(chord.name)} ${isFav ? "removed from" : "added to"} favorites`,
                        });
                      }}
                    >
                      <Heart
                        className={`w-3 h-3 ${isFav ? "fill-current" : ""}`}
                      />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}
