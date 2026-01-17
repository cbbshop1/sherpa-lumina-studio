import { useState, useCallback } from "react";
import AppNavigation from "@/components/AppNavigation";
import PitchPipeHero from "@/components/pitch-pipe/PitchPipeHero";
import CircularPitchPipe from "@/components/pitch-pipe/CircularPitchPipe";
import AudioVisualizer from "@/components/pitch-pipe/AudioVisualizer";
import ChordBuilder from "@/components/pitch-pipe/ChordBuilder";
import ToneGenerator from "@/components/pitch-pipe/ToneGenerator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const PitchPipe = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isVisualizerActive, setIsVisualizerActive] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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

  // Handle analyser connection from components
  const handleAnalyserConnect = useCallback((newAnalyser: AnalyserNode) => {
    setAnalyser(newAnalyser);
    setIsVisualizerActive(true);
  }, []);

  return (
    <div className="min-h-screen" onClick={handlePageClick}>
      <AppNavigation />
      
      {/* Add padding for fixed navigation */}
      <div className="pt-16">
        <PitchPipeHero />
        
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
          {/* Main Circular Pitch Pipe */}
          <CircularPitchPipe
            audioContext={audioContext}
            onAnalyserConnect={handleAnalyserConnect}
          />
          
          {/* Waveform Visualizer */}
          <AudioVisualizer
            analyser={analyser}
            isActive={isVisualizerActive}
          />
          
          {/* Chord Builder */}
          <ChordBuilder audioContext={audioContext} />
          
          {/* Advanced Tone Generator (Collapsible) */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full glass-effect rounded-2xl p-4 hover:bg-muted/50 transition-colors">
              <span className="text-lg font-semibold">Advanced Tone Generator</span>
              <ChevronDown 
                className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                  isAdvancedOpen ? 'rotate-180' : ''
                }`} 
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <ToneGenerator
                audioContext={audioContext}
                onAnalyserConnect={handleAnalyserConnect}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default PitchPipe;
