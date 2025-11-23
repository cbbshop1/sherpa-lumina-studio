import { useState } from "react";
import Hero from "@/components/Hero";
import PianoKeyboard from "@/components/PianoKeyboard";
import ChordLibrary from "@/components/ChordLibrary";
import ScaleExplorer from "@/components/ScaleExplorer";
import { usePianoAudio } from "@/hooks/usePianoAudio";

const Index = () => {
  const [highlightedNotes, setHighlightedNotes] = useState<string[]>([]);
  const [libraryChordName, setLibraryChordName] = useState<string>("");
  const { playChordNote, stopAllNotes } = usePianoAudio();

  const handleChordSelect = (notes: string[], chordName: string) => {
    setHighlightedNotes(notes);
    setLibraryChordName(chordName);
  };

  const handlePlayChord = (notes: string[]) => {
    // Stop any currently playing notes
    stopAllNotes();
    
    // Play each note in the chord with a slight delay for a strummed effect
    notes.forEach((note, index) => {
      setTimeout(() => {
        playChordNote(note, false);
      }, index * 50); // 50ms delay between each note
    });

    // Stop the chord after 2 seconds
    setTimeout(() => {
      stopAllNotes();
    }, 2000);
  };

  return (
    <div className="min-h-screen">
      <Hero />
      <PianoKeyboard 
        highlightedNotes={highlightedNotes} 
        libraryChordName={libraryChordName}
      />
      <ChordLibrary 
        onChordSelect={handleChordSelect}
        selectedChordNotes={highlightedNotes}
        onPlayChord={handlePlayChord}
      />
      <ScaleExplorer />
    </div>
  );
};

export default Index;
