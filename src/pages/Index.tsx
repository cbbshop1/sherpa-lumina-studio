import { useState } from "react";
import AppNavigation from "@/components/AppNavigation";
import Hero from "@/components/Hero";
import PianoKeyboard from "@/components/PianoKeyboard";
import ChordLibrary from "@/components/ChordLibrary";
import ChordProgressionBuilder from "@/components/ChordProgressionBuilder";
import ScaleExplorer from "@/components/ScaleExplorer";
import { usePianoAudio } from "@/hooks/usePianoAudio";
import { useChordProgressions, SavedChord } from "@/hooks/useChordProgressions";

const Index = () => {
  const [highlightedNotes, setHighlightedNotes] = useState<string[]>([]);
  const [libraryChordName, setLibraryChordName] = useState<string>("");
  const { playChordNote, stopAllNotes } = usePianoAudio();
  const { favorites, addFavorite, isFavorite } = useChordProgressions();

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

    // Stop the chord and clear highlighting after 2 seconds
    setTimeout(() => {
      stopAllNotes();
      setHighlightedNotes([]);
      setLibraryChordName("");
    }, 2000);
  };

  const handlePlayProgression = (chords: SavedChord[], duration: number) => {
    stopAllNotes();
    
    chords.forEach((chord, index) => {
      setTimeout(() => {
        // Stop previous chord
        if (index > 0) {
          stopAllNotes();
        }
        
        // Play current chord with strum effect
        chord.notes.forEach((note, noteIndex) => {
          setTimeout(() => {
            playChordNote(note, false);
          }, noteIndex * 50);
        });
      }, index * duration);
    });

    // Stop all notes and clear highlighting after the last chord
    setTimeout(() => {
      stopAllNotes();
      setHighlightedNotes([]);
      setLibraryChordName("");
    }, chords.length * duration);
  };

  return (
    <div className="min-h-screen">
      <AppNavigation />
      {/* Add padding for fixed navigation */}
      <div className="pt-16">
        <Hero />
        <div id="piano">
          <PianoKeyboard 
            highlightedNotes={highlightedNotes} 
            libraryChordName={libraryChordName}
          />
        </div>
        <div id="chord-library">
          <ChordLibrary 
            onChordSelect={handleChordSelect}
            selectedChordNotes={highlightedNotes}
            onPlayChord={handlePlayChord}
            onAddFavorite={addFavorite}
            isFavorite={isFavorite}
          />
        </div>
        <ChordProgressionBuilder 
          onPlayProgression={handlePlayProgression}
          favorites={favorites}
        />
        <div id="scale-explorer">
          <ScaleExplorer />
        </div>
      </div>
    </div>
  );
};

export default Index;
