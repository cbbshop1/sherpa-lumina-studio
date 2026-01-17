import { useState, useRef, useCallback } from "react";
import AppNavigation from "@/components/AppNavigation";
import PitchPipeHero from "@/components/pitch-pipe/PitchPipeHero";
import ToneGenerator from "@/components/pitch-pipe/ToneGenerator";
import AudioVisualizer from "@/components/pitch-pipe/AudioVisualizer";
import KeySelector from "@/components/pitch-pipe/KeySelector";
import ChordBuilder from "@/components/pitch-pipe/ChordBuilder";
import { frequencyToNote } from "@/utils/pitchPipeAudio";

const PitchPipe = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isVisualizerActive, setIsVisualizerActive] = useState(false);
  const [selectedNote, setSelectedNote] = useState("A");
  const [selectedOctave, setSelectedOctave] = useState(4);
  const [currentFrequency, setCurrentFrequency] = useState(440);

  // Initialize AudioContext on first user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
      return ctx;
    }
    return audioContext;
  }, [audioContext]);

  // Handle click on the page to initialize audio context
  const handlePageClick = useCallback(() => {
    initAudioContext();
  }, [initAudioContext]);

  // Handle analyser connection from ToneGenerator
  const handleAnalyserConnect = useCallback((newAnalyser: AnalyserNode) => {
    setAnalyser(newAnalyser);
    setIsVisualizerActive(true);
  }, []);

  // Handle frequency change from KeySelector
  const handleFrequencyChange = useCallback((frequency: number) => {
    setCurrentFrequency(frequency);
    const noteInfo = frequencyToNote(frequency);
    setSelectedNote(noteInfo.note);
    setSelectedOctave(noteInfo.octave);
  }, []);

  return (
    <div className="min-h-screen" onClick={handlePageClick}>
      <AppNavigation />
      
      {/* Add padding for fixed navigation */}
      <div className="pt-16">
        <PitchPipeHero />
        
        <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
          {/* Main grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column: Tone Generator */}
            <ToneGenerator
              audioContext={audioContext}
              onAnalyserConnect={handleAnalyserConnect}
            />
            
            {/* Right column: Key Selector and Chord Builder */}
            <div className="space-y-8">
              <KeySelector
                selectedNote={selectedNote}
                selectedOctave={selectedOctave}
                onNoteChange={setSelectedNote}
                onOctaveChange={setSelectedOctave}
                onFrequencyChange={handleFrequencyChange}
              />
              
              <ChordBuilder audioContext={audioContext} />
            </div>
          </div>
          
          {/* Audio Visualizer - Full width */}
          <AudioVisualizer
            analyser={analyser}
            isActive={isVisualizerActive}
          />
        </div>
      </div>
    </div>
  );
};

export default PitchPipe;
