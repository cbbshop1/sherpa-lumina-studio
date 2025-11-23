import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Play, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface Chord {
  name: string;
  suffix: string;
  notes: string[];
}

const getChordNotes = (root: string): Chord[] => {
  const rootIndex = KEYS.indexOf(root);
  
  const getNote = (semitones: number): string => {
    const index = (rootIndex + semitones) % 12;
    return KEYS[index];
  };

  return [
    { name: "Major", suffix: "", notes: [root, getNote(4), getNote(7)] },
    { name: "Minor", suffix: "m", notes: [root, getNote(3), getNote(7)] },
    { name: "Dominant 7", suffix: "7", notes: [root, getNote(4), getNote(7), getNote(10)] },
    { name: "Major 7", suffix: "maj7", notes: [root, getNote(4), getNote(7), getNote(11)] },
    { name: "Minor 7", suffix: "m7", notes: [root, getNote(3), getNote(7), getNote(10)] },
    { name: "Diminished", suffix: "dim", notes: [root, getNote(3), getNote(6)] },
    { name: "Augmented", suffix: "aug", notes: [root, getNote(4), getNote(8)] },
    { name: "Sus2", suffix: "sus2", notes: [root, getNote(2), getNote(7)] },
    { name: "Sus4", suffix: "sus4", notes: [root, getNote(5), getNote(7)] },
    { name: "6", suffix: "6", notes: [root, getNote(4), getNote(7), getNote(9)] },
    { name: "Minor 6", suffix: "m6", notes: [root, getNote(3), getNote(7), getNote(9)] },
    { name: "9", suffix: "9", notes: [root, getNote(4), getNote(7), getNote(10), getNote(14)] },
  ];
};

interface ChordLibraryProps {
  onChordSelect: (notes: string[], chordName: string) => void;
  selectedChordNotes: string[];
  onPlayChord: (notes: string[]) => void;
  onAddFavorite: (name: string, notes: string[]) => void;
  isFavorite: (name: string) => boolean;
}

const ChordLibrary = ({ onChordSelect, selectedChordNotes, onPlayChord, onAddFavorite, isFavorite }: ChordLibraryProps) => {
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState("C");
  const chords = getChordNotes(selectedKey);

  const handleChordClick = (chord: Chord) => {
    const chordName = `${selectedKey}${chord.suffix}`;
    onChordSelect(chord.notes, chordName);
  };

  const handleAddFavorite = (chord: Chord) => {
    const chordName = `${selectedKey}${chord.suffix}`;
    onAddFavorite(chordName, chord.notes);
    toast({
      title: "Chord saved!",
      description: `${chordName} added to favorites`,
    });
  };

  const isChordSelected = (notes: string[]) => {
    if (notes.length !== selectedChordNotes.length) return false;
    return notes.every(note => selectedChordNotes.includes(note));
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
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
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
              return (
                <div key={chord.name} className="relative group">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleChordClick(chord)}
                    className="w-full h-auto py-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <BookOpen className="w-4 h-4" />
                    <div className="flex flex-col items-center">
                      <span className="font-bold">
                        {selectedKey}{chord.suffix}
                      </span>
                      <span className="text-xs opacity-80">
                        {chord.name}
                      </span>
                    </div>
                    <span className="text-xs opacity-60">
                      {chord.notes.join(" - ")}
                    </span>
                  </Button>
                  <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayChord(chord.notes);
                      }}
                      className="w-8 h-8 rounded-full shadow-lg"
                      title="Play chord"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant={isFav ? "default" : "secondary"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddFavorite(chord);
                      }}
                      className="w-8 h-8 rounded-full shadow-lg"
                      title={isFav ? "Already in favorites" : "Add to favorites"}
                      disabled={isFav}
                    >
                      <Heart className={`w-3 h-3 ${isFav ? "fill-current" : ""}`} />
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
