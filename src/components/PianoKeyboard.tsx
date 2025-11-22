import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePianoAudio } from "@/hooks/usePianoAudio";
import { recognizeChord, ChordInfo } from "@/utils/chordRecognition";
import { Music, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const notes = [
  { note: "C", isBlack: false },
  { note: "C#", isBlack: true },
  { note: "D", isBlack: false },
  { note: "D#", isBlack: true },
  { note: "E", isBlack: false },
  { note: "F", isBlack: false },
  { note: "F#", isBlack: true },
  { note: "G", isBlack: false },
  { note: "G#", isBlack: true },
  { note: "A", isBlack: false },
  { note: "A#", isBlack: true },
  { note: "B", isBlack: false },
  { note: "C2", isBlack: false },
];

interface PianoKeyboardProps {
  highlightedNotes?: string[];
  libraryChordName?: string;
}

const PianoKeyboard = ({ highlightedNotes = [], libraryChordName }: PianoKeyboardProps) => {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"single" | "chord">("single");
  const [chordInfo, setChordInfo] = useState<ChordInfo | null>(null);
  const { playNote, playChordNote, stopAllNotes } = usePianoAudio();

  const handleNoteClick = (note: string) => {
    if (mode === "single") {
      // Single note mode - momentary play
      playNote(note);
      
      setActiveNotes(prev => new Set([...prev, note]));
      
      setTimeout(() => {
        setActiveNotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(note);
          return newSet;
        });
      }, 410);
    } else {
      // Chord mode - toggle sustained notes
      const newActiveNotes = new Set(activeNotes);
      const isRemoving = newActiveNotes.has(note);
      
      if (isRemoving) {
        newActiveNotes.delete(note);
        playChordNote(note, true); // Stop the note
      } else {
        newActiveNotes.add(note);
        playChordNote(note, false); // Start the note
      }
      
      setActiveNotes(newActiveNotes);
      
      // Recognize chord
      const chord = recognizeChord(Array.from(newActiveNotes));
      setChordInfo(chord);
    }
  };

  const handleClearChord = () => {
    stopAllNotes();
    setActiveNotes(new Set());
    setChordInfo(null);
  };

  const handleModeChange = (newMode: "single" | "chord") => {
    if (newMode !== mode) {
      stopAllNotes();
      setActiveNotes(new Set());
      setChordInfo(null);
      setMode(newMode);
    }
  };

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Interactive <span className="gradient-text">Piano</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            {mode === "single" 
              ? "Click the keys to play notes" 
              : "Click keys to build chords, click again to remove"}
          </p>
          
          {/* Mode Toggle */}
          <div className="flex justify-center gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => handleModeChange("single")}
              className="gap-2"
            >
              <Music className="w-4 h-4" />
              Single Note
            </Button>
            <Button
              variant={mode === "chord" ? "default" : "outline"}
              onClick={() => handleModeChange("chord")}
              className="gap-2"
            >
              <Music2 className="w-4 h-4" />
              Chord Builder
            </Button>
          </div>
        </div>

        <div className="glass-effect p-8 rounded-3xl">
          <div className="relative h-64 flex justify-center items-end">
            {/* White keys */}
            <div className="flex gap-1">
              {notes.filter(n => !n.isBlack).map((key) => (
                <button
                  key={key.note}
                  onClick={() => handleNoteClick(key.note)}
                  className={cn(
                    "w-16 h-48 rounded-b-lg border-2 transition-all duration-200",
                    activeNotes.has(key.note)
                      ? mode === "chord"
                        ? "bg-accent border-accent shadow-[0_0_30px_hsl(var(--accent))] translate-y-1 scale-105"
                        : "bg-primary border-primary shadow-[0_0_30px_hsl(var(--primary))] translate-y-1 scale-105"
                      : highlightedNotes.includes(key.note)
                      ? "bg-secondary border-secondary shadow-[0_0_20px_hsl(var(--secondary))]"
                      : "bg-white border-slate-300 hover:bg-slate-50 hover:shadow-lg"
                  )}
                >
                  <span className={cn(
                    "block mt-auto mb-4 text-sm font-semibold",
                    activeNotes.has(key.note) 
                      ? mode === "chord" ? "text-accent-foreground" : "text-primary-foreground" 
                      : "text-slate-800"
                  )}>
                    {key.note}
                  </span>
                </button>
              ))}
            </div>

            {/* Black keys */}
            <div className="absolute inset-0 flex justify-center items-start pt-2 pointer-events-none">
              <div className="flex">
                {notes.map((key, index) => {
                  if (!key.isBlack) return <div key={index} className="w-16" />;
                  
                  return (
                    <button
                      key={key.note}
                      onClick={() => handleNoteClick(key.note)}
                      className={cn(
                        "w-10 h-32 rounded-b-lg border-2 -ml-5 z-10 transition-all duration-200 pointer-events-auto",
                        activeNotes.has(key.note)
                          ? mode === "chord"
                            ? "bg-accent border-accent shadow-[0_0_20px_hsl(var(--accent))] translate-y-1"
                            : "bg-secondary border-secondary shadow-[0_0_20px_hsl(var(--secondary))] translate-y-1"
                          : highlightedNotes.includes(key.note)
                          ? "bg-muted border-muted shadow-[0_0_15px_hsl(var(--muted))]"
                          : "bg-slate-900 border-slate-950 hover:bg-slate-800 hover:shadow-lg"
                      )}
                    >
                      <span className={cn(
                        "block mt-auto mb-4 text-xs font-semibold",
                        activeNotes.has(key.note) 
                          ? mode === "chord" ? "text-accent-foreground" : "text-secondary-foreground" 
                          : "text-slate-200"
                      )}>
                        {key.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Library Chord Display */}
          {libraryChordName && highlightedNotes.length > 0 && (
            <div className="mt-8">
              <div className="glass-effect p-6 rounded-2xl border-2 border-secondary/20 animate-fade-in">
                <div className="text-center">
                  <h3 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                    {libraryChordName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Notes: {highlightedNotes.join(" - ")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chord Display */}
          {mode === "chord" && !libraryChordName && (
            <div className="mt-8">
              {chordInfo && chordInfo.notes.length > 0 ? (
                <div className="glass-effect p-6 rounded-2xl border-2 border-accent/20 animate-fade-in">
                  <div className="text-center">
                    <h3 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                      {chordInfo.name}
                    </h3>
                    {chordInfo.inversion > 0 && (
                      <p className="text-sm text-muted-foreground mb-2">
                        ({chordInfo.inversion === 1 ? "1st" : "2nd"} inversion)
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Notes: {chordInfo.notes.join(" - ")}
                    </p>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={handleClearChord}
                      variant="outline"
                      className="gap-2"
                    >
                      Clear Chord
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="glass-effect p-6 rounded-2xl">
                  <p className="text-center text-muted-foreground">
                    Select notes to build a chord
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Single Note Display */}
          {mode === "single" && (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Active notes: {activeNotes.size > 0 ? Array.from(activeNotes).join(", ") : "None"}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PianoKeyboard;
