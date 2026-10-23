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
import { ROOT_SPELLINGS, chordsForRoot } from "../lib/musicNotation";
import { formatNote } from "../lib/noteSelection";

const KEYS = ROOT_SPELLINGS;
const getChordNotes = chordsForRoot;
type Chord = ReturnType<typeof chordsForRoot>[number];

interface ChordLibraryProps {
  initialKey?: string;
  onChordSelect: (notes: string[], chordName: string) => void;
  selectedChordNotes: string[];
  onPlayChord: (notes: string[], name?: string) => void;
  playingChordName?: string;
  onAddFavorite: (name: string, notes: string[]) => void;
  isFavorite: (name: string) => boolean;
}

const ChordLibrary = ({
  initialKey = "C",
  onChordSelect,
  selectedChordNotes,
  onPlayChord,
  playingChordName,
  onAddFavorite,
  isFavorite,
}: ChordLibraryProps) => {
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState(
    KEYS.includes(initialKey) ? initialKey : "C",
  );
  const chords = getChordNotes(selectedKey);

  const handleChordClick = (chord: Chord) => {
    const chordName = `${selectedKey}${chord.suffix}`;
    // Toggle selection - clicking same chord again deselects it
    if (isChordSelected(chord.notes)) {
      onChordSelect([], "");
    } else {
      onChordSelect(chord.notes, chordName);
    }
  };

  const handleAddFavorite = (chord: Chord) => {
    const chordName = `${selectedKey}${chord.suffix}`;
    onAddFavorite(chordName, chord.notes);
    toast({
      title: "Chord saved!",
      description: `${formatNote(chordName)} added to favorites`,
    });
  };

  const isChordSelected = (notes: string[]) => {
    if (notes.length !== selectedChordNotes.length) return false;
    return notes.every((note) => selectedChordNotes.includes(note));
  };

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Chord <span className="gradient-text">Library</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Browse common chords and see them highlighted on the piano
          </p>
        </div>

        <Card className="glass-effect p-8 rounded-3xl">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-foreground">
              Select Key
            </label>
            <Select
              value={selectedKey}
              onValueChange={(nextKey) => {
                const activeIndex = chords.findIndex((chord) =>
                  isChordSelected(chord.notes),
                );
                setSelectedKey(nextKey);
                if (activeIndex >= 0) {
                  const nextChord = getChordNotes(nextKey)[activeIndex];
                  onChordSelect(
                    nextChord.notes,
                    `${nextKey}${nextChord.suffix}`,
                  );
                }
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue>{formatNote(selectedKey)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {formatNote(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {chords.map((chord) => {
              const isSelected = isChordSelected(chord.notes);
              const chordName = `${selectedKey}${chord.suffix}`;
              const isFav = isFavorite(chordName);
              const isPlaying = isSelected && playingChordName === chordName;
              return (
                <div key={chord.name} className="relative group">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleChordClick(chord)}
                    className="chord-choice w-full h-auto py-4 flex flex-col items-center gap-2 transition-all duration-200"
                    aria-pressed={isSelected}
                    aria-label={`Select ${formatNote(chordName)} ${chord.name}`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <div className="flex flex-col items-center">
                      <span className="font-bold">
                        {formatNote(selectedKey)}
                        {chord.suffix}
                      </span>
                      <span className="text-xs opacity-80">{chord.name}</span>
                    </div>
                    <span className="text-xs opacity-60">
                      {chord.spellings.map(formatNote).join(" · ")}
                    </span>
                  </Button>
                  <div
                    className={`chord-card-actions absolute -top-2 -right-2 flex gap-1 transition-opacity ${isPlaying ? "is-playing" : ""}`}
                  >
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayChord(chord.notes, chordName);
                      }}
                      className="w-8 h-8 rounded-full shadow-lg"
                      title={isPlaying ? "Stop chord" : "Play chord"}
                      aria-pressed={isPlaying}
                      aria-label={`${isPlaying ? "Stop" : "Play"} ${formatNote(chordName)} ${chord.name}`}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddFavorite(chord);
                      }}
                      className="w-8 h-8 rounded-full shadow-lg"
                      title={
                        isFav ? "Already in favorites" : "Add to favorites"
                      }
                      aria-label={
                        isFav
                          ? `${formatNote(chordName)} already in favorites`
                          : `Save ${formatNote(chordName)} to favorites`
                      }
                      disabled={isFav}
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
};

export default ChordLibrary;
