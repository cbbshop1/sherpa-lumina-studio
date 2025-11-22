import { useState } from "react";
import Hero from "@/components/Hero";
import PianoKeyboard from "@/components/PianoKeyboard";
import ChordLibrary from "@/components/ChordLibrary";
import ScaleExplorer from "@/components/ScaleExplorer";

const Index = () => {
  const [highlightedNotes, setHighlightedNotes] = useState<string[]>([]);
  const [libraryChordName, setLibraryChordName] = useState<string>("");

  const handleChordSelect = (notes: string[], chordName: string) => {
    setHighlightedNotes(notes);
    setLibraryChordName(chordName);
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
      />
      <ScaleExplorer />
    </div>
  );
};

export default Index;
