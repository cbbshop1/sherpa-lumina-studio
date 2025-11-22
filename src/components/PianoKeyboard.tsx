import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePianoAudio } from "@/hooks/usePianoAudio";

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

const PianoKeyboard = () => {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const { playNote } = usePianoAudio();

  const handleNoteClick = (note: string) => {
    playNote(note);
    
    // Add to active notes for visual feedback
    setActiveNotes(prev => new Set([...prev, note]));
    
    // Remove after sound duration (410ms to match ADSR envelope)
    setTimeout(() => {
      setActiveNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(note);
        return newSet;
      });
    }, 410);
  };

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Interactive <span className="gradient-text">Piano</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Click the keys to play notes and visualize scales
          </p>
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
                      ? "bg-primary border-primary shadow-[0_0_30px_hsl(var(--primary))] translate-y-1 scale-105"
                      : "bg-white border-slate-300 hover:bg-slate-50 hover:shadow-lg"
                  )}
                >
                  <span className={cn(
                    "block mt-auto mb-4 text-sm font-semibold",
                    activeNotes.has(key.note) ? "text-primary-foreground" : "text-slate-800"
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
                          ? "bg-secondary border-secondary shadow-[0_0_20px_hsl(var(--secondary))] translate-y-1"
                          : "bg-slate-900 border-slate-950 hover:bg-slate-800 hover:shadow-lg"
                      )}
                    >
                      <span className={cn(
                        "block mt-auto mb-4 text-xs font-semibold",
                        activeNotes.has(key.note) ? "text-secondary-foreground" : "text-slate-200"
                      )}>
                        {key.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Active notes: {activeNotes.size > 0 ? Array.from(activeNotes).join(", ") : "None"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PianoKeyboard;
