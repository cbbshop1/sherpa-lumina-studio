import { useState } from "react";
import { spelledChordNotes } from "../lib/musicNotation";
import { formatNote } from "../lib/noteSelection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Play,
  Plus,
  Trash2,
  Music2,
  ArrowUp,
  ArrowDown,
  Save,
} from "lucide-react";
import { SavedChord, ChordProgression } from "@/hooks/useChordProgressions";
import { useStudioSession } from "@/context/StudioSession";

interface ChordProgressionBuilderProps {
  onPlayProgression: (chords: SavedChord[], duration: number) => void;
  favorites: SavedChord[];
}

const ChordProgressionBuilder = ({
  onPlayProgression,
  favorites,
}: ChordProgressionBuilderProps) => {
  const {
    library: {
      progressions,
      createProgression,
      deleteProgression,
      addChordToProgression,
      removeChordFromProgression,
      reorderChordInProgression,
    },
  } = useStudioSession();
  const [newProgressionName, setNewProgressionName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProgression, setSelectedProgression] = useState<string | null>(
    null,
  );
  const [chordDuration, setChordDuration] = useState(2);

  const handleCreateProgression = () => {
    if (newProgressionName.trim()) {
      const id = createProgression(newProgressionName.trim());
      setNewProgressionName("");
      setIsCreateDialogOpen(false);
      setSelectedProgression(id);
    }
  };

  const handleAddChord = (chord: SavedChord) => {
    if (selectedProgression) {
      addChordToProgression(selectedProgression, chord);
    }
  };

  const handlePlayProgression = (progression: ChordProgression) => {
    if (progression.chords.length > 0) {
      onPlayProgression(progression.chords, chordDuration * 1000);
    }
  };

  const currentProgression = progressions.find(
    (p) => p.id === selectedProgression,
  );

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Chord <span className="gradient-text">Progressions</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Create and play custom chord progressions
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Progressions List */}
          <Card className="glass-effect p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Music2 className="w-5 h-5" />
                My Progressions
              </h3>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Progression</DialogTitle>
                    <DialogDescription>
                      Give your chord progression a name
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="e.g., I-IV-V-I"
                      value={newProgressionName}
                      onChange={(e) => setNewProgressionName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleCreateProgression()
                      }
                    />
                    <Button
                      onClick={handleCreateProgression}
                      className="w-full"
                    >
                      Create Progression
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              {progressions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No progressions yet</p>
                  <p className="text-sm">Create your first progression!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {progressions.map((progression) => (
                    <Card
                      key={progression.id}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedProgression === progression.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedProgression(progression.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold">{progression.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {progression.chords.length} chord
                            {progression.chords.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayProgression(progression);
                            }}
                            disabled={progression.chords.length === 0}
                            aria-label={`Play progression ${progression.name}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete progression ${progression.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProgression(progression.id);
                              if (selectedProgression === progression.id) {
                                setSelectedProgression(null);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Progression Builder */}
          <Card className="glass-effect p-6 rounded-3xl">
            <h3 className="text-xl font-bold mb-4">
              {currentProgression
                ? `Editing: ${currentProgression.name}`
                : "Select a Progression"}
            </h3>

            {currentProgression ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium whitespace-nowrap">
                    Chord Duration:
                  </label>
                  <Input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={chordDuration}
                    onChange={(e) =>
                      setChordDuration(parseFloat(e.target.value))
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>

                <ScrollArea className="h-[200px] pr-4">
                  {currentProgression.chords.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Add chords from your favorites below
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentProgression.chords.map((chord, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground">
                                {idx + 1}.
                              </span>
                              <div>
                                <p className="font-bold">
                                  {formatNote(chord.name)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {spelledChordNotes(chord.name, chord.notes)
                                    .map(formatNote)
                                    .join(" · ")}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Move ${formatNote(chord.name)} earlier`}
                                onClick={() =>
                                  reorderChordInProgression(
                                    selectedProgression!,
                                    idx,
                                    Math.max(0, idx - 1),
                                  )
                                }
                                disabled={idx === 0}
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Move ${formatNote(chord.name)} later`}
                                onClick={() =>
                                  reorderChordInProgression(
                                    selectedProgression!,
                                    idx,
                                    Math.min(
                                      currentProgression.chords.length - 1,
                                      idx + 1,
                                    ),
                                  )
                                }
                                disabled={
                                  idx === currentProgression.chords.length - 1
                                }
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Remove ${formatNote(chord.name)} from progression`}
                                onClick={() =>
                                  removeChordFromProgression(
                                    selectedProgression!,
                                    idx,
                                  )
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Add from Favorites
                  </h4>
                  <ScrollArea className="h-[120px]">
                    {favorites.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No favorite chords yet. Save some from the Chord
                        Library!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {favorites.map((chord) => (
                          <Button
                            key={chord.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddChord(chord)}
                            className="justify-start"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {formatNote(chord.name)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select or create a progression to start building</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ChordProgressionBuilder;
